"""GitHub synchronization service for the Portfolio Intelligence Platform.

Capabilities: pull updates, push changes, version control, release tracking,
audit trail, backup snapshots. Thin wrapper over `git` so deployment stays local.
"""
import subprocess
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True).stdout.strip()


def pull() -> str:
    return _git("pull", "--ff-only")


def push(message: str = "") -> str:
    _git("add", "-A")
    _git("commit", "-m", message or f"sync: {dt.datetime.now().isoformat(timespec='seconds')}")
    return _git("push")


def current_version() -> str:
    return _git("rev-parse", "--short", "HEAD")


def releases() -> list[str]:
    return [t for t in _git("tag", "--sort=-creatordate").splitlines() if t]


def snapshot() -> Path:
    """Create a backup snapshot of the active storage dataset."""
    import shutil
    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = ROOT / "storage" / "exports" / f"snapshot_{ts}"
    shutil.copytree(ROOT / "storage" / "current", dest, dirs_exist_ok=True)
    return dest


if __name__ == "__main__":
    print("HEAD:", current_version())
    print("Releases:", releases())
