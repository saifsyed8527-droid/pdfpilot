"""Fetch pinned, unmodified OFL Noto fonts used on demand by Edit PDF."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1] / "public/fonts/editor-v1"
REVISIONS = {"noto-fonts": "ffebf8c1ee449e544955a7e813c54f9b73848eac", "noto-cjk": "f8d157532fbfaeda587e826d4cd5b21a49186f7c"}
FAMILIES = ["Bengali", "Gujarati", "Gurmukhi", "Hebrew", "Kannada", "Malayalam", "Tamil", "Telugu", "Thai"]
FILES = [(f"NotoSans{family}-{weight}.ttf", "noto-fonts", f"hinted/ttf/NotoSans{family}/NotoSans{family}-{weight}.ttf") for family in FAMILIES for weight in ["Regular", "Bold"]]
FILES += [(f"NotoSansCJKjp-{weight}.otf", "noto-cjk", f"Sans/OTF/Japanese/NotoSansCJKjp-{weight}.otf") for weight in ["Regular", "Bold"]]
FILES += [("OFL-Noto.txt", "noto-fonts", "LICENSE"), ("OFL-CJK.txt", "noto-cjk", "Sans/LICENSE")]

def fetch(item):
    name, repo, source = item
    url = f"https://raw.githubusercontent.com/notofonts/{repo}/{REVISIONS[repo]}/{source}"
    data = urllib.request.urlopen(url, timeout=90).read()
    (ROOT / name).write_bytes(data)
    return {"file": name, "source": url, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        entries = list(pool.map(fetch, FILES))
    (ROOT / "integrity.json").write_text(json.dumps({"license": "SIL Open Font License 1.1", "sources": REVISIONS, "files": entries}, indent=2) + "\n")
    print(f"Verified source downloads: {len(entries)} files, {sum(e['bytes'] for e in entries):,} bytes")
