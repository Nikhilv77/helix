"use client";

import { ArrowRight } from "lucide-react";
import { SiteFooter, SiteNav } from "./site-chrome";
import { Delivery } from "./home/delivery-section";
import { Hero } from "./home/hero";
import { LearningPath } from "./home/learning-path-section";
import { PrimaryAction } from "./home/primary-action";
import { QuestionLab } from "./home/question-lab-section";
import { TheInterview } from "./home/interview-section";

export function MarketingHome() {
  return (
    <div className="blueprint overflow-x-clip">
      <div className="blueprint-grid" />
      <div className="blueprint-rails" />

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
          <PrimaryAction className="inline-flex items-center gap-2 text-sm font-semibold text-[#22409b] transition hover:gap-3 hover:text-[#13234f]">
            Start free <ArrowRight size={15} aria-hidden="true" />
          </PrimaryAction>
        }
      />
    </div>
  );
}
