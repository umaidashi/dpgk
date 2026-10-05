/**
 * dpgk_lint.ts - 動く図解（アニメーション付き SVG / 単一 HTML）の静的検査スクリプト
 *
 * 自己完結しているか、動きがあるか、prefers-reduced-motion に対応しているか、
 * 動きが騒がしすぎないか、読めるか、を決定論的に検査する。Node.js の標準モジュールのみで動作。
 *
 *   node dpgk_lint.ts out.svg [more.html ...] [--json] [--strict]
 *
 * 終了コード: ERROR があれば 1。--strict 時は WARN でも 1。
 * モジュールとして import { lint } from ".../dpgk_lint.ts" でも使える。
 */

import { readFileSync, realpathSync } from "node:fs";
import { extname, normalize } from "node:path";
import { parseArgs } from "node:util";

type Severity = "ERROR" | "WARN";
export type Hit = { id: string; severity: Severity; message: string; detail: string };

// (重大度, 減点, メッセージ)
const RULES: Record<string, [Severity, number, string]> = {
  "E-EXTERNAL": ["ERROR", 30, "外部リソースを読み込んでいる（1ファイルで完結させる）"],
  "E-NO-ANIMATION": ["ERROR", 40, "アニメーションが見つからない"],
  "E-NO-REDUCED-MOTION": ["ERROR", 20, "prefers-reduced-motion への対応がない"],
  "E-PLAYER": ["ERROR", 30, "HTML のプレイヤー部分が assets/player.html の最新版と一致しない（ひな形から作る / dpgk_sync_player.ts で更新）"],
  "E-NO-VIEWBOX": ["ERROR", 20, "SVG ルートに viewBox がない"],
  "W-SVG-SCRIPT": ["WARN", 10, "SVG に <script> がある（<img> 埋め込みでは動かない）"],
  "W-NO-TITLE": ["WARN", 10, "<title> がない（SVG は <desc> か aria-label も推奨）"],
  "W-FRANTIC": ["WARN", 10, "周期 1 秒未満の無限ループがある（linear の破線流れは除く）"],
  "W-BUSY": ["WARN", 10, "周期 2 秒未満で回り続ける動きが 3 個以上ある（常時動く要素が多すぎる）"],
  "W-MIXED-PERIOD": ["WARN", 5, "2 秒以上の無限ループの周期がそろっていない（1 本のタイムラインにする）"],
  "W-DECOR": ["WARN", 15, "意味を運ばない装飾がある（グロー、回り続ける回転、流れ続ける光沢・背景）"],
  "W-NO-PORTRAIT": ["WARN", 10, "HTML の図（#scene）に縦向きの配置（data-viewbox-portrait）がない。スマホを縦に持つと文字が小さくなる"],
  "W-THEME": ["WARN", 5, "ダーク配色が @media の中の :root だけで書かれていて、配色ボタン（data-theme）に従わない"],
  "W-SMALL-TEXT": ["WARN", 5, "12px 未満の文字がある"],
  "W-EMOJI": ["WARN", 5, "絵文字がある（図形とラベルで表す）"],
};

// \w と \b は Unicode の文字で判定する（日本語に隣接したときも、以前の Python 版と同じ結果にする）
const W = String.raw`\p{L}\p{N}_`;
const B = String.raw`(?:(?<=[${W}])(?![${W}])|(?<![${W}])(?=[${W}]))`;
const re = (src: string, flags = "") => new RegExp(src.replaceAll(String.raw`\w`, W).replaceAll(String.raw`\b`, B), flags + "u");

