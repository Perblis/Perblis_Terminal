import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { NavRail } from "@/components/shell/nav-rail";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { SessionExpiredProvider } from "@/components/auth/session-expired";

// The signed-in frame (04 §2): fixed ink-900 rail + centred 1320px content
// region. Presence of the refresh cookie gates entry — actual authorization
// happens at the API on every request; this is just the fast redirect.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  if (!jar.get("terminal_refresh")?.value) {
    redirect("/login");
  }

  return (
    <SessionExpiredProvider>
      <div className="flex min-h-screen">
        <NavRail />
        <main className="min-w-0 flex-1">
          <OfflineBanner />
          <div className="mx-auto max-w-[1320px] px-s4 py-s5 sm:px-s5 sm:py-s6">{children}</div>
        </main>
      </div>
    </SessionExpiredProvider>
  );
}
