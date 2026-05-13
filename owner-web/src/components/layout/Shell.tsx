import { MobileTabBar } from "./MobileTabBar";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-abyss flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-14 lg:pb-0">
        <TopBar />
        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
