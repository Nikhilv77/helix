import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/shared/seo";
import { termsOfService } from "@/features/marketing/content/legal";
import { LegalPage } from "@/features/marketing/ui/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the Trailgrad terms for using AI interview practice, mock feedback, resume-based prep, and account content.",
  alternates: { canonical: "/terms" },
  openGraph: {
    ...baseOpenGraph,
    title: "Terms of Service",
    description:
      "The terms for using Trailgrad AI interview practice, feedback, resume-based prep, and account content.",
    url: "/terms"
  }
};

export default function TermsPage() {
  return <LegalPage document={termsOfService} />;
}
