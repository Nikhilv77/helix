import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Clock, ListChecks } from "lucide-react";
import { TrailgradMark } from "@/components/brand/blueprint-art";
import { EditorialBackLink } from "@/components/marketing/chrome/editorial-back-link";
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

export async function BlogPostPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const relatedPosts = blogPosts.filter((candidate) => candidate.slug !== post.slug).slice(0, 2);
  return (
    <div className="editorial-theme blueprint min-h-screen overflow-x-clip">
      <EditorialBackLink href="/blog" />

      <main className="relative z-10 px-5 pb-14 pt-32 sm:px-10 sm:pb-20 sm:pt-36">
        <div className="pointer-events-none absolute left-1/2 top-20 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full" />
        <div className="pointer-events-none absolute -left-28 top-[34rem] hidden h-80 w-80 rounded-full sm:block" />
        <div className="pointer-events-none absolute -right-28 bottom-40 hidden h-80 w-80 rounded-full sm:block" />

        <article className="relative mx-auto w-full max-w-[78rem]">
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-cream/48">
            <Link href="/" className="transition hover:text-cream">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/blog" className="transition hover:text-cream">
              Blog
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-cream/72">{post.category}</span>
          </nav>

          <header className="mt-9 grid gap-9 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
            <div className="blog-rise">
              <span className="inline-flex items-center gap-2.5 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 sm:backdrop-blur-sm">
                <TrailgradMark className="h-3.5 w-3.5 text-cream" />
                <span className="blueprint-label whitespace-nowrap text-cream/80">
                  {post.category}
                </span>
              </span>
              <h1
                className="display-heading mt-6 max-w-4xl text-cream"
                style={{ fontSize: "clamp(2.8rem, 6.8vw, 5.8rem)" }}
              >
                {post.title}
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-relaxed text-cream/76 sm:text-xl">
                {post.dek}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4 text-sm font-semibold text-cream/52">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={16} aria-hidden="true" />
                  {post.publishedAt}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock size={16} aria-hidden="true" />
                  {post.readTime}
                </span>
              </div>
            </div>

            <div className="blog-rise relative min-h-[19rem] rounded-[1.4rem] sm:min-h-[27rem] lg:min-h-[31rem]">
              <Image
                src={post.coverImage}
                alt={post.coverAlt}
                fill
                priority
                sizes="(min-width: 1024px) 43rem, 92vw"
                className="object-contain p-2 sm:p-4"
              />
            </div>
          </header>

          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="overflow-hidden rounded-[1.65rem] bg-[#18191c] text-cream">
              <div className="px-5 py-8 sm:px-9 sm:py-11 lg:px-12">
                <div className="grid gap-4 rounded-[1.25rem] border border-white/10 bg-[#202126] p-5 sm:grid-cols-3">
                  {post.summary.map((item) => (
                    <div key={item} className="flex gap-3">
                      <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F26E01]" />
                      <p className="text-base font-semibold leading-7 text-cream/78">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 space-y-12">
                  {post.sections.map((section) => (
                    <section key={section.heading}>
                      {section.kicker ? (
                        <p className="blueprint-label text-[#F26E01]/80">{section.kicker}</p>
                      ) : null}
                      <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
                        {section.heading}
                      </h2>
                      <div className="mt-5 space-y-5">
                        {section.paragraphs.map((paragraph) => (
                          <p key={paragraph} className="text-lg leading-8 text-cream/70">
                            {paragraph}
                          </p>
                        ))}
                      </div>

                      {section.bullets ? (
                        <ul className="mt-7 grid gap-3">
                          {section.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="rounded-xl border border-white/10 bg-[#202126] px-4 py-3 text-base font-semibold leading-7 text-cream/76"
                            >
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  ))}
                </div>
              </div>
            </div>

            <aside className="lg:sticky lg:top-28">
              <div className="rounded-[1.35rem] border border-cream/[0.07] bg-cream/[0.045] p-5">
                <div className="flex items-center gap-3 pb-5">
                  <ListChecks
                    size={31}
                    strokeWidth={1.75}
                    className="text-cream"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="blueprint-label text-cream/42">{post.metricLabel}</p>
                    <p className="font-mono text-3xl font-semibold text-cream">{post.metric}</p>
                  </div>
                </div>
                <h2 className="mt-6 text-xl font-semibold tracking-tight text-cream">
                  Try this next
                </h2>
                <ol className="mt-5 space-y-4">
                  {post.nextPractice.map((item, index) => (
                    <li key={item} className="flex gap-3 text-sm font-semibold leading-6 text-cream/68">
                      <span className="font-mono text-cream/38">{index + 1}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>

          <section className="mt-14">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="blueprint-label text-cream/42">Read next</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-cream">
                  Keep the loop moving.
                </h2>
              </div>
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-bold text-cream transition hover:gap-3"
              >
                All notes <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group grid gap-5 rounded-[1.2rem] bg-cream/[0.035] p-4 transition sm:grid-cols-[11rem_1fr]"
                >
                  <div className="relative min-h-[12rem] rounded-[1rem] sm:min-h-full">
                    <Image
                      src={related.coverImage}
                      alt={related.coverAlt}
                      fill
                      sizes="(min-width: 1024px) 11rem, 92vw"
                      className="object-contain p-2 transition duration-700 group-hover:scale-[1.035]"
                    />
                  </div>
                  <div>
                    <p className="blueprint-label text-cream/42">{related.category}</p>
                    <h3 className="mt-3 text-xl font-semibold tracking-tight text-cream">
                      {related.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-cream/62">{related.dek}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </article>
      </main>

    </div>
  );
}

