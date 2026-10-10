"""Independent byte-level inspection of recovered outputs; no browser or source writes."""
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader
from datetime import datetime, timezone
import hashlib
import io
import json

EVIDENCE = Path('/Users/apple/Documents/Codex/2026-10-04/task/pdfpilot/docs/product-completion/qa-batch2-built')
DEST = Path(__file__).with_name('saved-output-inspection.json')
checks = []
inspected = set()

def read(name):
    inspected.add(name)
    return (EVIDENCE / name).read_bytes()

def pdf(name):
    return PdfReader(io.BytesIO(read(name)))

def archive(name):
    z = ZipFile(io.BytesIO(read(name)))
    assert z.testzip() is None, name + ': CRC error'
    assert len(z.namelist()) == len(set(z.namelist())), name + ': duplicate entries'
    return z

def record(name, **details):
    checks.append({'check': name, 'passed': True, **details})

def outside_whitespace(text):
    json.loads(text)
    parts, quoted, escaped = [], False, False
    for char in text:
        if quoted:
            parts.append(char)
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            parts.append(char)
            quoted = True
        elif char not in ' \t\r\n':
            parts.append(char)
    assert not quoted
    return ''.join(parts)

expected = r'{"id":9007199254740993,"huge":1e1000,"tiny":1e-400,"zero":-0,"x":1,"x":2,"unicode":"नमस्ते 🛫","escape":"\u0041\n\"\\","list":[true,null,{}]}'
for name in ['data/json-formatter.json', 'data/json-minifier.json']:
    text = read(name).decode('utf-8')
    assert outside_whitespace(text) == expected, name
    if 'minifier' in name:
        assert text == expected
    record('Exact JSON tokens', file=name, bytes=len(text.encode('utf-8')))
large = read('data/large-complete.json').decode('utf-8')
expected_large = '[' + ','.join('{"id":9007199254740993,"tiny":1e-400,"label":"नमस्ते '+str(i)+'"}' for i in range(18000)) + ']'
assert large == expected_large
formatted = json.loads(read('data/large-formatted.json'))
assert formatted == {'value': 'x' * 1_100_000, 'end': 'नमस्ते 🛫'}
record('Complete JSON beyond 100k preview', minifier_entries=18000, minifier_bytes=len(large.encode('utf-8')), formatter_value_characters=len(formatted['value']))
assert read('data/json-validator.txt').decode().startswith('Valid JSON syntax.')
invalid = read('data/invalid-report.txt').decode()
assert invalid.startswith('Invalid JSON syntax.') and 'Line 3, column 1.' in invalid
record('Downloaded valid and invalid validation reports')

with archive('data/excel-raw.zip') as z:
    assert z.namelist() == ['workbook_1_Data.xml', 'workbook_2_Other.xml']
    rows = ET.fromstring(z.read(z.namelist()[0])).findall('row')
    assert {e.tag:e.text for e in rows[0]} == {'नाम':'अली & <मूल>', 'Rate':'0.123456', 'Code':'00123', 'Error':'#DIV/0!'}
    assert {e.tag:e.text for e in rows[1]} == {'नाम':'next', 'Rate':'0', 'Code':'false', 'Error':'line\nline'}
    assert ET.fromstring(z.read(z.namelist()[1])).findtext('row/Key') == 'Second sheet'
with archive('data/excel-formatted-headerless.zip') as z:
    roots = [ET.fromstring(z.read(name)) for name in z.namelist()]
    rows = roots[0].findall('row')
    assert rows[0].findtext('field_1') == 'नाम'
    assert rows[1].findtext('field_2') == '12%'
    assert rows[1].findtext('field_4') == '#DIV/0!'
    assert rows[2].findtext('field_3') == 'FALSE'
record('Excel XML ZIPs parse independently', sheets=2, unicode_headings=True, raw_display_values=True, errors_and_escaping=True)
with archive('excel-pdf/worker-xml.zip') as z:
    assert len(z.namelist()) == 2
    roots = [ET.fromstring(z.read(name)) for name in z.namelist()]
    assert roots[0].findtext('row/Value') == '42'
    assert roots[1].findtext('row/field_2') == '73'
workbook_pdf = pdf('excel-pdf/graphics.pdf')
assert len(workbook_pdf.pages) == 2
texts = [p.extract_text() for p in workbook_pdf.pages]
assert 'FIRST SHEET ALPHA' in texts[0] and '42' in texts[0]
assert 'SECOND SHEET BRAVO' in texts[1] and '73' in texts[1]
assert len(workbook_pdf.pages[0].images) >= 2
record('Excel PDF and subsequent XML', pages=2, selectable_text=texts, first_page_embedded_images=len(workbook_pdf.pages[0].images))