const TEMPLATE = new URL("../assets/player.html", import.meta.url);
export const PLAYER_BLOCK = re(String.raw`(?:/\*|<!--) dpgk-player:start.*?dpgk-player:end (?:\*/|-->)`, "gs");
const EMOJI = re(String.raw`[\u{1F300}-\u{1FAFF}☀-➿⭐-⭕]`, "g");
// 名前空間 URI（xmlns="http://www.w3.org/2000/svg" など）は外部読み込みではない
// <a href> は読み込みではなくリンクなので除外する
const EXTERNAL = re(
  String.raw`(?:<(?!a\b)[\w:-]+\b[^>]*?\b(?:src|href|xlink:href)\s*=\s*["']\s*(?:https?:)?//)` +
  String.raw`|(?:url\(\s*["']?\s*(?:https?:)?//)` +
  String.raw`|(?:@import\s+(?:url\()?\s*["']?\s*(?:https?:)?//)`,
  "gi",
);
const SMIL = re(String.raw`<(animate|animateMotion|animateTransform|set)\b`, "i");
const CSS_ANIM = re(String.raw`@keyframes\b|\btransition\s*:`, "i");
const JS_ANIM = re(String.raw`\.animate\s*\(|requestAnimationFrame\s*\(`);
const TIME = String.raw`(\d*\.?\d+)(ms|s)\b`;
// 0 0 Npx の影 = 全方向に光るグロー
const GLOW = re(String.raw`(?:text-shadow|box-shadow)\s*:\s*0(?:px)?\s+0(?:px)?\s+\d|drop-shadow\(\s*0(?:px)?\s+0(?:px)?\s+\d|<feGaussianBlur\b`, "i");
const ANIMATION_DECL = re(String.raw`animation\s*:\s*([^;}"]+)`, "gi");

/** ファイルを読む。Python の read_text と同じく改行を \n にそろえる。 */
export const readText = (path: string | URL) => readFileSync(path, "utf8").replace(/\r\n?/g, "\n");

/** Python の float の表示（1.0 は "1.0"）。 */
export const pyFloat = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/** Python の round(x, 2)（ちょうど半分は偶数側）。 */
export function round2(x: number) {
  if (Number.isInteger(x * 8) && (x * 8) % 2) {
    const f = Math.floor(x * 100);
    return (f % 2 ? f + 1 : f) / 100;
  }
  return Number(x.toFixed(2));
}

/** {名前: 本体} を返す。本体は 1 段のネストまで拾う。 */
function keyframes(text: string) {
  return new Map([...text.matchAll(re(String.raw`@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}`, "g"))].map((m) => [m[1], m[2]]));
}

function decorations(text: string) {
  const found: string[] = [];
  if (GLOW.test(text)) found.push("グロー");
  const kf = keyframes(text);
  const looping = new Set<string>();
  for (const [, decl] of text.matchAll(ANIMATION_DECL))
    for (const part of decl.split(","))
      if (part.includes("infinite"))
        for (const [n] of part.matchAll(re(String.raw`[\w-]+`, "g"))) if (kf.has(n)) looping.add(n);
  for (const n of kf.keys())
    if (re(String.raw`animation-name\s*:\s*` + n).test(text) && re(String.raw`animation-iteration-count\s*:\s*infinite`).test(text)) looping.add(n);
  if ([...looping].some((n) => /rotate|360deg|1turn/u.test(kf.get(n)!)) || re(String.raw`<animateTransform\b[^>]*type="rotate"[^>]*indefinite`).test(text))
    found.push("回り続ける回転");
  if ([...looping].some((n) => kf.get(n)!.includes("background-position"))) found.push("流れ続ける光沢・背景");
  return found;
}

const seconds = (num: string, unit: string) => Number(num) / (unit === "ms" ? 1000 : 1);

