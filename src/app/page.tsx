import { auth } from "@clerk/nextjs/server";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { Dashboard } from "@/components/workspace/dashboard";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Decided on the server. Gating this on the client meant a signed-in user
 * rendered the marketing page until Clerk's hooks resolved.
 */
export default async function HomePage() {
  if (!clerkEnabled) {
    return <MarketingHome />;
  }

  const { userId } = await auth();
  return userId ? <Dashboard /> : <MarketingHome />;
}
