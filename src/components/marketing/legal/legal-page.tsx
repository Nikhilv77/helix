import { SiteFooter, SiteNav } from "@/components/marketing/chrome/site-chrome";
import { PrimaryAction } from "@/components/marketing/home/primary-action";
import type { LegalDocument } from "@/content/marketing/legal";

/**
 * Reads like a blog post: one column of type, left-aligned, sections divided
 * by hairlines. The icons that used to sit in a 3rem gutter beside every
 * heading are gone — eight decorative glyphs down the side of a legal document
 * are noise, and they pushed the body into a narrow second column.
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <div
      className="blueprint marketing-theme min-h-screen overflow-x-clip"
      data-marketing-accent="orange"
    >
      <SiteNav
        actionKind="button"
        sectionHrefPrefix="/"
        action={
          <PrimaryAction ariaLabel="Start free" className="outline-none">
            Start free
          </PrimaryAction>
        }
      />

      <main className="marketing-theme-section relative z-10 px-5 pb-24 pt-36 sm:px-10 sm:pb-28 sm:pt-40">
        <article className="mx-auto w-full max-w-[44rem]">
          <header>
            <p className="blueprint-label text-[color:var(--dm-accent-soft)]">{document.eyebrow}</p>
            <h1 className="marketing-page-title mt-5 text-cream">{document.title}</h1>
            <p className="marketing-page-lede mt-5 max-w-[40rem] text-cream/70 sm:mt-6">
              {document.introduction}
            </p>
            <p className="mt-6 text-[0.8125rem] font-medium tracking-[-0.005em] text-cream/35">
              Last updated {document.updatedAt}
            </p>
          </header>

          <div className="mt-12 sm:mt-14">
            {document.sections.map((section) => (
              <section key={section.title} className="border-t border-white/[0.06] py-8 sm:py-9">
                <h2 className="marketing-reading-title text-cream">{section.title}</h2>
                <p className="marketing-reading-copy mt-4 text-cream/65">{section.body}</p>
              </section>
            ))}
          </div>
        </article>
      </main>

      <SiteFooter sectionHrefPrefix="/" />
    </div>
  );
}
