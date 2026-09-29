import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SpeakingTeacher, W, type TeacherId } from "./teacher";
import { Beat, Letters, Stage, Underline, Words, clamp, easeIn, easeOut, ink, muted, orange, t } from "./kit";

/* The hero film: teachers, a follow-up, an answer, a score. */
// Teacher montage: each teacher gets a quick cut; the mouth follows their recorded greeting silently.
const MONTAGE_START = 300;
const SLOT = 78;
const montage: Array<{ id: TeacherId; name: string; line: string; from: "left" | "right" }> = [
  { id: "maya", name: "Maya", line: "Turns a messy topic into a next step.", from: "right" },
  { id: "daniel", name: "Daniel", line: "Slows hard ideas down.", from: "left" },
  { id: "olivia", name: "Olivia", line: "Practises like a real conversation.", from: "right" },
  { id: "ryan", name: "Ryan", line: "Challenges every assumption.", from: "left" },
  { id: "claire", name: "Claire", line: "Asks the follow-up that matters.", from: "right" }
];
const MONTAGE_END = MONTAGE_START + SLOT * montage.length;

function Teachers({ f }: { f: number }) {
  // Kept mounted for the whole montage so every model loads once.
  if (f < MONTAGE_START - 30 || f > MONTAGE_END + 20) return null;
  const index = Math.min(montage.length - 1, Math.max(0, Math.floor((f - MONTAGE_START) / SLOT)));
  const slot = montage[index]!;
  const slotStart = MONTAGE_START + index * SLOT;
  const i = t(f, slotStart, 18);
  const o = t(f, slotStart + SLOT - 14, 14, easeIn);
  const dir = slot.from === "right" ? 1 : -1;
  const shown = f >= MONTAGE_START && f <= MONTAGE_END;
  const push = 1 + t(f, slotStart, SLOT, Easing.linear) * 0.06;
  return (
    <AbsoluteFill style={{ opacity: shown ? 1 : 0 }}>
      {/* Giant name behind the teacher, sliding the opposite way. */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateX(${(1 - i) * -dir * 260 + o * dir * 200}px)`, opacity: Math.min(i, 1 - o) * 0.09 }}>
        <div style={{ fontSize: 460, fontWeight: 800, letterSpacing: -26, color: ink }}>{slot.name}</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 70, left: (1920 - W) / 2, opacity: Math.min(i, 1 - o), transform: `translateX(${(1 - i) * dir * 420 - o * dir * 420}px) scale(${(0.9 + i * 0.1) * push})`, transformOrigin: "50% 45%", filter: `blur(${(1 - i) * 10 + o * 10}px)` }}>
        <SpeakingTeacher frame={f} teacher={slot.id} speakingFrom={slotStart} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", flexDirection: "column", alignItems: "center", opacity: 1 - o }}>
        <Letters key={slot.id} f={f} at={slotStart + 6} text={slot.name} size={84} />
        <div style={{ marginTop: 14 }}>
          <Words key={slot.id + "l"} f={f} at={slotStart + 16} text={slot.line} size={34} color={muted} weight={500} gap={2} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function DemoFilm() {
  const f = useCurrentFrame();
  const answer = "I traced the slow query, added an index, and it felt a lot faster after that.";
  const typed = Math.floor(interpolate(f, [1010, 1110], [0, answer.length], clamp));
  const score = Math.round(interpolate(f, [1180, 1240], [0, 8], { ...clamp, easing: easeOut }));

  return (
    <Stage f={f}>
      <Beat f={f} start={0} end={96}>
        <Words f={f} at={4} text="Your next interview." size={128} />
      </Beat>
      <Beat f={f} start={90} end={186} enter="right" exit="left">
        <Words f={f} at={96} text="Practised before" size={128} />
        <Words f={f} at={108} text="it happens." size={128} color={orange} />
      </Beat>
      <Beat f={f} start={180} end={300}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Words f={f} at={186} text="Built from your resume." size={112} />
          <Underline f={f} at={214} width={620} />
        </div>
      </Beat>

      <Teachers f={f} />

      <Beat f={f} start={MONTAGE_END - 6} end={MONTAGE_END + 110} enter="up">
        <Words f={f} at={MONTAGE_END} text="Pick the teacher" size={116} />
        <Words f={f} at={MONTAGE_END + 10} text="you learn best with." size={116} color={muted} />
      </Beat>

      <Beat f={f} start={800} end={990} enter="zoom" exit="left">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36 }}>
          <Words f={f} at={806} text="They ask the follow-up." size={68} color={muted} weight={500} />
          <Words f={f} at={836} text="“What happens to sign-in when Redis drops at peak?”" size={86} gap={2} style={{ maxWidth: 1500 }} />
        </div>
      </Beat>

      <Beat f={f} start={984} end={1160} enter="right" exit="zoom">
        <div style={{ width: 1400, textAlign: "left" }}>
          <Words f={f} at={990} text="You answer out loud." size={64} color={muted} weight={500} style={{ justifyContent: "flex-start" }} />
          <div style={{ marginTop: 40, fontSize: 60, lineHeight: 1.3, fontWeight: 500, letterSpacing: -1.6, minHeight: 170 }}>
            {answer.slice(0, typed)}
            <span style={{ display: "inline-block", width: 4, height: 58, background: orange, marginLeft: 6, verticalAlign: "-8px", opacity: Math.floor(f / 18) % 2 ? 0 : 1 }} />
          </div>
        </div>
      </Beat>

      <Beat f={f} start={1156} end={1330}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 300, fontWeight: 700, letterSpacing: -16, lineHeight: 1, transform: `scale(${0.9 + t(f, 1170, 40) * 0.1})` }}>
            {score}<span style={{ color: muted, fontSize: 140, letterSpacing: -6 }}>/10</span>
          </div>
          <Words f={f} at={1210} text="Now show how you measured it." size={64} color={orange} weight={600} />
        </div>
      </Beat>

      {[
        ["DSA.", 1324],
        ["System design.", 1360],
        ["Behavioural.", 1396],
        ["Resume Roast.", 1432]
      ].map(([word, at], k) => (
        <Beat key={word as string} f={f} start={at as number} end={(at as number) + 40} enter={k % 2 ? "left" : "right"} exit="zoom">
          <Letters f={f} at={(at as number) + 2} text={word as string} size={170} />
        </Beat>
      ))}

      <Beat f={f} start={1470} end={1620} exit="zoom">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Words f={f} at={1476} text="Walk in ready." size={150} />
          <div style={{ marginTop: 34, opacity: t(f, 1510, 30), transform: `translateY(${(1 - t(f, 1510, 30)) * 20}px)`, fontSize: 44, fontWeight: 500, color: muted, letterSpacing: -0.8 }}>trailgrad.com</div>
        </div>
      </Beat>
    </Stage>
  );
}

