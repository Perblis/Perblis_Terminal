"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="max-w-[440px] text-center space-y-3">
        <div className="font-display uppercase text-[36px]">Something broke.</div>
        <p className="text-text-secondary">
          Tap to retry. If it keeps failing, sign out and back in.
        </p>
        <div className="flex justify-center">
          <Button onClick={reset}>Retry</Button>
        </div>
      </div>
    </div>
  );
}
