<!-- vps-governance-stub -->
## VPS agent entry point

Canonical VPS-wide policy: `/root/projects/_governance/` (git repo — commit policy changes).
Core rules load automatically in Claude Code and Cursor; this stub only points home.

Before non-trivial work in this repo:

```bash
/root/projects/_governance/vps-preflight.sh
```

- Secrets: never hardcode, never print values. See `_governance/secrets-policy.md`.
  Infisical is already running and linked — run `_governance/infisical-check.sh`, never reinstall.
- Host facts (ports, containers, gotchas): `_governance/vps-vital-facts.md`

This repository may add **stricter** requirements below, but may not weaken the VPS baseline.
<!-- /vps-governance-stub -->

# Claude Code Project Entry Point

**Read [AGENTS.md](AGENTS.md) first.** It is the canonical, platform-neutral session guide
for this repository: the session-start protocol, the document-authority table, the
architecture invariants, the commands, wave gating, the Definition of Done and the handoff
protocol all live there. This file exists only so Claude Code lands in the right place; it
deliberately holds no rules of its own, because a second copy drifts from the first.

The three things worth repeating here, because they are the ones most often assumed wrong:

- **`docs/waves/README.md` is the only authority for wave status.** Never start the next
  wave without explicit founder approval.
- **Merging to `main` deploys nothing** (D-027). Production ships only when someone runs
  `infra/vps/deploy.sh` on the VPS.
- **`DECISIONS.md` (repo root) is binding.** Do not re-litigate a ratified decision in
  code or review; surface a genuine conflict as a new decision entry.

Claude Code-specific: project hooks under `.claude/settings.json` enforce active governance
gates when `.governance/config.json` enables them. Hook success never grants permission for
a gated wave, a destructive Git operation, a deployment, or stage closure — the founder
must still authorize those explicitly.
