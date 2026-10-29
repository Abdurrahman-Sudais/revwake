"""Run from the repository root: python3 backend/tests/test_lambdas.py (standard library only)."""
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "backend" / "lambdas" / name / "handler.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


analyse_impact = load("analyse_impact")
suggest_mappings = load("suggest_mappings")
FX = json.loads((ROOT / "backend" / "tests" / "fixtures" / "cases.json").read_text())


class AnalyseImpactTest(unittest.TestCase):
    def test_shared_fixtures_match_prototype_engine(self):
        changes, results = analyse_impact.analyse(FX["spec"], "A", "B", FX["records"])
        self.assertEqual(changes, FX["diff"])
        for r in results:
            with self.subTest(r["id"]):
                e = FX["expected"][r["id"]]
                self.assertEqual(r["impact"], e["impact"])
                self.assertEqual(r["path"], e["path"])
                self.assertEqual(r["stale"], e["stale"])

    def test_handler_and_unknown_revision(self):
        out = analyse_impact.lambda_handler({"body": json.dumps({"spec": FX["spec"], "from": "A", "to": "B", "records": FX["records"]})}, None)
        self.assertEqual(len(out["results"]), len(FX["records"]))
        with self.assertRaises(ValueError):
            analyse_impact.diff(FX["spec"], "A", "Z")


class SuggestMappingsTest(unittest.TestCase):
    payload = {"record_text": "Housing finish: zinc plating, natural colour.", "specs": [{"id": "SP-204", "text": "Surface finish: Zinc plating. Colour: Natural."}, {"id": "SP-310", "text": "Length tolerance ±0.5 mm"}]}

    def test_rejects_identifying_input(self):
        with self.assertRaises(ValueError):
            suggest_mappings.check_input({**self.payload, "customer": "Northfield"})

    def test_keeps_only_evidence_bound_suggestions(self):
        p = suggest_mappings.check_input(self.payload)
        draft = {"suggestions": [
            {"spec_id": "SP-204", "record_quote": "zinc plating", "spec_quote": "Zinc plating", "explanation": "Both name zinc plating."},
            {"spec_id": "SP-999", "record_quote": "zinc plating", "spec_quote": "Zinc plating", "explanation": "Unknown spec."},
            {"spec_id": "SP-310", "record_quote": "zinc plating", "spec_quote": "Zinc plating", "explanation": "Quote not in SP-310."},
        ]}
        kept, rejected = suggest_mappings.validate(draft, p)
        self.assertEqual([k["spec_id"] for k in kept], ["SP-204"])
        self.assertEqual(kept[0]["decision"], "pending")
        self.assertEqual(len(rejected), 2)

    def test_fails_closed(self):
        p = suggest_mappings.check_input(self.payload)
        self.assertEqual(suggest_mappings.validate(None, p)[0], [])
        self.assertEqual(suggest_mappings.validate({"suggestions": {}}, p)[0], [])


if __name__ == "__main__":
    unittest.main()
