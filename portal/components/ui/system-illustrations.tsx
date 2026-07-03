// P12 illustrations in the 01 §5 language: single-weight 2px ink-300 lines,
// exactly one amber accent, machines/documents — never mascots.

export function LostContainerIllustration() {
  return (
    <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden fill="none">
      {/* stacked containers with one missing slot */}
      <g stroke="#B3B8C2" strokeWidth="2">
        <rect x="16" y="72" width="56" height="28" />
        <rect x="16" y="40" width="56" height="28" />
        <rect x="88" y="72" width="56" height="28" />
        <path d="M22 54h44M22 86h44M94 86h44" strokeWidth="1" />
      </g>
      {/* the amber accent: the container that isn't where it should be */}
      <rect x="96" y="24" width="40" height="20" stroke="#F59E0B" strokeWidth="2" transform="rotate(8 116 34)" />
      <path d="M88 68 l8 -12" stroke="#B3B8C2" strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  );
}

export function BreakdownIllustration() {
  return (
    <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden fill="none">
      {/* excavator, arm down — off duty */}
      <g stroke="#B3B8C2" strokeWidth="2">
        <rect x="28" y="64" width="52" height="28" rx="2" />
        <circle cx="40" cy="98" r="8" />
        <circle cx="68" cy="98" r="8" />
        <path d="M48 98h12" />
        <path d="M80 72 L112 56 L132 84" />
        <path d="M132 84 l-10 10" />
      </g>
      {/* amber accent: warning marker on the cab */}
      <path d="M54 44 l8 14 h-16 z" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  );
}

export function GateIllustration() {
  return (
    <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden fill="none">
      {/* terminal gate, barrier down */}
      <g stroke="#B3B8C2" strokeWidth="2">
        <rect x="24" y="48" width="24" height="52" />
        <path d="M24 100h112" />
        <path d="M36 48v-12" />
      </g>
      {/* amber accent: the lowered barrier arm */}
      <path d="M48 60 h84" stroke="#F59E0B" strokeWidth="3" />
      <path d="M60 60v4M76 60v4M92 60v4M108 60v4M124 60v4" stroke="#F59E0B" strokeWidth="1.5" />
    </svg>
  );
}
