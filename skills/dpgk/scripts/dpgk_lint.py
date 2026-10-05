#!/usr/bin/env python3
"""
dpgk_lint.py - 動く図解（アニメーション付き SVG / 単一 HTML）の静的検査スクリプト

自己完結しているか、動きがあるか、prefers-reduced-motion に対応しているか、
動きが騒がしすぎないか、読めるか、を決定論的に検査する。標準ライブラリのみで動作。

  python3 dpgk_lint.py out.svg [more.html ...] [--json] [--strict]

終了コード: ERROR があれば 1。--strict 時は WARN でも 1。
"""

import argparse
import json
import re
import sys
from pathlib import Path

# (ID, 重大度, 減点, メッセージ)
RULES = {
    "E-EXTERNAL": ("ERROR", 30, "外部リソースを読み込んでいる（1ファイルで完結させる）"),
    "E-NO-ANIMATION": ("ERROR", 40, "アニメーションが見つからない"),
    "E-NO-REDUCED-MOTION": ("ERROR", 20, "prefers-reduced-motion への対応がない"),
    "E-PLAYER": ("ERROR", 30, "HTML のプレイヤー部分が assets/player.html の最新版と一致しない（ひな形から作る / dpgk_sync_player.py で更新）"),
    "E-NO-VIEWBOX": ("ERROR", 20, "SVG ルートに viewBox がない"),
    "W-SVG-SCRIPT": ("WARN", 10, "SVG に <script> がある（<img> 埋め込みでは動かない）"),
    "W-NO-TITLE": ("WARN", 10, "<title> がない（SVG は <desc> か aria-label も推奨）"),
    "W-FRANTIC": ("WARN", 10, "周期 1 秒未満の無限ループがある（linear の破線流れは除く）"),
    "W-BUSY": ("WARN", 10, "周期 2 秒未満で回り続ける動きが 3 個以上ある（常時動く要素が多すぎる）"),
    "W-MIXED-PERIOD": ("WARN", 5, "2 秒以上の無限ループの周期がそろっていない（1 本のタイムラインにする）"),
    "W-DECOR": ("WARN", 15, "意味を運ばない装飾がある（グロー、回り続ける回転、流れ続ける光沢・背景）"),
    "W-NO-PORTRAIT": ("WARN", 10, "HTML の図（#scene）に縦向きの配置（data-viewbox-portrait）がない。スマホを縦に持つと文字が小さくなる"),
    "W-THEME": ("WARN", 5, "ダーク配色が @media の中の :root だけで書かれていて、配色ボタン（data-theme）に従わない"),
    "W-SMALL-TEXT": ("WARN", 5, "12px 未満の文字がある"),
    "W-EMOJI": ("WARN", 5, "絵文字がある（図形とラベルで表す）"),
}

TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "player.html"
PLAYER_BLOCK = re.compile(r"(?:/\*|<!--) dpgk-player:start.*?dpgk-player:end (?:\*/|-->)", re.S)
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿⭐-⭕]")
# 名前空間 URI（xmlns="http://www.w3.org/2000/svg" など）は外部読み込みではない
# <a href> は読み込みではなくリンクなので除外する
EXTERNAL = re.compile(
    r"""(?:<(?!a\b)[\w:-]+\b[^>]*?\b(?:src|href|xlink:href)\s*=\s*["']\s*(?:https?:)?//)"""
    r"""|(?:url\(\s*["']?\s*(?:https?:)?//)"""
    r"""|(?:@import\s+(?:url\()?\s*["']?\s*(?:https?:)?//)""",
    re.I,
)
SMIL = re.compile(r"<(animate|animateMotion|animateTransform|set)\b", re.I)
CSS_ANIM = re.compile(r"@keyframes\b|\btransition\s*:", re.I)
JS_ANIM = re.compile(r"\.animate\s*\(|requestAnimationFrame\s*\(")
REDUCED = re.compile(r"prefers-reduced-motion")
TIME = r"(\d*\.?\d+)(ms|s)\b"
# 0 0 Npx の影 = 全方向に光るグロー
GLOW = re.compile(r"(?:text-shadow|box-shadow)\s*:\s*0(?:px)?\s+0(?:px)?\s+\d|drop-shadow\(\s*0(?:px)?\s+0(?:px)?\s+\d|<feGaussianBlur\b", re.I)


def keyframes(text):
    """{名前: 本体} を返す。本体は 1 段のネストまで拾う。"""
    return {m.group(1): m.group(2) for m in re.finditer(r"@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}", text)}


def decorations(text):
    found = []
    if GLOW.search(text):
        found.append("グロー")
    kf = keyframes(text)
    looping = {n for decl in re.findall(r"animation\s*:\s*([^;}\"]+)", text, re.I)
               for part in decl.split(",") if "infinite" in part
               for n in re.findall(r"[\w-]+", part) if n in kf}
    looping |= {n for n in kf if re.search(r"animation-name\s*:\s*" + re.escape(n), text)
                and re.search(r"animation-iteration-count\s*:\s*infinite", text)}
    if any(re.search(r"rotate|360deg|1turn", kf[n]) for n in looping) or re.search(r'<animateTransform\b[^>]*type="rotate"[^>]*indefinite', text):
        found.append("回り続ける回転")
    if any("background-position" in kf[n] for n in looping):
        found.append("流れ続ける光沢・背景")
    return found


