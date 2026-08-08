import type { Metadata } from "next";

export const siteName = "Trailgrad";
export const defaultTitle = "Trailgrad | Learn the Patterns, Then Defend Them";
export const defaultDescription =
  "A guided path through the 123 questions and 12 patterns interviews actually ask, plus AI voice mock interviews that press on your resume evidence and score what you can defend.";
export const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trailgrad.com";

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
