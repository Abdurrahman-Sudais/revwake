# Review safeguards

| Safeguard | Where in the prototype (`src/app/`) | In the database (`db/schema.sql`) |
|---|---|---|
| Confirmed links only | `paths()` follows `confirmed` links | `record_link.confirmed` requires who and when |
| Unknown is never unaffected | `analyse()`: unconfirmed links and superseded-value mentions mean “Mapping required” | `impact_result` check; close blocked while mapping is required |
| Rejections need a reason | `decideMapping` (10+ characters) | stored on the record (`not_depends_on`) and in the audit log |
| Department scoping | reviewers act on their own department only (`myTask`) | `reviewer_department` RLS policy |
| Dispositions need a reason | `recordDisposition` | CHECK on `review_task` |
| Deviations need engineering | `approveDeviation`, `closeBlockers` | CHECK + `check_change_close` |
| Decision is not implementation | separate evidence step; policy can require it | CHECK + close trigger |
| Closed is closed | actions refuse closed changes | `check_change_close`, `check_task_open` |
| AI is labelled and never decides | `suggestMappings` results need an engineer decision | `ai_suggestion.decision` |
| Audit | every action writes an entry | `audit_event` append-only trigger; admin-only reads |

## Tests

- `tests/engine.test.mjs` and `backend/tests/test_lambdas.py` both run `backend/tests/fixtures/cases.json`: multi-hop paths, complete records, unconfirmed links to the spec or to a dependent record, superseded-value mentions, “not dependent” decisions and unrelated text.
- `tests/workflow.test.mjs` covers the full change lifecycle, permissions, department routing, the deviation and evidence gates, closure, a new revision, and the policy switch.
- `tests/prototype.test.mjs` drives all three roles through the UI in jsdom, including persistence and reset.
- `db/test_rls.sql` checks tenant isolation, department scoping, admin restrictions, CHECK constraints, the close gate, frozen closed changes and the append-only audit in PostgreSQL 16. It caught a NULL-handling gap in two CHECK constraints, now fixed.
- Still to do with real users: keyboard and screen-reader passes, and a pilot measuring mappings confirmed against rejected and the time from revision to closure.
