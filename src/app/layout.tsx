import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { clerkAppearance } from "@/lib/clerk-theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helix",
  description: "An AI product builder workspace for product and architecture teams.",
  icons: {
    icon: "/brand/helix-icon.svg",
    shortcut: "/brand/helix-icon.svg",
    apple: "/brand/helix-icon.svg"
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
