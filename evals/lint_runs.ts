/** 各 run の outputs を dpgk_lint にかけて lint.json を書く。node evals/lint_runs.ts dpgk-workspace/iteration-N */
import { globSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { lint, readText } from "../skills/dpgk/scripts/dpgk_lint.ts";

const base = process.argv[2];
for (const out of globSync("*/*/run-1/outputs", { cwd: base }).sort()) {
  const res = [];
  for (const f of (readdirSync(join(base, out), { recursive: true }) as string[]).sort()) {
    if (![".svg", ".html"].includes(extname(f))) continue;
    const { score, hits } = lint(readText(join(base, out, f)), extname(f) === ".svg");
    res.push({ file: basename(f), score, ids: hits.map((h) => h.id) });
  }
  writeFileSync(join(base, dirname(out), "lint.json"), JSON.stringify(res, null, 1));
  console.log(relative(base, join(base, dirname(out))), JSON.stringify(res));
}
