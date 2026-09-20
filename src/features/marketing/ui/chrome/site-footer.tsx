import Link from "next/link";
import { TrailgradMark } from "@/components/trailgrad-mark";

const footerLinks: Array<{ label: string; href: string }> = [
  { label: "Interview", href: "#interview" },
  { label: "Practice", href: "#practice" },
  { label: "Help", href: "#help" },
  { label: "Blog", href: "/blog" }
];

function sectionHref(href: string, prefix: string): string {
  return href.startsWith("#") ? `${prefix}${href}` : href;
}

/**
 * Same language as the bar at the top: a hairline, plain type, nothing
 * enclosed. The cream CTA that used to sit here is gone — the closing section
 * directly above it already makes that ask, and two in a row read as nagging.
 */
export function SiteFooter({ sectionHrefPrefix = "" }: { sectionHrefPrefix?: string }) {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-5 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            aria-label="Trailgrad home"
            className="inline-flex items-center gap-2.5 rounded-lg text-cream outline-none transition-opacity duration-300 hover:opacity-70 focus-visible:ring-2 focus-visible:ring-cream/40"
          >
            <TrailgradMark className="marketing-brand-mark h-5 w-5" sizes="20px" />
            <span className="text-[0.95rem] font-medium tracking-tight">Trailgrad</span>
          </Link>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-7 gap-y-3">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={sectionHref(link.href, sectionHrefPrefix)}
                className="text-sm text-cream/50 outline-none transition-colors duration-300 hover:text-cream/90 focus-visible:ring-2 focus-visible:ring-cream/40"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.05] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-cream/34">
            © {new Date().getFullYear()} Trailgrad · AI interview practice
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-[0.8125rem] text-cream/42 transition-colors duration-300 hover:text-cream/80"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-[0.8125rem] text-cream/42 transition-colors duration-300 hover:text-cream/80"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
