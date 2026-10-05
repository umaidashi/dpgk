# 紹介動画

dpgk の紹介動画（1280×720 / 30fps / 27.5 秒、日本語字幕・音声なし）の [Remotion](https://www.remotion.dev/) プロジェクトです。書き出したものは `../media/` に置いています。

```bash
npm install
npm run studio   # プレビュー
npm run render   # out/dpgk-intro.mp4
npm run gif      # out/dpgk-intro.gif（README 用、720px・12fps）
cp out/dpgk-intro.mp4 out/dpgk-intro.gif ../media/
```

素材の `public/shots/` は `examples/` を headless Chrome で撮ったスクリーンショットです。見た目はすべてフレーム番号から計算しています（`src/Intro.jsx`）。
