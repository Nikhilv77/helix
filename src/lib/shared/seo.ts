import type { Metadata } from "next";

export const siteName = "Trailgrad";
export const defaultTitle = "Trailgrad | Software Engineering Interview Prep Built Around You";
export const defaultDescription =
  "Prepare for software engineering interviews with resume-based practice, realistic mock interviews, clear feedback, and help when you get stuck.";
export const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trailgrad.com";

/**
 * Open Graph fields every public page needs. Next.js replaces a parent's
 * `openGraph` object instead of merging it, so a page that sets its own title
 * must spread these back in or it loses the preview image and site name.
 */
export const baseOpenGraph = {
  type: "website",
  siteName,
  images: [
    {
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "Trailgrad AI interview practice"
    }
  ]
} satisfies NonNullable<Metadata["openGraph"]>;

/** Same for `twitter`, which is also replaced rather than merged. */
export const baseTwitter = {
  card: "summary_large_image",
  images: ["/opengraph-image"]
} satisfies NonNullable<Metadata["twitter"]>;

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
