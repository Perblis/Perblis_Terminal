// P1's cinematic right panel. Photography curation is a founder direction-
// check item (image CDNs are unreachable from the build environment and the
// founder wants to art-direct it) — until then this is a crafted ink-duotone
// port scene in the 01 §5 illustration language: 2px lines, one amber accent,
// no human characters. The slow pan (wave-7-vision.md) rides on the wrapper
// and respects prefers-reduced-motion via the global collapse.

export function PortScene() {
  return (
    <div aria-hidden className="relative h-full w-full overflow-hidden bg-surface-inverse">
      <svg
        viewBox="0 0 1200 900"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full motion-safe:animate-port-pan"
      >
        {/* sky wash */}
        <rect width="1200" height="900" fill="#16181D" />
        {/* horizon glow */}
        <rect y="540" width="1200" height="360" fill="#23262E" />
        {/* container stacks */}
        <g stroke="#3A3F4A" strokeWidth="2" fill="#1B1E24">
          {[80, 250, 420, 760, 930].map((x, i) => (
            <g key={x}>
              <rect x={x} y={620 - (i % 3) * 44} width="150" height={280 + (i % 3) * 44} />
              <line x1={x} y1={664 - (i % 3) * 44} x2={x + 150} y2={664 - (i % 3) * 44} />
              <line x1={x} y1={708 - (i % 3) * 44} x2={x + 150} y2={708 - (i % 3) * 44} />
              <line x1={x} y1={752} x2={x + 150} y2={752} />
              <line x1={x} y1={796} x2={x + 150} y2={796} />
            </g>
          ))}
        </g>
        {/* gantry crane */}
        <g stroke="#8D93A0" strokeWidth="3" fill="none">
          <path d="M560 860 V300 H1120 V860" />
          <path d="M560 300 L640 180 H1040 L1120 300" />
          <path d="M620 860 V300 M1060 860 V300" />
          <path d="M560 480 H1120 M560 660 H1120" />
        </g>
        {/* trolley + hook line */}
        <g>
          <rect x="800" y="288" width="72" height="24" fill="#8D93A0" />
          <line x1="836" y1="312" x2="836" y2="452" stroke="#8D93A0" strokeWidth="2" />
          {/* the one amber accent: the lifted container */}
          <rect x="776" y="452" width="120" height="52" fill="#F59E0B" />
          <line x1="776" y1="478" x2="896" y2="478" stroke="#16181D" strokeWidth="2" />
        </g>
        {/* quay edge + water */}
        <rect y="860" width="1200" height="40" fill="#101216" />
      </svg>
      {/* duotone grade: ink scrim keeps any overlaid text ≥4.5:1 (01 §4) */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-ink-900/30" />
    </div>
  );
}
