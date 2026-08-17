# TERMINAL — Technical Specification Document v2.1 (moved)

**This file is no longer the TSD.** The canonical Technical Specification lives at:

## → [docs/perblis-terminal-TSD.md](../perblis-terminal-TSD.md)

Moved under **D-031** when the repository adopted the governance-system document layout.

**Nothing was renumbered.** Every `§` section of TSD v2.1 — §1 System Topology through
§11 Out-of-Scope Architecture Notes — is present in the canonical file with the same
number, so an existing citation of the form `TSD §3.4` still resolves. What the canonical
file adds above §1 is a requirement layer (`T-001…T-019`), an F-ID↔T-ID traceability
matrix, a cost-evidence table and a verification register.

Two sections changed on the move, both recorded in D-031:

- **§10 Build Waves** is now a pointer. Delivery sequencing has one authority,
  [docs/waves/README.md](../waves/README.md); the duplicated wave table was removed
  because a second copy of a mutable status table drifts from the first.
- **§1, §2.3 and §5** carry supersession notes reconciling them to **D-027** (self-hosted
  VPS, manual deploy), **D-019/D-020** (bespoke token-driven portal components) and
  **D-028** (dark-only Infisical-derived palette). The original text is struck through
  rather than deleted.

Related authorities:

| Concern | File |
|---|---|
| How it is built | [docs/perblis-terminal-TSD.md](../perblis-terminal-TSD.md) |
| What the system does | [docs/perblis-terminal-FSD.md](../perblis-terminal-FSD.md) |
| Ratified decisions | [DECISIONS.md](../../DECISIONS.md) |
| Engineering rules | [design.md](../../design.md) |
| Delivery sequencing | [docs/waves/README.md](../waves/README.md) |
