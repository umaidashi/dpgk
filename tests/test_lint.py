#!/usr/bin/env python3
"""dpgk_lint の回帰テスト。python3 tests/test_lint.py

good/ と assets/ のひな形は指摘ゼロ、bad/ は先頭コメント `<!-- expect: ID ... -->` の ID と完全一致すること。
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills/dpgk/scripts"))
from dpgk_lint import lint  # noqa: E402

fails = 0
good = [*(ROOT / "tests/corpus/good").iterdir(), *(ROOT / "skills/dpgk/assets").iterdir(), *(ROOT / "examples").iterdir()]
for p in [p for p in sorted(good) + sorted((ROOT / "tests/corpus/bad").iterdir()) if p.suffix in (".svg", ".html")]:
    text = p.read_text(encoding="utf-8")
    m = re.search(r"<!-- expect: ([^>]*?) -->", text)
    expected = set(m.group(1).split()) if m else set()
    _, hits = lint(text, p.suffix == ".svg")
    found = {h["id"] for h in hits}
    ok = found == expected
    fails += not ok
    print(f"{'ok  ' if ok else 'FAIL'} {p.relative_to(ROOT)}" + ("" if ok else f"  expected={sorted(expected)} found={sorted(found)}"))

# ひな形から縦向きの viewBox を外すと W-NO-PORTRAIT だけが出ること（ひな形を変えても追従するよう、その場で作る）
tpl = (ROOT / "skills/dpgk/assets/player.html").read_text(encoding="utf-8")
_, hits = lint(re.sub(r' data-viewbox-portrait="[^"]*"', "", tpl, count=1), False)
ok = {h["id"] for h in hits} == {"W-NO-PORTRAIT"}
fails += not ok
print(("ok   " if ok else "FAIL ") + "player.html から縦向きを外すと W-NO-PORTRAIT" + ("" if ok else f"  found={sorted(h['id'] for h in hits)}"))

# 図のスタイルに古い書き方のダーク配色を足すと W-THEME だけが出ること
_, hits = lint(tpl.replace("  /* ここから図のスタイル", "  @media (prefers-color-scheme: dark) { :root { --x: #000; } }\n  /* ここから図のスタイル", 1), False)
ok = {h["id"] for h in hits} == {"W-THEME"}
fails += not ok
print(("ok   " if ok else "FAIL ") + "古い書き方のダーク配色で W-THEME" + ("" if ok else f"  found={sorted(h['id'] for h in hits)}"))

# examples の HTML のプレイヤー部分が、ひな形（assets/player.html）の最新版と一致していること
import subprocess  # noqa: E402
html = sorted(str(p) for p in (ROOT / "examples").glob("*.html"))
r = subprocess.run([sys.executable, str(ROOT / "skills/dpgk/scripts/dpgk_sync_player.py"), "--check", *html], capture_output=True, text=True)
print(("ok   " if r.returncode == 0 else "FAIL ") + "examples のプレイヤーがひな形と一致" + ("" if r.returncode == 0 else "\n" + r.stdout))
fails += r.returncode != 0

sys.exit(1 if fails else 0)
