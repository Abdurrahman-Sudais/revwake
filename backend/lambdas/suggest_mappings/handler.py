"""AI mapping suggestions (AWS Lambda + Amazon Bedrock).

Scope: for a record that has no confirmed link, suggest which specification it may depend on.
Dependency tracing itself stays in analyse_impact and uses confirmed links only.

Safeguards enforced in code:
  * Input minimisation: only the record text and the candidate specifications' requirement text are
    sent. Customer names, quantities, prices, people and tenant identifiers are rejected.
  * Evidence-bound output: each suggestion must name a supplied specification id and quote text
    found verbatim in the record AND in that specification. Anything else is discarded; malformed
    output yields no suggestions.
  * Suggestions are pending until an engineer confirms (a confirmed link is created) or rejects them.

Environment: BEDROCK_MODEL_ID, GUARDRAIL_ID (optional), GUARDRAIL_VERSION (optional).
"""
import json
import os

PROMPT_VERSION = "2026-10-v1"
FORBIDDEN_KEYS = {"customer", "qty", "quantity", "value", "price", "owner", "assignee", "email", "tenant_id"}

SYSTEM = (
    "You help a manufacturing change engineer. Given one record's text and several specifications, "
    "say which specification, if any, the record may depend on. Quote the exact words from the record "
    "and from the specification. Do not decide; the engineer confirms. Output ONLY JSON matching the schema."
)
SCHEMA = {"suggestions": [{"spec_id": "one of the supplied ids", "record_quote": "exact text", "spec_quote": "exact text", "explanation": "one sentence"}]}


def check_input(req):
    bad = FORBIDDEN_KEYS.intersection(req)
    if bad:
        raise ValueError(f"forbidden keys in model input: {sorted(bad)}")
    if not isinstance(req.get("record_text"), str) or not isinstance(req.get("specs"), list):
        raise ValueError("record_text must be a string and specs a list")
    specs = [{"id": s["id"], "text": str(s["text"])} for s in req["specs"]]
    return {"record_text": req["record_text"], "specs": specs}


def build_prompt(payload):
    return f"Input: {json.dumps(payload, ensure_ascii=False)}\nSchema: {json.dumps(SCHEMA)}"


def validate(draft, payload, limit=3):
    items = draft.get("suggestions") if isinstance(draft, dict) else None
    if not isinstance(items, list):
        return [], ["output is not {suggestions: [...]}"]
    specs = {s["id"]: s["text"] for s in payload["specs"]}
    kept, rejected = [], []
    for s in items[:limit]:
        if not isinstance(s, dict) or s.get("spec_id") not in specs:
            rejected.append("unknown specification")
            continue
        rq, sq, why = s.get("record_quote"), s.get("spec_quote"), str(s.get("explanation", "")).strip()
        if not rq or rq not in payload["record_text"]:
            rejected.append("record quote not found")
        elif not sq or sq not in specs[s["spec_id"]]:
            rejected.append("specification quote not found")
        elif not why or len(why) > 300:
            rejected.append("missing or overlong explanation")
        else:
            kept.append({"spec_id": s["spec_id"], "record_quote": rq, "spec_quote": sq, "explanation": why, "decision": "pending"})
    return kept, rejected


def lambda_handler(event, _context):  # pragma: no cover - needs AWS
    import boto3

    req = json.loads(event["body"]) if isinstance(event.get("body"), str) else event
    payload = check_input(req)
    params = {
        "modelId": os.environ["BEDROCK_MODEL_ID"],
        "system": [{"text": SYSTEM}],
        "messages": [{"role": "user", "content": [{"text": build_prompt(payload)}]}],
        "inferenceConfig": {"maxTokens": 600, "temperature": 0},
    }
    if os.environ.get("GUARDRAIL_ID"):
        params["guardrailConfig"] = {"guardrailIdentifier": os.environ["GUARDRAIL_ID"], "guardrailVersion": os.environ.get("GUARDRAIL_VERSION", "DRAFT")}
    text = boto3.client("bedrock-runtime").converse(**params)["output"]["message"]["content"][0]["text"]
    try:
        draft = json.loads(text)
    except json.JSONDecodeError:
        draft = None
    kept, rejected = validate(draft, payload)
    return {"suggestions": kept, "rejected": len(rejected), "model_id": params["modelId"], "prompt_version": PROMPT_VERSION}
