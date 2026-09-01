import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Josefin_Sans, Raleway } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Analytics } from "@vercel/analytics/next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/chrome/workspace-shell";
import { AuthSync } from "@/components/workspace/chrome/auth-sync";
import { WorkspaceTeacherProvider } from "@/lib/avatars/teacher-context";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { clerkAppearance } from "@/lib/auth/clerk-theme";
import { appUrl, defaultDescription, defaultTitle, siteName } from "@/lib/shared/seo";
import type { WorkspaceAccent } from "@/lib/workspace/accent";
import { welcomePersonaFromQuery } from "@/lib/avatars/personas";
import { isWorkspaceChromeRoute } from "@/lib/workspace/workspace-routes";
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
    icon: [
      { url: "/brand/favicon.ico", type: "image/x-icon", sizes: "48x48" },
      { url: "/brand/logo-black-bg.png", type: "image/png", sizes: "1200x1200" }
    ],
    shortcut: "/brand/favicon.ico",
    apple: {
      url: "/brand/logo-black-bg.png",
      type: "image/png",
      sizes: "1200x1200"
    }
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

/**
 * Never prerendered or reused across auth states.
 *
 * The signed-in workspace shell stays mounted across public and workspace
 * routes. Next reuses this layout during client navigation, so mounting the
 * shell only for the first pathname would make the sidebar impossible to
 * restore when returning from Trailguide without a hard refresh.
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
  const welcomeHome =
    pathname === "/" &&
    welcomePersonaFromQuery(new URLSearchParams(search).get("welcome")) !== null;

  if (workspaceRoute && pathname !== "/" && !userId) redirect("/");

  let initialWorkspaceAccent: WorkspaceAccent | undefined;
  let initialTeacherId: string | null = null;
  let initialProfileImage: string | null = null;

  if (userId) {
    const profile = await getAppContainer()
      .profileService.get(authenticatedOwnerId(userId))
      .catch(() => null);
    if (workspaceRoute && !welcomeHome && !profile?.onboardingCompletedAt) redirect("/onboarding");
    if (profile) {
      initialTeacherId = profile.teacherId;
      initialProfileImage = profile.profileImage;
      initialWorkspaceAccent = profile.workspaceAccent;
    }
  }

  const app = (
    <>
      <ScrollRestoration />
      {userId ? (
        <WorkspaceTeacherProvider teacherId={initialTeacherId}>
          <WorkspaceShell
            initialAccent={initialWorkspaceAccent}
            initialProfileImage={initialProfileImage}
          >
            {children}
          </WorkspaceShell>
        </WorkspaceTeacherProvider>
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
      {/* Decided on the server alongside the shell itself so workspace-specific
          global behavior is present on the first paint. */}
      <body className={userId && workspaceRoute ? "workspace" : undefined}>
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
