# 動きのパターン集

動きの種類（順序・流れ・因果・変化・注目）ごとに、使う場面と最小の実装を示します。SVGで動くもの（CSS / SMIL）を基本にし、HTMLでもそのまま使えます。

全パターン共通で、タイムラインは1本にまとめます。ループ周期を `--T` のような1つの値で決め、各要素は `@keyframes` の％で出番を区切ります。

```css
/* 周期 9s の 1 本のタイムライン。各要素は % で出番を持つ */
.a { animation: a 9s ease-out infinite both; }
@keyframes a { 0%,10% { opacity: 0 } 15%,100% { opacity: 1 } }

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
}
```

`animation: none` にしたときに最終状態が見えるよう、要素の素の状態（CSSで指定しない状態）は「表示済み」にしておきます。隠すのは `@keyframes` の中だけです。

---

## 1. 順序: 段階的な出現

**使う場面**: 手順、レイヤーの積み上げ、リストの項目。

```css
.step { animation: reveal 8s ease-out infinite both; }
.step:nth-child(2) { animation-name: reveal2; }
@keyframes reveal  { 0%,5%  { opacity: 0; transform: translateY(6px) } 12%,100% { opacity: 1; transform: none } }
@keyframes reveal2 { 0%,20% { opacity: 0; transform: translateY(6px) } 27%,100% { opacity: 1; transform: none } }
```

`animation-delay` を使うとループ2周目以降でずれるため、無限ループでは `@keyframes` の％で出番をずらします。1回だけ再生する場合は `animation-delay` で構いません。

## 2. 流れ: パス上の移動

**使う場面**: リクエスト/レスポンス、データパイプライン、メッセージキュー。

SMIL の `animateMotion` が最も確実です（`<img>` 埋め込みでも動く）。

```xml
<path id="p1" d="M60,80 L340,80" stroke="#8a8f98" fill="none"/>
<circle r="6" fill="#2563eb">
  <animateMotion dur="9s" repeatCount="indefinite"
                 keyPoints="0;0;1;1" keyTimes="0;0.11;0.33;1"
                 calcMode="linear"><mpath href="#p1"/></animateMotion>
</circle>
```

`keyPoints` と `keyTimes` で「待つ → 移動 → 止まる」を1本の周期に収めます。

SMIL は CSS の `animation: none` で止まりません。移動するパケットは「途中経過」として扱い、`prefers-reduced-motion` では `display: none` で消し、到着後の矢印（CSS側、素の状態で表示）だけが残るようにします。

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
  .dot { display: none; }
}
```

継続的な流れ（帯域、ストリーム）は破線を流します。

```css
.flow { stroke-dasharray: 6 8; animation: flow 1.2s linear infinite; }
@keyframes flow { to { stroke-dashoffset: -14 } }
```

破線の流れは「常に流れている」意味を持つので、一時的なイベントには使いません。

## 3. 因果: 原因の後に結果が反応する

**使う場面**: イベント発火 → ハンドラ実行、キャッシュミス → DB問い合わせ、障害 → フェイルオーバー。

原因の動きが終わってから 0.2〜0.4 秒遅れて結果を動かします。同時に動くと因果ではなく並行に見えます。

```css
/* パケット到着が 33% → サーバーの反応は 36% から */
.server-hit { animation: hit 9s ease-out infinite; }
@keyframes hit { 0%,35% { fill: #e5e7eb } 38%,48% { fill: #93c5fd } 55%,100% { fill: #e5e7eb } }
```

## 4. 変化: 量・状態の遷移

**使う場面**: 計算量の比較、メモリ使用量、状態遷移（CLOSED → ESTABLISHED）。

量は `transform: scaleX()` / `scaleY()` で変えます（`width` のアニメーションより軽く、SVGでも動く）。`transform-box: fill-box; transform-origin: left;` を忘れないようにします。

```css
.bar { transform-box: fill-box; transform-origin: left; animation: grow 8s ease-in-out infinite both; }
@keyframes grow { 0%,10% { transform: scaleX(.05) } 40%,100% { transform: scaleX(1) } }
```

状態ラベルの切り替えは、2つの `<text>` を重ねてクロスフェードします。文字列を書き換えるより、`prefers-reduced-motion` 時の最終状態を作りやすくなります。

## 5. 注目: 1か所だけ強調する

**使う場面**: 長い図の中で「今の話題」を示す、HTMLのステップ送り。

強調する側を変えるより、それ以外を薄くする（`opacity: .25`）ほうが、色を増やさずに済みます。

```css
.dim { animation: dim 9s infinite; }
@keyframes dim { 0%,40% { opacity: 1 } 45%,70% { opacity: .25 } 75%,100% { opacity: 1 } }
```

---

## HTML: ビート駆動のプレイヤー

ステップ送りが要る場合は [`../assets/player.html`](../assets/player.html) を使います。各ビートは「その場面の最終状態」を宣言し、遷移はCSSトランジションに任せます。

```js
const beats = [
  { caption: "クライアントが SYN を送る", apply: s => { s.packet("syn").at("server"); s.state("client", "SYN_SENT"); } },
  ...
];
```

ビートは直前のビートに依存しない書き方にします（どこから再生しても同じ見た目になる）。これは Remotion の「フレーム番号から見た目が決まる」発想と同じです。

遷移や追加のアニメーションの長さは、必ず `var(--dur)` を基準に書きます（例: `calc(var(--dur) * 2)`）。倍速を切り替えるとプレイヤーが `--dur` を書き換えるので、固定の秒数で書いた動きだけが倍速に追従しなくなります。
