#!/usr/bin/env python3
"""
dpgk_sync_player.py - HTML 図解のプレイヤー部分を、assets/player.html の最新版で上書きする

  python3 dpgk_sync_player.py out.html [more.html ...]      # 上書きする
  python3 dpgk_sync_player.py out.html --check              # 古ければ終了コード 1（上書きしない）

player.html の dpgk-player:start〜end で囲んだブロック（CSS / 操作ボタン / プレイヤーのスクリプト）を、
対象ファイルの同じ順番のブロックと入れ替える。図の中身（header、#scene、beats、render）には触れない。
"""

import argparse
import re
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "player.html"
# 図のスタイル側に残った古い書き方のダーク配色（@media の中で :root だけを上書き）を、配色ボタンに従う形に直す
OLD_DARK = re.compile(r"@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}\s*\}")


def fix_dark(text):
    return OLD_DARK.sub(lambda m: (
        f"@media (prefers-color-scheme: dark) {{ :root:not([data-theme=\"light\"]) {{{m.group(1)}}} }}\n"
        f"  :root[data-theme=\"dark\"] {{{m.group(1)}}}"), text)


BLOCK = re.compile(r"(?:/\*|<!--) dpgk-player:start.*?dpgk-player:end (?:\*/|-->)", re.S)


def main():
    ap = argparse.ArgumentParser(description="dpgk プレイヤー部分の同期")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--check", action="store_true", help="古いものを報告するだけ")
    args = ap.parse_args()

    blocks = BLOCK.findall(TEMPLATE.read_text(encoding="utf-8"))
    stale = broken = False
    for f in args.files:
        p = Path(f)
        text = p.read_text(encoding="utf-8")
        found = BLOCK.findall(text)
        if len(found) != len(blocks):
            print(f"{p}: プレイヤーのブロックが {len(found)} 個（ひな形は {len(blocks)} 個）。ひな形から作り直す")
            broken = True
            continue
        if found == blocks and not OLD_DARK.search(text):
            print(f"{p}: 最新")
            continue
        stale = True
        if args.check:
            print(f"{p}: 古い")
            continue
        it = iter(blocks)
        p.write_text(fix_dark(BLOCK.sub(lambda _: next(it), text)), encoding="utf-8")
        print(f"{p}: 更新した")
    sys.exit(1 if broken or (stale and args.check) else 0)


if __name__ == "__main__":
    main()
