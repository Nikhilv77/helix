import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/chrome/site-chrome";
import { PrimaryAction } from "@/components/marketing/home/primary-action";
import { blogPosts } from "@/content/marketing/blog";

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

export function BlogIndexPage() {
  const featured = blogPosts[0];
  const rest = blogPosts.slice(1);
  if (!featured) return null;

  return (
    <div
      className="blueprint marketing-theme min-h-screen overflow-x-clip"
      data-marketing-accent="orange"
    >
      <SiteNav
        actionKind="button"
        sectionHrefPrefix="/"
        action={
          <PrimaryAction ariaLabel="Start free" className="outline-none">
            Start free
          </PrimaryAction>
        }
      />

      <main className="marketing-theme-section relative z-10 px-5 pb-24 pt-36 sm:px-10 sm:pb-28 sm:pt-40">
        <div className="mx-auto w-full max-w-[58rem]">
          <header className="text-center">
            <p className="blueprint-label text-[color:var(--dm-accent-soft)]">Trailgrad notes</p>
            <h1 className="marketing-page-title mt-5 text-cream">Clearer practice starts here.</h1>
            <p className="marketing-page-lede mx-auto mt-5 max-w-lg text-cream/70 sm:mt-6">
              Short reads on resumes, interview answers, and the small fixes that make practice
              easier.
            </p>
          </header>

          {/* The lead note gets the panel; the rest are rows, the way the home
              page separates one artifact from a list. */}
          <Link
            href={`/blog/${featured.slug}`}
            className="public-glass group mt-14 block rounded-[1.5rem] px-6 py-7 transition-colors duration-300 hover:border-white/[0.16] sm:px-9 sm:py-9"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="blueprint-label text-[color:var(--dm-accent-soft)]">
                {featured.category}
              </span>
              <span className="text-cream/20">·</span>
              <span className="text-sm text-cream/35">{featured.readTime}</span>
            </div>

            <h2 className="marketing-card-title mt-5 max-w-2xl text-cream">{featured.title}</h2>
            <p className="marketing-reading-copy mt-4 max-w-2xl text-cream/60">{featured.dek}</p>

            <ul className="mt-7 grid gap-3 border-t border-white/[0.06] pt-7">
              {featured.summary.map((item) => (
                <li key={item} className="flex gap-3 text-base leading-[1.7] text-cream/55">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--dm-accent)]" />
                  {item}
                </li>
              ))}
            </ul>

            <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-cream transition-[gap] duration-300 group-hover:gap-3">
              Read note <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>

          <div className="mt-4">
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex items-baseline gap-6 border-b border-white/[0.06] py-7"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="blueprint-label text-cream/35">{post.category}</span>
                    <span className="text-cream/15">·</span>
                    <span className="text-sm text-cream/30">{post.readTime}</span>
                  </div>
                  <h3 className="marketing-list-title mt-3 text-cream">{post.title}</h3>
                  <p className="mt-2 max-w-2xl text-base leading-[1.7] text-cream/50">
                    {post.dek}
                  </p>
                </div>

                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-cream/25 transition-[color,transform] duration-300 group-hover:translate-x-1 group-hover:text-cream/70"
                />
              </Link>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter sectionHrefPrefix="/" />
    </div>
  );
}
