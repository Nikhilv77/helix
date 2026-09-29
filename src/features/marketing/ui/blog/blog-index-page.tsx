import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { blogPosts } from "@/features/marketing/content/blog";
import { SiteFooter } from "@/features/marketing/ui/chrome/site-footer";
import { SiteMark } from "@/features/marketing/ui/chrome/site-mark";
import { Reveal } from "@/shared/ui/motion/reveal";

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

/**
 * Same as the home page: white, the mark alone in the corner, a big headline
 * that rises in on load. The lead note sits in the films' ember frame; the
 * rest are quiet rows with no rules that rise in as you scroll.
 */
export function BlogIndexPage() {
  const featured = blogPosts[0];
  const rest = blogPosts.slice(1);
  if (!featured) return null;

  return (
    <div
      className="blueprint marketing-blog marketing-theme min-h-screen overflow-x-clip"
      data-marketing-accent="orange"
    >
      <SiteMark />

      <main className="marketing-theme-section relative z-10 px-5 pb-24 pt-32 sm:px-10 sm:pb-32 sm:pt-44">
        <div className="mx-auto w-full max-w-[58rem]">
          <header className="text-center">
            <h1 className="page-rise marketing-page-title wordmark text-cream">
              Clearer practice starts here.
            </h1>
            <p
              className="page-rise marketing-page-lede mx-auto mt-6 max-w-lg text-cream/66 sm:mt-7"
              style={{ "--i": 1 } as CSSProperties}
            >
              Short reads on resumes, interview answers, and the small fixes that make practice
              easier.
            </p>
          </header>

          <div className="page-rise mt-16 sm:mt-20" style={{ "--i": 2 } as CSSProperties}>
            <Link
              href={`/blog/${featured.slug}`}
              className="ember-card group block rounded-[1.5rem] px-6 py-8 outline-none focus-visible:ring-2 focus-visible:ring-cream/30 sm:px-10 sm:py-10"
            >
              <p className="text-sm text-cream/45">
                {featured.category}, {featured.readTime}
              </p>
              <h2 className="marketing-card-title mt-4 max-w-2xl text-cream">{featured.title}</h2>
              <p className="marketing-reading-copy mt-4 max-w-2xl text-cream/60">{featured.dek}</p>

              <ul className="mt-7 grid gap-3">
                {featured.summary.map((item) => (
                  <li key={item} className="flex gap-3 text-base leading-[1.7] text-cream/60">
                    <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--dm-accent)]" />
                    {item}
                  </li>
                ))}
              </ul>

              <span className="mt-8 inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-cream transition-[gap] duration-300 group-hover:gap-3">
                Read note <ArrowRight size={16} aria-hidden="true" />
              </span>
            </Link>
          </div>

          <div className="mt-10 sm:mt-14">
            {rest.map((post, index) => (
              <Reveal key={post.slug} delay={index * 90}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="page-row group flex items-center gap-6 rounded-2xl px-1 py-7 outline-none focus-visible:ring-2 focus-visible:ring-cream/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-cream/45">
                      {post.category}, {post.readTime}
                    </p>
                    <h3 className="page-row-title marketing-list-title mt-2.5 text-cream">
                      {post.title}
                    </h3>
                    <p className="mt-2 max-w-2xl text-base leading-[1.7] text-cream/55">
                      {post.dek}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="page-row-arrow grid h-10 w-10 shrink-0 place-items-center rounded-full"
                  >
                    <ArrowRight size={17} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter sectionHrefPrefix="/" />
    </div>
  );
}
