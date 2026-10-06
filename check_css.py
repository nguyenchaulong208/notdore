
import os
base = "E:/Github Code/notdore/"
files = ["index.html","van-ban.html","invoice-ocr.html","invoice-extractor.html","hoa-don-xml.html","merge-excel.html","allocate-import-cost.html"]
for f in files:
    p = base + f
    with open(p, "r", encoding="utf-8") as fh:
        c = fh.read()
    css_refs = [l.strip() for l in c.split("\n") if "css" in l and ("href" in l or "link" in l)]
    print(f"=== {f} ===")
    for ref in css_refs:
        if "css" in ref.lower():
            print(f"  {ref[:100]}")
