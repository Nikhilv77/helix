import type { Metadata } from "next";
import { FileText, LockKeyhole, Server, ShieldCheck, User } from "lucide-react";
import { EditorialBackLink } from "@/components/marketing/editorial-back-link";

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
  return (
    <div className="editorial-theme blueprint min-h-screen overflow-x-clip">
      <EditorialBackLink />

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

        <section className="mx-auto mt-10 max-w-4xl rounded-[2rem] border border-white/10 bg-[#18191c] p-5 text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
          <div className="space-y-2">
            {sections.map((section) => {
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
                    <p className="mt-2 text-base leading-7 text-cream/64">
                      {section.body}
                    </p>
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
