#!/usr/bin/env python3
"""
dpgk_snap.py - 動く図解を指定時刻・指定ビートで止めてスクリーンショットを撮る（標準ライブラリ + ローカルの Chrome）

  python3 dpgk_snap.py out.svg                     # ループを 6 等分した時刻 + 動きを減らす設定の静止画
  python3 dpgk_snap.py out.svg --times 0,3.5,9     # 時刻（秒）を指定
  python3 dpgk_snap.py out.html --beats 7          # player.html 形式: #beat=1..7 を撮る
  python3 dpgk_snap.py out.html --beats 7 --width 375
  python3 dpgk_snap.py out.html --beats 7 --width 375 --height 667 --measure   # 画像は撮らず、各ビートの最小文字サイズを測る

SVG は HTML に埋め込み、CSS アニメーション（Web Animations）と SMIL を同じ時刻で一時停止してから撮る。
画像は <出力ファイル名>.snaps/ に保存し、パスを 1 行ずつ出力する。撮れた画像は必ず目で見て確認する。
"""

import argparse
import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dpgk_lint import infinite_animations  # noqa: E402

CHROME_CANDIDATES = [
    os.environ.get("CHROME", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome",
]

FREEZE = """<script>
const t = Number(new URLSearchParams(location.search).get("t") || 0);
for (const s of document.querySelectorAll("svg")) { if (s.pauseAnimations) { s.pauseAnimations(); s.setCurrentTime(t); } }
for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
</script>"""


def find_chrome():
    for c in CHROME_CANDIDATES:
        if c and (Path(c).exists() or shutil.which(c)):
            return c
    sys.exit("Chrome / Chromium が見つからない。環境変数 CHROME にパスを指定する。")


def shoot(chrome, url, png, width, height, reduced=False):
    args = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            f"--window-size={width},{height}", f"--screenshot={png}", url]
    if reduced:
        args.insert(1, "--force-prefers-reduced-motion")
    subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60, check=False)
    print(png if Path(png).exists() else f"失敗: {url}")


def measure(chrome, src, beats, width, height):
    """player.html の #beat=N&measure を iframe で開き、図の中で一番小さい文字の画面上の px を測る。"""
    import json
    if "dpgk-player:start" not in src.read_text(encoding="utf-8"):
        print("測れない: dpgk のプレイヤー（assets/player.html v9 以降）を使っていないページ")
        return
    worst = None
    for i in range(1, beats + 1):
        page = Path(tempfile.mkdtemp()) / "measure.html"
        page.write_text(
            f"<!doctype html><body style='margin:0'><iframe src='{src.as_uri()}#beat={i}&measure' "
            f"style='width:{width}px;height:{height}px;border:0;display:block'></iframe><pre id='out'>なし</pre>"
            "<script>addEventListener('message', e => { if (e.data && e.data.dpgk === 'measure') "
            "document.getElementById('out').textContent = JSON.stringify(e.data); });</script>",
            encoding="utf-8",
        )
        try:
            r = subprocess.run([chrome, "--headless=new", "--disable-gpu", "--virtual-time-budget=5000", "--dump-dom",
                                f"--window-size={max(width, 600)},{height + 100}", page.as_uri()],
                               capture_output=True, text=True, timeout=30)
        except subprocess.TimeoutExpired:
            print(f"beat {i}: Chrome が 30 秒で終わらなかった（もう一度実行する）")
            continue
        m = re.search(r"<pre id=\"out\">(.*?)</pre>", r.stdout, re.S)
        try:
            d = json.loads(html.unescape(m.group(1)))
        except (AttributeError, ValueError):
            print(f"beat {i}: 測れなかった（player.html v9 以降のプレイヤーが必要）")
            continue
        ok = d["minFont"] >= 10
        print(f"beat {i}: 最小 {d['minFont']}px（{d['orient']}、「{d['label']}」）{'' if ok else '  ← 10px 未満'}")
        worst = d["minFont"] if worst is None else min(worst, d["minFont"])
    if worst is not None:
        print(f"{width}x{height} の最小文字: {worst}px {'OK' if worst >= 10 else 'NG（10px 以上にする）'}")


def svg_size(text):
    m = re.search(r'viewBox\s*=\s*"\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', text)
    return (float(m.group(1)), float(m.group(2))) if m else (800, 450)


def main():
    ap = argparse.ArgumentParser(description="dpgk 動く図解のスナップショット")
    ap.add_argument("file")
    ap.add_argument("--times", help="SVG: 撮る時刻（秒）のカンマ区切り")
    ap.add_argument("--beats", type=int, help="HTML: player.html 形式のビート数")
    ap.add_argument("--width", type=int, default=0, help="画面幅 px（既定: SVG は viewBox 幅、HTML は 1200）")
    ap.add_argument("--measure", action="store_true", help="HTML: 画像の代わりに、各ビートで図の最小文字が画面上で何 px かを測る")
    ap.add_argument("--height", type=int, default=900, help="HTML の画面の高さ px（既定 900。背の低いスマホは 667）")
    args = ap.parse_args()

    src = Path(args.file).resolve()
    if args.measure:
        measure(find_chrome(), src, args.beats or 1, args.width or 375, args.height if args.height != 900 else 667)
        return
    out = src.with_name(src.name + ".snaps")
    out.mkdir(exist_ok=True)
    chrome = find_chrome()
    text = src.read_text(encoding="utf-8")

    if src.suffix.lower() == ".svg":
        vw, vh = svg_size(text)
        width = args.width or int(vw)
        height = int(width * vh / vw) + 1
        if args.times:
            times = [float(x) for x in args.times.split(",")]
        else:
            loops = infinite_animations(text)
            period = max((d for d, _ in loops), default=6.0)
            times = [round(period * i / 6, 2) for i in range(6)] + [round(period - 0.05, 2)]
        body = re.sub(r"<\?xml[^>]*>", "", text)
        page = Path(tempfile.mkdtemp()) / "snap.html"
        page.write_text(
            f"<!doctype html><meta charset='utf-8'><title>{html.escape(src.name)}</title>"
            f"<style>html,body{{margin:0}} svg{{display:block;width:100%;height:auto}}</style>{body}{FREEZE}",
            encoding="utf-8",
        )
        for t in times:
            shoot(chrome, f"{page.as_uri()}?t={t}", out / f"t{t:06.2f}.png", width, height)
        shoot(chrome, page.as_uri(), out / "reduced-motion.png", width, height, reduced=True)
    else:
        width = args.width or 1200
        height = args.height
        # headless Chrome はウィンドウ幅に下限（約 500px）があるので、狭い幅は iframe で再現する
        frame = Path(tempfile.mkdtemp()) / "frame.html"

        def url(fragment=""):
            if width >= 600:
                return src.as_uri() + fragment
            frame.write_text(
                f"<!doctype html><style>body{{margin:0;background:#888}}</style>"
                f"<iframe src='{src.as_uri()}{fragment}' style='width:{width}px;height:{height}px;border:0;display:block'></iframe>",
                encoding="utf-8",
            )
            return frame.as_uri()

        win = max(width, 600)
        if args.beats:
            for i in range(1, args.beats + 1):
                shoot(chrome, url(f"#beat={i}"), out / f"w{width}-beat{i}.png", win, height)
        else:
            shoot(chrome, url(), out / f"w{width}.png", win, height)
        shoot(chrome, url(), out / f"w{width}-reduced-motion.png", win, height, reduced=True)


if __name__ == "__main__":
    main()
