import React from "react";
import {
  AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing,
} from "remotion";

// dpgk の紹介動画（日本語字幕・音声なし）。1280x720 / 30fps / 27.5 秒。
// 見た目はすべてフレーム番号から決める（dpgk と同じ考え方）。

const C = { bg: "#fafaf9", fg: "#1c1917", muted: "#78716c", line: "#d6d3d1", node: "#ffffff", accent: "#2563eb", accentSoft: "#dbeafe" };
const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

// 場面の区切り（フレーム）
export const S = {
  title: [0, 90],
  what: [90, 180],
  controls: [270, 390],
  portrait: [660, 75],
  end: [735, 90],
};
export const DURATION = 825;

// ---- 共通部品 ----

const Subtitle = ({ text, from, to }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ background: "rgba(28,25,23,.86)", color: "#fff", fontSize: 30, fontWeight: 600, padding: "10px 26px", borderRadius: 10, letterSpacing: ".02em", maxWidth: 1120, textAlign: "center", lineHeight: 1.45 }}>
        {text}
      </div>
    </div>
  );
};

const Card = ({ src, w, h, style, label }) => (
  <div style={{ position: "absolute", width: w, height: h, borderRadius: 12, overflow: "hidden", background: C.node, boxShadow: "0 8px 28px rgba(0,0,0,.12)", border: `1px solid ${C.line}`, ...style }}>
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left" }} />
    {label && (
      <div style={{ position: "absolute", top: 10, right: 10, background: C.fg, color: "#fff", fontSize: 18, fontWeight: 700, padding: "3px 12px", borderRadius: 999 }}>{label}</div>
    )}
  </div>
);

// ---- 1. タイトル ----

