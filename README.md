# 🤪🧠⚡ dpgk

説明を「動く図解」にする Agent Skill です。概念・仕組み・手順・データの流れを、アニメーション付き SVG か単一ファイルの HTML で出力します。

<p align="center">
  <a href="https://umaidashi.github.io/dpgk/"><img src="./media/dpgk-intro.gif" width="720" alt="dpgk の紹介動画: 作れる図解と、タップで一時停止・長押しで 2 倍速・上下ドラッグで 0.1〜10 倍速などの操作"></a>
</p>

<p align="center">
  紹介動画（27 秒・音声なし）: <a href="https://umaidashi.github.io/dpgk/">GitHub Pages で見る</a> ・ <a href="./media/dpgk-intro.mp4">mp4</a>
</p>

方針は1つで、**動きは意味を運ぶためだけに使う**ことです。順序・流れ・因果・変化・注目のどれにも当たらない動き（常時回転、ふわふわ、意味のない発光）は入れません。

実際の出力例は [`examples/`](examples/README.md) にあります。GitHub Pages で、ブラウザやスマホからそのまま動かせます。

| 例 | 形式 |
|---|---|
| [DNS の名前解決](https://umaidashi.github.io/dpgk/examples/dns-resolution.svg) | SVG |
| [JavaScript のイベントループ](https://umaidashi.github.io/dpgk/examples/event-loop.html) | HTML プレイヤー |
| [二分探索とリニアサーチ](https://umaidashi.github.io/dpgk/examples/binary-vs-linear.html) | HTML プレイヤー + スライダー |
| [git rebase と merge](https://umaidashi.github.io/dpgk/examples/rebase-vs-merge.html) | HTML プレイヤー |
| [Remotion の仕組み](https://umaidashi.github.io/dpgk/examples/remotion-mechanism.html) | HTML プレイヤー |

## 出力形式

| 形式 | 使う場面 |
|---|---|
| SVG | README・Markdown に貼る、1つの概念を1ループで見せる。CSS / SMIL のみで動き、`<img>` 埋め込みでも再生される |
| HTML | 一時停止・倍速・ステップ送り・入力操作が要る。[`player.html`](skills/dpgk/assets/player.html) をひな形に、ビートを宣言的に書く |

HTML のプレイヤーは画面全体を使って自動再生し、縦型動画と同じく図をタップすると一時停止 / 再開、長押ししている間だけ 2× になります（押したまま上にドラッグで最大 10×、下で最小 0.1×）。画面の上辺には全体の進み具合を示す再生バーが流れます。スマホを縦に持つと縦向きの配置に切り替わり、全画面表示（F キー）にも対応しています。ほかに再生/一時停止（Space）、前後のステップ（← / →）、倍速 0.5×〜2×（`<` / `>`）、`#beat=3` での直接ジャンプに対応しています。

## インストール

Claude Code のプラグインとして:

```bash
/plugin marketplace add umaidashi/dpgk
/plugin install dpgk@dpgk
```

または skills.sh で:

```bash
npx skills add umaidashi/dpgk
```

## 使い方

```text
TCP の3ウェイハンドシェイクを動く図にして
JavaScript のイベントループをステップ送りで説明して --format html
```

スキルは次の順で進めます。

1. 見終わった人が答えられる「問い」を1文で決め、3〜7個のビートに分ける
2. 最終フレームを静止画として完成させる
3. ビート表どおりに1本のタイムラインで動きを付ける
4. `dpgk_lint.py` で静的検査する
5. `dpgk_snap.py` で時刻・ビートごとに止めた画像を撮り、重なりやはみ出しを目で確認する

## 必要なもの

- スキル本体（SKILL.md、ひな形、参照資料）だけなら、追加のインストールは要りません。
- 付属スクリプトは **Python 3.8 以上の標準ライブラリだけ**で動きます（`pip install` は不要）。macOS と多くの Linux には最初から入っています。
- `dpgk_snap.py` は、ローカルの **Google Chrome か Chromium** を画面なしで使います。見つからないときは環境変数 `CHROME` にパスを指定します。
- どちらも無い環境では、スキルは検査や目視確認を省き、省いたことを出力に書きます。図の作成自体はできます。

## 付属ツール: dpgk_lint.py

標準ライブラリのみで動く静的検査スクリプトです。

```bash
python3 skills/dpgk/scripts/dpgk_lint.py out.svg
python3 skills/dpgk/scripts/dpgk_lint.py out.html --json --strict
```

| ID | 内容 |
|---|---|
| E-EXTERNAL | 外部 CDN・フォント・画像を読み込んでいる |
| E-NO-ANIMATION | アニメーションがない |
| E-NO-REDUCED-MOTION | `prefers-reduced-motion` に対応していない |
| E-NO-VIEWBOX | SVG に `viewBox` がない |
| E-PLAYER | HTML のプレイヤー部分が `assets/player.html` の最新版と一致しない |
| W-SVG-SCRIPT | SVG に `<script>` がある |
| W-NO-TITLE | `<title>`（SVG は `<desc>` / `aria-label` も）がない |
| W-FRANTIC | 周期1秒未満の無限ループ |
| W-BUSY | 周期2秒未満の無限ループが3個以上 |
| W-MIXED-PERIOD | 無限ループの周期がそろっていない |
| W-DECOR | グロー、回り続ける回転、流れ続ける光沢・背景 |
| W-SMALL-TEXT | 12px 未満の文字 |
| W-EMOJI | 絵文字 |

ERROR があれば終了コード 1、`--strict` では WARN でも 1 を返します。

## 付属ツール: dpgk_sync_player.py

HTML のプレイヤー部分（`dpgk-player:start`〜`end` のブロック）を、`assets/player.html` の最新版で上書きします。図の中身には触れません。

```bash
python3 skills/dpgk/scripts/dpgk_sync_player.py examples/*.html          # 最新版に揃える
python3 skills/dpgk/scripts/dpgk_sync_player.py examples/*.html --check  # 古いものがあれば終了コード 1
```

プレイヤーを改善したら、このスクリプトで `examples/` に反映します。`tests/test_lint.py` が `--check` を実行するので、反映し忘れるとテストが落ちます。

## 付属ツール: dpgk_snap.py

ローカルの Chrome をヘッドレスで使い、アニメーションを指定時刻（SVG）や指定ビート（HTML）で止めて PNG を撮ります。ブラウザ操作ツールがなくても使えます。

```bash
python3 skills/dpgk/scripts/dpgk_snap.py out.svg                 # ループを 6 等分した時刻 + 動きを減らす設定
python3 skills/dpgk/scripts/dpgk_snap.py out.html --beats 7 --width 375
```

## 品質の確かめ方

```bash
python3 tests/test_lint.py   # リンターの回帰テスト
```

スキル出力の評価セットは [`evals/`](evals/README.md) にあります。スキルあり / なしの比較結果（合格率 100% 対 37%、定性評価つき）は [`evals/benchmark.md`](evals/benchmark.md) にまとめています。

## リポジトリ構成

```text
.
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/dpgk/
│   ├── SKILL.md                    # スキル本体
│   ├── references/
│   │   ├── motion-patterns.md      # 動きの種類ごとの実装パターン
│   │   └── anti-patterns.md        # 避ける動き・見た目・構造
│   ├── assets/player.html          # HTML ステップ再生のひな形
│   └── scripts/
│       ├── dpgk_lint.py            # 静的検査
│       ├── dpgk_snap.py            # 時刻・ビートで止めたスクリーンショット
│       └── dpgk_sync_player.py     # プレイヤー部分を最新のひな形に揃える
├── index.html                      # GitHub Pages のトップ（紹介動画と例へのリンク）
├── media/                          # 紹介動画（mp4 / gif / ポスター画像）
├── video/                          # 紹介動画の Remotion プロジェクト
├── examples/                       # スキルの出力例（SVG 1 本、HTML 4 本）
├── evals/
│   ├── evals.json                  # スキル出力の評価セット（skill-creator 形式）
│   ├── benchmark.md                # スキルあり / なしの比較結果
│   └── README.md
└── tests/
    ├── test_lint.py
    └── corpus/{good,bad}/          # リンターの回帰用サンプル
```

## 参考

- [nanaism/yomiyasu](https://github.com/nanaism/yomiyasu) — リポジトリ構成（スキル + リンター + evals）
- [plannotator/effective-html](https://github.com/plannotator/effective-html) — 自己完結 HTML アーティファクトの考え方
- [Remotion](https://www.remotion.dev/) — 「時間から見た目が決まる」宣言的アニメーションの発想

## ライセンス

コードと文書は [MIT License](LICENSE) です。紹介動画に使った Remotion のライセンス、GitHub マーク（Octicons）の表記、参考にしたプロジェクト、商標については [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にまとめています。
