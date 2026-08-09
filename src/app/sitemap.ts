import type { MetadataRoute } from "next";
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
    }
  ];
}
