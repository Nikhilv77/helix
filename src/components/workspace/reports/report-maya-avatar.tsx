"use client";

import type { CSSProperties } from "react";
import { InterviewSignal } from "@/components/brand/blueprint-art";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";

export function ReportMayaAvatar({
  delay = 120,
  speaking = false
}: {
  delay?: number;
  speaking?: boolean;
}) {
  return (
    <div
      className="report-maya-portrait relative h-[18rem] w-full max-w-[34rem] overflow-hidden rounded-2xl sm:h-[24rem] lg:h-[29rem]"
      style={{ "--report-delay": `${delay}ms` } as CSSProperties}
    >
      <InterviewSignal className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[14rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 opacity-30 sm:h-[18rem] sm:w-[24rem] lg:h-[21rem] lg:w-[28rem] lg:opacity-40" />

      <div
        className="absolute inset-x-[-10%] bottom-[-4%] top-[-10%] z-10 sm:inset-x-[-6%] lg:inset-x-[-5%] xl:inset-x-[-2%]"
        style={{
          maskImage: "linear-gradient(180deg,#000 0%,#000 88%,transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 88%,transparent 100%)"
        }}
      >
        <MayaStage speaking={speaking} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-[#3657b4] via-[#3657b4]/84 to-transparent" />
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
    </div>
  );
}
