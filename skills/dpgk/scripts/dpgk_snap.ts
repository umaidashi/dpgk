/**
 * dpgk_snap.ts - 動く図解を止めて撮り、1 枚の一覧画像（シート）にまとめる（Node.js の標準モジュール + ローカルの Chrome）
 *
 *   node dpgk_snap.ts out.html                 # 全ビートを PC 幅とスマホ幅のシートに 1 枚ずつ + スマホでの最小文字サイズ
 *   node dpgk_snap.ts out.svg                  # ループを 6 等分した時刻と終わり際のシート + 動きを減らす設定の静止画
 *   node dpgk_snap.ts out.svg --times 0,3.5,9  # SVG の時刻（秒）を指定
 *   node dpgk_snap.ts out.html --beat 4 --width 375 --height 667   # 1 コマだけ実寸で撮る（細部を確かめるとき）
 *   node dpgk_snap.ts out.html --measure       # 画像は撮らず、スマホ（375x667）での最小文字サイズだけ測る
 *
 * ビートや時刻ごとの画面を iframe で 1 ページに並べ、Chrome を 1 回起動して撮る。
 * 見る画像が少ないほど確認の往復が減るので、まずシートを見て、気になるコマだけ --beat で実寸を撮る。
 * HTML の「動きを減らす設定」は最終ビートと同じ見た目なので、別には撮らない。
 * 画像は <出力ファイル名>.snaps/ に保存し、パスを 1 行ずつ出力する。
 */

import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { infiniteAnimations, pyFloat, readText, round2 } from "./dpgk_lint.ts";

const CHROME_CANDIDATES = [
  process.env.CHROME ?? "",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome",
];
const PER_SHEET = 8;   // 1 枚に並べるコマ数の上限（多すぎると 1 コマが小さくなり、はみ出しを見落とす）
const MAX_BEATS = 20;  // ビート数を調べるときに試す上限
const PHONE = [375, 667] as const;
const DESKTOP = [1200, 750] as const;

const FREEZE = `<script>
const t = Number(new URLSearchParams(location.search).get("t") || 0);
for (const s of document.querySelectorAll("svg")) { if (s.pauseAnimations) { s.pauseAnimations(); s.setCurrentTime(t); } }
for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
</script>`;

type Measured = { beat: number; total?: number; orient: string; minFont: number; label: string };

const die = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const unescape = (s: string) =>
  s.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi, (_, dec, hex, name) =>
    dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16))
      : ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[name.toLowerCase()]);

/** Python の Path.as_uri() と同じ（英数字と _.-~/ 以外をパーセントエンコード）。 */
const asUri = (p: string) =>
  "file://" + p.split("/").map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())).join("/");

