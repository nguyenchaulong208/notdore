import os, re
base = "E:/Github Code/notdore/"
# But also try the Linux-style path
if not os.path.isdir(base):
    base = "/e/Github Code/notdore/"
files = ["index.html","van-ban.html","tools.html","invoice-ocr.html","invoice-extractor.html","hoa-don-xml.html","merge-excel.html","allocate-import-cost.html"]
for f in files:
    p = os.path.join(base, f)
    if not os.path.exists(p):
        print("MISSING:", p)
        continue
    with open(p, "r", encoding="utf-8") as fh:
        c = fh.read()
    c2 = re.sub(r'<body class="anime-page-[a-zA-Z0-9-]*">', '<body class="anime-page">', c)
    if c2 != c:
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(c2)
        print("Fixed:", f, "at", base)
    else:
        print("Already OK:", f)
