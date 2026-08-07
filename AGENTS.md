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

# Agent notes

## VPS migration secrets
This repo is **public**. Env secrets are in private `NwabuezeChigozirim/vps-governance` under `secrets/Perblis_Terminal*.env`.
After cloning onto a new host: copy those files into `.env` and `backend/.env`, then follow `VPS-BACKUP-SECRETS.md` in `vps-governance` to remove secrets from git there.
Never commit `.env` files to this repository.