const which = (cmd: string) =>
  (process.env.PATH ?? "").split(delimiter).some((d) => {
    try {
      accessSync(join(d, cmd), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (c && (existsSync(c) || which(c))) return c;
  return die("Chrome / Chromium が見つからない。環境変数 CHROME にパスを指定する。");
}

/** headless Chrome はまれに終わらないことがあるので、打ち切って 1 回だけやり直す。 */
function runChrome(chrome: string, args: string[], timeout = 60) {
  for (let i = 0; i < 2; i++) {
    const r = spawnSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", ...args],
      { encoding: "utf8", timeout: timeout * 1000, killSignal: "SIGKILL", maxBuffer: 1 << 30 });
    if (r.error && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT") continue;
    if (r.error) throw r.error;
    return r;
  }
  return null;
}

function shoot(chrome: string, url: string, png: string, width: number, height: number, reduced = false, scale = 1) {
  const args = [`--window-size=${width},${height}`, `--force-device-scale-factor=${scale}`,
    "--virtual-time-budget=6000", `--screenshot=${png}`, url];
  if (reduced) args.unshift("--force-prefers-reduced-motion");
  runChrome(chrome, args);
  console.log(existsSync(png) ? png : `失敗: ${url}`);
}

function tmpPage(name: string, body: string) {
  const page = join(mkdtempSync(join(tmpdir(), "tmp")), name);
  writeFileSync(page, `<!doctype html><meta charset='utf-8'>${body}`);
  return page;
}

/** frames: [ラベル, URL][]。iframe を fw x fh で開き、scale 倍に縮めて cols 列に並べたページと、その寸法を返す。 */
function sheet(frames: [string, string][], fw: number, fh: number, scale: number, cols: number) {
  cols = Math.min(cols, frames.length);
  const cw = Math.round(fw * scale), ch = Math.round(fh * scale);
  const cells = frames.map(([label, url]) =>
    `<figure><figcaption>${escape(label)}</figcaption><div class='f' style='width:${cw}px;height:${ch}px'>` +
    `<iframe src='${url}' style='width:${fw}px;height:${fh}px;transform:scale(${scale})'></iframe></div></figure>`).join("");
  const rows = Math.ceil(frames.length / cols);
  const gap = 16, cap = 26;
  const width = cols * cw + (cols + 1) * gap;
  const height = rows * (ch + cap + gap) + gap;
  const body = `<style>body{margin:0;background:#888;font:600 16px system-ui,sans-serif}` +
    `.g{display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:${gap}px;padding:${gap}px}` +
    `figure{margin:0}figcaption{height:${cap}px;color:#fff}` +
    `.f{overflow:hidden;background:#fff}iframe{border:0;transform-origin:0 0;display:block}</style>` +
    `<div class='g'>${cells}</div>`;
  return [body, width, height] as const;
}

/** #beat=N&measure で開いたページから、図の中で一番小さい文字の画面上の px を受け取る（スマホ 375x667）。 */
function measure(chrome: string, src: string, beats?: number): [number, (Measured | undefined)[]] | null {
  if (!readText(src).includes("dpgk-player:start")) return null;
  const n = beats || MAX_BEATS;
  let frames = "";
  for (let i = 1; i <= n; i++)
    frames += `<iframe src='${asUri(src)}#beat=${i}&measure' style='width:${PHONE[0]}px;height:${PHONE[1]}px;border:0'></iframe>`;
  const page = tmpPage("measure.html", frames + "<pre id='out'>[]</pre><script>const r = [];" +
    "addEventListener('message', e => { if (e.data && e.data.dpgk === 'measure') {" +
    " r.push(e.data); document.getElementById('out').textContent = JSON.stringify(r); } });</script>");
  const res = runChrome(chrome, ["--virtual-time-budget=8000", "--dump-dom", `--window-size=800,${PHONE[1]}`, asUri(page)]);
  const m = (res?.stdout ?? "").match(/<pre id="out">(.*?)<\/pre>/s);
  let data: Measured[];
  try {
    data = JSON.parse(unescape(m![1]));
  } catch {
    return null;
  }
  const total = beats || (data.length && "total" in data[0] ? data[0].total : undefined);
  if (!total) return null;
  const byBeat = new Map(data.filter((d) => d.beat <= total).map((d) => [d.beat, d]));
  return [total, Array.from({ length: total }, (_, i) => byBeat.get(i + 1))];
}

function report(results: (Measured | undefined)[]) {
  let worst: number | null = null;
  results.forEach((d, i) => {
    if (!d) {
      console.log(`beat ${i + 1}: 測れなかった`);
      return;
    }
    const ok = d.minFont >= 10;
    console.log(`beat ${i + 1}: 最小 ${d.minFont}px（${d.orient}、「${d.label}」）${ok ? "" : "  ← 10px 未満"}`);
    worst = worst === null ? d.minFont : Math.min(worst, d.minFont);
  });
  if (worst !== null) console.log(`${PHONE[0]}x${PHONE[1]} の最小文字: ${worst}px ${worst >= 10 ? "OK" : "NG（10px 以上にする）"}`);
}

function htmlMode(chrome: string, src: string, out: string, beats?: number) {
  const found = measure(chrome, src, beats);
  let total: number, results: (Measured | undefined)[];
  if (!found) {
    if (!beats) die("ビート数が分からない（dpgk のプレイヤー v12 以降でない）。--beats で指定する。");
    [total, results] = [beats!, Array(beats).fill(undefined)];
  } else {
    [total, results] = found;
  }
  report(results);
  const chunks: number[][] = [];
  for (let i = 1; i <= total; i += PER_SHEET) chunks.push(Array.from({ length: Math.min(PER_SHEET, total + 1 - i) }, (_, j) => i + j));
  for (const [name, [fw, fh], scale, cols, dpr] of [["w1200", DESKTOP, 0.5, 2, 2], ["w375", PHONE, 1, 4, 1]] as const) {
    chunks.forEach((chunk, k) => {
      const frames = chunk.map((i): [string, string] => {
        const d = results[i - 1];
        return [`beat ${i}` + (d && name === "w375" ? `（最小 ${d.minFont}px）` : ""), `${asUri(src)}#beat=${i}`];
      });
      const [body, w, h] = sheet(frames, fw, fh, scale, cols);
      const suffix = chunks.length > 1 ? `-${k + 1}` : "";
      shoot(chrome, asUri(tmpPage("sheet.html", body)), join(out, `sheet-${name}${suffix}.png`), w, h, false, dpr);
    });
  }
}

function svgMode(chrome: string, src: string, out: string, times?: number[]) {
  const text = readText(src);
  const m = text.match(/viewBox\s*=\s*"\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  const [vw, vh] = m ? [Number(m[1]), Number(m[2])] : [800, 450];
  if (!times) {
    const durations = infiniteAnimations(text).map(([d]) => d);
    const period = durations.length ? Math.max(...durations) : 6.0;
    times = [...Array.from({ length: 6 }, (_, i) => round2((period * i) / 6)), round2(period - 0.05)];
  }
  const body = text.replace(/<\?xml[^>]*>/g, "");
  const freeze = tmpPage("freeze.html", `<title>${escape(basename(src))}</title>` +
    `<style>html,body{margin:0} svg{display:block;width:100%;height:auto}</style>${body}${FREEZE}`);
  const fw = Math.trunc(Math.min(vw, 800));
  const fh = Math.trunc((fw * vh) / vw) + 1;
  for (let k = 0; k < times.length; k += PER_SHEET) {
    const frames = times.slice(k, k + PER_SHEET).map((t): [string, string] => [`t = ${pyFloat(t)}s`, `${asUri(freeze)}?t=${pyFloat(t)}`]);
    const [page, w, h] = sheet(frames, fw, fh, 1, 2);
    const suffix = times.length > PER_SHEET ? `-${k / PER_SHEET + 1}` : "";
    shoot(chrome, asUri(tmpPage("sheet.html", page)), join(out, `sheet${suffix}.png`), w, h, false, 2);
  }
  shoot(chrome, asUri(freeze), join(out, "reduced-motion.png"), fw, fh, true, 2);
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      times: { type: "string" }, beats: { type: "string" }, beat: { type: "string" },
      width: { type: "string" }, height: { type: "string" }, measure: { type: "boolean" },
    },
  });
  if (positionals.length !== 1) die("usage: dpgk_snap.ts [--times T] [--beats N] [--beat N] [--width W] [--height H] [--measure] file");
  const int = (v?: string) => (v === undefined ? undefined : Number.isInteger(Number(v)) ? Number(v) : die(`invalid int value: '${v}'`));
  const beats = int(values.beats), beat = int(values.beat), width = int(values.width) ?? 0, height = int(values.height) ?? 0;

  const abs = resolve(positionals[0]);
  const src = existsSync(abs) ? realpathSync(abs) : abs;
  const chrome = findChrome();
  if (values.measure) {
    const found = measure(chrome, src, beats);
    if (!found) die("測れない: dpgk のプレイヤー（assets/player.html v12 以降）を使っていないページ");
    report(found![1]);
    return;
  }
  const out = src + ".snaps";
  mkdirSync(out, { recursive: true });
  if (extname(src).toLowerCase() === ".svg") {
    svgMode(chrome, src, out, values.times ? values.times.split(",").map(Number) : undefined);
  } else if (beat) {
    const w = width || DESKTOP[0], h = height || DESKTOP[1];
    const [body, sw, sh] = sheet([[`beat ${beat}（${w}x${h}）`, `${asUri(src)}#beat=${beat}`]], w, h, 1, 1);
    shoot(chrome, asUri(tmpPage("one.html", body)), join(out, `w${w}-beat${beat}.png`), sw, sh, false, 2);
  } else {
    htmlMode(chrome, src, out, beats);
  }
}

main();
