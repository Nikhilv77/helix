import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

describe("SiteNav", () => {
  afterEach(cleanup);

  it("renders brand mark and navigation links", () => {
    render(<SiteNav />);

    const brandLink = screen.getByRole("link", { name: /Trailgrad home/i });
    expect(brandLink).toHaveAttribute("href", "/");

    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute("href", "#learn");
    expect(screen.getByRole("link", { name: "Interview" })).toHaveAttribute("href", "#interview");
    expect(screen.getByRole("link", { name: "Practice" })).toHaveAttribute("href", "#practice");
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "#help");
  });

  it("prefixes section hrefs when sectionHrefPrefix is provided", () => {
    render(<SiteNav sectionHrefPrefix="/" />);

    expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute("href", "/#learn");
    expect(screen.getByRole("link", { name: "Interview" })).toHaveAttribute("href", "/#interview");
    expect(screen.getByRole("link", { name: "Practice" })).toHaveAttribute("href", "/#practice");
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/#help");
  });

  it("renders default Start free action", () => {
    render(<SiteNav />);

    const cta = screen.getAllByText("Start free");
    expect(cta.length).toBeGreaterThan(0);
  });

  it("renders custom action when provided", () => {
    render(<SiteNav action={<button type="button">Custom CTA</button>} />);

    const customButtons = screen.getAllByRole("button", { name: "Custom CTA" });
    expect(customButtons.length).toBeGreaterThan(0);
  });

  it("toggles mobile menu on mobile button click", () => {
    render(<SiteNav />);

    const menuButton = screen.getByRole("button", { name: "Open menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("closes mobile menu when Escape key is pressed", () => {
    render(<SiteNav />);

    const openButton = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(openButton);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
});

describe("SiteFooter", () => {
  afterEach(cleanup);

  it("renders brand, footer links, and legal links", () => {
    render(<SiteFooter />);

    const brandLink = screen.getByRole("link", { name: /Trailgrad home/i });
    expect(brandLink).toHaveAttribute("href", "/");

    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/blog");

    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${year} Trailgrad`))).toBeInTheDocument();
  });

  it("prefixes hash links when sectionHrefPrefix is passed", () => {
    render(<SiteFooter sectionHrefPrefix="/" />);

    expect(screen.getByRole("link", { name: "Interview" })).toHaveAttribute("href", "/#interview");
    expect(screen.getByRole("link", { name: "Practice" })).toHaveAttribute("href", "/#practice");
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/#help");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/blog");
  });
});
