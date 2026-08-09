import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/site-chrome";
import { TrailgradMark } from "@/components/marketing/blueprint-art";
import { PrimaryAction } from "@/components/marketing/home/primary-action";
import { blogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Trailgrad essays on resume evidence, mock interview practice, AI coaching, and faster interview feedback loops.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Trailgrad Blog",
    description: "Practical essays on turning your resume into defensible interview answers.",
    url: "/blog"
  }
};

export default function BlogIndexPage() {
  const featured = blogPosts[0];
  const rest = blogPosts.slice(1);
  if (!featured) return null;

  const navAction = (
    <PrimaryAction ariaLabel="Start" className="outline-none">
      Start
    </PrimaryAction>
  );
  const footerAction = (
    <PrimaryAction className="inline-flex items-center gap-2">
      Start free <ArrowRight size={15} aria-hidden="true" />
    </PrimaryAction>
  );

  return (
    <div className="blueprint min-h-screen overflow-x-clip">
      <div className="blueprint-grid" />
      <div className="blueprint-rails" />
      <SiteNav action={navAction} actionKind="button" sectionHrefPrefix="/" />

      <main className="relative z-10 px-5 pb-16 pt-36 sm:px-10 sm:pb-24 sm:pt-40">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(241,234,216,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(241,234,216,0.08) 1px, transparent 1px)",
            backgroundPosition: "center top",
            backgroundSize: "11rem 11rem"
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-28 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full border border-cream/10" />
        <div className="pointer-events-none absolute -right-24 top-72 h-80 w-80 rounded-full border border-cream/10" />
        <div className="pointer-events-none absolute -left-28 bottom-80 h-72 w-72 rounded-full border border-cream/10" />

        <section className="relative mx-auto w-full max-w-[78rem]">
          <div className="pointer-events-none absolute -top-20 right-0 hidden text-[9rem] font-bold leading-none tracking-[-0.05em] text-cream/[0.035] lg:block">
            Field Notes
          </div>

          <div className="blog-rise max-w-5xl">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-cream/18 bg-cream/[0.045] px-3.5 py-1.5 backdrop-blur-sm">
              <TrailgradMark className="h-3.5 w-3.5 text-cream" />
              <span className="blueprint-label whitespace-nowrap text-cream/78">
                Trailgrad Blog
              </span>
            </span>
            <h1 className="display-heading mt-6 max-w-5xl text-5xl text-cream sm:text-7xl lg:text-8xl">
              Field notes for interviews you can defend.
            </h1>
            <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
              <p className="max-w-2xl text-lg leading-relaxed text-cream/76 sm:text-xl">
                Resume proof, live-round pressure, and feedback loops written for candidates who
                want signal without noise.
              </p>
              <div className="grid grid-cols-3 gap-4 border-t border-cream/14 pt-5 lg:border-t-0 lg:pt-0">
                {[
                  ["3", "Notes"],
                  ["18", "Min"],
                  ["1", "Fix"]
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="font-mono text-3xl font-semibold text-cream">{value}</p>
                    <p className="blueprint-label mt-1 text-cream/40">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Link
            href={`/blog/${featured.slug}`}
            className="blog-feature group mt-14 grid gap-8 transition lg:grid-cols-[minmax(0,1.04fr)_minmax(24rem,0.78fr)] lg:items-center"
          >
            <div className="blog-cover relative min-h-[20rem] overflow-hidden rounded-lg bg-[#2b499f] shadow-[0_34px_100px_-62px_rgba(3,10,31,0.86)] sm:min-h-[28rem] lg:min-h-[34rem]">
              <Image
                src={featured.coverImage}
                alt={featured.coverAlt}
                fill
                priority
                sizes="(min-width: 1024px) 48rem, 92vw"
                className="object-cover transition duration-700 group-hover:scale-[1.025]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#13234f]/24 via-transparent to-transparent" />
            </div>

            <div className="relative">
              <div className="flex flex-wrap items-center gap-3">
                <span className="blueprint-label rounded-full bg-cream/8 px-3 py-1 text-cream/64">
                  Featured
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream/52">
                  <Clock size={15} aria-hidden="true" />
                  {featured.readTime}
                </span>
              </div>
              <h2 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-cream sm:text-5xl">
                {featured.title}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-cream/68 sm:text-lg">
                {featured.dek}
              </p>

              <div className="mt-7 grid gap-3 border-y border-cream/14 py-6">
                {featured.summary.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-start gap-3 text-sm font-semibold leading-6 text-cream/64"
                  >
                    <CheckCircle2
                      size={17}
                      className="mt-1 shrink-0 text-[#8be6bd]"
                      aria-hidden="true"
                    />
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between gap-6">
                <div>
                  <p className="blueprint-label text-cream/38">{featured.metricLabel}</p>
                  <p className="mt-1 font-mono text-3xl font-semibold text-cream">
                    {featured.metric}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-cream transition group-hover:gap-3">
                  Read note <ArrowRight size={16} aria-hidden="true" />
                </span>
              </div>
            </div>
          </Link>

          <section className="mt-14 grid auto-rows-fr gap-9 lg:grid-cols-2">
            {rest.map((post, index) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="blog-note-card group flex h-full flex-col transition"
                style={{ animationDelay: `${180 + index * 130}ms` }}
              >
                <div className="blog-cover relative min-h-[18rem] overflow-hidden rounded-lg bg-[#2b499f] shadow-[0_24px_80px_-62px_rgba(3,10,31,0.78)]">
                  <Image
                    src={post.coverImage}
                    alt={post.coverAlt}
                    fill
                    sizes="(min-width: 1024px) 38rem, 92vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.035]"
                  />
                </div>
                <div className="flex flex-1 flex-col pt-6">
                  <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-cream/48">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen size={15} aria-hidden="true" />
                      {post.category}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={15} aria-hidden="true" />
                      {post.readTime}
                    </span>
                  </div>
                  <h3 className="mt-4 text-3xl font-semibold tracking-tight text-cream">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-cream/62">{post.dek}</p>
                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold text-cream transition group-hover:gap-3">
                    Read article <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </section>

          <section className="blog-rise mt-16 grid gap-6 border-t border-cream/14 pt-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-cream/8 text-cream">
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <h2 className="mt-5 max-w-lg text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
                Clean notes, built for the next round.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {["Resume proof", "Mock pressure", "Report loops"].map((item) => (
                <div key={item} className="border-t border-cream/14 pt-5">
                  <p className="blueprint-label text-cream/40">{item}</p>
                  <p className="mt-3 text-base leading-7 text-cream/64">
                    Short, usable notes designed to become your next practice round.
                  </p>
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>

      <SiteFooter action={footerAction} sectionHrefPrefix="/" />
    </div>
  );
}
