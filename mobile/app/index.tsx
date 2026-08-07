import { Redirect } from "expo-router";

import { useOnboarding } from "../stores/onboarding";

/** S1 route decision: first launch → onboarding; otherwise the Map. */
export default function Index() {
  const completed = useOnboarding((s) => s.completed);
  return <Redirect href={completed ? "/(tabs)" : "/onboarding"} />;
}
