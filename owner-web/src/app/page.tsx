import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const c = await cookies();
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "terminal_session";
  const session = c.get(cookieName);
  if (session?.value) redirect("/dashboard");
  redirect("/login");
}
