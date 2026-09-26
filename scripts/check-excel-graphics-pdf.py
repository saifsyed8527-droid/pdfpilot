"""Independently inspect and render local PDF downloads for visual review."""
import sys
import json
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

source, output = Path(sys.argv[1]), Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
reader = PdfReader(source)
document = pdfium.PdfDocument(str(source))
tiles = []
counts = {}

def multiply(current, transform):
    a, b, c, d, e, f = current
    g, h, i, j, k, l = transform
    return (a*g+c*h, b*g+d*h, a*i+c*j, b*i+d*j, a*k+c*l+e, b*k+d*l+f)

def bounds(matrix, x, y, width, height):
    a, b, c, d, e, f = matrix
    points = [(a*s+c*t+e, b*s+d*t+f) for s, t in [(x, y), (x+width, y), (x, y+height), (x+width, y+height)]]
    return min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)

def intersect(a, b):
    return max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])

for index, page in enumerate(reader.pages):
    objects = page["/Resources"].get("/XObject", {})
    # Count actual paints, not resources: a cached image can be placed twice.
    # Track the renderer's rectangular clipping/transforms to detect graphics
    # that were embedded but positioned partly outside the physical PDF page.
    matrix, clipping, pending_clip, stack, pictures = (1, 0, 0, 1, 0, 0), None, None, [], 0
    for operands, operator in ContentStream(page.get_contents(), reader).operations:
        if operator == b"q":
            stack.append((matrix, clipping))
        elif operator == b"Q":
            matrix, clipping = stack.pop()
        elif operator == b"cm":
            matrix = multiply(matrix, [float(v) for v in operands])
        elif operator == b"re":
            pending_clip = bounds(matrix, *[float(v) for v in operands])
        elif operator in (b"W", b"W*") and pending_clip:
            clipping = intersect(clipping, pending_clip) if clipping else pending_clip
        elif operator == b"Do" and objects[operands[0]].get_object().get("/Subtype") == "/Image":
            pictures += 1
            box = bounds(matrix, 0, 0, 1, 1)
            if clipping:
                box = intersect(box, clipping)
            assert box[0] >= -0.1 and box[1] >= -0.1 and box[2] <= float(page.mediabox.width) + 0.1 and box[3] <= float(page.mediabox.height) + 0.1, f"Graphic outside page {index + 1}: {box}"
    heading = (page.extract_text() or "").splitlines()[0]
    counts[heading] = counts.get(heading, 0) + pictures
    print(f"Page {index + 1}: {float(page.mediabox.width):.1f} x {float(page.mediabox.height):.1f} pt, {pictures} graphics, {(page.extract_text() or '').splitlines()[0:1]}")
    bitmap = document[index].render(scale=1.3)
    rendered = bitmap.to_pil().convert("RGB")
    rendered.save(output / f"page-{index + 1:02d}.png")
    thumb = rendered.copy()
    thumb.thumbnail((580, 470))
    tile = Image.new("RGB", (600, 500), "#dbe2eb")
    tile.paste(thumb, ((600 - thumb.width) // 2, 24))
    ImageDraw.Draw(tile).text((12, 8), f"Page {index + 1}", fill="black")
    tiles.append(tile)
for start in range(0, len(tiles), 6):
    subset = tiles[start:start + 6]
    contact = Image.new("RGB", (1800, 1000), "white")
    for n, tile in enumerate(subset):
        contact.paste(tile, ((n % 3) * 600, (n // 3) * 500))
    contact.save(output / f"overview-{start // 6 + 1}.png")
if len(sys.argv) > 3:
    expected = json.loads(Path(sys.argv[3]).read_text())
    assert counts == expected, f"Missing/extra drawings or sheets: expected={expected}; actual={counts}"
    print(f"PASS: all {sum(expected.values())} pictures/charts across {len(expected)} sheets are in the PDF")
    text = "".join(page.extract_text() or "" for page in reader.pages)
    compact = "".join(text.split())
    for row in range(10, 85):
        assert f"Row{row:03d}mustsurvive" in compact, f"Missing row {row} at a graphic/page boundary"
    print("PASS: all graphics fit their pages and all 75 long-table row markers survived pagination")
