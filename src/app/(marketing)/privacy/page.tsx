import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/shared/seo";
import { privacyPolicy } from "@/features/marketing/content/legal";
import { LegalPage } from "@/features/marketing/ui/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read how Trailgrad handles resume text, interview answers, transcripts, reports, service providers, and workspace data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    ...baseOpenGraph,
    title: "Privacy Policy",
    description:
      "How Trailgrad handles resume text, interview answers, transcripts, reports, and workspace data.",
    url: "/privacy"
  }
};

export default function PrivacyPage() {
  return <LegalPage document={privacyPolicy} />;
}
