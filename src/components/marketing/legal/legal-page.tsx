import { ArrowRight } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/chrome/site-chrome";
import { PrimaryAction } from "@/components/marketing/home/primary-action";
import type { LegalDocument } from "@/content/marketing/legal";

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <div
      className="marketing-theme editorial-theme blueprint min-h-screen overflow-x-clip"
      data-marketing-accent="orange"
    >
      <SiteNav
        actionKind="button"
        sectionHrefPrefix="/"
        action={
          <PrimaryAction ariaLabel="Start" className="outline-none">
            Start
          </PrimaryAction>
        }
      />

      <main className="relative z-10 px-5 pb-12 pt-32 sm:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="blueprint-label text-cream/[0.58]">{document.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
            {document.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-cream/[0.72]">
            {document.introduction}
          </p>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-cream/[0.42]">
            Last updated: {document.updatedAt}
          </p>
        </header>

        <section className="public-glass mx-auto mt-10 max-w-4xl rounded-[2rem] px-5 text-cream sm:px-8">
          <div>
            {document.sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <section
                  key={section.title}
                  className={`grid gap-4 py-7 sm:grid-cols-[3rem_1fr] sm:py-8 ${index > 0 ? "border-t border-white/[0.08]" : ""}`}
                >
                  <span className="pt-0.5 text-cream/58">
                    <Icon size={28} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-cream">
                      {section.title}
                    </h2>
                    <p className="mt-2 text-base leading-7 text-cream/64">{section.body}</p>
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </main>
      <SiteFooter
        sectionHrefPrefix="/"
        action={
          <PrimaryAction className="inline-flex items-center gap-2">
            Start free <ArrowRight size={15} aria-hidden="true" />
          </PrimaryAction>
        }
      />
    </div>
  );
}
