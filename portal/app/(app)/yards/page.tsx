import { redirect } from "next/navigation";

/** Yards are managed from the Assets page — keep old bookmarks working. */
export default function YardsRedirectPage() {
  redirect("/assets?yards=1");
}
