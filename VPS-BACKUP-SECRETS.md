# VPS backup secrets — agent instructions

**This repository is public.** Do **not** commit `.env` files here.

Private env backups live in `NwabuezeChigozirim/vps-governance`:
- `secrets/Perblis_Terminal.env` → copy to `.env`
- `secrets/Perblis_Terminal.backend.env` → copy to `backend/.env`

## After install on the new host
1. Clone/checkout this project, then copy the two files from `vps-governance` into place.
2. In `vps-governance`, follow its `VPS-BACKUP-SECRETS.md`: keep secrets on disk, remove them from git tracking, commit the cleanup, and delete the remote `vps-backup-*` branch once recovery is confirmed.
3. Ensure `.env` and `backend/.env` stay gitignored in this public repo forever.
