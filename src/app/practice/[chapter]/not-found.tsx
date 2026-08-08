import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";

export default function ChapterNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[95rem] flex-col items-start px-5 py-16 sm:px-8 lg:px-10">
      <div className="w-full max-w-xl rounded-[1.5rem] bg-[#3557b4] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07)] sm:p-5">
        <div className="rounded-2xl bg-[#2a4aa0] p-6 sm:p-8">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream/[0.08] text-cream/55">
            <Compass size={20} aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-[1.75rem] font-semibold tracking-tight text-cream">
            That session isn&apos;t in your path.
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-cream/65">
            The chapter you followed does not exist in the frontend roadmap. It may have been
            renamed, or the link may be out of date.
          </p>
          <Link
            href="/practice"
            className="group mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-5 text-[14px] font-semibold text-[#1d3a86] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Back to Practice
            <ArrowRight
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
