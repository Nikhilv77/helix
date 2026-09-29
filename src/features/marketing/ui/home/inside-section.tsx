"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Code2, FileText, Mic, Users, type LucideIcon } from "lucide-react";
import { Reveal, useViewportPresence } from "@/shared/ui/motion/reveal";

/** What the product includes, stated plainly. Each part is one side of prep. */
const parts: ReadonlyArray<{ name: string; icon: LucideIcon; body: string }> = [
  {
    name: "Interviews",
    icon: Mic,
    body: "Five voice rounds with an AI interviewer: resume and behavioural, technical deep dive, DSA, system design on a shared canvas, and hiring manager. Each is shaped by your resume and the role you want."
  },
  {
    name: "Practice",
    icon: Code2,
    body: "A guided roadmap through 200 DSA problems, plus core technical, applied engineering, and architecture tracks written for your role."
  },
  {
    name: "Feedback",
    icon: FileText,
    body: "A scored report after every round that quotes your answers and names the one thing to fix next. Resume Roast gives your resume the same honest read."
  },
  {
    name: "Help",
    icon: Users,
    body: "Hints first, then the full reasoning. Still stuck? Ask a Trailmate who has already solved the problem, and work through it together."
  }
];

export function Inside() {
  const gridRef = useRef<HTMLDListElement>(null);
  const present = useViewportPresence(gridRef, "-15% 0px");
  const [shown, setShown] = useState(false);

  // Plays once; scrolling back up does not replay it.
  useEffect(() => {
    if (present) setShown(true);
  }, [present]);

  return (
    <section
      id="inside"
      data-ember="right"
      className="marketing-deferred-section marketing-theme-section relative z-10 px-5 py-20 sm:px-10 sm:py-28"
    >
      <div className="mx-auto w-full max-w-[64rem]">
        <Reveal>
          <h2 className="marketing-section-title display-heading max-w-2xl text-cream">
            Everything a real interview loop asks of you.
          </h2>
        </Reveal>

        <dl
          ref={gridRef}
          data-shown={shown}
          className="inside-grid mt-14 grid gap-x-16 gap-y-12 sm:mt-20 sm:grid-cols-2 sm:gap-y-16"
        >
          {parts.map((part, index) => (
            <div key={part.name} className="inside-part" style={{ "--i": index } as CSSProperties}>
              <dt className="flex items-center gap-3 text-2xl font-semibold tracking-[-0.025em] text-cream sm:text-[1.75rem]">
                <part.icon aria-hidden="true" size={22} strokeWidth={1.6} className="inside-icon" />
                {part.name}
              </dt>
              <dd className="mt-4 max-w-[28rem] text-[1.0625rem] leading-[1.7] text-cream/66">
                {part.body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
