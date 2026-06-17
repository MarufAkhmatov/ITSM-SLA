"""FastAPI entrypoint for the Portfolio Intelligence Platform."""
import datetime as dt
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import storage, parser, normalize, aggregate, aria, config

app = FastAPI(title="Portfolio Intelligence Platform", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _payload():
    data = storage.load_current()
    if not data:
        return None
    return data.get("payload")


@app.get("/api/health")
def health():
    meta = storage.load_current_meta()
    return {"status": "ok", "has_data": meta is not None, "active": meta}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    saved = storage.save_upload(file.filename, raw)
    try:
        rows = parser.parse_file(saved)
        issues = normalize.normalize_rows(rows)
        if not issues:
            raise HTTPException(422, "No issues found in file")
        payload = aggregate.build(issues)
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(422, f"Parse/calculation failed: {e}")

    meta = {
        "filename": file.filename,
        "stored_as": saved.name,
        "rows": len(rows),
        "issues": len(issues),
        "epics": payload["kpis"]["total_epics"],
        "uploaded_at": dt.datetime.now().isoformat(timespec="seconds"),
    }
    storage.set_current({"issues": issues, "payload": payload}, meta)
    return {"ok": True, "meta": meta, "kpis": payload["kpis"]}


@app.get("/api/dashboard")
def dashboard():
    p = _payload()
    if not p:
        return {"has_data": False}
    return {"has_data": True, "meta": storage.load_current_meta(),
            "widgets": p["widgets"], "kpis": p["kpis"]}


@app.get("/api/analytics")
def analytics():
    p = _payload()
    if not p:
        return {"has_data": False}
    return {"has_data": True, **p["analytics"]}


@app.get("/api/uploads")
def uploads():
    return {"history": storage.upload_history()}


class AriaQ(BaseModel):
    question: str


@app.post("/api/aria")
def aria_ask(q: AriaQ):
    p = _payload()
    if not p:
        return {"answer": "No portfolio dataset has been uploaded yet. Please upload a Jira export.",
                "source": "system"}
    return aria.ask(q.question, p)
