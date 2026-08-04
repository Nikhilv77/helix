import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { clerkAppearance } from "@/lib/clerk-theme";
import { appUrl, defaultDescription, defaultTitle, siteName } from "@/lib/seo";
import "./globals.css";

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
      { url: "/brand/helix-favicon.svg", type: "image/svg+xml" },
      { url: "/brand/helix-icon.png", type: "image/png", sizes: "790x796" }
    ],
    shortcut: "/brand/helix-favicon.svg",
    apple: "/brand/helix-icon.png"
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [{ url: "/brand/helix-logo.png", width: 1200, height: 630, alt: "Helix" }]
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/brand/helix-logo.png"]
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
  }
};

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap"
});

const sansFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap"
});

const fontVariables = `${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`;

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Resolved on the server so the workspace chrome is never wrong on first
  // paint, and signed-in users never see the marketing page flash through.
  const { userId } = clerkPublishableKey ? await auth() : { userId: null };

  const app = (
    <>
      <ScrollRestoration />
      {userId ? <WorkspaceShell>{children}</WorkspaceShell> : <main>{children}</main>}
    </>
  );

  return (
    <html lang="en" className={fontVariables}>
      <body>
        {clerkPublishableKey ? (
          <ClerkProvider appearance={clerkAppearance}>{app}</ClerkProvider>
        ) : (
          app
        )}
      </body>
    </html>
  );
}
