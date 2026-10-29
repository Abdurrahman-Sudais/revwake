-- Verifies db/schema.sql on a scratch PostgreSQL database. Run as a superuser:
--   createdb revwake_test && psql -v ON_ERROR_STOP=1 -d revwake_test -f db/schema.sql -f db/test_rls.sql
-- Every check raises an exception on failure; the last line prints ALL CHECKS PASSED.

CREATE ROLE revwake_app LOGIN;
GRANT USAGE ON SCHEMA public TO revwake_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO revwake_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO revwake_app;

-- Seed two tenants as the superuser (RLS is bypassed for superusers).
INSERT INTO tenant (tenant_id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Tenant A'), ('22222222-2222-2222-2222-222222222222', 'Tenant B');
INSERT INTO app_user (user_id, tenant_id, idp_subject, display_name, role, department) VALUES
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'eng', 'Alex', 'engineer', NULL),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'prod', 'Kai', 'reviewer', 'Production'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'qa', 'Sam', 'reviewer', 'Quality'),
  ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'adm', 'Mei', 'admin', NULL),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'eng', 'Other', 'engineer', NULL);
INSERT INTO specification VALUES ('11111111-1111-1111-1111-111111111111', 'SP-204', 'Finish', 'Northfield'), ('22222222-2222-2222-2222-222222222222', 'SP-900', 'Secret', 'Other');
INSERT INTO spec_revision VALUES
  ('11111111-1111-1111-1111-111111111111', 'SP-204', 'B', '2026-03-02', '{"Surface finish": "Zinc plating"}', NULL),
  ('11111111-1111-1111-1111-111111111111', 'SP-204', 'C', '2026-10-12', '{"Surface finish": "Powder coating"}', NULL);
INSERT INTO mfg_record VALUES
  ('11111111-1111-1111-1111-111111111111', 'WO-218', 'Order', 'Brackets', 'Open', 240, NULL, 'Finish: zinc plating', '{}'),
  ('11111111-1111-1111-1111-111111111111', 'QC-07', 'Inspection', 'Finish check', 'Open', NULL, NULL, 'Check zinc plating', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'WO-900', 'Order', 'Secret order', 'Open', 5, NULL, 'Other tenant', '{}');
INSERT INTO eng_change (tenant_id, change_id, spec_id, from_rev, to_rev, title, owner_id, analysed_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ECN-41', 'SP-204', 'B', 'C', 'Finish change', 'a0000000-0000-0000-0000-000000000001', now());
INSERT INTO impact_result VALUES
  ('11111111-1111-1111-1111-111111111111', 'ECN-41', 'WO-218', 'Review required', '{SP-204,WO-218}', '{Zinc plating}'),
  ('11111111-1111-1111-1111-111111111111', 'ECN-41', 'QC-07', 'Review required', '{SP-204,QC-07}', '{Zinc plating}');
INSERT INTO review_task (tenant_id, change_id, record_id, department) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ECN-41', 'WO-218', 'Production'),
  ('11111111-1111-1111-1111-111111111111', 'ECN-41', 'QC-07', 'Quality');

CREATE FUNCTION as_user(t text, u text, r text, dep text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.tenant_id', t, false), set_config('app.user_id', u, false), set_config('app.role', r, false), set_config('app.department', coalesce(dep, ''), false); $$;
CREATE FUNCTION expect(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT ok THEN RAISE EXCEPTION 'FAILED: %', what; END IF; END $$;
CREATE FUNCTION expect_error(stmt text, pattern text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'FAILED: expected an error matching "%" from: %', pattern, stmt;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' OR SQLERRM NOT LIKE '%' || pattern || '%' THEN RAISE; END IF;
END $$;

SET ROLE revwake_app;

-- Tenant isolation
SELECT as_user('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'engineer', NULL);
SELECT expect((SELECT count(*) FROM mfg_record) = 2, 'engineer sees only own tenant records');
SELECT expect((SELECT count(*) FROM specification) = 1, 'engineer sees only own tenant specs');
SELECT expect_error($$INSERT INTO mfg_record VALUES ('22222222-2222-2222-2222-222222222222','X','Order','x','Open',1,NULL,'','{}')$$, 'row-level security');

-- Department scoping
SELECT as_user('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'reviewer', 'Production');
SELECT expect((SELECT array_agg(record_id) FROM review_task) = '{WO-218}', 'production reviewer sees only production tasks');
UPDATE review_task SET disposition = 'Update to new revision', reason = 'Re-issue at Rev C', decided_by = app_user(), decided_at = now() WHERE record_id = 'QC-07';
SELECT as_user('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'engineer', NULL);
SELECT expect((SELECT disposition FROM review_task WHERE record_id = 'QC-07') IS NULL, 'production reviewer cannot update a quality task');

-- Constraints mirror the prototype gates
SELECT expect_error($$UPDATE review_task SET disposition = 'Scrap', reason = 'short', decided_by = app_user(), decided_at = now() WHERE record_id = 'WO-218'$$, 'review_task_check');
SELECT expect_error($$UPDATE review_task SET implementation_ref = 'X-1' WHERE record_id = 'WO-218'$$, 'review_task_check');

-- Admins: no record text, audit readable
SELECT as_user('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000004', 'admin', NULL);
SELECT expect((SELECT count(*) FROM mfg_record) = 0, 'admin cannot read record text');
SELECT expect((SELECT sum(records) FROM record_counts) = 2, 'admin reads own-tenant aggregates');

-- Close gate
SELECT as_user('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'engineer', NULL);
SELECT expect_error($$UPDATE eng_change SET closed_by = app_user(), closed_at = now() WHERE change_id = 'ECN-41'$$, 'tasks without a disposition');
UPDATE review_task SET disposition = 'Use as-is (deviation)', reason = 'Inspect stock to Rev B', decided_by = app_user(), decided_at = now() WHERE record_id = 'QC-07';
UPDATE review_task SET disposition = 'Update to new revision', reason = 'Re-issue at Rev C', decided_by = app_user(), decided_at = now() WHERE record_id = 'WO-218';
SELECT expect_error($$UPDATE eng_change SET closed_by = app_user(), closed_at = now() WHERE change_id = 'ECN-41'$$, 'unapproved deviations');
UPDATE review_task SET deviation_approved_by = app_user() WHERE record_id = 'QC-07';
SELECT expect_error($$UPDATE eng_change SET closed_by = app_user(), closed_at = now() WHERE change_id = 'ECN-41'$$, 'implementation evidence');
UPDATE review_task SET implementation_ref = 'WO-218 instruction rev 4' WHERE record_id = 'WO-218';
UPDATE eng_change SET closed_by = app_user(), closed_at = now() WHERE change_id = 'ECN-41';
SELECT expect_error($$UPDATE review_task SET reason = 'Changed after closing' WHERE record_id = 'WO-218'$$, 'is closed');
SELECT expect_error($$UPDATE eng_change SET title = 'x' WHERE change_id = 'ECN-41'$$, 'is closed');

-- Audit append-only and admin-only reads
INSERT INTO audit_event (tenant_id, user_id, action, detail) VALUES (app_tenant(), app_user(), 'Change closed', 'ECN-41');
SELECT expect((SELECT count(*) FROM audit_event) = 0, 'engineer cannot read the audit log');
SELECT as_user('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000004', 'admin', NULL);
SELECT expect((SELECT count(*) FROM audit_event) = 1, 'admin reads the audit log');
SELECT expect_error($$UPDATE audit_event SET detail = 'tampered'$$, 'append-only');

SELECT 'ALL CHECKS PASSED' AS result;
