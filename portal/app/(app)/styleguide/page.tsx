import type { Metadata } from "next";

import { WordmarkInline, WordmarkPlate } from "@/components/brand/wordmark";
import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CornerBracketPanel } from "@/components/ui/corner-brackets";
import { TextField } from "@/components/ui/field";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { CountBadge, StatusBadge, type HireStatus } from "@/components/ui/status-badge";
import { LostContainerIllustration } from "@/components/ui/system-illustrations";

import { OtpDemo } from "./otp-demo";

export const metadata: Metadata = { title: "Component sheet" };

const ALL_STATUSES: HireStatus[] = [
  "requested",
  "accepted",
  "confirmed",
  "on_hire",
  "completed",
  "declined",
  "expired",
  "cancelled",
  "in_dispute",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-s4">
      <h2 className="font-display text-h2 text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

// The 7A founder direction-check artifact: every core component in its Heavy
// Duty skin, on one page, before we build outward (wave-7-vision.md §Process).
export default function StyleguidePage() {
  return (
    <>
      <PageHeader title="Component sheet" crumbs={[{ label: "7A direction check" }]} />
      <div className="flex flex-col gap-s7 pb-s8">
        <Section title="Brand">
          <div className="flex flex-wrap items-center gap-s5">
            <WordmarkPlate />
            <WordmarkPlate compact />
            <WordmarkInline />
          </div>
          <div className="hazard-stripe max-w-md" />
          <p className="text-caption text-ink-500">
            Wordmark: the founder&apos;s rounded-square excavator mark is workshopped together at
            this direction check — the 01 §1 plate stands until then.
          </p>
        </Section>

        <Section title="Money — the visual signature">
          <CornerBracketPanel className="max-w-sm bg-surface-card p-s5">
            <p className="text-overline font-display uppercase tracking-[0.1em] text-ink-500">
              You receive
            </p>
            <Money kobo={425_000_000} className="mt-s2 block text-display-xl" />
            <div className="mt-s4 border-t border-border-default pt-s3 text-body-sm">
              <div className="flex justify-between py-s1">
                <span className="text-text-secondary">Hire value</span>
                <Money kobo={472_222_200} className="font-normal" />
              </div>
              <div className="flex justify-between py-s1">
                <span className="text-text-secondary">Service fee · 10%</span>
                <Money kobo={-47_222_200} className="font-normal" />
              </div>
              <div className="mt-s2 flex justify-between border-t-2 border-border-structural pt-s2">
                <span className="font-medium">Payout</span>
                <Money kobo={425_000_000} />
              </div>
            </div>
          </CornerBracketPanel>
          <p className="max-w-md text-caption text-ink-500">
            Full value always (₦4,250,000 — never ₦4.25M). Plex Mono 500, true minus, amounts
            appear set like print (no count-up, 08 §2). Corner brackets per D-021.
          </p>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-s3">
            <Button>Accept hire</Button>
            <Button variant="secondary">Pause listing</Button>
            <Button variant="destructive">Cancel hire</Button>
            <Button variant="ghost">Duplicate</Button>
            <Button loading>Publish</Button>
            <Button disabled>Publish</Button>
          </div>
          <div className="flex flex-wrap items-center gap-s3">
            <Button size="lg">Request to hire</Button>
            <Button size="md">Save yard</Button>
            <Button size="sm" variant="secondary">
              Edit
            </Button>
          </div>
        </Section>

        <Section title="Fields">
          <div className="grid max-w-2xl gap-s4 sm:grid-cols-2">
            <TextField label="Asset title" placeholder="30-tonne mobile crane" />
            <TextField label="Phone number" prefix="+234" placeholder="803 123 4567" />
            <TextField
              label="Daily rate"
              prefix="₦"
              placeholder="250,000"
              className="font-mono"
              helper="Whole naira — no kobo."
            />
            <TextField
              label="Email"
              defaultValue="not-an-email"
              error="Enter a valid email address."
            />
          </div>
          <OtpDemo />
        </Section>

        <Section title="Status system">
          <div className="flex flex-wrap gap-s2">
            {ALL_STATUSES.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
          <div className="flex items-center gap-s3">
            <CountBadge count={3} />
            <CountBadge count={12} urgent />
            <span className="text-caption text-ink-500">unread · urgent</span>
          </div>
        </Section>

        <Section title="Banners">
          <div className="flex max-w-2xl flex-col gap-s3">
            <Banner tone="info">Documents received. We review within 12 hours.</Banner>
            <Banner tone="warning" action={<Button size="sm">Verify identity</Button>}>
              3 things before this goes live — verification is one of them.
            </Banner>
            <Banner tone="danger">Payment window closed and the dates were released.</Banner>
          </div>
        </Section>

        <Section title="Loading & empty">
          <Card className="max-w-md">
            <div className="flex items-center gap-s3">
              <Skeleton className="size-s7" />
              <div className="flex flex-1 flex-col gap-s2">
                <Skeleton className="h-s3 w-2/3" />
                <Skeleton className="h-s3 w-1/3" />
              </div>
            </div>
          </Card>
          <Card className="flex max-w-md flex-col items-center gap-s3 p-s6 text-center">
            <LostContainerIllustration />
            <p className="font-display text-h3 text-text-primary">No assets yet</p>
            <p className="text-body-sm text-text-secondary">
              Your first listing takes about ten minutes.
            </p>
            <Button>Add asset</Button>
          </Card>
        </Section>
      </div>
    </>
  );
}
