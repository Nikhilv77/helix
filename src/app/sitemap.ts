import type { MetadataRoute } from "next";
import { blogPosts } from "@/content/marketing/blog";
import { appUrl } from "@/lib/seo";

const lastModified = new Date("2026-08-09T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: appUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${appUrl}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${appUrl}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${appUrl}/blog`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6
    },
    ...blogPosts.map((post) => ({
      url: `${appUrl}/blog/${post.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5
    }))
  ];
}