def seconds(num: str, unit: str) -> float:
    return float(num) / (1000 if unit == "ms" else 1)


def infinite_animations(text: str):
    """(周期秒, linear か) を、無限ループの CSS animation / SMIL ごとに返す。"""
    out = []
    for decl in re.findall(r"animation\s*:\s*([^;}\"]+)", text, re.I):
        for part in decl.split(","):
            if "infinite" not in part:
                continue
            m = re.search(TIME, part)
            if m:
                out.append((seconds(*m.groups()), "linear" in part))
    for tag in re.findall(r"<(?:animate|animateMotion|animateTransform)\b[^>]*>", text, re.I):
        if 'repeatCount="indefinite"' not in tag:
            continue
        m = re.search(r'dur="' + TIME, tag)
        if m:
            out.append((seconds(*m.groups()), 'calcMode="linear"' in tag))
    return out


def lint(text: str, is_svg: bool):
    hits = []

    def hit(rule_id, detail=""):
        hits.append({"id": rule_id, "severity": RULES[rule_id][0], "message": RULES[rule_id][2], "detail": detail})

    for m in EXTERNAL.finditer(text):
        hit("E-EXTERNAL", text[m.start(): m.start() + 80].split("\n")[0])

    has_anim = bool(SMIL.search(text) or CSS_ANIM.search(text) or JS_ANIM.search(text))
    if not has_anim:
        hit("E-NO-ANIMATION")
    elif not REDUCED.search(text):
        hit("E-NO-REDUCED-MOTION")

    if is_svg:
        root = re.search(r"<svg\b[^>]*>", text, re.I)
        if not root or "viewbox" not in root.group(0).lower():
            hit("E-NO-VIEWBOX")
        if re.search(r"<script\b", text, re.I):
            hit("W-SVG-SCRIPT")
        if not re.search(r"<title\b", text, re.I) or not re.search(r"<desc\b|aria-label", text, re.I):
            hit("W-NO-TITLE")
    else:
        if not re.search(r"<title\b[^>]*>\s*\S", text, re.I):
            hit("W-NO-TITLE")
        scene = re.search(r"<svg\b[^>]*\bid=[\"']scene[\"'][^>]*>", text)
        if scene and "data-viewbox-portrait" not in scene.group(0):
            hit("W-NO-PORTRAIT")
        if re.search(r"@media \(prefers-color-scheme: dark\) \{\s*:root \{", text):
            hit("W-THEME")
        found = PLAYER_BLOCK.findall(text)
        if not found:
            hit("E-PLAYER", "プレイヤーなし")
        elif found != PLAYER_BLOCK.findall(TEMPLATE.read_text(encoding="utf-8")):
            hit("E-PLAYER", "古い・改変されている")

    loops = infinite_animations(text)
    frantic = [d for d, linear in loops if d < 1 and not linear]
    if frantic:
        hit("W-FRANTIC", f"{min(frantic)}s")
    ambient = [d for d, _ in loops if d < 2]
    if len(ambient) >= 3:
        hit("W-BUSY", f"{len(ambient)} 個")
    periods = sorted({round(d, 2) for d, _ in loops if d >= 2})
    if len(periods) > 1:
        hit("W-MIXED-PERIOD", ", ".join(f"{p}s" for p in periods))

    decor = decorations(text)
    if decor:
        hit("W-DECOR", "、".join(decor))

    small = [float(v) for v in re.findall(r"font-size\s*[:=]\s*[\"']?(\d*\.?\d+)(?:px)?[\"';\s}]", text) if float(v) < 12]
    if small:
        hit("W-SMALL-TEXT", f"{min(small)}px")

    emoji = EMOJI.findall(text)
    if emoji:
        hit("W-EMOJI", "".join(sorted(set(emoji)))[:10])

    # 同じ ID は 1 回だけ減点する
    score = 100 - sum(RULES[i][1] for i in {h["id"] for h in hits})
    return max(score, 0), hits


def main():
    ap = argparse.ArgumentParser(description="dpgk 動く図解の静的検査")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--json", action="store_true", help="JSON で出力")
    ap.add_argument("--strict", action="store_true", help="WARN でも終了コード 1")
    args = ap.parse_args()

    results, failed = [], False
    for f in args.files:
        p = Path(f)
        score, hits = lint(p.read_text(encoding="utf-8"), p.suffix.lower() == ".svg")
        results.append({"file": str(p), "score": score, "findings": hits})
        if any(h["severity"] == "ERROR" for h in hits) or (args.strict and hits):
            failed = True

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for r in results:
            print(f"{r['file']}  スコア: {r['score']}/100")
            for h in r["findings"]:
                detail = f"  ({h['detail']})" if h["detail"] else ""
                print(f"  [{h['severity']}] {h['id']}: {h['message']}{detail}")
            if not r["findings"]:
                print("  [PASS] 指摘なし")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
