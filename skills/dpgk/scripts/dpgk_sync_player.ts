/**
 * dpgk_sync_player.ts - HTML 図解のプレイヤー部分を、assets/player.html の最新版で上書きする
 *
 *   node dpgk_sync_player.ts out.html [more.html ...]      # 上書きする
 *   node dpgk_sync_player.ts out.html --check              # 古ければ終了コード 1（上書きしない）
 *
 * player.html の dpgk-player:start〜end で囲んだブロック（CSS / 操作ボタン / プレイヤーのスクリプト）を、
 * 対象ファイルの同じ順番のブロックと入れ替える。図の中身（header、#scene、beats、render）には触れない。
 */

import { writeFileSync } from "node:fs";
import { normalize } from "node:path";
import { parseArgs } from "node:util";
import { PLAYER_BLOCK as BLOCK, readText } from "./dpgk_lint.ts";

const TEMPLATE = new URL("../assets/player.html", import.meta.url);
// 図のスタイル側に残った古い書き方のダーク配色（@media の中で :root だけを上書き）を、配色ボタンに従う形に直す
const OLD_DARK = /@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}\s*\}/g;

const fixDark = (text: string) =>
  text.replace(OLD_DARK, (_, body: string) =>
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {${body}} }\n` +
    `  :root[data-theme="dark"] {${body}}`);

const { values, positionals } = parseArgs({ allowPositionals: true, options: { check: { type: "boolean" } } });
if (!positionals.length) {
  console.error("usage: dpgk_sync_player.ts [--check] files [files ...]");
  process.exit(2);
}

const blocks = readText(TEMPLATE).match(BLOCK) ?? [];
let stale = false, broken = false;
for (const f of positionals) {
  const p = normalize(f);
  const text = readText(f);
  const found = text.match(BLOCK) ?? [];
  if (found.length !== blocks.length) {
    console.log(`${p}: プレイヤーのブロックが ${found.length} 個（ひな形は ${blocks.length} 個）。ひな形から作り直す`);
    broken = true;
    continue;
  }
  if (found.every((b, i) => b === blocks[i]) && !text.match(OLD_DARK)) {
    console.log(`${p}: 最新`);
    continue;
  }
  stale = true;
  if (values.check) {
    console.log(`${p}: 古い`);
    continue;
  }
  let i = 0;
  writeFileSync(f, fixDark(text.replace(BLOCK, () => blocks[i++])));
  console.log(`${p}: 更新した`);
}
process.exit(broken || (stale && values.check) ? 1 : 0);
