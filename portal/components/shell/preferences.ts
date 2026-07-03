// Shell preferences persisted per browser (04 §4 density; 05 §5 rail collapse).
// Read pre-hydration by the inline script in the root layout so neither
// preference flashes.

export const DENSITY_KEY = "terminal:density";
export const RAIL_KEY = "terminal:rail";

export type Density = "comfortable" | "compact";

export function readDensity(): Density {
  if (typeof window === "undefined") return "comfortable";
  return window.localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
}

export function applyDensity(density: Density) {
  window.localStorage.setItem(DENSITY_KEY, density);
  document.documentElement.dataset.density = density;
}

export function readRailCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(RAIL_KEY) === "collapsed";
}

export function persistRailCollapsed(collapsed: boolean) {
  window.localStorage.setItem(RAIL_KEY, collapsed ? "collapsed" : "expanded");
}

/** Inline <script> body: stamps html[data-density] before first paint. */
export const PREFERENCES_BOOT_SCRIPT = `try{var d=localStorage.getItem(${JSON.stringify(
  DENSITY_KEY,
)});if(d==="compact")document.documentElement.dataset.density=d;}catch(e){}`;
