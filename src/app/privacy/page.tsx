import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, FileText, LockKeyhole, Server, ShieldCheck, User } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/site-chrome";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read how Trailgrad handles resume text, interview answers, transcripts, reports, service providers, and workspace data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy",
    description:
      "How Trailgrad handles resume text, interview answers, transcripts, reports, and workspace data.",
    url: "/privacy"
  }
};

const updatedAt = "August 8, 2026";

const sections = [
  {
    title: "Information we process",
    body: "Trailgrad processes profile details, resume text, interview answers, transcripts, progress, and reports so your practice can stay relevant to your goals.",
    icon: FileText
  },
  {
    title: "Resume handling",
    body: "Resume files are used to extract interview evidence. The current flow reads the uploaded file in memory and does not store the original file.",
    icon: User
  },
  {
    title: "Workspace data",
    body: "Interview transcripts, reports, progress, and profile settings stay inside your private account workspace.",
    icon: LockKeyhole
  },
  {
    title: "Service providers",
    body: "Trailgrad may use authentication, infrastructure, database, voice, and AI providers. They process data only as needed to run product features.",
    icon: Server
  },
  {
    title: "Security",
    body: "We use reasonable technical and organizational safeguards to protect your data. No internet service can be guaranteed perfectly secure.",
    icon: ShieldCheck
  }
];

export default function PrivacyPage() {
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
          <p className="blueprint-label text-cream/[0.58]">Trailgrad Privacy</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-cream sm:text-6xl">
            Privacy Policy
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-cream/[0.72]">
            A clear summary of what Trailgrad processes when you upload a resume, practice
            interviews, and review reports.
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
