import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../src/app/seed.js';
import * as A from '../src/app/actions.js';
import { changeStatus } from '../src/app/engine.js';

const t = (n = 0) => new Date(Date.UTC(2026, 9, 22, 9, n)).toISOString();
const C = 'ECN-41';

test('mapping → department review → deviation approval → evidence → close', () => {
  const d = seed();
  const c = () => A.changeById(d, C);
  assert.throws(() => A.decideMapping(d, 'u-kai', C, 'WO-235', true, '', t()), A.PermissionError);
  A.decideMapping(d, 'u-alex', C, 'WO-235', true, '', t(1));
  assert.equal(c().results.find(r => r.id === 'WO-235').impact, 'Review required', 'confirmed link re-runs analysis');
  assert.ok(c().tasks.some(x => x.recordId === 'WO-235'));
  assert.throws(() => A.decideMapping(d, 'u-alex', C, 'RT-12', false, 'short', t()), /10 characters/);
  A.decideMapping(d, 'u-alex', C, 'RT-12', false, 'Step 40 is for the older bracket family only.', t(2));
  assert.equal(c().results.find(r => r.id === 'RT-12').impact, 'Unaffected');
  assert.equal(changeStatus(c(), d.policy), 'In review');

  assert.throws(() => A.assignTask(d, 'u-alex', C, 'PO-731', 'u-kai', t()), /Purchasing reviewer/);
  A.assignTask(d, 'u-alex', C, 'PO-731', 'u-jo', t());
  assert.throws(() => A.recordDisposition(d, 'u-kai', C, 'PO-731', 'Cancel or amend purchase', 'Amend to powder coat', t()), /Production tasks only/);
  A.recordDisposition(d, 'u-jo', C, 'PO-731', 'Cancel or amend purchase', 'Amend PO to powder coating service.', t(3));
  for (const id of ['WO-218', 'WO-221', 'WO-235']) A.recordDisposition(d, 'u-kai', C, id, 'Update to new revision', 'Re-issue instruction at Rev C.', t(4));
  A.recordDisposition(d, 'u-sam', C, 'QC-07', 'Use as-is (deviation)', 'Inspect existing stock to Rev B until it runs out.', t(5));
  assert.equal(changeStatus(c(), d.policy), 'Awaiting sign-off');
  assert.throws(() => A.closeChange(d, 'u-alex', C, t()), /deviation.*engineering approval/);
  assert.throws(() => A.approveDeviation(d, 'u-sam', C, 'QC-07', t()), A.PermissionError);
  A.approveDeviation(d, 'u-alex', C, 'QC-07', t(6));
  assert.throws(() => A.closeChange(d, 'u-alex', C, t()), /implementation evidence/);
  assert.throws(() => A.recordImplementation(d, 'u-sam', C, 'QC-07', 'X-1', t()), /does not need/);
  A.recordImplementation(d, 'u-jo', C, 'PO-731', 'PO-731 amendment A1', t(7));
  for (const id of ['WO-218', 'WO-221', 'WO-235']) A.recordImplementation(d, 'u-kai', C, id, `${id} instruction rev 4`, t(8));
  assert.equal(changeStatus(c(), d.policy), 'Ready to close');
  A.closeChange(d, 'u-alex', C, t(9));
  assert.equal(changeStatus(c(), d.policy), 'Closed');
  assert.throws(() => A.recordDisposition(d, 'u-kai', C, 'WO-218', 'Scrap', 'Too late now really', t()), /closed/);
  const report = A.impactReport(d, c());
  assert.equal(report.records.find(r => r.id === 'QC-07').deviationApprovedBy, 'Alex Morgan');
  assert.match(report.notice, /No ERP/);
  for (const x of ['Mapping confirmed', 'Mapping rejected', 'Disposition recorded', 'Deviation approved', 'Implementation evidence recorded', 'Change closed']) assert.ok(d.audit.some(a => a.action === x), x);
});

test('a new change with a new revision, analysed, and the policy switch', () => {
  const d = seed();
  assert.throws(() => A.createChange(d, 'u-kai', { specId: 'SP-310', newRev: 'C', attrs: { 'Hole pattern': 'HP-3' }, title: 'x' }, t()), A.PermissionError);
  assert.throws(() => A.createChange(d, 'u-alex', { specId: 'SP-310', newRev: 'C', attrs: {}, title: 'No-op' }, t()), /does not change/);
  const id = A.createChange(d, 'u-alex', { specId: 'SP-310', newRev: 'C', attrs: { 'Hole pattern': 'HP-3' }, title: 'Hole pattern update' }, t());
  assert.equal(id, 'ECN-43');
  A.runAnalysis(d, 'u-alex', id, t());
  const c = A.changeById(d, id);
  assert.deepEqual(c.tasks.map(x => x.recordId), ['WO-229', 'QC-11']);
  A.setPolicy(d, 'u-mei', 'requireImplementationEvidence', false, t());
  A.recordDisposition(d, 'u-kai', id, 'WO-229', 'Update to new revision', 'Drill to HP-3 from next batch.', t());
  A.recordDisposition(d, 'u-sam', id, 'QC-11', 'No change needed', 'Length check unaffected by hole pattern.', t());
  A.closeChange(d, 'u-alex', id, t());
  assert.throws(() => A.setRole(d, 'u-mei', 'u-mei', 'engineer', t()), /own administrator/);
});

test('early-access validation and HubSpot payload', async () => {
  const { validateLead, leadPayload, hubspotConfig } = await import('../src/lead.js');
  const f = { name: 'Ana Ruiz', email: 'ana@example.com', company: 'Fab Co', role: 'QA lead', category: 'Fabricator', volume: '5–20', challenge: 'Finish changes', consent: false, marketing: true };
  assert.match(validateLead(f), /agree/);
  assert.equal(validateLead({ ...f, consent: true }), '');
  const p = leadPayload({ ...f, consent: true }, { pageUri: 'x' }, {});
  assert.deepEqual(p.fields.map(x => x.name), ['firstname', 'lastname', 'email', 'company', 'jobtitle', 'manufacturing_category', 'monthly_revisions', 'change_challenge']);
  assert.deepEqual(p.legalConsentOptions.consent.communications, []);
  assert.equal(hubspotConfig({}), null);
});
