"use client";

import type { CSSProperties } from "react";
import { InterviewSignal } from "@/components/brand/blueprint-art";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";

export function ReportMayaAvatar({
  delay = 120,
  speaking = false,
  size = "default",
  transparent = false
}: {
  delay?: number;
  speaking?: boolean;
  size?: "default" | "compact" | "summary";
  transparent?: boolean;
}) {
  return (
    <div
      className={`report-maya-portrait relative w-full max-w-[34rem] ${
        transparent ? "overflow-visible rounded-none" : "overflow-hidden rounded-2xl"
      } ${
        size === "summary"
          ? "h-[14rem] sm:h-[16rem]"
          : size === "compact"
            ? "h-[15rem] sm:h-[18rem] lg:h-[20rem]"
            : "h-[18rem] sm:h-[24rem] lg:h-[29rem]"
      }`}
      style={{ "--report-delay": `${delay}ms` } as CSSProperties}
    >
      {!transparent ? (
        <InterviewSignal className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[14rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 opacity-30 sm:h-[18rem] sm:w-[24rem] lg:h-[21rem] lg:w-[28rem] lg:opacity-40" />
      ) : null}

      <div
        className={`absolute z-10 ${
          transparent
            ? "inset-x-[-10%] bottom-[-4%] top-[-10%] sm:inset-x-[-6%] lg:inset-x-[-5%] xl:inset-x-[-2%]"
            : "inset-x-[-10%] bottom-[-4%] top-[-10%] sm:inset-x-[-6%] lg:inset-x-[-5%] xl:inset-x-[-2%]"
        }`}
        style={{
          maskImage: transparent
            ? "linear-gradient(180deg,#000 0%,#000 78%,rgba(0,0,0,0.86) 88%,transparent 100%)"
            : "linear-gradient(180deg,#000 0%,#000 86%,transparent 100%)",
          WebkitMaskImage: transparent
            ? "linear-gradient(180deg,#000 0%,#000 78%,rgba(0,0,0,0.86) 88%,transparent 100%)"
            : "linear-gradient(180deg,#000 0%,#000 86%,transparent 100%)"
        }}
      >
        <MayaStage speaking={speaking} transparent={transparent} performanceProfile="report" />
      </div>
      {transparent ? <div aria-hidden className="report-maya-bottom-soften" /> : null}
      {!transparent ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-[#151619] via-[#151619]/84 to-transparent" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-28 opacity-35"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(241,234,216,0.42) 1px, transparent 1.4px)",
              backgroundSize: "18px 18px",
              maskImage: "linear-gradient(180deg, transparent 0%, #000 46%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 46%, transparent 100%)"
            }}
          />
        </>
      ) : null}
    </div>
  );
}
