import type { Metadata } from "next";

export const siteName = "Trailgrad";
export const defaultTitle = "Trailgrad | AI Interview Practice Built From Your Resume";
export const defaultDescription =
  "Turn your resume into a focused interview prep path, practice live AI mock interviews with Maya, and get reports that show what you can defend.";
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
