import type { Metadata } from "next";

export const siteName = "Helix";
export const defaultTitle = "Helix | Resume-Grounded AI Interview Practice";
export const defaultDescription =
  "Practice AI mock interviews that use your resume evidence, ask sharper follow-ups, and help you prepare with a personalized interview plan.";
export const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://helixinterviews.com";

export function pageTitle(title: string): string {
  return `${title} | ${siteName}`;
}

export function privatePageMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false
      }
    }
  };
}
