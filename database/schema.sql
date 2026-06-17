-- ============================================================================
--  Portfolio Intelligence Platform — PostgreSQL normalized schema
--  Production storage target. The runnable stdlib backend uses file storage
--  (/storage/current) with the identical logical model; this schema is the
--  drop-in production database (swap storage.py for a SQLAlchemy repository).
-- ============================================================================

CREATE TABLE IF NOT EXISTS upload_history (
    id              BIGSERIAL PRIMARY KEY,
    filename        TEXT NOT NULL,
    stored_as       TEXT NOT NULL,
    file_format     TEXT,                       -- csv | xlsx | html
    rows            INTEGER,
    issues          INTEGER,
    epics           INTEGER,
    is_active       BOOLEAN DEFAULT FALSE,
    uploaded_at     TIMESTAMPTZ DEFAULT now(),
    archived_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    full_name       TEXT,
    role            TEXT NOT NULL DEFAULT 'Viewer'   -- Admin|PMO|PM|Executive|Viewer
                    CHECK (role IN ('Admin','PMO','PM','Executive','Viewer')),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_managers (
    id              BIGSERIAL PRIMARY KEY,
    full_name       TEXT UNIQUE NOT NULL,
    avatar_url      TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    id              BIGSERIAL PRIMARY KEY,
    project_key     TEXT NOT NULL,              -- PMD | PMO
    name            TEXT,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

-- Portfolio project = Epic
CREATE TABLE IF NOT EXISTS epics (
    id              BIGSERIAL PRIMARY KEY,
    issue_key       TEXT NOT NULL,
    project_key     TEXT,
    summary         TEXT,
    status          TEXT,
    status_group    TEXT,                       -- discovery|delivery|declined|other
    pm_id           BIGINT REFERENCES project_managers(id),
    story_points    NUMERIC,
    created_at      TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,                -- Resolution Date (used for yearly analytics)
    due_at          TIMESTAMPTZ,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE,
    UNIQUE (issue_key, upload_id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id              BIGSERIAL PRIMARY KEY,
    issue_key       TEXT NOT NULL,
    issue_type      TEXT,                       -- Task | New Feature
    epic_key        TEXT,
    project_key     TEXT,
    summary         TEXT,
    status          TEXT,
    status_group    TEXT,
    pm_id           BIGINT REFERENCES project_managers(id),
    story_points    NUMERIC,
    created_at      TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    due_at          TIMESTAMPTZ,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE,
    UNIQUE (issue_key, upload_id)
);

CREATE TABLE IF NOT EXISTS status_history (
    id              BIGSERIAL PRIMARY KEY,
    issue_key       TEXT NOT NULL,
    status          TEXT NOT NULL,
    entered_at      TIMESTAMPTZ NOT NULL,
    exited_at       TIMESTAMPTZ,
    duration_days   NUMERIC,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_status_history_issue ON status_history (issue_key, upload_id);

CREATE TABLE IF NOT EXISTS dependencies (
    id              BIGSERIAL PRIMARY KEY,
    source_key      TEXT NOT NULL,
    target_key      TEXT NOT NULL,
    link_type       TEXT NOT NULL,              -- blocks | is blocked by | depends on
    kind            TEXT,                       -- "Epic blocks Task" etc.
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blockers (
    id              BIGSERIAL PRIMARY KEY,
    issue_key       TEXT NOT NULL,
    is_epic         BOOLEAN,
    blocked_by      TEXT[],
    blocked_days    NUMERIC,
    risk_rating     TEXT,                       -- Low | Medium | High
    root_cause      TEXT,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ttm_metrics (
    id              BIGSERIAL PRIMARY KEY,
    issue_key       TEXT NOT NULL,
    issue_type      TEXT,                       -- Epic | Task | New Feature
    discovery_ttm   NUMERIC,
    delivery_ttm    NUMERIC,
    total_ttm       NUMERIC,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_time_metrics (
    id              BIGSERIAL PRIMARY KEY,
    issue_key       TEXT NOT NULL,
    in_progress_at  TIMESTAMPTZ,
    testing_exit_at TIMESTAMPTZ,
    lead_time_days  NUMERIC,
    flow_efficiency NUMERIC,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_scores (
    id              BIGSERIAL PRIMARY KEY,
    issue_key       TEXT NOT NULL,
    score           NUMERIC,                    -- 0..100
    category        TEXT,                       -- Excellent | Good | Warning | Critical
    ttm             NUMERIC,
    lead_time       NUMERIC,
    blocked         INTEGER,
    overdue         INTEGER,
    dependencies    INTEGER,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pm_scores (
    id                  BIGSERIAL PRIMARY KEY,
    pm_id               BIGINT REFERENCES project_managers(id),
    pm_score            NUMERIC,
    projects_completed  INTEGER,
    tasks_completed     INTEGER,
    avg_ttm             NUMERIC,
    avg_lead_time       NUMERIC,
    flow_efficiency     NUMERIC,
    success_rate        NUMERIC,
    ranking             INTEGER,
    upload_id           BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS yearly_statistics (
    id              BIGSERIAL PRIMARY KEY,
    year            INTEGER,
    completed       INTEGER,
    yoy_growth_pct  NUMERIC,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quarterly_statistics (
    id              BIGSERIAL PRIMARY KEY,
    period          TEXT,                       -- 2025-Q3
    completed       INTEGER,
    qoq_growth_pct  NUMERIC,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS monthly_statistics (
    id              BIGSERIAL PRIMARY KEY,
    period          TEXT,                       -- 2025-09
    completed       INTEGER,
    upload_id       BIGINT REFERENCES upload_history(id) ON DELETE CASCADE
);

-- RAG / knowledge base
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id              BIGSERIAL PRIMARY KEY,
    source          TEXT,    -- internal | methodologies | lex_uz | cbu_uz | pmo | project_office | jira | jira_archive
    title           TEXT,
    path            TEXT,
    content         TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vector_embeddings (
    id              BIGSERIAL PRIMARY KEY,
    document_id     BIGINT REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index     INTEGER,
    chunk_text      TEXT,
    embedding       BYTEA          -- pgvector "vector(768)" in production
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id),
    action          TEXT,
    entity          TEXT,
    detail          JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_epics_resolved ON epics (resolved_at);
CREATE INDEX IF NOT EXISTS ix_tasks_resolved ON tasks (resolved_at);
CREATE INDEX IF NOT EXISTS ix_dependencies_src ON dependencies (source_key);
