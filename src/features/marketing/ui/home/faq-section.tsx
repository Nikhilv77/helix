"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import { useInView } from "@/shared/ui/motion/reveal";

/** The questions people ask before signing up, answered from how the product works. */
const questions = [
  {
    question: "Is Trailgrad free?",
    answer:
      "Yes. Practice and help from other learners are free and will stay free. Voice interviews are free too, with a daily limit."
  },
  {
    question: "Which roles does it cover?",
    answer:
      "Technical roles across software engineering. Your practice tracks and interview rounds follow the role you choose when you sign up."
  },
  {
    question: "Why does it need my resume?",
    answer:
      "Your interviewer asks about the projects, roles, and skills on it, the way a real interviewer would. You add it when you sign up and can replace it any time from your profile."
  },
  {
    question: "What happens to my resume?",
    answer:
      "It is read once to pull out your experience, projects, and skills. The details stay in your account; the original file is not stored."
  },
  {
    question: "Are my interviews recorded?",
    answer:
      "Your audio is not recorded. The transcript is kept so your report can quote your answers. Your camera is optional and its view never leaves your device."
  }
] as const;

/**
 * No big heading: one line in the same voice as the film captions, then the
 * questions as quiet rows with no rules between them. They rise in one after
 * another as the section arrives, and an open answer eases down with a short
 * ember stroke under its question.
 */
export function Faq() {
  const listRef = useRef<HTMLDivElement>(null);
  const shown = useInView(listRef);

  return (
    <section
      id="faq"
      className="marketing-deferred-section marketing-theme-section relative z-10 px-5 py-20 sm:px-10 sm:py-28"
    >
      <div ref={listRef} className="faq-list mx-auto w-full max-w-[58rem]" data-shown={shown}>
        <h2
          className="faq-part marketing-section-title display-heading mx-auto max-w-[40rem] text-balance text-center text-cream"
          style={{ "--i": 0 } as CSSProperties}
        >
          A few things people ask first.
        </h2>

        <div className="mt-12 sm:mt-20">
          {questions.map((item, index) => (
            <details
              key={item.question}
              className="faq-item faq-part smooth-disclosure group"
              style={{ "--i": index + 1 } as CSSProperties}
            >
              <summary className="faq-question flex cursor-pointer list-none items-center justify-between gap-6 rounded-2xl px-1 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-cream/30 sm:py-7 [&::-webkit-details-marker]:hidden">
                <span className="faq-question-text text-[1.3rem] font-semibold leading-snug tracking-[-0.025em] sm:text-[1.9rem]">
                  {item.question}
                </span>
                <span
                  aria-hidden="true"
                  className="faq-toggle grid h-10 w-10 shrink-0 sm:h-12 sm:w-12 place-items-center rounded-full"
                >
                  <Plus size={20} strokeWidth={2.25} className="faq-toggle-icon" />
                </span>
              </summary>
              <div className="smooth-disclosure-body px-1">
                <span aria-hidden="true" className="faq-stroke block" />
                <p className="max-w-[44rem] pb-8 pt-5 text-[1.0625rem] leading-[1.75] text-cream/66 sm:text-[1.25rem]">
                  {item.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
