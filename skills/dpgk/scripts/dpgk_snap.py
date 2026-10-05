#!/usr/bin/env python3
"""
dpgk_snap.py - 動く図解を止めて撮り、1 枚の一覧画像（シート）にまとめる（標準ライブラリ + ローカルの Chrome）

  python3 dpgk_snap.py out.html                 # 全ビートを PC 幅とスマホ幅のシートに 1 枚ずつ + スマホでの最小文字サイズ
  python3 dpgk_snap.py out.svg                  # ループを 6 等分した時刻と終わり際のシート + 動きを減らす設定の静止画
  python3 dpgk_snap.py out.svg --times 0,3.5,9  # SVG の時刻（秒）を指定
  python3 dpgk_snap.py out.html --beat 4 --width 375 --height 667   # 1 コマだけ実寸で撮る（細部を確かめるとき）
  python3 dpgk_snap.py out.html --measure       # 画像は撮らず、スマホ（375x667）での最小文字サイズだけ測る

ビートや時刻ごとの画面を iframe で 1 ページに並べ、Chrome を 1 回起動して撮る。
見る画像が少ないほど確認の往復が減るので、まずシートを見て、気になるコマだけ --beat で実寸を撮る。
HTML の「動きを減らす設定」は最終ビートと同じ見た目なので、別には撮らない。
画像は <出力ファイル名>.snaps/ に保存し、パスを 1 行ずつ出力する。
"""

import argparse
import html
import json
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
PER_SHEET = 8          # 1 枚に並べるコマ数の上限（多すぎると 1 コマが小さくなり、はみ出しを見落とす）
MAX_BEATS = 20         # ビート数を調べるときに試す上限
PHONE = (375, 667)
DESKTOP = (1200, 750)

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


def run_chrome(chrome, args, timeout=60):
    """headless Chrome はまれに終わらないことがあるので、打ち切って 1 回だけやり直す。"""
    for _ in range(2):
        try:
            return subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", *args],
                                  capture_output=True, text=True, timeout=timeout, check=False)
        except subprocess.TimeoutExpired:
            continue
    return None


def shoot(chrome, url, png, width, height, reduced=False, scale=1):
    args = [f"--window-size={width},{height}", f"--force-device-scale-factor={scale}",
            "--virtual-time-budget=6000", f"--screenshot={png}", url]
    if reduced:
        args.insert(0, "--force-prefers-reduced-motion")
    run_chrome(chrome, args)
    print(png if Path(png).exists() else f"失敗: {url}")


def tmp_page(name, body):
    page = Path(tempfile.mkdtemp()) / name
    page.write_text(f"<!doctype html><meta charset='utf-8'>{body}", encoding="utf-8")
    return page


