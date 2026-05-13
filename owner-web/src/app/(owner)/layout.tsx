// Authenticated owner shell. Real Sidebar/TopBar arrive in Wave 02.
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-abyss min-h-screen">{children}</div>;
}
