import { cn } from "@/lib/cn";

export function MessageBubble({
  body,
  fromMe,
  timestamp,
}: {
  body: string;
  fromMe: boolean;
  timestamp: string;
}) {
  return (
    <div className={cn("flex", fromMe ? "justify-end" : "justify-start")}>
      <div className="max-w-[78%] space-y-1">
        <div
          className={cn(
            "rounded-card px-3 py-2 text-[14px] font-body whitespace-pre-line",
            fromMe
              ? "bg-forge-dim text-text-primary border border-forge-dim"
              : "bg-surface text-text-primary border border-border",
          )}
        >
          {body}
        </div>
        <div
          className={cn(
            "font-mono text-[10px] text-text-tertiary",
            fromMe ? "text-right" : "text-left",
          )}
        >
          {new Date(timestamp).toLocaleTimeString("en-NG", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
