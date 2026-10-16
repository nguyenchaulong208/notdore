
import os, re

base = "E:/Github Code/notdore/"
files = ["index.html","van-ban.html","invoice-ocr.html","invoice-extractor.html","hoa-don-xml.html","merge-excel.html","allocate-import-cost.html"]

changed = []
unchanged = []

for f in files:
    p = base + f
    if not os.path.exists(p):
        print(f"  {f}: MISSING")
        continue
    with open(p, "r", encoding="utf-8") as fh:
        c = fh.read()
    
    # Check if already has cybercore.css
    if "cybercore.css" in c:
        unchanged.append(f)
        print(f"  {f}: Already has cybercore.css")
        continue
    
    # Replace anime.css with cybercore.css
    if "anime.css" in c:
        c = c.replace('assets/css/anime.css', 'assets/css/cybercore.css')
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(c)
        changed.append(f)
        print(f"  {f}: Changed anime.css -> cybercore.css")
    else:
        unchanged.append(f)
        print(f"  {f}: No anime.css found")

print(f"\n=== Summary ===")
print(f"Changed: {len(changed)}")
print(f"Unchanged: {len(unchanged)}")
print(f"\nChanged files: {changed}")
