import { EditorialBackLink } from "@/components/marketing/chrome/editorial-back-link";
import type { LegalDocument } from "@/content/marketing/legal";

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <div className="editorial-theme blueprint min-h-screen overflow-x-clip">
      <EditorialBackLink />

      <main className="relative z-10 px-5 pb-12 pt-32 sm:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="blueprint-label text-cream/[0.58]">{document.eyebrow}</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-cream sm:text-6xl">
            {document.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-cream/[0.72]">
            {document.introduction}
          </p>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-cream/[0.42]">
            Last updated: {document.updatedAt}
          </p>
        </header>

        <section className="mx-auto mt-10 max-w-4xl rounded-[2rem] border border-white/10 bg-[#18191c] p-5 text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
          <div className="space-y-2">
            {document.sections.map((section) => {
              const Icon = section.icon;
              return (
                <section
                  key={section.title}
                  className="grid gap-4 rounded-2xl p-4 transition hover:bg-[#F26E01]/[0.06] sm:grid-cols-[3rem_1fr]"
                >
                  <span className="pt-0.5 text-[#F26E01]">
                    <Icon size={30} strokeWidth={1.75} aria-hidden="true" />
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
    </div>
  );
}

