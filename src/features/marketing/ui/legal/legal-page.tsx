import type { CSSProperties } from "react";
import type { LegalDocument } from "@/features/marketing/content/legal";
import { SiteFooter } from "@/features/marketing/ui/chrome/site-footer";
import { SiteMark } from "@/features/marketing/ui/chrome/site-mark";
import { Reveal } from "@/shared/ui/motion/reveal";

/**
 * Reads like a blog post and looks like the home page: white, the mark alone
 * in the corner, the header rising in on load, and sections separated by
 * space rather than rules.
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <div
      className="blueprint marketing-theme min-h-screen overflow-x-clip"
      data-marketing-accent="orange"
    >
      <SiteMark />

      <main className="marketing-theme-section relative z-10 px-5 pb-24 pt-32 sm:px-10 sm:pb-32 sm:pt-44">
        <article className="mx-auto w-full max-w-[44rem]">
          <header>
            <h1 className="page-rise marketing-page-title wordmark text-cream">{document.title}</h1>
            <p
              className="page-rise marketing-page-lede mt-6 max-w-[40rem] text-cream/66 sm:mt-7"
              style={{ "--i": 1 } as CSSProperties}
            >
              {document.introduction}
            </p>
            <p
              className="page-rise mt-6 text-[0.875rem] text-cream/40"
              style={{ "--i": 2 } as CSSProperties}
            >
              Last updated {document.updatedAt}
            </p>
          </header>

          <div className="mt-14 space-y-12 sm:mt-16 sm:space-y-14">
            {document.sections.map((section) => (
              <Reveal key={section.title}>
                <section>
                  <h2 className="marketing-reading-title text-cream">{section.title}</h2>
                  <p className="marketing-reading-copy mt-4 text-cream/66">{section.body}</p>
                </section>
              </Reveal>
            ))}
          </div>
        </article>
      </main>

      <SiteFooter sectionHrefPrefix="/" />
    </div>
  );
}
