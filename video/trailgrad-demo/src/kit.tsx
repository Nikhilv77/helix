import React, { type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useVideoConfig } from "remotion";

/*
 * Shared moves for the product films: every beat is typography, and every
 * change is a move: zoom in, slide through, zoom past.
 */
export const FPS = 60;
export const ink = "#141414";
export const muted = "#8d8d8d";
export const orange = "#f26e01";
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
export const t = (f: number, from: number, dur: number, easing = easeOut) => interpolate(f, [from, from + dur], [0, 1], { ...clamp, easing });

/** Frame size helpers so one film lays out in 16:9 and in the 4:5 phone cut. */
export function useFrameLayout() {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  /** A block width that never runs closer than `pad` to the frame edges. */
  const fit = (desired: number, pad = 70) => Math.min(desired, width - pad * 2);
  return { width, height, portrait, fit };
}

/** A beat on screen from `start` to `end`: zooms in on entry and punches past the camera on exit. */
export function Beat({ f, start, end, children, enter = "zoom", exit = "zoom" }: { f: number; start: number; end: number; children: ReactNode; enter?: "zoom" | "left" | "right" | "up"; exit?: "zoom" | "left" | "right" }) {
  if (f < start - 1 || f > end + 1) return null;
  const i = t(f, start, 22);
  const o = t(f, end - 16, 16, easeIn);
  const enterMove = { zoom: `scale(${0.82 + i * 0.18})`, left: `translateX(${(1 - i) * -340}px)`, right: `translateX(${(1 - i) * 340}px)`, up: `translateY(${(1 - i) * 160}px)` }[enter];
  const exitMove = { zoom: `scale(${1 + o * 0.42})`, left: `translateX(${o * -420}px)`, right: `translateX(${o * 420}px)` }[exit];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: Math.min(i, 1 - o), filter: `blur(${(1 - i) * 14 + o * 18}px)`, transform: `${enterMove} ${exitMove}` }}>
      {children}
    </AbsoluteFill>
  );
}

/** Words rise out of a mask one after another, each with a little overshoot. */
export function Words({ f, at, text, size, color = ink, gap = 3, weight = 600, style }: { f: number; at: number; text: string; size: number; color?: string; gap?: number; weight?: number; style?: CSSProperties }) {
  const { fps } = useVideoConfig();
  const { fit } = useFrameLayout();
  const maxWidth = fit(typeof style?.maxWidth === "number" ? style.maxWidth : 1780);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: size * 0.26, fontSize: size, fontWeight: weight, letterSpacing: -size * 0.045, lineHeight: 1.05, color, ...style, maxWidth }}>
      {text.split(" ").map((word, i) => {
        const s = spring({ frame: f - at - i * gap, fps, config: { damping: 14, stiffness: 170, mass: 0.7 } });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.14, marginBottom: -size * 0.14 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - s) * 105}%) rotate(${(1 - s) * 6}deg)`, opacity: Math.min(1, s * 1.6) }}>{word}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Letters of one word drop in with a stagger and settle with a spring. */
export function Letters({ f, at, text, size: desired }: { f: number; at: number; text: string; size: number }) {
  const { fps } = useVideoConfig();
  const { width } = useFrameLayout();
  // One unbroken word: shrink it until it fits the frame width.
  const size = Math.min(desired, (width * 0.88) / (text.length * 0.56));
  return (
    <div style={{ display: "flex", fontSize: size, fontWeight: 700, letterSpacing: -size * 0.05, color: ink, lineHeight: 1 }}>
      {text.split("").map((ch, i) => {
        const s = spring({ frame: f - at - i * 2, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
        return <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - s) * 60}px) scale(${0.6 + s * 0.4})`, opacity: Math.min(1, s * 2), filter: `blur(${(1 - Math.min(1, s)) * 8}px)` }}>{ch}</span>;
      })}
    </div>
  );
}

/** An orange stroke that wipes under a phrase. */
export function Underline({ f, at, width }: { f: number; at: number; width: number }) {
  return <div style={{ height: 8, borderRadius: 8, background: orange, width: width * t(f, at, 26), marginTop: 18 }} />;
}

/** White stage with the font and one faint warm light that drifts. */
export function Stage({ f, children }: { f: number; children: ReactNode }) {
  const drift = Math.sin(f / 90) * 6;
  return (
    <AbsoluteFill style={{ background: "#ffffff", color: ink, fontFamily: "Raleway, sans-serif", overflow: "hidden" }}>
      <style>{`@font-face{font-family:Raleway;src:url('${staticFile("raleway.ttf")}') format('truetype');font-weight:100 900;}*{box-sizing:border-box}`}</style>
      <AbsoluteFill style={{ background: `radial-gradient(38% 42% at ${50 + drift}% ${48 - drift / 2}%, rgba(242,110,1,0.07), transparent 70%)` }} />
      {children}
    </AbsoluteFill>
  );
}
