-- Revwake PostgreSQL schema (Amazon RDS for PostgreSQL), matching the proposed architecture on the website.
-- Design goals: tenant isolation and department scoping through row-level security, confirmed-link
-- dependencies, database-enforced review gates, and an append-only audit log.
-- Verified locally with PostgreSQL 16 by db/test_rls.sql (see README). Not deployed anywhere.
--
-- The API sets these per transaction (SET LOCAL) from the verified JWT:
--   app.tenant_id, app.user_id, app.role ('engineer' | 'reviewer' | 'admin'), app.department

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION app_tenant() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('app.role', true) $$;
CREATE OR REPLACE FUNCTION app_department() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('app.department', true) $$;
CREATE OR REPLACE FUNCTION app_user() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE TABLE tenant (
  tenant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  require_implementation_evidence boolean NOT NULL DEFAULT true,
  ai_suggestions boolean NOT NULL DEFAULT true
);

CREATE TYPE user_role AS ENUM ('engineer', 'reviewer', 'admin');
CREATE TYPE department AS ENUM ('Production', 'Purchasing', 'Quality');

CREATE TABLE app_user (
  user_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant ON DELETE CASCADE,
  idp_subject text NOT NULL,                 -- Cognito subject; no passwords stored here
  display_name text NOT NULL,
  role        user_role NOT NULL,
  department  department,
  CHECK ((role = 'reviewer') = (department IS NOT NULL)),
  UNIQUE (tenant_id, idp_subject)
);

CREATE TABLE specification (
  tenant_id uuid NOT NULL REFERENCES tenant ON DELETE CASCADE,
  spec_id   text NOT NULL,
  title     text NOT NULL,
  customer  text,
  PRIMARY KEY (tenant_id, spec_id)
);

CREATE TABLE spec_revision (
  tenant_id uuid NOT NULL,
  spec_id   text NOT NULL,
  rev       text NOT NULL CHECK (rev ~ '^[A-Z]{1,2}$'),
  issued_on date NOT NULL,
  attrs     jsonb NOT NULL CHECK (jsonb_typeof(attrs) = 'object'),
  source_s3_key text,                        -- the revised PDF in versioned S3
  PRIMARY KEY (tenant_id, spec_id, rev),
  FOREIGN KEY (tenant_id, spec_id) REFERENCES specification ON DELETE CASCADE
);

CREATE TYPE record_type AS ENUM ('Order', 'Material', 'Inspection', 'Routing');

CREATE TABLE mfg_record (
  tenant_id uuid NOT NULL REFERENCES tenant ON DELETE CASCADE,
  record_id text NOT NULL,
  type      record_type NOT NULL,
  title     text NOT NULL,
  state     text NOT NULL CHECK (state IN ('Open', 'Complete')),
  qty       integer CHECK (qty IS NULL OR qty >= 0),
  value_cents bigint CHECK (value_cents IS NULL OR value_cents >= 0),
  body_text text NOT NULL DEFAULT '',
  not_depends_on text[] NOT NULL DEFAULT '{}',   -- specs a person confirmed it does NOT depend on
  PRIMARY KEY (tenant_id, record_id)
);

-- A record depends on a specification or on another record. Only confirmed links create dependencies.
CREATE TABLE record_link (
  tenant_id uuid NOT NULL,
  record_id text NOT NULL,
  target_id text NOT NULL,                   -- a spec_id or a record_id
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_by uuid REFERENCES app_user,
  confirmed_at timestamptz,
  CHECK (confirmed = (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)),
  PRIMARY KEY (tenant_id, record_id, target_id),
  FOREIGN KEY (tenant_id, record_id) REFERENCES mfg_record ON DELETE CASCADE
);

CREATE TABLE eng_change (
  tenant_id uuid NOT NULL,
  change_id text NOT NULL,
  spec_id   text NOT NULL,
  from_rev  text NOT NULL,
  to_rev    text NOT NULL,
  title     text NOT NULL,
  owner_id  uuid NOT NULL REFERENCES app_user,
  analysed_at timestamptz,
  closed_by uuid REFERENCES app_user,
  closed_at timestamptz,
  CHECK ((closed_by IS NULL) = (closed_at IS NULL)),
  CHECK (from_rev <> to_rev),
  PRIMARY KEY (tenant_id, change_id),
  FOREIGN KEY (tenant_id, spec_id, from_rev) REFERENCES spec_revision,
  FOREIGN KEY (tenant_id, spec_id, to_rev) REFERENCES spec_revision
);

CREATE TABLE impact_result (
  tenant_id uuid NOT NULL,
  change_id text NOT NULL,
  record_id text NOT NULL,
  impact    text NOT NULL CHECK (impact IN ('Review required', 'Mapping required', 'Complete', 'Unaffected')),
  path      text[],
  stale     text[] NOT NULL DEFAULT '{}',
  CHECK ((impact IN ('Review required', 'Complete')) = (path IS NOT NULL)),
  PRIMARY KEY (tenant_id, change_id, record_id),
  FOREIGN KEY (tenant_id, change_id) REFERENCES eng_change ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, record_id) REFERENCES mfg_record
);

