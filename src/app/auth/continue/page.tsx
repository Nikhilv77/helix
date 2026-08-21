import { ContinueClient } from "./continue-client";
import { privatePageMetadata } from "@/lib/shared/seo";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Continue",
  "Continue into your Trailgrad interview workspace."
);

export default function ContinuePage() {
  return <ContinueClient />;
}
