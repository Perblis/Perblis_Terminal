export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-abyss grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-[400px]">{children}</div>
    </main>
  );
}
