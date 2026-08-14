import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Josefin_Sans, Raleway } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Analytics } from "@vercel/analytics/next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { AuthSync } from "@/components/workspace/auth-sync";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { clerkAppearance } from "@/lib/clerk-theme";
import { appUrl, defaultDescription, defaultTitle, siteName } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";
import "./globals.css";

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: siteName,
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`
  },
  description: defaultDescription,
  keywords: [
    "AI interview practice",
    "mock interview software",
    "resume interview preparation",
    "AI interview coach",
    "AI resume interview practice",
    "voice mock interview",
    "interview preparation app",
    "behavioral interview practice",
    "technical interview practice"
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  category: "software",
  icons: {
    // SVG first for the tab (the raw PNG is white on transparency and vanishes
    // on a light tab); the PNG stays for platforms that want a bitmap.
    icon: [
      { url: "/brand/trailgrad-favicon.svg", type: "image/svg+xml" },
      { url: "/brand/trailgrad-icon.png", type: "image/png", sizes: "790x796" }
    ],
    shortcut: "/brand/trailgrad-favicon.svg",
    apple: "/brand/trailgrad-icon.png"
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Trailgrad AI interview practice"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/opengraph-image"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1
    }
  },
  ...(googleSiteVerification
    ? {
        verification: {
          google: googleSiteVerification
        }
      }
    : {})
};

/**
 * One typeface across the product. Raleway gives Trailgrad a little more
 * warmth than the previous neutral UI face while keeping the interface clean.
 *
 * Headings and body share the family and separate on weight and size instead,
 * with Geist Mono for numerals, slugs and code.
 */
const displayFont = Raleway({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

const sansFont = Raleway({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const monoFont = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"
});

const cardFont = Josefin_Sans({
  subsets: ["latin"],
  variable: "--font-card",
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

const fontVariables = `${displayFont.variable} ${sansFont.variable} ${monoFont.variable} ${cardFont.variable}`;

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function isWorkspaceChromeRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/practice" ||
    pathname.startsWith("/practice/") ||
    pathname === "/interviews" ||
    pathname === "/progress" ||
    pathname === "/reports" ||
    pathname === "/profile" ||
    pathname === "/manage" ||
    pathname.startsWith("/sessions/") ||
    pathname.startsWith("/session/")
  );
}

/**
 * Never prerendered or reused across auth states.
 *
 * The layout decides whether the workspace chrome renders at all, and Next
 * does not re-render layouts on client-side navigation. Without this, a layout
 * that rendered once without a resolved session kept being reused, so pages
 * reached by navigation appeared with no sidebar while a freshly loaded page
 * had one.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Resolved on the server so the workspace chrome is never wrong on first
  // paint, and signed-in users never see the marketing page flash through.
  const { userId } = clerkPublishableKey ? await auth() : { userId: null };
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-trailgrad-pathname") ?? "";
  const search = requestHeaders.get("x-trailgrad-search") ?? "";
  const workspaceRoute = isWorkspaceChromeRoute(pathname);
  const welcomeHome = pathname === "/" && new URLSearchParams(search).get("welcome") === "maya";

  if (workspaceRoute && pathname !== "/" && !userId) redirect("/");

  let showWorkspaceShell = false;
  if (userId && workspaceRoute && !welcomeHome) {
    const profile = await getAppContainer()
      .profileService.get(authenticatedOwnerId(userId))
      .catch(() => null);
    if (!profile?.onboardingCompletedAt) redirect("/onboarding");
    showWorkspaceShell = true;
  }

  const app = (
    <>
      <ScrollRestoration />
      {showWorkspaceShell ? (
        <WorkspaceShell>{children}</WorkspaceShell>
      ) : userId ? (
        children
      ) : (
        <>
          <AuthSync />
          <main>{children}</main>
        </>
      )}
    </>
  );

  return (
    <html lang="en" className={fontVariables}>
      {/* Decided on the server alongside the shell itself, so the canvas is
          never marketing-black for a signed-in user, even on first paint. */}
      <body className={userId ? "workspace" : undefined}>
        {clerkPublishableKey ? (
          <ClerkProvider appearance={clerkAppearance}>{app}</ClerkProvider>
        ) : (
          app
        )}
        <Analytics />
      </body>
    </html>
  );
}
