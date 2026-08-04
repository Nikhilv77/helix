import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/edit-preview",
        "/interview",
        "/onboarding",
        "/profile",
        "/session/",
        "/sessions/"
      ]
    },
    sitemap: `${appUrl}/sitemap.xml`
  };
}
