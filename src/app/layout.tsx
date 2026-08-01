import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthenticatedShell } from "@/components/auth/authenticated-shell";
import { ScrollRestoration } from "@/components/scroll-restoration";
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

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {clerkPublishableKey ? (
        <AuthenticatedShell>{children}</AuthenticatedShell>
      ) : (
        <main>{children}</main>
      )}
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const app = (
    <>
      <ScrollRestoration />
      <AppShell>{children}</AppShell>
    </>
  );

  return (
    <html lang="en">
      <body>{clerkPublishableKey ? <ClerkProvider>{app}</ClerkProvider> : app}</body>
    </html>
  );
}
