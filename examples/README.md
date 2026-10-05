# examples

dpgk スキルで実際に出力した動く図解です（`evals/evals.json` の各お題を、スキルありで実行した2回目の出力）。ブラウザで開くと動きます。**GitHub Pages で動くものを見られます: https://umaidashi.github.io/dpgk/examples/**

HTML は画面全体を使って自動再生し、上辺の再生バーで全体の進み具合が分かります。図をタップで一時停止、長押ししている間だけ 2×（押したまま上下にドラッグで 0.1×〜10×）、← / → でステップ送り、`<` / `>` で速度、F で全画面です。スマホを縦に持つと縦向きの配置になります。

| ファイル | 動くものを見る | 形式 | お題 |
|---|---|---|---|
| [dns-resolution.svg](dns-resolution.svg) | [開く](https://umaidashi.github.io/dpgk/examples/dns-resolution.svg) | SVG（README 埋め込み用ループ） | DNS の名前解決（スタブ → フル → ルート → TLD → 権威） |
| [event-loop.html](event-loop.html) | [開く](https://umaidashi.github.io/dpgk/examples/event-loop.html) | HTML プレイヤー | JavaScript のイベントループと、Promise.then が setTimeout より先に走る理由 |
| [binary-vs-linear.html](binary-vs-linear.html) | [開く](https://umaidashi.github.io/dpgk/examples/binary-vs-linear.html) | HTML プレイヤー + スライダー | 二分探索とリニアサーチの比較回数（配列サイズを変えて試せる） |
| [rebase-vs-merge.html](rebase-vs-merge.html) | [開く](https://umaidashi.github.io/dpgk/examples/rebase-vs-merge.html) | HTML プレイヤー | Git の rebase と merge の違い（「派手に」と頼まれても装飾に頼らない例） |
| [remotion-mechanism.html](remotion-mechanism.html) | [開く](https://umaidashi.github.io/dpgk/examples/remotion-mechanism.html) | HTML プレイヤー | Remotion が React コンポーネントを mp4 にする仕組み |

すべて `dpgk_lint.py` で 100/100 です。HTML のプレイヤー部分はひな形と同じもので、ひな形を変えたら `dpgk_sync_player.py` で反映します（`tests/test_lint.py` がどちらも毎回検査します）。
