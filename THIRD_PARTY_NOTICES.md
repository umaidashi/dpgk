# サードパーティの表記

このリポジトリのコードと文書は [MIT License](LICENSE) で公開しています。ただし、次のものはそれぞれの権利者のライセンスや規約に従います。

## リポジトリに含まれるもの

### GitHub マーク（Octicons）

[`index.html`](index.html) のリポジトリへのリンクに、[Octicons](https://github.com/primer/octicons) の `mark-github` アイコンを SVG で埋め込んでいます。リンク先が GitHub であることを示す目的だけで使っています。GitHub のロゴの扱いは [GitHub Logos and Usage](https://github.com/logos) に従います。

```
MIT License

Copyright (c) 2026 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 紹介動画（`media/`）と、その素材（`video/public/shots/`）

- 紹介動画は [Remotion](https://www.remotion.dev/) で作りました。Remotion の [Free License](https://www.remotion.dev/license) の範囲（個人の利用）で作成しています。動画の中で見せている画面は、このリポジトリの `examples/` を撮ったものです。
- 動画と画像の中の日本語は、macOS に標準で入っているヒラギノ角ゴシックで描いた文字を画像にしたものです。フォントのファイルそのものは含めていません。

## リポジトリに含めず、利用するだけのもの

`video/` の Remotion プロジェクトは、`npm install` で次のパッケージを取得して使います。これらはリポジトリには含めていません。

| パッケージ | ライセンス |
|---|---|
| [remotion](https://github.com/remotion-dev/remotion)、[@remotion/cli](https://github.com/remotion-dev/remotion) | [Remotion License](https://www.remotion.dev/license)。個人、従業員 3 人以下の営利企業、非営利団体は無料です。それ以外の営利企業が使う場合は Company License が必要です |
| [react](https://github.com/facebook/react)、[react-dom](https://github.com/facebook/react) | MIT |

Remotion は動画の書き出しに FFmpeg と Chrome Headless Shell を使います。どちらも Remotion がダウンロードして使うもので、このリポジトリでは配布していません。

`skills/dpgk/scripts/` のスクリプトは Node.js の標準モジュールだけを使い、外部パッケージには依存しません。`dpgk_snap.ts` は、利用者の環境にある Google Chrome か Chromium を起動するだけです。

## 参考にしたもの

次のプロジェクトの構成と考え方を参考にしました。コードや文章は複製していません。

- [nanaism/yomiyasu](https://github.com/nanaism/yomiyasu)（MIT License, Copyright (c) 2026 nanaism）: スキル、リンター、評価セットをまとめるリポジトリ構成
- [plannotator/effective-html](https://github.com/plannotator/effective-html)（MIT License, Copyright (c) 2026 plannotator）: 1 ファイルで完結する HTML アーティファクトの考え方
- [anthropics/skills](https://github.com/anthropics/skills) の skill-creator: 評価セット（`evals/evals.json`）の形式と、評価の進め方

`examples/remotion-mechanism.html` は、[Remotion のドキュメント](https://www.remotion.dev/docs/the-fundamentals)をもとに仕組みを自分の言葉で図解したものです。出典をページ内にリンクしています。

## 商標

Claude、Claude Code、GitHub、Remotion、React など、このリポジトリに出てくる製品名やサービス名は、それぞれの権利者の商標または登録商標です。このリポジトリは個人のプロジェクトで、これらの権利者とは関係がなく、承認や支援を受けたものでもありません。
