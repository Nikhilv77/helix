import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function EditorialBackLink({ href = "/auth/continue" }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Go back"
      className="fixed left-4 top-4 z-50 inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#18191c]/95 px-4 text-sm font-semibold text-cream/72 shadow-[0_16px_42px_-28px_rgba(0,0,0,0.9)] backdrop-blur-md transition hover:border-white/[0.12] hover:bg-[#202126] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/35 sm:left-6 sm:top-6"
    >
      <ArrowLeft size={17} aria-hidden="true" />
      Back
    </Link>
  );
}