CREATE TABLE review_task (
  tenant_id uuid NOT NULL,
  change_id text NOT NULL,
  record_id text NOT NULL,
  department department NOT NULL,
  assignee  uuid REFERENCES app_user,
  disposition text CHECK (disposition IN ('Update to new revision', 'Use as-is (deviation)', 'Rework', 'Scrap', 'Cancel or amend purchase', 'No change needed')),
  reason    text,
  decided_by uuid REFERENCES app_user,
  decided_at timestamptz,
  deviation_approved_by uuid REFERENCES app_user,
  implementation_ref text,
  CHECK ((disposition IS NULL) = (decided_by IS NULL)),
  CHECK (disposition IS NULL OR length(trim(reason)) >= 10),
  -- coalesce: a CHECK passes on NULL, so a missing disposition must compare as false, not unknown.
  CHECK (deviation_approved_by IS NULL OR coalesce(disposition = 'Use as-is (deviation)', false)),
  CHECK (implementation_ref IS NULL OR coalesce(disposition IN ('Update to new revision', 'Rework', 'Cancel or amend purchase'), false)),
  PRIMARY KEY (tenant_id, change_id, record_id),
  FOREIGN KEY (tenant_id, change_id) REFERENCES eng_change ON DELETE CASCADE
);

CREATE TABLE ai_suggestion (
  tenant_id uuid NOT NULL,
  change_id text NOT NULL,
  record_id text NOT NULL,
  spec_id   text NOT NULL,
  record_quote text NOT NULL,
  spec_quote   text NOT NULL,
  model_id  text NOT NULL,
  prompt_version text NOT NULL,
  decision  text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'confirmed', 'rejected')),
  decided_by uuid REFERENCES app_user,
  CHECK ((decision = 'pending') = (decided_by IS NULL)),
  PRIMARY KEY (tenant_id, change_id, record_id, spec_id)
);

CREATE TABLE audit_event (
  event_id  bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  at        timestamptz NOT NULL DEFAULT now(),
  user_id   uuid,
  action    text NOT NULL,
  detail    text NOT NULL
);

-- Review gate: a change can only close when nothing is left to decide (mirrors closeBlockers()).
CREATE OR REPLACE FUNCTION check_change_close() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE needs_evidence boolean;
BEGIN
  IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL THEN
    IF NEW.analysed_at IS NULL THEN RAISE EXCEPTION 'change % has not been analysed', NEW.change_id; END IF;
    IF EXISTS (SELECT 1 FROM impact_result WHERE tenant_id = NEW.tenant_id AND change_id = NEW.change_id AND impact = 'Mapping required') THEN
      RAISE EXCEPTION 'change % has undecided mappings', NEW.change_id; END IF;
    IF EXISTS (SELECT 1 FROM review_task WHERE tenant_id = NEW.tenant_id AND change_id = NEW.change_id AND disposition IS NULL) THEN
      RAISE EXCEPTION 'change % has tasks without a disposition', NEW.change_id; END IF;
    IF EXISTS (SELECT 1 FROM review_task WHERE tenant_id = NEW.tenant_id AND change_id = NEW.change_id AND disposition = 'Use as-is (deviation)' AND deviation_approved_by IS NULL) THEN
      RAISE EXCEPTION 'change % has unapproved deviations', NEW.change_id; END IF;
    SELECT require_implementation_evidence INTO needs_evidence FROM tenant WHERE tenant_id = NEW.tenant_id;
    IF needs_evidence AND EXISTS (SELECT 1 FROM review_task WHERE tenant_id = NEW.tenant_id AND change_id = NEW.change_id
         AND disposition IN ('Update to new revision', 'Rework', 'Cancel or amend purchase') AND implementation_ref IS NULL) THEN
      RAISE EXCEPTION 'change % is missing implementation evidence', NEW.change_id; END IF;
  END IF;
  IF OLD.closed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'change % is closed', OLD.change_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER eng_change_close BEFORE UPDATE ON eng_change FOR EACH ROW EXECUTE FUNCTION check_change_close();

-- Tasks of a closed change are frozen.
CREATE OR REPLACE FUNCTION check_task_open() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM eng_change WHERE tenant_id = NEW.tenant_id AND change_id = NEW.change_id AND closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'change % is closed', NEW.change_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER review_task_open BEFORE UPDATE ON review_task FOR EACH ROW EXECUTE FUNCTION check_task_open();

-- Audit is append-only for the application.
CREATE OR REPLACE FUNCTION audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_event is append-only'; END $$;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION audit_append_only();

-- Row-level security. FORCE applies it to the table owner too, so tests can run as the owner role.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_user','specification','spec_revision','mfg_record','record_link','eng_change','impact_result','review_task','ai_suggestion','audit_event'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant())', t);
  END LOOP;
END $$;

-- Policies are permissive (OR-ed) by default; these are RESTRICTIVE so they narrow tenant_isolation.
-- Reviewers see only their department's tasks.
CREATE POLICY reviewer_department ON review_task AS RESTRICTIVE
  USING (app_role() <> 'reviewer' OR department::text = app_department());
-- Reviewers may update only their department's tasks, and never the engineering approval column
-- (column privileges for that are granted per role in deployment); admins do not edit tasks.
CREATE POLICY no_admin_task_writes ON review_task AS RESTRICTIVE FOR UPDATE USING (app_role() IN ('engineer', 'reviewer'));
-- Only admins read the audit log; everyone may append.
CREATE POLICY audit_read ON audit_event AS RESTRICTIVE FOR SELECT USING (app_role() = 'admin');
-- Admins see aggregates, not record text: they read mfg_record only through record_counts.
CREATE POLICY record_no_admin ON mfg_record AS RESTRICTIVE FOR SELECT USING (app_role() <> 'admin');

-- Owned by a reporting role with BYPASSRLS in deployment, so it filters by tenant explicitly.
CREATE VIEW record_counts WITH (security_barrier) AS
  SELECT tenant_id, type, state, count(*) AS records, coalesce(sum(qty), 0) AS units
  FROM mfg_record WHERE tenant_id = app_tenant() GROUP BY tenant_id, type, state;
