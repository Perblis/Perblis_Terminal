# Implementations

## 2026-05-22 00:00 - Cloud Agent environment setup
- tag: CHORE
- area: AGENTS.md
- summary: Updated AGENTS.md workspace paths from `/workspace` to `/agent/repos/Terminal-Server` and corrected owner-web references to point to the separate Terminal-Web repo
- reason: Cloud Agent VMs mount repos at `/agent/repos/<repo-name>`, not `/workspace`. Owner-web is now a separate repo (Terminal-Web).
- notes: No code changes — only AGENTS.md documentation corrections.
