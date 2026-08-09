import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  images: {
    // Every distinct `quality` an <Image> asks for has to be listed, or the
    // optimizer refuses it. 72 is the delivery portrait, 76 the question-lab
    // laptop; 75 is next/image's own default, kept so an unannotated <Image>
    // keeps working.
    qualities: [72, 75, 76]
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, max-age=0, must-revalidate"
          }
        ]
      },
      {
        // Next only revalidates /public assets, so the interviewer model —
        // several megabytes of it — cost a conditional round trip on every
        // marketing visit before the hero could draw. These filenames are
        // stable and versioned by hand, so a month of caching is safe.
        source: "/:path(avatars|brand|images)/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
