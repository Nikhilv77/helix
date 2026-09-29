import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Beat, Letters, Stage, Words, clamp, easeOut, ink, muted, orange, t, useFrameLayout } from "./kit";

/*
 * The second film: one round from resume to report. It reads what you built,
 * asks about it, helps when you are stuck, drills the gaps, and ends on the
 * one thing to fix.
 */

// Illustrative resume lines; no real candidate data.
const resumeLines = [
  "Built a payments service handling 2M requests a day.",
  "Moved order events from cron jobs onto Kafka.",
  "Cut checkout p95 from 900 ms to 240 ms."
];

function Resume({ f }: { f: number }) {
  const { fit, portrait } = useFrameLayout();
  return (
    <div style={{ width: fit(1360, 90), display: "flex", flexDirection: "column", gap: portrait ? 40 : 34 }}>
      {resumeLines.map((line, i) => {
        const at = 130 + i * 14;
        const inT = t(f, at, 30);
        const picked = i === 1;
        const sweep = picked ? t(f, 214, 34) : 0;
        const dim = picked ? 0 : t(f, 214, 30);
        return (
          <div
            key={line}
            style={{
              position: "relative",
              alignSelf: "flex-start",
              fontSize: portrait ? 56 : 58,
              lineHeight: 1.2,
              fontWeight: 600,
              letterSpacing: -1.8,
              color: ink,
              opacity: inT * (1 - dim * 0.72),
              transform: `translateY(${(1 - inT) * 40}px) scale(${1 + (picked ? t(f, 214, 40) * 0.04 : 0)})`,
              transformOrigin: "0% 50%"
            }}
          >
            <div style={{ position: "absolute", left: -14, right: -14, top: 6, bottom: 2, borderRadius: 12, background: "rgba(242,110,1,0.16)", transformOrigin: "0% 50%", transform: `scaleX(${sweep})` }} />
            <span style={{ position: "relative" }}>{line}</span>
          </div>
        );
      })}
    </div>
  );
}

function Typed({ f, from, to, text, size, color = ink }: { f: number; from: number; to: number; text: string; size: number; color?: string }) {
  const shown = Math.floor(interpolate(f, [from, to], [0, text.length], clamp));
  const { fit } = useFrameLayout();
  return (
    <div style={{ fontSize: size, lineHeight: 1.3, fontWeight: 500, letterSpacing: -size * 0.025, color, maxWidth: fit(1400, 80), textAlign: "center", minHeight: size * 2.6 }}>
      {text.slice(0, shown)}
      <span style={{ display: "inline-block", width: 4, height: size * 0.95, background: orange, marginLeft: 6, verticalAlign: `-${size * 0.14}px`, opacity: Math.floor(f / 18) % 2 ? 0 : 1 }} />
    </div>
  );
}

const drills: Array<[string, number]> = [
  ["Two pointers.", 808],
  ["Rate limiter.", 846],
  ["Idempotent APIs.", 884],
  ["Cache invalidation.", 922]
];

export function RoundsFilm() {
  const f = useCurrentFrame();
  return (
    <Stage f={f}>
      <Beat f={f} start={0} end={104}>
        <Words f={f} at={4} text="Upload once." size={140} />
      </Beat>

      <Beat f={f} start={98} end={330} enter="right" exit="zoom">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 64 }}>
          <Words f={f} at={104} text="It reads what you built." size={64} color={muted} weight={500} />
          <Resume f={f} />
        </div>
      </Beat>

      <Beat f={f} start={326} end={384} exit="zoom">
        <Letters f={f} at={328} text="Kafka." size={260} />
      </Beat>

      <Beat f={f} start={380} end={560} enter="up" exit="left">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36 }}>
          <Words f={f} at={386} text="Then asks about it." size={64} color={muted} weight={500} />
          <Words f={f} at={412} text="“Why Kafka there, and not a simple queue?”" size={92} gap={2} style={{ maxWidth: 1500 }} />
        </div>
      </Beat>

      <Beat f={f} start={554} end={776} enter="right" exit="zoom">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
          <Words f={f} at={560} text="Stuck? Ask for a hint." size={64} color={muted} weight={500} />
          <Typed f={f} from={600} to={700} text="Think about what happens when a consumer falls behind." size={74} />
        </div>
      </Beat>

      <Beat f={f} start={770} end={812} enter="up" exit="zoom">
        <Words f={f} at={772} text="Then drill the gaps." size={120} />
      </Beat>
      {drills.map(([word, at], k) => (
        <Beat key={word} f={f} start={at} end={at + 40} enter={k % 2 ? "left" : "right"} exit="zoom">
          <Letters f={f} at={at + 2} text={word} size={160} />
        </Beat>
      ))}

      <Beat f={f} start={962} end={1210} enter="zoom" exit="left">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Words f={f} at={968} text="After every round," size={64} color={muted} weight={500} />
          <div style={{ marginTop: 20 }}>
            <Words f={f} at={988} text="one thing to fix." size={150} />
          </div>
          <div style={{ marginTop: 44, opacity: t(f, 1040, 30), transform: `translateY(${(1 - t(f, 1040, 30, easeOut)) * 24}px)` }}>
            <Words f={f} at={1040} text="Lead with the trade-off, then the numbers." size={60} color={orange} weight={600} gap={2} />
          </div>
        </div>
      </Beat>

      <Beat f={f} start={1204} end={1440} exit="zoom">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Words f={f} at={1210} text="A little sharper" size={140} />
          <Words f={f} at={1224} text="every round." size={140} color={muted} />
          <div style={{ marginTop: 36, opacity: t(f, 1270, 30), fontSize: 44, fontWeight: 500, color: muted, letterSpacing: -0.8 }}>trailgrad.com</div>
        </div>
      </Beat>
    </Stage>
  );
}
