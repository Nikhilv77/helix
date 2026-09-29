import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { blogPosts, getBlogPost } from "@/features/marketing/content/blog";
import { SiteFooter } from "@/features/marketing/ui/chrome/site-footer";
import { SiteMark } from "@/features/marketing/ui/chrome/site-mark";
import { Reveal } from "@/shared/ui/motion/reveal";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) {
    return {
      title: "Blog post not found",
      description: "This Trailgrad blog post could not be found."
    };
  }

  return {
    title: post.title,
    description: post.dek,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.dek,
      url: `/blog/${post.slug}`,
      images: [
        {
          url: post.coverImage,
          width: 1536,
          height: 1024,
          alt: post.coverAlt
        }
      ]
    },
    twitter: {
      title: post.title,
      description: post.dek,
      images: [post.coverImage]
    }
  };
}

/**
 * One column of type on white, like the home page: the header rises in on
 * load, sections rise in as you scroll, and nothing is boxed or ruled off.
 */
export async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const relatedPosts = blogPosts.filter((candidate) => candidate.slug !== post.slug).slice(0, 2);

  return (
    <div
      className="blueprint marketing-blog marketing-theme min-h-screen overflow-x-clip"
      data-marketing-accent="orange"
    >
      <SiteMark />

      <main className="marketing-theme-section relative z-10 px-5 pb-24 pt-32 sm:px-10 sm:pb-32 sm:pt-40">
        <article className="mx-auto w-full max-w-[44rem]">
          <Link
            href="/blog"
            className="page-rise page-back inline-flex items-center gap-2 rounded-md text-sm font-medium text-cream/50 outline-none transition-colors duration-300 hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/30"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            All notes
          </Link>

          <header className="mt-10">
            <p className="page-rise text-sm text-cream/45" style={{ "--i": 1 } as CSSProperties}>
              {post.category}
            </p>
            <h1
              className="page-rise marketing-page-title wordmark mt-3 text-cream"
              style={{ "--i": 2 } as CSSProperties}
            >
              {post.title}
            </h1>
            <p
              className="page-rise marketing-page-lede mt-6 text-cream/66 sm:mt-7"
              style={{ "--i": 3 } as CSSProperties}
            >
              {post.dek}
            </p>
            <p
              className="page-rise mt-6 text-[0.875rem] text-cream/40"
              style={{ "--i": 4 } as CSSProperties}
            >
              <time>{post.publishedAt}</time>, {post.readTime}
            </p>
          </header>

          <ul
            className="page-rise ember-card mt-12 grid gap-3 rounded-[1.4rem] px-6 py-6 sm:px-8 sm:py-7"
            style={{ "--i": 5 } as CSSProperties}
          >
            {post.summary.map((item) => (
              <li key={item} className="flex gap-3 text-base leading-[1.7] text-cream/66">
                <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--dm-accent)]" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-16 space-y-16">
            {post.sections.map((section) => (
              <Reveal key={section.heading}>
                <section>
                  {section.kicker ? (
                    <p className="text-sm font-semibold text-[color:var(--dm-accent)]">
                      {section.kicker}
                    </p>
                  ) : null}
                  <h2 className="marketing-reading-title mt-3 text-cream">{section.heading}</h2>
                  <div className="mt-5 space-y-5">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="marketing-reading-copy text-cream/66">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {section.bullets ? (
                    <ul className="mt-7 grid gap-3.5">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex gap-3 text-base leading-[1.7] text-cream/60"
                        >
                          <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-cream/25" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <section className="mt-20">
              <h2 className="marketing-reading-title text-cream">Try this next</h2>
              <ul className="mt-6 grid gap-4">
                {post.nextPractice.map((item) => (
                  <li key={item} className="flex gap-3 text-base leading-[1.7] text-cream/66">
                    <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--dm-accent)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal>
            <section className="mt-20">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="marketing-reading-title text-cream">Read next</h2>
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-cream/50 outline-none transition-colors duration-300 hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/30"
                >
                  All notes <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-4">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="page-row group flex items-center gap-6 rounded-2xl px-1 py-6 outline-none focus-visible:ring-2 focus-visible:ring-cream/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-cream/45">{related.category}</p>
                      <h3 className="page-row-title mt-2 text-lg font-semibold leading-snug tracking-[-0.02em] text-cream sm:text-xl">
                        {related.title}
                      </h3>
                      <p className="mt-2 text-[0.9375rem] leading-[1.65] text-cream/50">
                        {related.dek}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="page-row-arrow grid h-10 w-10 shrink-0 place-items-center rounded-full"
                    >
                      <ArrowRight size={17} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </Reveal>
        </article>
      </main>

      <SiteFooter sectionHrefPrefix="/" />
    </div>
  );
}
