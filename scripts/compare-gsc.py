"""Compare a future Page Indexing export without mistaking sample churn for indexing."""
import csv,json,sys
from pathlib import Path
from urllib.parse import urlparse
R=Path(__file__).resolve().parent.parent;D=R/'docs/pseo/indexation/2026-09-29'
new=Path(sys.argv[1]);output=Path(sys.argv[2])
assert not output.exists(),'Choose a new output path; existing evidence is not overwritten.'
def rows(p):return list(csv.DictReader(p.open(encoding='utf-8-sig')))
oldrows=rows(D/'baseline/gsc/Table.csv');newrows=rows(new/'Table.csv')
inv={r['route']:r for r in json.loads((D/'wanted-index-inventory.json').read_text())}
old={r['URL'] for r in oldrows};recent={r['URL'] for r in newrows}
chart=rows(new/'Chart.csv')
result={'baselineExport':'2026-09-29','comparisonDirectory':str(new),'newChartLastPoint':chart[-1] if chart else None,'baselineSampleUrls':len(old),'newSampleUrls':len(recent),'stillInExcludedSample':sorted(old&recent),'newlyInExcludedSample':sorted(recent-old),'noLongerInExcludedSample':sorted(old-recent),'wantedInNewSample':sum(inv.get(urlparse(u).path,{}).get('indexWanted',False) for u in recent),'newSampleUnmappedUrls':sorted(u for u in recent if urlparse(u).path not in inv),'limitation':'Capped sample changes do not establish indexing, recrawling or removal. Compare the same GSC reason and property; obtain indexed-page/URL Inspection and Performance evidence separately.'}
output.write_text(json.dumps(result,indent=2)+'\n');print(output)
