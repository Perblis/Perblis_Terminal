// Guest-intent pattern (07 §7 / FSD §6): a protected action from a guest
// opens the auth sheet and RESUMES the intent after sign-in — J2 registers
// mid-flow without losing the listing. The pending intent is a router href,
// held in memory (an interrupted cold start should land on Map, not replay
// a stale intent).

let pendingHref: string | null = null;

export function setPendingIntent(href: string): void {
  pendingHref = href;
}

/** Returns the pending href once, clearing it (consume-on-read). */
export function consumePendingIntent(): string | null {
  const href = pendingHref;
  pendingHref = null;
  return href;
}

export function hasPendingIntent(): boolean {
  return pendingHref !== null;
}

/**
 * Screens call this on a protected action: signed-in → run it now; guest →
 * remember the intent and return the auth href to open.
 */
export function guardIntent(
  isSignedIn: boolean,
  intentHref: string,
): { proceed: true } | { proceed: false; authHref: "/auth/login" } {
  if (isSignedIn) return { proceed: true };
  setPendingIntent(intentHref);
  return { proceed: false, authHref: "/auth/login" };
}
