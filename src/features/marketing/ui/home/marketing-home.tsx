import { SiteFooter } from "../chrome/site-footer";
import { SiteNav } from "../chrome/site-nav";
import { Begin } from "./begin-section";
import { Hero } from "./hero";
import { HomeThemeArrival } from "./home-theme-arrival";
import { Practice } from "./practice-section";
import { Pushback } from "./pushback-section";
import { Stuck } from "./stuck-section";

export function MarketingHome() {
  return (
    <HomeThemeArrival>
      <div
        className="blueprint marketing-theme overflow-x-clip"
        data-marketing-accent="orange"
      >
        <SiteNav />

        <main className="relative">
          <Hero />
          <Pushback />
          <Practice />
          <Stuck />
          <Begin />
        </main>

        <SiteFooter />
      </div>
    </HomeThemeArrival>
  );
}
