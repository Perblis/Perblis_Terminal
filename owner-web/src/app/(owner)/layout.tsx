import { redirect } from "next/navigation";

import { Shell } from "@/components/layout/Shell";
import { getSession } from "@/lib/auth/session";

/**
 * The (owner) segment is also guarded by the edge proxy, which handles
 * both the unauthenticated and non-owner cases (including dropping the
 * cookie in the latter). This layout re-checks server-side so a stale
 * token never renders a protected page even if the proxy is bypassed,
 * then drops the route into the persistent app shell.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.is_owner) redirect("/login?error=owner_required");

  return <Shell>{children}</Shell>;
}