const Title = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 12, stiffness: 160 } });
  const sub = interpolate(f, [14, 30], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: "-.02em", transform: `scale(${0.6 + 0.4 * pop})`, opacity: pop }}>
        dpgk
      </div>
      <div style={{ fontSize: 48, fontWeight: 700, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)` }}>
        説明を、<span style={{ color: C.accent }}>動く図解</span>に。
      </div>
      <div style={{ fontSize: 24, color: C.muted, opacity: interpolate(f, [30, 44], [0, 1], clamp) }}>Agent Skill for Claude Code</div>
    </AbsoluteFill>
  );
};

// ---- 2. 何が作れるか ----

const What = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cards = [
    { src: "shots/event-loop-6.png", x: 70, y: 70, label: "HTML" },
    { src: "shots/rebase-vs-merge-5.png", x: 470, y: 120, label: "HTML" },
    { src: "shots/remotion-mechanism-6.png", x: 870, y: 70, label: "HTML" },
    { src: "shots/dns.png", x: 290, y: 330, label: "SVG", w: 430, h: 240 },
    { src: "shots/binary-vs-linear-3.png", x: 760, y: 330, label: "HTML" },
  ];
  const showLabels = f >= 90;
  return (
    <AbsoluteFill>
      {cards.map((c, i) => {
        const s = spring({ frame: f - i * 7, fps, config: { damping: 16 } });
        return (
          <Card key={c.src} src={c.src} w={c.w || 360} h={c.h || 203} label={showLabels ? c.label : null}
            style={{ left: c.x, top: c.y, opacity: s, transform: `translateY(${(1 - s) * 40}px) scale(${0.92 + 0.08 * s})` }} />
        );
      })}
    </AbsoluteFill>
  );
};

// ---- 3. 操作方法 ----

const HOLD_RATE = 2, MAX_RATE = 10, MIN_RATE = 0.1, RANGE = 220, CURVE = 2.2;
const dragRate = (dy) => {
  const d = Math.max(-1, Math.min(1, dy / RANGE));
  const k = Math.abs(d) ** CURVE;
  return d >= 0 ? HOLD_RATE * (MAX_RATE / HOLD_RATE) ** k : HOLD_RATE * (MIN_RATE / HOLD_RATE) ** k;
};

// 操作場面のタイムライン（場面の頭からのフレーム）
const T = { tap: 105, hold: 195, holdOn: 205, holdOff: 262, dragStart: 275, dragTop: 320, dragBottom: 365, dragEnd: 380 };

function fingerY(f) {
  if (f < T.dragStart) return 0;
  if (f < T.dragTop) return -RANGE * interpolate(f, [T.dragStart, T.dragTop], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  if (f < T.dragBottom) return interpolate(f, [T.dragTop + 8, T.dragBottom], [-RANGE, RANGE], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return RANGE;
}
function rateAt(f) {
  if (f >= T.tap + 3 && f < T.hold) return 0;                      // 一時停止中
  if (f >= T.holdOn && f < T.holdOff) return 2;                     // 長押し
  if (f >= T.dragStart && f < T.dragEnd) return dragRate(-fingerY(f)); // ドラッグ（上が速い）
  if (f >= T.dragEnd) return 1;
  return 1;
}
function progressAt(f) {
  let p = 0.3;
  for (let i = 0; i < f; i++) p += 0.0011 * rateAt(i);
  return p % 1;
}
const fmt = (r) => (r >= 3 ? (Math.round(r * 2) / 2).toFixed(r >= 9.95 ? 0 : 1) : (Math.round(r * 10) / 10).toFixed(1)).replace(/\.0$/, "");

const Controls = () => {
  const f = useCurrentFrame();
  const W = 960, H = 540, X = 160, Y = 60;
  const r = rateAt(f);
  const pressing = (f >= T.tap && f < T.tap + 6) || (f >= T.hold && f < T.dragEnd);
  const fingerVisible = f >= T.tap - 12 && f < T.dragEnd + 10;
  const fx = X + W * 0.62, fy = Y + H * 0.5 + fingerY(f);
  let badge = "";
  if (f >= T.tap + 3 && f < T.hold) badge = "一時停止中";
  if (f >= T.holdOn && f < T.dragStart) badge = "2× ▶▶";
  if (f >= T.dragStart && f < T.dragEnd) badge = `${fmt(r)}× ${r >= 1 ? "▶▶" : "▶"}`;
  const ripple = interpolate(f, [T.tap, T.tap + 14], [0, 1], clamp);
  const holdFill = interpolate(f, [T.hold, T.holdOn], [0, 1], clamp);
  const enter = interpolate(f, [0, 12], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      {/* ブラウザの枠 */}
      <div style={{ position: "absolute", left: X, top: Y - 34, width: W, height: H + 34, borderRadius: 12, overflow: "hidden", background: C.node, boxShadow: "0 12px 40px rgba(0,0,0,.16)", border: `1px solid ${C.line}` }}>
        <div style={{ height: 34, background: "#f0eeec", display: "flex", alignItems: "center", gap: 8, paddingLeft: 14 }}>
          {["#ef4444", "#f59e0b", "#22c55e"].map((c) => <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
          <div style={{ marginLeft: 16, fontSize: 15, color: C.muted }}>umaidashi.github.io/dpgk/examples/event-loop.html</div>
        </div>
        <div style={{ position: "relative", width: W, height: H }}>
          <Img src={staticFile("shots/event-loop-3.png")} style={{ width: W, height: H }} />
          {/* 再生バー */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: C.line }}>
            <div style={{ height: "100%", width: `${progressAt(f) * 100}%`, background: C.accent }} />
          </div>
          {badge && (
            <div style={{ position: "absolute", top: 70, right: 24, background: C.fg, color: "#fff", fontSize: 26, fontWeight: 800, padding: "6px 18px", borderRadius: 999, opacity: 0.92 }}>{badge}</div>
          )}
        </div>
      </div>

      {/* ドラッグ中の速度ゲージ */}
      {f >= T.dragStart - 6 && f < T.dragEnd + 6 && (
        <div style={{ position: "absolute", left: X + W + 26, top: Y + H * 0.5 - RANGE - 10, height: RANGE * 2 + 20, width: 70, opacity: interpolate(f, [T.dragStart - 6, T.dragStart, T.dragEnd, T.dragEnd + 6], [0, 1, 1, 0], clamp) }}>
          <div style={{ position: "absolute", left: 30, top: 10, bottom: 10, width: 6, borderRadius: 3, background: C.line }} />
          {[["10×", 0], ["2×", 0.5], ["0.1×", 1]].map(([t, p]) => (
            <div key={t} style={{ position: "absolute", left: 44, top: 10 + p * RANGE * 2 - 12, fontSize: 18, color: C.muted, fontWeight: 700 }}>{t}</div>
          ))}
          <div style={{ position: "absolute", left: 21, top: 10 + RANGE + fingerY(f) - 12, width: 24, height: 24, borderRadius: 12, background: C.accent }} />
        </div>
      )}

      {/* 指 */}
      {fingerVisible && (
        <div style={{ position: "absolute", left: fx - 30, top: fy - 30, width: 60, height: 60 }}>
          {f >= T.tap && f < T.tap + 14 && (
            <div style={{ position: "absolute", inset: -30 * ripple, borderRadius: "50%", border: `3px solid ${C.accent}`, opacity: 1 - ripple }} />
          )}
          {f >= T.hold && f < T.holdOn + 4 && (
            <svg width="60" height="60" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
              <circle cx="30" cy="30" r="27" fill="none" stroke={C.accent} strokeWidth="5" strokeDasharray={`${170 * holdFill} 170`} />
            </svg>
          )}
          <div style={{ position: "absolute", inset: pressing ? 9 : 6, borderRadius: "50%", background: "rgba(28,25,23,.55)", border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,.3)" }} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---- 4. スマホ縦持ち ----

const Portrait = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 15 } });
  const keys = [["← →", "ステップ送り"], ["Space", "一時停止"], ["< >", "速度"], ["F", "全画面"]];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 270, top: 50, width: 310, height: 533, borderRadius: 40, background: "#111", padding: 12, transform: `rotate(${(1 - s) * -90}deg) scale(${0.8 + 0.2 * s})`, boxShadow: "0 16px 40px rgba(0,0,0,.25)" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 30, overflow: "hidden", background: C.bg }}>
          <Img src={staticFile("shots/phone-event-loop-3.png")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 640, top: 170, display: "flex", flexDirection: "column", gap: 18, opacity: interpolate(f, [14, 26], [0, 1], clamp) }}>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>PC ではキーボードでも</div>
        {keys.map(([k, t]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26 }}>
            <span style={{ minWidth: 96, textAlign: "center", border: `2px solid ${C.fg}`, borderBottomWidth: 4, borderRadius: 8, padding: "2px 10px", fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}>{k}</span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---- 5. 品質チェックと導入 ----

const End = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chips = ["lint で自動検査", "止めた画面をスクショで確認", "スマホの文字サイズを計測"];
  const cmd = spring({ frame: f - 30, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30, paddingBottom: 60 }}>
      <div style={{ display: "flex", gap: 16 }}>
        {chips.map((c, i) => {
          const s = spring({ frame: f - i * 6, fps, config: { damping: 15 } });
          return <div key={c} style={{ fontSize: 26, fontWeight: 700, padding: "10px 20px", borderRadius: 999, background: C.accentSoft, color: "#1e3a8a", opacity: s, transform: `translateY(${(1 - s) * 20}px)` }}>{c}</div>;
        })}
      </div>
      <div style={{ opacity: cmd, transform: `scale(${0.9 + 0.1 * cmd})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace", background: C.fg, color: "#fff", padding: "14px 30px", borderRadius: 12 }}>npx skills add umaidashi/dpgk</div>
        <div style={{ fontSize: 28, color: C.accent, fontWeight: 700 }}>umaidashi.github.io/dpgk</div>
      </div>
    </AbsoluteFill>
  );
};

