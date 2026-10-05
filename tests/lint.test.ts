/**
 * dpgk_lint の回帰テスト。node --test tests/
 *
 * good/ と assets/ のひな形は指摘ゼロ、bad/ は先頭コメント `<!-- expect: ID ... -->` の ID と完全一致すること。
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { test } from "node:test";
import { lint, readText } from "../skills/dpgk/scripts/dpgk_lint.ts";

const ROOT = join(import.meta.dirname, "..");
const list = (dir: string) => readdirSync(join(ROOT, dir)).map((f) => join(ROOT, dir, f)).sort();
const ids = (text: string, isSvg: boolean) => [...new Set(lint(text, isSvg).hits.map((h) => h.id))].sort();

const good = [...list("tests/corpus/good"), ...list("skills/dpgk/assets"), ...list("examples")].sort();
for (const p of [...good, ...list("tests/corpus/bad")].filter((p) => [".svg", ".html"].includes(extname(p)))) {
  test(relative(ROOT, p), () => {
    const text = readText(p);
    const m = text.match(/<!-- expect: ([^>]*?) -->/);
    const expected = m ? [...new Set(m[1].split(/\s+/).filter(Boolean))].sort() : [];
    assert.deepEqual(ids(text, extname(p) === ".svg"), expected);
  });
}

// ひな形から縦向きの viewBox を外すと W-NO-PORTRAIT だけが出ること（ひな形を変えても追従するよう、その場で作る）
const tpl = readText(join(ROOT, "skills/dpgk/assets/player.html"));
test("player.html から縦向きを外すと W-NO-PORTRAIT", () => {
  assert.deepEqual(ids(tpl.replace(/ data-viewbox-portrait="[^"]*"/, ""), false), ["W-NO-PORTRAIT"]);
});

// 図のスタイルに古い書き方のダーク配色を足すと W-THEME だけが出ること
test("古い書き方のダーク配色で W-THEME", () => {
  const text = tpl.replace("  /* ここから図のスタイル", "  @media (prefers-color-scheme: dark) { :root { --x: #000; } }\n  /* ここから図のスタイル");
  assert.deepEqual(ids(text, false), ["W-THEME"]);
});

// examples の HTML のプレイヤー部分が、ひな形（assets/player.html）の最新版と一致していること
test("examples のプレイヤーがひな形と一致", () => {
  const html = list("examples").filter((p) => p.endsWith(".html"));
  const r = spawnSync(process.execPath, [join(ROOT, "skills/dpgk/scripts/dpgk_sync_player.ts"), "--check", ...html], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout);
});
