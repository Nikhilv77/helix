import type { Metadata } from "next";

export const siteName = "Trailgrad";
export const defaultTitle = "Trailgrad | Software Engineering Interview Prep Built Around You";
export const defaultDescription =
  "Prepare for software engineering interviews with resume-based practice, realistic mock interviews, clear feedback, and help when you get stuck.";
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
