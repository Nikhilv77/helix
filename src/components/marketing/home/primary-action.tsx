"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import type { ReactNode } from "react";

export function PrimaryAction({
  children,
  className,
  ariaLabel
}: {
  children: ReactNode;
  className: string;
  ariaLabel?: string;
}) {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <SignInButton
        mode="modal"
        forceRedirectUrl="/auth/continue"
        signUpForceRedirectUrl="/auth/continue"
      >
        <button type="button" aria-label={ariaLabel} className={className}>
          {children}
        </button>
      </SignInButton>
    );
  }

  return (
    <Link href="/interview" aria-label={ariaLabel} className={className}>
      {children}
    </Link>
  );
}
