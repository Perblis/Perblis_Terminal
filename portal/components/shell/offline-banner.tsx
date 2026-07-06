"use client";

// 07 §3: persistent ink-900 offline notice. Cached queries keep rendering
// (stale-while-revalidate); mutations will fail loudly with retry copy.
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    setOffline(!window.navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="flex items-center gap-s2 bg-surface-inverse px-s4 py-s2 text-body-sm text-text-inverse">
      <WifiOff size={14} aria-hidden />
      Offline — showing saved data
    </div>
  );
}
