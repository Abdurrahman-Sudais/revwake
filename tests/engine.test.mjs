import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyse, diff, exposure, suggestMappings, closeBlockers, changeStatus, csv } from '../src/app/engine.js';
import { seed } from '../src/app/seed.js';

const fx = JSON.parse(fs.readFileSync('backend/tests/fixtures/cases.json', 'utf8'));

test('impact analysis matches the shared fixtures used by the Python Lambda', () => {
  assert.deepEqual(diff(fx.spec, 'A', 'B'), fx.diff);
  const out = analyse(fx.spec, 'A', 'B', fx.records);
  for (const r of out) {
    const e = fx.expected[r.id];
    assert.equal(r.impact, e.impact, `${r.id} impact`);
    assert.deepEqual(r.path, e.path, `${r.id} path`);
    assert.deepEqual(r.stale, e.stale, `${r.id} stale`);
  }
});

test('seed ECN-41 matches the home-page workspace', () => {
  const d = seed();
  const c = d.changes.find(x => x.id === 'ECN-41');
  const impact = id => c.results.find(r => r.id === id).impact;
  for (const id of ['WO-218', 'WO-221', 'PO-731', 'QC-07']) assert.equal(impact(id), 'Review required', id);
  assert.equal(impact('WO-229'), 'Unaffected');
  assert.equal(impact('WO-235'), 'Mapping required');
  assert.equal(impact('WO-205'), 'Complete');
  assert.deepEqual(c.tasks.map(t => [t.recordId, t.department]), [['WO-218', 'Production'], ['WO-221', 'Production'], ['PO-731', 'Purchasing'], ['QC-07', 'Quality']]);
  assert.deepEqual(exposure(c.results, d.records), { units: 360, committed: 1850, records: 4 });
  assert.equal(changeStatus(c, d.policy), 'Mapping required');
  assert.equal(closeBlockers(c, d.policy).length, 2);
});

test('mapping suggestions need at least two shared words', () => {
  const d = seed();
  assert.deepEqual(suggestMappings(d.records.find(r => r.id === 'WO-235'), d.specs).map(s => s.specId), ['SP-204']);
  assert.deepEqual(suggestMappings({ id: 'X', text: 'Bolts and washers' }, d.specs), []);
});

test('csv escaping', () => assert.equal(csv([['a', 'b,c'], ['"q"', 'x\ny']]), 'a,"b,c"\n"""q""","x\ny"'));
