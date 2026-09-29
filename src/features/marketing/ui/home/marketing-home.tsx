import { SiteFooter } from "../chrome/site-footer";
import { SiteMark } from "../chrome/site-mark";
import { Begin } from "./begin-section";
import { Faq } from "./faq-section";
import { Hero } from "./hero";
import { RoundsFilmSection } from "./rounds-film-section";
import { Stuck } from "./stuck-section";

export function MarketingHome() {
  return (
    <div className="blueprint marketing-theme overflow-x-clip" data-marketing-accent="orange">
      <SiteMark />

      <main className="relative">
        <Hero />
        <RoundsFilmSection />
        <Stuck />
        <Faq />
        <Begin />
        <SiteFooter />
      </main>
    </div>
  );
}
