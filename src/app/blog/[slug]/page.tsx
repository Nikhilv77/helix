import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks
} from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/site-chrome";
import { TrailgradMark } from "@/components/marketing/blueprint-art";
import { blogPosts, getBlogPost } from "@/lib/blog";

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

export default async function BlogPostPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const relatedPosts = blogPosts.filter((candidate) => candidate.slug !== post.slug).slice(0, 2);
  const navAction = (
    <Link href="/blog" aria-label="Back to blog" title="Back to blog">
      <ArrowLeft size={20} aria-hidden="true" />
    </Link>
  );
  const footerAction = (
    <Link href="/blog" className="inline-flex items-center gap-2">
      More notes <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );

  return (
    <div className="blueprint min-h-screen overflow-x-clip">
      <div className="blueprint-grid" />
      <div className="blueprint-rails" />
      <SiteNav action={navAction} sectionHrefPrefix="/" />

      <main className="relative z-10 px-5 pb-16 pt-32 sm:px-10 sm:pb-24 sm:pt-36">
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
        <div className="pointer-events-none absolute left-1/2 top-16 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full border border-cream/10" />
        <div className="pointer-events-none absolute -left-28 top-[34rem] h-80 w-80 rounded-full border border-cream/10" />
        <div className="pointer-events-none absolute -right-28 bottom-40 h-80 w-80 rounded-full border border-cream/10" />

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

          <header className="mt-10 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 backdrop-blur-sm">
                <TrailgradMark className="h-3.5 w-3.5 text-cream" />
                <span className="blueprint-label whitespace-nowrap text-cream/80">
                  {post.category}
                </span>
              </span>
              <h1
                className="display-heading mt-6 max-w-4xl text-cream"
                style={{ fontSize: "clamp(2.8rem, 6.8vw, 6rem)" }}
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

            <div className="overflow-hidden rounded-lg border border-cream/16 bg-cream/[0.06] shadow-[0_30px_90px_-56px_rgba(3,10,31,0.78)]">
              <div className="relative aspect-[3/2] bg-[#2b499f]">
                <Image
                  src={post.coverImage}
                  alt={post.coverAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 43rem, 92vw"
                  className="object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#13234f]/25 via-transparent to-transparent" />
              </div>
            </div>
          </header>

          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="overflow-hidden rounded-lg bg-[#f1ead8] text-[#151923] shadow-[0_34px_90px_-54px_rgba(3,10,31,0.78)]">
              <div
                aria-hidden="true"
                className="h-2 bg-[#3657b4]"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, rgba(241,234,216,0.34) 1px, transparent 1px)",
                  backgroundSize: "2rem 100%"
                }}
              />
              <div className="px-5 py-8 sm:px-9 sm:py-11 lg:px-12">
                <div className="grid gap-4 border-b border-[#17234b]/10 pb-8 sm:grid-cols-3">
                  {post.summary.map((item) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2
                        size={18}
                        className="mt-1 shrink-0 text-[#227350]"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold leading-6 text-[#1f2937]/78">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 space-y-12">
                  {post.sections.map((section) => (
                    <section key={section.heading}>
                      {section.kicker ? (
                        <p className="blueprint-label text-[#3657b4]/70">{section.kicker}</p>
                      ) : null}
                      <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[#141821] sm:text-4xl">
                        {section.heading}
                      </h2>
                      <div className="mt-5 space-y-5">
                        {section.paragraphs.map((paragraph) => (
                          <p key={paragraph} className="text-lg leading-8 text-[#242832]/72">
                            {paragraph}
                          </p>
                        ))}
                      </div>

                      {section.bullets ? (
                        <ul className="mt-7 grid gap-3">
                          {section.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="rounded-lg border border-[#3657b4]/12 bg-[#3657b4]/[0.055] px-4 py-3 text-base font-semibold leading-7 text-[#17234b]/76"
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
              <div className="rounded-lg border border-cream/16 bg-cream/[0.065] p-5">
                <div className="flex items-center gap-3 border-b border-cream/14 pb-5">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream/10 text-cream">
                    <ListChecks size={19} aria-hidden="true" />
                  </span>
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

          <section className="mt-14 border-t border-cream/16 pt-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="blueprint-label text-cream/42">Read next</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-cream">
                  Keep the prep loop moving.
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
                  className="group grid overflow-hidden rounded-lg border border-cream/15 bg-cream/[0.055] transition hover:-translate-y-1 hover:border-cream/28 hover:bg-cream/[0.08] sm:grid-cols-[11rem_1fr]"
                >
                  <div className="relative min-h-[13rem] bg-[#2b499f] sm:min-h-full">
                    <Image
                      src={related.coverImage}
                      alt={related.coverAlt}
                      fill
                      sizes="(min-width: 1024px) 11rem, 92vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-5">
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

      <SiteFooter action={footerAction} sectionHrefPrefix="/" />
    </div>
  );
}
