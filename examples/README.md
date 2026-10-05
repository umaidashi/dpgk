# 🤪🧠⚡ dpgk examples

[GitHub リポジトリ（umaidashi/dpgk）](https://github.com/umaidashi/dpgk) ・ [トップページ（紹介動画）](https://umaidashi.github.io/dpgk/)

dpgk スキルで実際に作った動く図解です。`evals/evals.json` の各お題を、スキルありで実行した2回目の出力です。ファイルをブラウザで開くと動きます。GitHub Pages の https://umaidashi.github.io/dpgk/examples/ からも、そのまま動かせます。

HTML の例は画面全体を使って自動で再生し、上辺の再生バーで全体の進み具合が分かります。図をタップすると一時停止し、長押ししている間だけ 2 倍速になります。押したまま上下にドラッグすると、0.1〜10 倍の範囲で速度を変えられます。キーボードでは ← / → でステップ送り、`<` / `>` で速度の切り替え、F で全画面になります。スマホを縦に持つと、縦向きの配置に切り替わります。

| ファイル | 動くものを見る | 形式 | お題 |
|---|---|---|---|
| [dns-resolution.svg](dns-resolution.svg) | [開く](https://umaidashi.github.io/dpgk/examples/dns-resolution.svg) | SVG（README 埋め込み用ループ） | DNS の名前解決（スタブ → フル → ルート → TLD → 権威） |
| [event-loop.html](event-loop.html) | [開く](https://umaidashi.github.io/dpgk/examples/event-loop.html) | HTML プレイヤー | JavaScript のイベントループと、Promise.then が setTimeout より先に走る理由 |
| [binary-vs-linear.html](binary-vs-linear.html) | [開く](https://umaidashi.github.io/dpgk/examples/binary-vs-linear.html) | HTML プレイヤー + スライダー | 二分探索とリニアサーチの比較回数（配列サイズを変えて試せる） |
| [rebase-vs-merge.html](rebase-vs-merge.html) | [開く](https://umaidashi.github.io/dpgk/examples/rebase-vs-merge.html) | HTML プレイヤー | Git の rebase と merge の違い（「派手に」と頼まれても装飾に頼らない例） |
| [remotion-mechanism.html](remotion-mechanism.html) | [開く](https://umaidashi.github.io/dpgk/examples/remotion-mechanism.html) | HTML プレイヤー | Remotion が React コンポーネントを mp4 にする仕組み |

どの例も `dpgk_lint.ts` で 100/100 です。HTML のプレイヤー部分はひな形と同じもので、ひな形を変えたときは `dpgk_sync_player.ts` で反映します。点数とプレイヤーの一致は、どちらも `tests/lint.test.ts` が毎回検査します。
