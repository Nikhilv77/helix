"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Building2 } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";

export function AuthenticatedHeader() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[#08090d]/78 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-3 text-base font-semibold tracking-normal text-ink"
        >
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.03] transition group-hover:scale-105">
            <Image
              src="/brand/helix-icon.svg"
              alt=""
              width={28}
              height={28}
              priority
              unoptimized
            />
          </span>
          <span>Helix</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1.5 text-sm text-muted sm:inline-flex">
            <Building2 size={14} className="text-accent" aria-hidden="true" />
            Personal workspace
          </span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/5 text-muted transition hover:border-white/20 hover:text-ink"
            aria-label="Notifications"
          >
            <Bell size={16} aria-hidden="true" />
          </button>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-10 w-10"
              }
            }}
          />
        </div>
      </div>
    </header>
  );
}