def sheet(frames, fw, fh, scale, cols):
    """frames: [(ラベル, URL)]。iframe を fw x fh で開き、scale 倍に縮めて cols 列に並べたページと、その寸法を返す。"""
    cols = min(cols, len(frames))
    cw, ch = round(fw * scale), round(fh * scale)
    cells = "".join(
        f"<figure><figcaption>{html.escape(label)}</figcaption><div class='f' style='width:{cw}px;height:{ch}px'>"
        f"<iframe src='{url}' style='width:{fw}px;height:{fh}px;transform:scale({scale})'></iframe></div></figure>"
        for label, url in frames)
    rows = -(-len(frames) // cols)
    gap, cap = 16, 26
    width = cols * cw + (cols + 1) * gap
    height = rows * (ch + cap + gap) + gap
    body = (f"<style>body{{margin:0;background:#888;font:600 16px system-ui,sans-serif}}"
            f".g{{display:grid;grid-template-columns:repeat({cols},{cw}px);gap:{gap}px;padding:{gap}px}}"
            f"figure{{margin:0}}figcaption{{height:{cap}px;color:#fff}}"
            f".f{{overflow:hidden;background:#fff}}iframe{{border:0;transform-origin:0 0;display:block}}</style>"
            f"<div class='g'>{cells}</div>")
    return body, width, height


def measure(chrome, src, beats=None):
    """#beat=N&measure で開いたページから、図の中で一番小さい文字の画面上の px を受け取る（スマホ 375x667）。"""
    if "dpgk-player:start" not in src.read_text(encoding="utf-8"):
        return None
    n = beats or MAX_BEATS
    frames = "".join(f"<iframe src='{src.as_uri()}#beat={i}&measure' style='width:{PHONE[0]}px;height:{PHONE[1]}px;border:0'></iframe>"
                     for i in range(1, n + 1))
    page = tmp_page("measure.html", frames + "<pre id='out'>[]</pre><script>const r = [];"
                    "addEventListener('message', e => { if (e.data && e.data.dpgk === 'measure') {"
                    " r.push(e.data); document.getElementById('out').textContent = JSON.stringify(r); } });</script>")
    res = run_chrome(chrome, ["--virtual-time-budget=8000", "--dump-dom", f"--window-size=800,{PHONE[1]}", page.as_uri()])
    m = re.search(r'<pre id="out">(.*?)</pre>', res.stdout if res else "", re.S)
    try:
        data = json.loads(html.unescape(m.group(1)))
    except (AttributeError, ValueError):
        return None
    total = beats or (data[0]["total"] if data and "total" in data[0] else None)
    if not total:
        return None
    by_beat = {d["beat"]: d for d in data if d["beat"] <= total}
    return total, [by_beat.get(i) for i in range(1, total + 1)]


def report(results):
    worst = None
    for i, d in enumerate(results, 1):
        if not d:
            print(f"beat {i}: 測れなかった")
            continue
        ok = d["minFont"] >= 10
        print(f"beat {i}: 最小 {d['minFont']}px（{d['orient']}、「{d['label']}」）{'' if ok else '  ← 10px 未満'}")
        worst = d["minFont"] if worst is None else min(worst, d["minFont"])
    if worst is not None:
        print(f"{PHONE[0]}x{PHONE[1]} の最小文字: {worst}px {'OK' if worst >= 10 else 'NG（10px 以上にする）'}")


def html_mode(chrome, src, out, beats):
    found = measure(chrome, src, beats)
    if not found:
        if not beats:
            sys.exit("ビート数が分からない（dpgk のプレイヤー v12 以降でない）。--beats で指定する。")
        total, results = beats, [None] * beats
    else:
        total, results = found
    report(results)
    chunks = [list(range(i, min(i + PER_SHEET, total + 1))) for i in range(1, total + 1, PER_SHEET)]
    for name, (fw, fh), scale, cols, dpr in (("w1200", DESKTOP, 0.5, 2, 2), ("w375", PHONE, 1, 4, 1)):
        for k, chunk in enumerate(chunks, 1):
            frames = []
            for i in chunk:
                d = results[i - 1]
                label = f"beat {i}" + (f"（最小 {d['minFont']}px）" if d and name == "w375" else "")
                frames.append((label, f"{src.as_uri()}#beat={i}"))
            body, w, h = sheet(frames, fw, fh, scale, cols)
            suffix = f"-{k}" if len(chunks) > 1 else ""
            shoot(chrome, tmp_page("sheet.html", body).as_uri(), out / f"sheet-{name}{suffix}.png", w, h, scale=dpr)


def svg_mode(chrome, src, out, times):
    text = src.read_text(encoding="utf-8")
    m = re.search(r'viewBox\s*=\s*"\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', text)
    vw, vh = (float(m.group(1)), float(m.group(2))) if m else (800, 450)
    if not times:
        period = max((d for d, _ in infinite_animations(text)), default=6.0)
        times = [round(period * i / 6, 2) for i in range(6)] + [round(period - 0.05, 2)]
    body = re.sub(r"<\?xml[^>]*>", "", text)
    freeze = tmp_page("freeze.html", f"<title>{html.escape(src.name)}</title>"
                      f"<style>html,body{{margin:0}} svg{{display:block;width:100%;height:auto}}</style>{body}{FREEZE}")
    fw = int(min(vw, 800))
    fh = int(fw * vh / vw) + 1
    for k in range(0, len(times), PER_SHEET):
        frames = [(f"t = {t}s", f"{freeze.as_uri()}?t={t}") for t in times[k:k + PER_SHEET]]
        page, w, h = sheet(frames, fw, fh, 1, 2)
        suffix = f"-{k // PER_SHEET + 1}" if len(times) > PER_SHEET else ""
        shoot(chrome, tmp_page("sheet.html", page).as_uri(), out / f"sheet{suffix}.png", w, h, scale=2)
    shoot(chrome, freeze.as_uri(), out / "reduced-motion.png", fw, fh, reduced=True, scale=2)


def main():
    ap = argparse.ArgumentParser(description="dpgk 動く図解のスナップショット（シートにまとめる）")
    ap.add_argument("file")
    ap.add_argument("--times", help="SVG: 撮る時刻（秒）のカンマ区切り")
    ap.add_argument("--beats", type=int, help="HTML: ビート数（省略時はページから読み取る）")
    ap.add_argument("--beat", type=int, help="HTML: このビートだけを実寸で撮る")
    ap.add_argument("--width", type=int, default=0, help="--beat のときの画面幅 px（既定 1200）")
    ap.add_argument("--height", type=int, default=0, help="--beat のときの画面の高さ px（既定 750）")
    ap.add_argument("--measure", action="store_true", help="HTML: スマホでの最小文字サイズだけ測る")
    args = ap.parse_args()

    src = Path(args.file).resolve()
    chrome = find_chrome()
    if args.measure:
        found = measure(chrome, src, args.beats)
        if not found:
            sys.exit("測れない: dpgk のプレイヤー（assets/player.html v12 以降）を使っていないページ")
        report(found[1])
        return
    out = src.with_name(src.name + ".snaps")
    out.mkdir(exist_ok=True)
    if src.suffix.lower() == ".svg":
        svg_mode(chrome, src, out, [float(x) for x in args.times.split(",")] if args.times else None)
    elif args.beat:
        w, h = args.width or DESKTOP[0], args.height or DESKTOP[1]
        body, sw, sh = sheet([(f"beat {args.beat}（{w}x{h}）", f"{src.as_uri()}#beat={args.beat}")], w, h, 1, 1)
        shoot(chrome, tmp_page("one.html", body).as_uri(), out / f"w{w}-beat{args.beat}.png", sw, sh, scale=2)
    else:
        html_mode(chrome, src, out, args.beats)


if __name__ == "__main__":
    main()
