import Image from "next/image";

// P1's cinematic right panel: real photography (generated, licence-free —
// no stock hotlinks), one lime container carrying the brand accent. The 60s
// Ken Burns pan rides the wrapper and respects prefers-reduced-motion via
// motion-safe; the ink scrim keeps overlaid text at >=4.5:1 (01 §4).

export function PortScene() {
  return (
    <div aria-hidden className="relative h-full w-full overflow-hidden bg-surface-chrome">
      <div className="absolute inset-0 motion-safe:animate-port-pan">
        <Image
          src="/port-scene.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover"
        />
      </div>
      {/* duotone grade: ink scrim keeps any overlaid text >=4.5:1 (01 §4) */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-ink-900/10 to-ink-900/40" />
    </div>
  );
}
