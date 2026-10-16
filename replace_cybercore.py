
import os

base = "E:/Github Code/notdore/"
files = ["index.html","van-ban.html","invoice-ocr.html","invoice-extractor.html","hoa-don-xml.html","merge-excel.html","allocate-import-cost.html"]

changed = []
unchanged = []

for f in files:
    p = base + f
    with open(p, "r", encoding="utf-8") as fh:
        c = fh.read()
    
    if "cybercore.css" in c:
        unchanged.append(f)
        print(f"  {f}: Already has cybercore.css")
        continue
    
    if "cypress.css" in c:
        c = c.replace('href="assets/css/cypress.css"', 'href="assets/css/cybercore.css"')
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(c)
        changed.append(f)
        print(f"  {f}: Replaced cypress.css -> cybercore.css")
    else:
        unchanged.append(f)
        print(f"  {f}: No cypress.css found")

print(f"\n=== Summary ===")
print(f"Changed: {len(changed)}")
print(f"Unchanged: {len(unchanged)}")
print(f"\nChanged files: {changed}")