// ---- 全体 ----

export const Intro = () => {
  const subs = [
    ["dpgk は、説明を「動く図解」にする Agent Skill です", 4, 88],
    ["仕組み・手順・データの流れを、意味のある動きで見せます", 92, 178],
    ["README に貼れる SVG と、操作できる HTML を 1 ファイルで", 182, 268],
    ["開くと自動再生。上辺のバーで全体のどこまで進んだかが分かる", 274, 370],
    ["図をタップすると一時停止、もう一度で再開", 372, 460],
    ["長押ししている間だけ 2 倍速", 462, 540],
    ["押したまま上下にドラッグで 0.1〜10 倍速。引くほど急に変わる", 542, 658],
    ["スマホを縦に持つと、縦向きの配置に切り替わる", 662, 733],
    ["品質チェック付き。Claude Code からすぐ使えます", 737, 822],
  ];
  return (
    <AbsoluteFill style={{ background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Sequence from={S.title[0]} durationInFrames={S.title[1]}><Title /></Sequence>
      <Sequence from={S.what[0]} durationInFrames={S.what[1]}><What /></Sequence>
      <Sequence from={S.controls[0]} durationInFrames={S.controls[1]}><Controls /></Sequence>
      <Sequence from={S.portrait[0]} durationInFrames={S.portrait[1]}><Portrait /></Sequence>
      <Sequence from={S.end[0]} durationInFrames={S.end[1]}><End /></Sequence>
      {subs.map(([t, a, b]) => <Subtitle key={t} text={t} from={a} to={b} />)}
    </AbsoluteFill>
  );
};
