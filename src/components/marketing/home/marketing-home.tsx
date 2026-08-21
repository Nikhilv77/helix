"use client";

import { ArrowRight } from "lucide-react";
import { SiteFooter, SiteNav } from "../chrome/site-chrome";
import { Delivery } from "./delivery-section";
import { Hero } from "./hero";
import { LearningPath } from "./learning-path-section";
import { PrimaryAction } from "./primary-action";
import { QuestionLab } from "./question-lab-section";
import { TheInterview } from "./interview-section";

export function MarketingHome() {
  return (
    <div className="blueprint marketing-theme overflow-x-clip" data-marketing-accent="orange">
      <SiteNav
        actionKind="button"
        action={
          <PrimaryAction ariaLabel="Start" className="outline-none">
            Start
          </PrimaryAction>
        }
      />

      <main className="relative">
        <Hero />
        <LearningPath />
        <QuestionLab />
        <TheInterview />
        <Delivery />
      </main>

      <SiteFooter
        action={
          <PrimaryAction className="inline-flex items-center gap-2 text-sm font-semibold text-[#13234f] transition hover:gap-3 hover:text-[#0d1b44]">
            Start free <ArrowRight size={15} aria-hidden="true" />
          </PrimaryAction>
        }
      />
    </div>
  );
}
