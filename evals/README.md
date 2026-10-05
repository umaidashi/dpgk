# evals

dpgk の品質を測るための評価セットです。2 層に分かれています。

## 1. リンターの回帰テスト（決定論的）

`skills/dpgk/scripts/dpgk_lint.ts` が、良い例を通し、悪い例を正しい検査IDで落とせるかを確認します。

```bash
node --test tests/lint.test.ts
```

- `tests/corpus/good/` と `skills/dpgk/assets/` のひな形: 指摘ゼロであること
- `tests/corpus/bad/`: 先頭の `<!-- expect: ID ... -->` と検出IDが完全一致すること

検査ルールを足したら、そのルールに引っかかる最小の悪い例を `tests/corpus/bad/` に1つ追加します。

## 2. スキルの出力評価（`evals.json`）


[skill-creator](https://github.com/anthropics/skills) で回すと、結果は `dpgk-workspace/iteration-N/eval-<id>-<name>/{with_skill,without_skill}/run-1/` に入ります（`.gitignore` 済み）。

1. 各 eval の `prompt` を、スキルあり／なしのサブエージェントで実行する（`outputs/` と `response.md` を保存）
2. `node evals/lint_runs.ts dpgk-workspace/iteration-N` で各 run に `lint.json` を作る
3. 採点エージェントが `expectations` を1つずつ判定し、`grading.json` を書く
4. skill-creator の `aggregate_benchmark` と `generate_review.py` で比較表とレビュー画面を作る
5. 結果を [`benchmark.md`](benchmark.md) にまとめる（作業フォルダはローカルのパスを含むのでコミットしない）

### 各 eval が見ているもの

| name | 見ているもの |
|---|---|
| svg-readme-concept | `<img>` で単体表示できること、最終フレームだけで順序が読めること、委任と回答の区別 |
| html-step-player | 問いの明示、最新プレイヤー（自動再生・タップ停止・長押し 2×・ドラッグ速度・再生バー）、縦長画面での読みやすさ、ビート数、マイクロタスクが先に走る理由 |
| format-choice-by-need | HTML を選んだ理由の説明、探索の過程が 1 比較ずつ見えること |
| restraint-no-decoration | 「派手に」と頼まれても装飾（グロー・常時回転・流れる背景）に流れないこと |
| remotion-mechanism | フレーム番号で描く理由まで含めた Remotion の仕組みの正確さ |
| document-input | 設計書（`files/upload-design.md`）を元に、資料にない事実を足さず、問いを絞り、出典を書けるか |
| conversation-input | 会話ログ（`files/conversation.md`）を元に、会話で決めたことだけで図にし、範囲外とした話題を入れないか |

HTML のお題（2〜5）には共通で「プレイヤーが最新のひな形と一致する（`E-PLAYER` なし）」「375×667 の縦長画面で縦向き配置に切り替わり読める」を入れています。

assertion は「スキルなしでも普通に満たせるもの」を避け、スキルの原則（最終フレームで成立、問いの明示、意味のない動きをしない、なぜを1ビート）を守れたかで差が出るように書いています。
