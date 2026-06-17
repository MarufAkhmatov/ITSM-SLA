"""File-based storage layer.

Latest upload -> /storage/current ; previous versions auto-moved to /storage/archive.
(Designed to be swappable for the PostgreSQL schema in /database/schema.sql.)
"""
import json
import shutil
import datetime as dt
from pathlib import Path
from . import config

CURRENT_DATA = config.CURRENT / "dataset.json"
CURRENT_META = config.CURRENT / "meta.json"
STATUS_AUDIT_FILE = config.CURRENT / "status_audit.json"
HISTORY_FILE = config.STORAGE / "upload_history.json"
CACHE_DIR = config.TEMP / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def parse_cache_get(h: str):
    f = CACHE_DIR / f"{h}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    return None


def parse_cache_put(h: str, issues: list):
    (CACHE_DIR / f"{h}.json").write_text(json.dumps(issues, ensure_ascii=False), encoding="utf-8")


def save_status_audit(audit: dict) -> None:
    STATUS_AUDIT_FILE.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")


def load_status_audit() -> dict | None:
    if STATUS_AUDIT_FILE.exists():
        return json.loads(STATUS_AUDIT_FILE.read_text(encoding="utf-8"))
    return None


def _now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def save_upload(filename: str, raw_bytes: bytes) -> Path:
    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = config.UPLOADS / f"{ts}__{filename}"
    dest.write_bytes(raw_bytes)
    return dest


def archive_current():
    """Move the active dataset to the archive before a new one becomes active."""
    if CURRENT_DATA.exists():
        meta = {}
        if CURRENT_META.exists():
            meta = json.loads(CURRENT_META.read_text(encoding="utf-8"))
        ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        adir = config.ARCHIVE / ts
        adir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(CURRENT_DATA), str(adir / "dataset.json"))
        if CURRENT_META.exists():
            shutil.move(str(CURRENT_META), str(adir / "meta.json"))
        return adir
    return None


def set_current(dataset: dict, meta: dict):
    archive_current()
    CURRENT_DATA.write_text(json.dumps(dataset, ensure_ascii=False), encoding="utf-8")
    meta = {**meta, "activated_at": _now()}
    CURRENT_META.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    _append_history(meta)


def load_current() -> dict | None:
    if CURRENT_DATA.exists():
        return json.loads(CURRENT_DATA.read_text(encoding="utf-8"))
    return None


def load_current_meta() -> dict | None:
    if CURRENT_META.exists():
        return json.loads(CURRENT_META.read_text(encoding="utf-8"))
    return None


def _append_history(meta: dict):
    hist = []
    if HISTORY_FILE.exists():
        hist = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    hist.insert(0, meta)
    HISTORY_FILE.write_text(json.dumps(hist, ensure_ascii=False, indent=2), encoding="utf-8")


def upload_history() -> list:
    if HISTORY_FILE.exists():
        return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    return []
