"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "What actually happens in a Trailguide session?",
    answer:
      "It is a focused one-to-one conversation. You explain what you are working through, your guide asks questions and the two of you look at the options together. The aim is to leave with a clearer decision or a short list of useful next steps."
  },
  {
    question: "How is this different from asking an AI?",
    answer:
      "AI is great for gathering information and practising. A guide adds human judgment: they can notice the context behind your question, ask follow-ups and share what they have learned from making similar decisions in real teams. You can use both; they help in different ways."
  },
  {
    question: "How do I choose the right mentor?",
    answer:
      "Choose based on the problem you want to solve, not only the company name. Look at the kind of work each person has done and the topics they know well. For example, a system design interview calls for a different perspective than a move into engineering management."
  },
  {
    question: "What should I prepare before we meet?",
    answer:
      "A short note about your situation is enough. If they are useful, you can also bring the job description, feedback you received, a resume or a design you want to discuss. There is no presentation to make and your question does not need to be perfectly formed."
  },
  {
    question: "Can a mentor refer me or guarantee that I get an offer?",
    answer:
      "No. Trailguide does not promise referrals, interviews or job offers. A mentor can help you prepare thoughtfully, spot gaps and make better decisions, but the outcome still depends on the company, the process and your own work."
  },
  {
    question: "Is this still useful if my interview is only a few days away?",
    answer:
      "Yes. The goal will not be to cover everything at the last minute. Your guide can help you decide what matters most, practise the weakest area and make a realistic plan for the time you have left."
  }
];

export function TrailguideFaq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section
      aria-labelledby="trailguide-faq-title"
      className="relative overflow-hidden rounded-[1.5rem] bg-[#20201d] p-6 text-white sm:p-10 lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:p-14"
    >
      <span
        aria-hidden="true"
        className="absolute -left-24 top-40 h-64 w-64 rounded-full bg-[#ef7d45]/10 blur-2xl"
      />

      <div className="relative mb-9 lg:mb-0">
        <h2
          id="trailguide-faq-title"
          className="max-w-[11ch] text-[clamp(2.3rem,4.6vw,3.8rem)] font-semibold leading-[1] tracking-[-0.05em]"
        >
          A few things you may be wondering.
        </h2>
        <p className="mt-6 max-w-[38ch] text-sm leading-7 text-white/60">
          Trailguide is simply a way to get thoughtful, practical help from someone who has done
          similar work before.
        </p>

        <div className="mt-8 flex max-w-[360px] items-start gap-3 rounded-[1rem] bg-[#ef7d45] p-4 text-[#24150e]">
          <MessageCircle
            className="mt-0.5 shrink-0"
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <p className="text-sm leading-6">
            Still unsure? You can browse the mentors first. There is no pressure to choose straight
            away.
          </p>
        </div>
      </div>

      <div className="relative grid gap-3">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          const buttonId = `trailguide-faq-button-${index}`;
          const panelId = `trailguide-faq-panel-${index}`;

          return (
            <article
              key={item.question}
              className={`overflow-hidden rounded-[1rem] transition-colors duration-300 ${
                isOpen ? "bg-white/[0.12]" : "bg-white/[0.065] hover:bg-white/[0.09]"
              }`}
            >
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left text-[0.95rem] font-semibold leading-6 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ef8b58] sm:px-6 sm:text-base"
                >
                  <span>{item.question}</span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white/65">
                    <ChevronDown
                      size={17}
                      strokeWidth={1.8}
                      aria-hidden="true"
                      className={`transition-transform duration-300 ease-out ${isOpen ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>
              </h3>

              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="max-w-[62ch] px-5 pb-6 text-sm leading-7 text-white/62 sm:px-6">
                    {item.answer}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
