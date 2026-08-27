"use client";

import { SiteFooter, SiteNav } from "../chrome/site-chrome";
import { Begin } from "./begin-section";
import { Practice } from "./practice-section";
import { Hero } from "./hero";
import { PrimaryAction } from "./primary-action";
import { Pushback } from "./pushback-section";
import { Stuck } from "./stuck-section";

export function MarketingHome() {
  return (
    <div className="blueprint marketing-theme overflow-x-clip" data-marketing-accent="orange">
      <SiteNav
        actionKind="button"
        action={
          <PrimaryAction ariaLabel="Start free" className="outline-none">
            Start free
          </PrimaryAction>
        }
      />

      <main className="relative">
        <Hero />
        <Pushback />
        <Practice />
        <Stuck />
        <Begin />
      </main>

      <SiteFooter />
    </div>
  );
}
