import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blogPosts } from "@/features/marketing/content/blog";
import { privacyPolicy, termsOfService } from "@/features/marketing/content/legal";
import { BlogIndexPage } from "./blog/blog-index-page";
import { BlogPostPage, generateMetadata, generateStaticParams } from "./blog/blog-post-page";
import { LegalPage } from "./legal/legal-page";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound
}));

describe("Public Pages", () => {
  afterEach(cleanup);

  describe("BlogIndexPage", () => {
    it("renders blog index page with featured and secondary posts", () => {
      render(<BlogIndexPage />);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Clearer practice starts here."
      );
      expect(screen.getByText(blogPosts[0]!.title)).toBeInTheDocument();
      expect(screen.getByText(blogPosts[1]!.title)).toBeInTheDocument();
    });
  });

  describe("BlogPostPage", () => {
    it("renders specific blog post content", async () => {
      const post = blogPosts[0]!;
      render(await BlogPostPage({ params: Promise.resolve({ slug: post.slug }) }));

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(post.title);
      expect(screen.getByText(post.dek)).toBeInTheDocument();
      expect(screen.getByText(post.publishedAt)).toBeInTheDocument();
    });

    it("triggers notFound when slug does not match", async () => {
      await expect(
        BlogPostPage({ params: Promise.resolve({ slug: "unknown-slug-123" }) })
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.notFound).toHaveBeenCalled();
    });

    it("generates static params for all blog posts", () => {
      const params = generateStaticParams();
      expect(params).toEqual(blogPosts.map((post) => ({ slug: post.slug })));
    });

    it("generates metadata for a valid blog post", async () => {
      const post = blogPosts[0]!;
      const meta = await generateMetadata({ params: Promise.resolve({ slug: post.slug }) });

      expect(meta.title).toBe(post.title);
      expect(meta.description).toBe(post.dek);
      expect(meta.alternates?.canonical).toBe(`/blog/${post.slug}`);
      expect(meta.openGraph?.title).toBe(post.title);
      expect(meta.openGraph?.url).toBe(`/blog/${post.slug}`);
    });

    it("generates fallback metadata when blog post is not found", async () => {
      const meta = await generateMetadata({ params: Promise.resolve({ slug: "non-existent" }) });

      expect(meta.title).toBe("Blog post not found");
      expect(meta.description).toBe("This Trailgrad blog post could not be found.");
    });
  });

  describe("LegalPage", () => {
    it("renders privacy policy document", () => {
      render(<LegalPage document={privacyPolicy} />);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy Policy");
      expect(screen.getByText(privacyPolicy.introduction)).toBeInTheDocument();
      expect(screen.getByText(privacyPolicy.sections[0]!.title)).toBeInTheDocument();
    });

    it("renders terms of service document", () => {
      render(<LegalPage document={termsOfService} />);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Terms of Service");
      expect(screen.getByText(termsOfService.introduction)).toBeInTheDocument();
      expect(screen.getByText(termsOfService.sections[0]!.title)).toBeInTheDocument();
    });
  });
});
