#!/usr/bin/env python3
"""把 src/ 的程式與 vendor/ 的函式庫合併成單一檔案 dist/autoreport.html。
單一檔案的好處：不需安裝、不需網路，雙擊就能在瀏覽器開啟。
用法：python3 build.py
"""
from pathlib import Path

root = Path(__file__).parent
src = root / "src"
html = (src / "index.html").read_text(encoding="utf-8")
css = (src / "styles.css").read_text(encoding="utf-8")
vendor = "\n;\n".join((root / "vendor" / n).read_text(encoding="utf-8") for n in ["jszip.min.js", "exceljs.min.js"])
app = "\n\n".join(f"/* ===== {p.name} ===== */\n" + p.read_text(encoding="utf-8") for p in sorted((src / "js").glob("*.js")))

for name, body in [("vendor", vendor), ("app", app)]:
    if "</script" in body.lower():
        body = body.replace("</script", "<\\/script").replace("</SCRIPT", "<\\/SCRIPT")
    if name == "vendor":
        vendor = body
    else:
        app = body

out = html.replace("/*@@CSS@@*/", css).replace("/*@@VENDOR@@*/", vendor).replace("/*@@APP@@*/", app)
(root / "dist").mkdir(exist_ok=True)
(root / "dist" / "autoreport.html").write_text(out, encoding="utf-8")
print(f"dist/autoreport.html  {len(out.encode('utf-8')) / 1024:.0f} KB")
