import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, CalendarDays, Clock, Sparkles } from "lucide-react";
import { TrailgradMark } from "@/components/marketing/blueprint-art";
import { EditorialBackLink } from "@/components/marketing/editorial-back-link";
import { blogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Trailgrad notes on resume-based practice, interview answers, AI coaching, and clearer feedback.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Trailgrad Blog",
    description: "Practical notes on turning your resume into better interview answers.",
    url: "/blog"
  }
};

export default function BlogIndexPage() {
  const featured = blogPosts[0];
  const rest = blogPosts.slice(1);
  if (!featured) return null;

  return (
    <div className="editorial-theme blueprint min-h-screen overflow-x-clip">
      <EditorialBackLink />

      <main className="relative z-10 px-5 pb-14 pt-32 sm:px-10 sm:pb-20 sm:pt-36">
        <div className="pointer-events-none absolute left-1/2 top-24 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full" />
        <div className="pointer-events-none absolute -right-24 top-[36rem] hidden h-80 w-80 rounded-full sm:block" />
        <div className="pointer-events-none absolute -left-28 bottom-72 hidden h-72 w-72 rounded-full sm:block" />

        <section className="relative mx-auto w-full max-w-[78rem]">
          <div className="blog-rise mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-cream/18 bg-cream/[0.045] px-3.5 py-1.5 sm:backdrop-blur-sm">
              <TrailgradMark className="h-3.5 w-3.5 text-cream" />
              <span className="blueprint-label whitespace-nowrap text-cream/78">
                Trailgrad notes
              </span>
            </span>
            <h1 className="display-heading mt-6 text-5xl text-cream sm:text-7xl lg:text-8xl">
              Clearer practice starts here.
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-cream/76 sm:text-xl">
              Short reads on resumes, interview answers, and the small fixes that make practice
              feel easier to use.
            </p>
          </div>

          <Link
            href={`/blog/${featured.slug}`}
            className="blog-feature group mt-14 grid gap-8 transition lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-center"
          >
            <div className="relative order-2 lg:order-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="blueprint-label rounded-full border border-cream/18 bg-cream/[0.045] px-3 py-1 text-cream/64">
                  Featured note
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream/56">
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

              <div className="mt-7 grid gap-4 py-2">
                {featured.summary.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-start gap-3 text-base font-semibold leading-7 text-cream/72 sm:text-lg"
                  >
                    <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-cream/70" />
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

            <div className="relative order-1 min-h-[19rem] rounded-[1.4rem] lg:order-2 lg:min-h-[31rem]">
              <Image
                src={featured.coverImage}
                alt={featured.coverAlt}
                fill
                priority
                sizes="(min-width: 1024px) 43rem, 92vw"
                className="object-contain p-2 transition duration-700 group-hover:scale-[1.025] sm:p-4"
              />
            </div>
          </Link>

          <section className="mt-14 grid gap-6">
            {rest.map((post, index) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="blog-note-card group grid gap-5 rounded-[1.25rem] bg-cream/[0.035] p-4 transition sm:grid-cols-[13rem_1fr_auto] sm:items-center"
                style={{ animationDelay: `${180 + index * 130}ms` }}
              >
                <div className="relative min-h-[12rem] rounded-[1.15rem] border border-cream/[0.04] sm:min-h-[8.5rem]">
                  <Image
                    src={post.coverImage}
                    alt={post.coverAlt}
                    fill
                    sizes="(min-width: 1024px) 13rem, 92vw"
                    className="object-contain p-2 transition duration-700 group-hover:scale-[1.035]"
                  />
                </div>

                <div>
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
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
                    {post.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-base leading-7 text-cream/62">{post.dek}</p>
                </div>

                <span className="inline-flex items-center gap-2 text-sm font-bold text-cream transition group-hover:gap-3 sm:justify-self-end">
                  Read <ArrowRight size={15} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </section>

          <section className="blog-rise mt-14 grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <Sparkles size={34} strokeWidth={1.7} className="text-cream" aria-hidden="true" />
              <h2 className="mt-5 max-w-lg text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
                Notes you can use in the next round.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {["Resume stories", "Live answers", "Next fixes"].map((item) => (
                <div key={item} className="rounded-[1.1rem] bg-cream/[0.035] p-5">
                  <p className="blueprint-label text-cream/40">{item}</p>
                  <p className="mt-3 text-base leading-7 text-cream/64">
                    Small, practical ideas you can turn into one better practice session.
                  </p>
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>

    </div>
  );
}
