import Link from "next/link";
import { TrailgradMark } from "@/components/trailgrad-mark";

const productLinks: Array<{ label: string; href: string }> = [
  { label: "Interview", href: "#interview" },
  { label: "Help", href: "#help" },
  { label: "FAQ", href: "#faq" },
  { label: "Blog", href: "/blog" }
];

const legalLinks: Array<{ label: string; href: string }> = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" }
];

function sectionHref(href: string, prefix: string): string {
  return href.startsWith("#") ? `${prefix}${href}` : href;
}

const linkClass =
  "site-footer-link rounded-md text-cream/60 outline-none transition-colors duration-300 hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40";

/**
 * White like the page, so the footer ends it instead of boxing it off. The
 * mark and one line on the left, two short link groups on the right. The
 * only rule is a hairline that fades out at both ends.
 */
export function SiteFooter({ sectionHrefPrefix = "" }: { sectionHrefPrefix?: string }) {
  return (
    <footer className="site-footer relative z-10 overflow-hidden px-5 pb-10 pt-12 sm:px-8 sm:pb-12">
      <div className="site-footer-inner mx-auto w-full max-w-[72rem] pt-12 sm:pt-14">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-[20rem] flex-col gap-3">
            <Link
              href="/"
              aria-label="Trailgrad home"
              className="inline-flex items-center gap-2.5 self-start rounded-lg text-cream outline-none transition-opacity duration-300 hover:opacity-70 focus-visible:ring-2 focus-visible:ring-cream/40"
            >
              <TrailgradMark className="marketing-brand-mark h-6 w-6" sizes="24px" />
              <span className="text-[1.05rem] font-semibold tracking-tight">Trailgrad</span>
            </Link>
            <p className="text-[0.9375rem] leading-relaxed text-cream/55">
              Learn, practise, and interview on the work you&rsquo;ve actually done.
            </p>
          </div>

          <div className="flex gap-14 text-[0.9375rem] sm:gap-20">
            <nav aria-label="Footer" className="flex flex-col gap-3">
              {productLinks.map((link) => (
                <Link
                  key={link.label}
                  href={sectionHref(link.href, sectionHrefPrefix)}
                  className={linkClass}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <nav aria-label="Legal" className="flex flex-col gap-3">
              {legalLinks.map((link) => (
                <Link key={link.label} href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <p className="mt-14 text-[0.8125rem] text-cream/40 sm:mt-16">
          © {new Date().getFullYear()} Trailgrad
        </p>
      </div>
    </footer>
  );
}
