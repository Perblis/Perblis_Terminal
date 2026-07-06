import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// "/" routes by session: signed-in suppliers land on the dashboard, everyone
// else at sign-in (P1).
export default async function Home() {
  const jar = await cookies();
  redirect(jar.get("terminal_refresh")?.value ? "/dashboard" : "/login");
}
