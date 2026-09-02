import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/shared/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/interview", "/onboarding", "/profile"]
    },
    sitemap: `${appUrl}/sitemap.xml`
  };
}
