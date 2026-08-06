# Agent notes

## VPS migration secrets
This repo is **public**. Env secrets are in private `NwabuezeChigozirim/vps-governance` under `secrets/Perblis_Terminal*.env`.
After cloning onto a new host: copy those files into `.env` and `backend/.env`, then follow `VPS-BACKUP-SECRETS.md` in `vps-governance` to remove secrets from git there.
Never commit `.env` files to this repository.
