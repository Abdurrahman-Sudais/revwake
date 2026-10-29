"""Deterministic impact analysis (AWS Lambda).

Same rules as the prototype engine (src/app/engine.js). Both are tested against
backend/tests/fixtures/cases.json so they cannot drift apart silently.

Input:  {"spec": {...with revisions}, "from": "B", "to": "C", "records": [...]}
        In production the records are read from PostgreSQL (db/schema.sql) for the caller's tenant.
Output: {"changes": [...attribute diffs], "results": [{id, impact, path, stale, department}]}

No AI is involved: dependency tracing follows confirmed links only.
"""
import json
import re
from collections import deque

DEPARTMENT = {"Order": "Production", "Routing": "Production", "Material": "Purchasing", "Inspection": "Quality"}


def normalise(text):
    return " ".join(re.sub(r"[^a-z0-9µ]+", " ", str(text or "").lower()).split())


def diff(spec, frm, to):
    revs = {r["rev"]: r["attrs"] for r in spec["revisions"]}
    if frm not in revs or to not in revs:
        raise ValueError(f"revision not found for {spec['id']}")
    a, b = revs[frm], revs[to]
    keys = list(dict.fromkeys([*a.keys(), *b.keys()]))
    return [{"key": k, "old": a.get(k, "—"), "new": b.get(k, "—")} for k in keys if normalise(a.get(k)) != normalise(b.get(k))]


def paths(root, records):
    children = {}
    for r in records:
        for link in r["links"]:
            if link.get("confirmed"):
                children.setdefault(link["to"], []).append(r["id"])
    out = {root: [root]}
    queue = deque([root])
    while queue:
        node = queue.popleft()
        for child in sorted(children.get(node, [])):
            if child not in out:
                out[child] = out[node] + [child]
                queue.append(child)
    del out[root]
    return out


def mentions(record, changes):
    text = f" {normalise(record.get('text'))} "
    return [c["old"] for c in changes if c["old"] != "—" and f" {normalise(c['old'])} " in text]


def analyse(spec, frm, to, records):
    changes = diff(spec, frm, to)
    reach = paths(spec["id"], records)
    results = []
    for r in records:
        path = reach.get(r["id"])
        stale = mentions(r, changes)
        unconfirmed = any(not link.get("confirmed") and (link["to"] == spec["id"] or link["to"] in reach) for link in r["links"])
        if path and r.get("state") == "Complete":
            impact = "Complete"
        elif path:
            impact = "Review required"
        elif spec["id"] in r.get("notDependsOn", []):
            impact = "Unaffected"
        elif unconfirmed or stale:
            impact = "Mapping required"
        else:
            impact = "Unaffected"
        results.append({"id": r["id"], "impact": impact, "path": path, "stale": stale, "department": DEPARTMENT.get(r.get("type"))})
    return changes, results


def lambda_handler(event, _context):
    body = json.loads(event["body"]) if isinstance(event.get("body"), str) else event
    changes, results = analyse(body["spec"], body["from"], body["to"], body["records"])
    return {"changes": changes, "results": results}
