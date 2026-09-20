import { describe, expect, it } from "vitest";
import { blogPosts, getBlogPost } from "./blog";

describe("blog content", () => {
  it("provides valid, structured blog posts", () => {
    expect(blogPosts.length).toBeGreaterThan(0);

    for (const post of blogPosts) {
      expect(post.slug).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(post.dek).toBeTruthy();
      expect(post.category).toBeTruthy();
      expect(post.publishedAt).toBeTruthy();
      expect(post.readTime).toMatch(/\d+ min read/);
      expect(post.coverImage).toMatch(/^\/images\/blog\//);
      expect(post.coverAlt).toBeTruthy();
      expect(post.summary.length).toBeGreaterThan(0);
      expect(post.sections.length).toBeGreaterThan(0);
      expect(post.nextPractice.length).toBeGreaterThan(0);

      for (const section of post.sections) {
        expect(section.heading).toBeTruthy();
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });

  it("has unique slugs across all blog posts", () => {
    const slugs = blogPosts.map((post) => post.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it("finds blog posts by slug", () => {
    const first = blogPosts[0]!;
    const found = getBlogPost(first.slug);
    expect(found).toEqual(first);
  });

  it("returns undefined for unknown slugs", () => {
    expect(getBlogPost("non-existent-slug")).toBeUndefined();
  });
});
