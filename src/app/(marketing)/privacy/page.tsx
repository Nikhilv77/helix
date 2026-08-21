import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal/legal-page";
import { privacyPolicy } from "@/content/marketing/legal";

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

export default function PrivacyPage() {
  return <LegalPage document={privacyPolicy} />;
}

