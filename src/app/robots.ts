import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/shared/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
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
