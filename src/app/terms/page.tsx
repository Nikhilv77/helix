import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, FileText, RotateCw, Scale, ShieldCheck, UserCheck } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/site-chrome";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the Trailgrad terms for using AI interview practice, mock feedback, resume-based prep, and account content.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service",
    description:
      "The terms for using Trailgrad AI interview practice, feedback, resume-based prep, and account content.",
    url: "/terms"
  }
};

const updatedAt = "August 8, 2026";

const sections = [
  {
    title: "Using Trailgrad",
    body: "Trailgrad is an AI interview practice workspace. You are responsible for the information you provide and how you use practice feedback.",
    icon: FileText
  },
  {
    title: "AI feedback",
    body: "Prompts, scores, reports, and suggestions are practice aids. They are not hiring decisions, employment advice, or a guarantee of interview performance.",
    icon: Scale
  },
  {
    title: "Your content",
    body: "You keep ownership of your resume, answers, transcripts, and profile content. Trailgrad processes that content to provide and improve the product.",
    icon: UserCheck
  },
  {
    title: "Acceptable use",
    body: "Do not misuse the service, disrupt the product, reverse engineer protected systems, upload harmful content, or use Trailgrad for unlawful activity.",
    icon: ShieldCheck
  },
  {
    title: "Availability",
    body: "Trailgrad may change, pause, or discontinue parts of the service. The product is provided without warranties to the fullest extent allowed by law.",
    icon: RotateCw
  }
];

export default function TermsPage() {
  const backAction = (
    <Link href="/" aria-label="Back" title="Back">
      <ArrowLeft size={20} aria-hidden="true" />
    </Link>
  );

  const footerAction = (
    <Link href="/" className="inline-flex items-center gap-2">
      Back <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );

  return (
    <div className="blueprint min-h-screen overflow-x-clip">
      <div className="blueprint-grid" />
      <SiteNav action={backAction} sectionHrefPrefix="/" />

      <main className="relative z-10 px-5 pb-12 pt-32 sm:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="blueprint-label text-cream/[0.58]">Trailgrad Legal</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-cream sm:text-6xl">
            Terms of Service
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-cream/[0.72]">
            The simple agreement for using Trailgrad interview practice.
          </p>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-cream/[0.42]">
            Last updated: {updatedAt}
          </p>
        </header>

        <section className="mx-auto mt-10 max-w-4xl rounded-[2rem] bg-white p-5 text-[#111827] shadow-[0_24px_70px_-34px_rgba(3,10,31,0.62)] sm:p-8">
          <div className="space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <section
                  key={section.title}
                  className="grid gap-4 rounded-2xl p-4 transition hover:bg-[#22409b]/[0.04] sm:grid-cols-[3rem_1fr]"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#22409b]/[0.08] text-[#22409b]">
                    <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-[#111827]">
                      {section.title}
                    </h2>
                    <p className="mt-2 text-base leading-7 text-[#111827]/[0.64]">
                      {section.body}
                    </p>
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter action={footerAction} sectionHrefPrefix="/" />
    </div>
  );
}
