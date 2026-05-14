import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="max-w-[440px] text-center space-y-3">
        <div className="font-display uppercase text-[36px]">Not found.</div>
        <p className="text-text-secondary">The page or record does not exist.</p>
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