with archive('word-cancel/retry-mixed.docx') as z:
    root = ET.fromstring(z.read('word/document.xml'))
    ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    texts = [e.text for e in root.findall('.//w:t', ns)]
    assert texts == ['SELECTABLE COVER ALPHA', 'SCANNED ATTACHMENT BRAVO', 'SELECTABLE END CHARLIE']
    breaks = [e for e in root.findall('.//w:br', ns) if e.get('{'+ns['w']+'}type') == 'page']
    assert len(breaks) == 2
record('Editable mixed DOCX text order', text_runs=texts, explicit_page_breaks=2)

source = pdf('pages/source.pdf')
mappings = {
    'pages/rotated.pdf':[0,1,2,3], 'pages/removed.pdf':[0,2],
    'pages/last-page.pdf':[3], 'pages/selected-merged.pdf':[0,2],
    **{'pages/extract-pages-'+str(i+1)+'.pdf':[i] for i in range(4)},
}
for name, indices in mappings.items():
    result = pdf(name)
    assert len(result.pages) == len(indices)
    for actual, index in zip(result.pages, indices):
        original = source.pages[index]
        assert actual.extract_text() == original.extract_text()
        assert list(actual.mediabox) == list(original.mediabox)
        assert list(actual.cropbox) == list(original.cropbox)
        delta = 90 if name == 'pages/rotated.pdf' else 0
        assert actual.rotation == (original.rotation + delta) % 360
    record('PDF page text, geometry and rotations', file=name, source_pages=[i+1 for i in indices])
with archive('pages/all-pages.zip') as z:
    assert len(z.namelist()) == 4
    for index, name in enumerate(z.namelist()):
        result = PdfReader(io.BytesIO(z.read(name)))
        assert len(result.pages) == 1
        assert result.pages[0].extract_text() == source.pages[index].extract_text()
record('Extract all pages ZIP', count=4, ordered=True)
assert len(pdf('pages/rotate-pdf-retry-rotated.pdf').pages) == 300
assert len(pdf('pages/delete-pages-retry-cancellation-300-pages_removed.pdf').pages) == 299
with archive('pages/extract-pages-retry-cancellation-300-pages_extracted_pages.zip') as z:
    assert len(z.namelist()) == 300
    assert all(len(PdfReader(io.BytesIO(z.read(n))).pages) == 1 for n in z.namelist())
record('Saved retries after cancellation', rotate_pages=300, delete_pages=299, extract_zip_members=300, limitation='Artifact inspection does not itself prove cancellation timing')

def color(page):
    assert len(page.images) == 1
    return page.images[0].image.convert('RGB').resize((1,1)).getpixel((0,0))

ordered = pdf('scan/ordered.pdf')
assert len(ordered.pages) == 2
assert all([float(p.mediabox.width),float(p.mediabox.height)] == [792.0,612.0] for p in ordered.pages)
colors = [color(p) for p in ordered.pages]
assert colors[0][2] > 245 and colors[0][0] < 5
assert colors[1][0] > 245 and colors[1][2] < 5
record('Scan PDF order and Letter landscape dimensions', mean_image_rgb=colors, pages=2)
for name in ['scan/separate.zip', 'scan/jpg-collisions.zip']:
    with archive(name) as z:
        assert len(z.namelist()) == 3
        readers = [PdfReader(io.BytesIO(z.read(n))) for n in z.namelist()]
        assert all(len(r.pages) == 1 for r in readers)
        colors = [color(r.pages[0]) for r in readers]
        assert [max(range(3),key=lambda i: c[i]) for c in colors] == [0,2,0]
        record('Collision-safe ZIP retains red/blue/red images', file=name, members=z.namelist(), mean_image_rgb=colors)
camera = pdf('scan/synthetic-camera.pdf')
assert len(camera.pages) == 1
green = color(camera.pages[0])
assert green[1] > 100 and green[0] < 20 and green[2] < 20
record('Synthetic camera PDF has captured image', mean_image_rgb=green, limitation='No physical camera test')

report = {
    'inspectedAtUtc':datetime.now(timezone.utc).isoformat(),
    'applicationSource':'2ba44383d60fd592843417bf47d6b8cfdfbf8a4c',
    'evidenceRoot':str(EVIDENCE),
    'scope':'Fresh independent inspection of saved 4 October outputs; no fresh browser, processing, deployment or production claims.',
    'checks':checks,
    'files':[{'path':name, 'bytes':(EVIDENCE/name).stat().st_size, 'sha256':hashlib.sha256((EVIDENCE/name).read_bytes()).hexdigest()} for name in sorted(inspected)],
    'status':'passed',
}
DEST.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':'passed','checks':len(checks),'files':len(inspected),'report':str(DEST)}))
