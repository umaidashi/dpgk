# 紹介動画

dpgk の紹介動画（1920×1080 / 30fps / 27.5 秒。1280×720 で組んで `--scale 1.5` で書き出す、日本語字幕・音声なし）の [Remotion](https://www.remotion.dev/) プロジェクトです。書き出したものは `../media/` に置いています。

```bash
npm install
npm run studio   # プレビュー
npm run render   # out/dpgk-intro.mp4（1920×1080）
npm run gif      # out/dpgk-intro.gif（README 用、960px・15fps）
cp out/dpgk-intro.mp4 out/dpgk-intro.gif ../media/
```

素材の `public/shots/` は `examples/` を headless Chrome で 3 倍の解像度で撮ったスクリーンショットです。見た目はすべてフレーム番号から計算しています（`src/Intro.jsx`）。
