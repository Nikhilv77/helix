import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";

export default function ChapterNotFound() {
  return (
    <div className="mx-auto flex min-h-[72svh] w-full max-w-[94rem] items-center bg-black px-5 py-16 sm:px-8 lg:px-10">
      <section className="w-full max-w-xl">
        <Compass size={24} aria-hidden="true" className="text-cream/48" />
        <h1 className="mt-6 font-display text-[clamp(2rem,5vw,3.2rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-cream">
          This session isn&apos;t in your path.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-7 text-cream/58">
          It may have been renamed or the link may be out of date. Your practice roadmap is still
          available from the library.
        </p>
        <Link
          href="/practice"
          className="group mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-cream px-5 text-[14px] font-semibold text-[#171a16] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Back to Practice
          <ArrowRight
            size={15}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </section>
    </div>
  );
}
