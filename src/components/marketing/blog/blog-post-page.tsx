import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/chrome/site-chrome";
import { PrimaryAction } from "@/components/marketing/home/primary-action";
import { blogPosts, getBlogPost } from "@/content/marketing/blog";

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

export async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const relatedPosts = blogPosts.filter((candidate) => candidate.slug !== post.slug).slice(0, 2);

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
        <article className="mx-auto w-full max-w-[44rem]">
          <nav className="flex flex-wrap items-center gap-2 text-sm text-cream/35">
            <Link href="/blog" className="transition-colors duration-300 hover:text-cream/80">
              Blog
            </Link>
            <span aria-hidden="true" className="text-cream/15">
              /
            </span>
            <span className="text-cream/55">{post.category}</span>
          </nav>

          <header className="mt-10">
            <p className="blueprint-label text-[color:var(--dm-accent-soft)]">{post.category}</p>
            <h1
              className="display-heading mt-5 text-cream"
              style={{ fontSize: "clamp(2rem, 4.4vw, 3.4rem)" }}
            >
              {post.title}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-cream/70">{post.dek}</p>
            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-cream/30">
              <span>{post.publishedAt}</span>
              <span className="text-cream/15">·</span>
              <span>{post.readTime}</span>
            </p>
          </header>

          {/* The takeaways, on a hairline rather than in a card — the article
              is one column of type now, so nothing here needs a container. */}
          <ul className="mt-10 grid gap-3 border-y border-white/[0.06] py-7">
            {post.summary.map((item) => (
              <li key={item} className="flex gap-3 text-[0.95rem] leading-7 text-cream/60">
                <span className="mt-3 h-1 w-1 shrink-0 rounded-full bg-[color:var(--dm-accent)]" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-14 space-y-14">
            {post.sections.map((section) => (
              <section key={section.heading}>
                {section.kicker ? (
                  <p className="blueprint-label text-[color:var(--dm-accent-soft)]">
                    {section.kicker}
                  </p>
                ) : null}
                <h2 className="mt-3 text-2xl font-medium tracking-tight text-cream">
                  {section.heading}
                </h2>
                <div className="mt-5 space-y-5">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-[1.05rem] leading-8 text-cream/65">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.bullets ? (
                  <ul className="mt-7 grid gap-3.5">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-3 text-[0.95rem] leading-7 text-cream/55"
                      >
                        <span className="mt-3 h-1 w-1 shrink-0 rounded-full bg-cream/25" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <section className="mt-16 border-t border-white/[0.06] pt-10">
            <p className="blueprint-label text-[color:var(--dm-accent-soft)]">Try this next</p>
            <ol className="mt-6 grid gap-4">
              {post.nextPractice.map((item, index) => (
                <li key={item} className="flex gap-4 text-[0.95rem] leading-7 text-cream/65">
                  <span className="font-mono text-sm text-cream/25">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-16 border-t border-white/[0.06] pt-10">
            <div className="flex items-baseline justify-between gap-4">
              <p className="blueprint-label text-cream/35">Read next</p>
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm text-cream/50 transition-colors duration-300 hover:text-cream"
              >
                All notes <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-2">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group flex items-baseline gap-6 border-b border-white/[0.06] py-6"
                >
                  <div className="min-w-0 flex-1">
                    <span className="blueprint-label text-cream/30">{related.category}</span>
                    <h3 className="mt-2.5 text-lg font-medium tracking-tight text-cream">
                      {related.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-cream/45">{related.dek}</p>
                  </div>
                  <ArrowRight
                    size={15}
                    aria-hidden="true"
                    className="shrink-0 text-cream/25 transition-[color,transform] duration-300 group-hover:translate-x-1 group-hover:text-cream/70"
                  />
                </Link>
              ))}
            </div>
          </section>
        </article>
      </main>

      <SiteFooter sectionHrefPrefix="/" />
    </div>
  );
}
