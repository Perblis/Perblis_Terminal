import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

// P2 lands in slice 7B (stats, payout strip, activity feed, checklist).
// This shell page proves the frame + auth gate end-to-end for 7A.
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <Card className="p-s6 text-center">
        <p className="font-display text-h3 text-text-primary">Your cockpit is being fitted out</p>
        <p className="mx-auto mt-s2 max-w-md text-body-sm text-text-secondary">
          Fleet stats, the payout strip, and your activity feed arrive with the next slice. Sign-in,
          navigation, and your account are already live.
        </p>
      </Card>
    </>
  );
}
