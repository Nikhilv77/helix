import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";

export default function NotFound() {
  return (
    <main className="blueprint relative grid min-h-screen min-h-[100svh] place-items-center overflow-hidden px-5 py-16 text-cream">
      <div className="blueprint-grid" />
      <div className="blueprint-rails" />
      <div className="blueprint-glow" />

      <section className="relative z-10 mx-auto w-full max-w-2xl text-center">
        <TrailgradMark className="mx-auto h-20 w-20 rotate-1 text-cream/78" />

        <p className="blueprint-label mt-8 text-cream/48">404</p>
        <h1 className="mt-4 text-balance text-[2.45rem] font-bold leading-tight tracking-tight text-cream sm:text-[4.5rem]">
          This trail stops here.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-cream/64 sm:text-lg">
          The page you opened does not exist, or it moved while the map was being redrawn.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-11 rotate-[-0.7deg] items-center justify-center gap-2 rounded-lg border border-cream/55 bg-cream/[0.05] px-5 text-sm font-bold text-cream/78 outline-none backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:rotate-0 hover:border-cream/75 hover:bg-cream/[0.085] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/65"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Back home
          </Link>
          <Link
            href="/practice"
            className="inline-flex min-h-11 rotate-[0.7deg] items-center justify-center gap-2 rounded-lg border border-cream/24 bg-cream/[0.025] px-5 text-sm font-semibold text-cream/58 outline-none backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:rotate-0 hover:border-cream/42 hover:bg-cream/[0.055] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/45"
          >
            <Compass size={18} aria-hidden="true" />
            Open practice
          </Link>
        </div>
      </section>
    </main>
  );
}