/** [周期秒, linear か] を、無限ループの CSS animation / SMIL ごとに返す。 */
export function infiniteAnimations(text: string): [number, boolean][] {
  const out: [number, boolean][] = [];
  for (const [, decl] of text.matchAll(ANIMATION_DECL)) {
    for (const part of decl.split(",")) {
      if (!part.includes("infinite")) continue;
      const m = part.match(re(TIME));
      if (m) out.push([seconds(m[1], m[2]), part.includes("linear")]);
    }
  }
  for (const [tag] of text.matchAll(re(String.raw`<(?:animate|animateMotion|animateTransform)\b[^>]*>`, "gi"))) {
    if (!tag.includes('repeatCount="indefinite"')) continue;
    const m = tag.match(re('dur="' + TIME));
    if (m) out.push([seconds(m[1], m[2]), tag.includes('calcMode="linear"')]);
  }
  return out;
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function lint(text: string, isSvg: boolean): { score: number; hits: Hit[] } {
  const hits: Hit[] = [];
  const hit = (id: string, detail = "") => hits.push({ id, severity: RULES[id][0], message: RULES[id][2], detail });

  // 80 文字（コードポイント）で切る
  for (const m of text.matchAll(EXTERNAL)) hit("E-EXTERNAL", Array.from(text.slice(m.index, m.index + 160)).slice(0, 80).join("").split("\n")[0]);

  const hasAnim = SMIL.test(text) || CSS_ANIM.test(text) || JS_ANIM.test(text);
  if (!hasAnim) hit("E-NO-ANIMATION");
  else if (!text.includes("prefers-reduced-motion")) hit("E-NO-REDUCED-MOTION");

  if (isSvg) {
    const root = text.match(re(String.raw`<svg\b[^>]*>`, "i"));
    if (!root || !root[0].toLowerCase().includes("viewbox")) hit("E-NO-VIEWBOX");
    if (re(String.raw`<script\b`, "i").test(text)) hit("W-SVG-SCRIPT");
    if (!re(String.raw`<title\b`, "i").test(text) || !re(String.raw`<desc\b|aria-label`, "i").test(text)) hit("W-NO-TITLE");
  } else {
    if (!re(String.raw`<title\b[^>]*>\s*\S`, "i").test(text)) hit("W-NO-TITLE");
    const scene = text.match(re(String.raw`<svg\b[^>]*\bid=["']scene["'][^>]*>`));
    if (scene && !scene[0].includes("data-viewbox-portrait")) hit("W-NO-PORTRAIT");
    if (/@media \(prefers-color-scheme: dark\) \{\s*:root \{/u.test(text)) hit("W-THEME");
    const found = text.match(PLAYER_BLOCK) ?? [];
    if (!found.length) hit("E-PLAYER", "プレイヤーなし");
    else if (!sameList(found, readText(TEMPLATE).match(PLAYER_BLOCK) ?? [])) hit("E-PLAYER", "古い・改変されている");
  }

  const loops = infiniteAnimations(text);
  const frantic = loops.filter(([d, linear]) => d < 1 && !linear).map(([d]) => d);
  if (frantic.length) hit("W-FRANTIC", `${pyFloat(Math.min(...frantic))}s`);
  const ambient = loops.filter(([d]) => d < 2);
  if (ambient.length >= 3) hit("W-BUSY", `${ambient.length} 個`);
  const periods = [...new Set(loops.filter(([d]) => d >= 2).map(([d]) => round2(d)))].sort((a, b) => a - b);
  if (periods.length > 1) hit("W-MIXED-PERIOD", periods.map((p) => `${pyFloat(p)}s`).join(", "));

  const decor = decorations(text);
  if (decor.length) hit("W-DECOR", decor.join("、"));

  const small = [...text.matchAll(re(String.raw`font-size\s*[:=]\s*["']?(\d*\.?\d+)(?:px)?["';\s}]`, "g"))].map((m) => Number(m[1])).filter((v) => v < 12);
  if (small.length) hit("W-SMALL-TEXT", `${pyFloat(Math.min(...small))}px`);

  const emoji = text.match(EMOJI);
  if (emoji) hit("W-EMOJI", [...new Set(emoji)].sort().slice(0, 10).join(""));

  // 同じ ID は 1 回だけ減点する
  const score = 100 - [...new Set(hits.map((h) => h.id))].reduce((s, id) => s + RULES[id][1], 0);
  return { score: Math.max(score, 0), hits };
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { json: { type: "boolean" }, strict: { type: "boolean" } },
  });
  if (!positionals.length) {
    console.error("usage: dpgk_lint.ts [--json] [--strict] files [files ...]");
    process.exit(2);
  }

  let failed = false;
  const results = positionals.map((f) => {
    const { score, hits } = lint(readText(f), extname(f).toLowerCase() === ".svg");
    if (hits.some((h) => h.severity === "ERROR") || (values.strict && hits.length)) failed = true;
    return { file: normalize(f), score, findings: hits };
  });

  if (values.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      console.log(`${r.file}  スコア: ${r.score}/100`);
      for (const h of r.findings) console.log(`  [${h.severity}] ${h.id}: ${h.message}${h.detail ? `  (${h.detail})` : ""}`);
      if (!r.findings.length) console.log("  [PASS] 指摘なし");
    }
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename) main();
