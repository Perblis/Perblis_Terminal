// Server-only configuration. API_BASE_URL never reaches the browser bundle —
// the browser talks exclusively to /auth/* and /bff/* on this origin (TSD §5).

export function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? "http://localhost:8000/api/v1";
}
