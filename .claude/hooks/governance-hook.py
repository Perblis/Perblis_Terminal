#!/usr/bin/env python3
"""Claude Code project-hook adapter for governancectl."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


EVENT = sys.argv[1] if len(sys.argv) > 1 else ""
CLAUDE_EVENT_NAMES = {
    "session-start": "SessionStart",
    "subagent-start": "SubagentStart",
    "subagent-stop": "SubagentStop",
    "pre-tool-use": "PreToolUse",
    "post-tool-use": "PostToolUse",
    "stop": "Stop",
    "session-end": "SessionEnd",
}


def repository_root() -> Path | None:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0:
        return Path(result.stdout.strip()).resolve()
    installed_root = Path(__file__).resolve().parents[2]
    if (installed_root / ".git").exists():
        return installed_root
    return None


def runtime_path() -> Path | None:
    override = os.environ.get("GOVERNANCECTL")
    candidates = [
        Path(override).expanduser() if override else None,
        Path("~/.local/share/agent-skills/governance-system/scripts/governancectl").expanduser(),
        Path("~/.claude/skills/governance-system/scripts/governancectl").expanduser(),
        Path("~/.cursor/skills/governance-system/scripts/governancectl").expanduser(),
    ]
    return next((path.resolve() for path in candidates if path and path.is_file()), None)


def neutral_decision(payload: bytes) -> dict[str, str]:
    root = repository_root()
    runtime = runtime_path()
    if root is None or runtime is None:
        return {"permission": "allow", "reason": "governance-runtime-unavailable"}
    result = subprocess.run(
        [sys.executable, str(runtime), "--repo", str(root), "--json", "hook", EVENT],
        input=payload,
        capture_output=True,
        check=False,
        timeout=9,
    )
    if result.returncode != 0:
        return {"permission": "allow", "reason": "governance-hook-warning"}
    try:
        parsed = json.loads(result.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {"permission": "allow", "reason": "governance-hook-invalid-output"}
    if not isinstance(parsed, dict):
        return {"permission": "allow", "reason": "governance-hook-invalid-output"}
    return {
        "permission": str(parsed.get("permission", "allow")),
        "reason": str(parsed.get("reason", "governance-check-complete")),
    }


def translate(decision: dict[str, str]) -> dict[str, object]:
    permission = decision["permission"]
    reason = decision["reason"]
    event_name = CLAUDE_EVENT_NAMES.get(EVENT, EVENT)
    if EVENT == "pre-tool-use":
        return {
            "hookSpecificOutput": {
                "hookEventName": event_name,
                "permissionDecision": permission,
            },
            "systemMessage": reason,
        }
    if EVENT in {"stop", "subagent-stop"}:
        if permission == "deny":
            return {"decision": "block", "reason": reason}
        return {"decision": "approve"}
    if EVENT in {"session-start", "post-tool-use"} and "warning" in reason:
        return {
            "hookSpecificOutput": {
                "hookEventName": event_name,
                "additionalContext": reason,
            }
        }
    return {}


def main() -> int:
    payload = sys.stdin.buffer.read()
    try:
        decision = neutral_decision(payload)
    except (OSError, subprocess.SubprocessError):
        decision = {"permission": "allow", "reason": "governance-hook-warning"}
    print(json.dumps(translate(decision), separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
