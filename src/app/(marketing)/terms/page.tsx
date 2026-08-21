import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal/legal-page";
import { termsOfService } from "@/content/marketing/legal";

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

export default function TermsPage() {
  return <LegalPage document={termsOfService} />;
}

