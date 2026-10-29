// State transitions for the prototype. Each action mutates a draft copy of the workspace data,
// checks the acting user's role first, and writes an audit entry. The UI clones, applies and
// persists; tests call these directly.
import { DISPOSITIONS, NEEDS_IMPLEMENTATION, closeBlockers, exposure } from './engine.js';
import { buildAnalysis } from './seed.js';

export const PERMISSIONS = [
  ['View changes and impact analysis', { engineer: true, reviewer: 'Own department’s tasks', admin: 'Aggregates only' }],
  ['Create changes, run analysis', { engineer: true, reviewer: false, admin: false }],
  ['Confirm or reject mappings, decide AI suggestions', { engineer: true, reviewer: false, admin: false }],
  ['Assign review tasks', { engineer: true, reviewer: false, admin: false }],
  ['Record dispositions and implementation evidence', { engineer: false, reviewer: 'Own department only', admin: false }],
  ['Approve deviations, close changes', { engineer: true, reviewer: false, admin: false }],
  ['Change roles and policy', { engineer: false, reviewer: false, admin: true }],
  ['View audit log', { engineer: false, reviewer: false, admin: true }],
];

export class PermissionError extends Error {}
export const userById = (d, id) => d.users.find(u => u.id === id);
export const changeById = (d, id) => d.changes.find(c => c.id === id);
export const recordById = (d, id) => d.records.find(r => r.id === id);
export const specById = (d, id) => d.specs.find(s => s.id === id);
export const displayName = (d, id) => (id === 'system' ? 'System' : userById(d, id)?.name || id);

function guard(d, userId, roles, what) {
  const u = userById(d, userId);
  if (!u || !roles.includes(u.role)) throw new PermissionError(`${u ? u.name : 'This user'} cannot ${what}.`);
  return u;
}

export function audit(d, userId, action, detail, now) {
  d.audit.push({ id: (d.audit.at(-1)?.id || 0) + 1, at: now, user: userId, action, detail });
}

function openChange(d, id) {
  const c = changeById(d, id);
  if (!c) throw new Error('Change not found.');
  if (c.closed) throw new Error(`${c.id} is closed.`);
  return c;
}

function summary(c) {
  const n = k => c.results.filter(r => r.impact === k).length;
  return `${n('Review required')} review required, ${n('Mapping required')} mapping required, ${n('Complete')} complete`;
}

/** Re-run analysis for every open, analysed change on a specification (after mapping decisions). */
function rerun(d, specId) {
  d.changes = d.changes.map(c => (c.specId === specId && c.analysed && !c.closed ? buildAnalysis(c, d.specs, d.records, d.policy) : c));
}

export function createChange(d, userId, input, now) {
  guard(d, userId, ['engineer'], 'create changes');
  const spec = specById(d, input.specId);
  if (!spec) throw new Error('Choose a specification.');
  if (input.newRev) {
    const rev = input.newRev.trim().toUpperCase();
    if (!/^[A-Z]{1,2}$/.test(rev)) throw new Error('A revision is one or two letters.');
    if (spec.revisions.some(r => r.rev === rev)) throw new Error(`Rev ${rev} already exists.`);
    const base = spec.revisions.at(-1);
    const attrs = { ...base.attrs, ...Object.fromEntries(Object.entries(input.attrs).filter(([, v]) => String(v).trim()).map(([k, v]) => [k, String(v).trim()])) };
    if (Object.keys(attrs).every(k => attrs[k] === base.attrs[k])) throw new Error('The new revision does not change any attribute.');
    spec.revisions.push({ rev, date: now.slice(0, 10), attrs });
    input = { ...input, from: base.rev, to: rev };
  }
  if (!input.title?.trim()) throw new Error('Give the change a title.');
  const id = `ECN-${Math.max(...d.changes.map(c => Number(c.id.slice(4)))) + 1}`;
  d.changes.unshift({ id, specId: spec.id, from: input.from, to: input.to, title: input.title.trim(), owner: userId, created: now, analysed: false, results: [], tasks: [], suggestions: [], closed: null });
  audit(d, userId, 'Change created', `${id} · ${spec.id} Rev ${input.from} → ${input.to}`, now);
  return id;
}

export function runAnalysis(d, userId, changeId, now) {
  guard(d, userId, ['engineer'], 'run impact analysis');
  const i = d.changes.findIndex(c => c.id === changeId);
  if (d.changes[i].closed) throw new Error(`${changeId} is closed.`);
  d.changes[i] = buildAnalysis(d.changes[i], d.specs, d.records, d.policy);
  const ex = exposure(d.changes[i].results, d.records);
  audit(d, userId, 'Impact analysis run', `${changeId} · ${summary(d.changes[i])} · ${ex.units} open units, $${ex.committed} committed`, now);
}

/** Engineer decides whether a record depends on the change's specification. */
export function decideMapping(d, userId, changeId, recordId, depends, reason, now) {
  guard(d, userId, ['engineer'], 'decide mappings');
  const c = openChange(d, changeId);
  const r = recordById(d, recordId);
  if (c.results.find(x => x.id === recordId)?.impact !== 'Mapping required') throw new Error(`${recordId} does not need a mapping decision.`);
  if (!depends && (!reason || reason.trim().length < 10)) throw new Error('Give a reason of at least 10 characters for “not dependent”.');
  r.links = r.links.filter(l => l.to !== c.specId);
  if (depends) r.links.push({ to: c.specId, confirmed: true, by: userId, at: now });
  else r.notDependsOn = [...new Set([...(r.notDependsOn || []), c.specId])];
  c.suggestions.filter(s => s.recordId === recordId && s.decision === 'pending').forEach(s => { s.decision = depends ? 'confirmed' : 'rejected'; s.by = userId; s.at = now; });
  audit(d, userId, depends ? 'Mapping confirmed' : 'Mapping rejected', `${changeId} · ${recordId} ${depends ? '→' : '✕'} ${c.specId}${depends ? '' : ` · ${reason.trim()}`}`, now);
  rerun(d, c.specId);
}

export function assignTask(d, userId, changeId, recordId, assignee, now) {
  guard(d, userId, ['engineer'], 'assign tasks');
  const c = openChange(d, changeId);
  const t = c.tasks.find(x => x.recordId === recordId);
  const u = userById(d, assignee);
  if (assignee !== 'Unassigned' && (u?.role !== 'reviewer' || u.department !== t.department)) throw new Error(`Assign ${t.department} tasks to a ${t.department} reviewer.`);
  t.assignee = assignee;
  audit(d, userId, 'Task assigned', `${changeId} · ${recordId} → ${displayName(d, assignee)}`, now);
}

function myTask(d, userId, changeId, recordId) {
  const u = guard(d, userId, ['reviewer'], 'record dispositions');
  const c = openChange(d, changeId);
  const t = c.tasks.find(x => x.recordId === recordId);
  if (!t) throw new Error('Task not found.');
  if (t.department !== u.department) throw new PermissionError(`${u.name} reviews ${u.department} tasks only.`);
  return [c, t];
}

export function recordDisposition(d, userId, changeId, recordId, disposition, reason, now) {
  const [, t] = myTask(d, userId, changeId, recordId);
  if (!DISPOSITIONS.includes(disposition)) throw new Error('Choose a disposition.');
  if (!reason || reason.trim().length < 10) throw new Error('Explain the disposition (at least 10 characters).');
  Object.assign(t, { disposition, reason: reason.trim(), by: userId, at: now, deviationApprovedBy: null, implementation: null });
  audit(d, userId, 'Disposition recorded', `${changeId} · ${recordId} · ${disposition}`, now);
}

export function recordImplementation(d, userId, changeId, recordId, ref, now) {
  const [, t] = myTask(d, userId, changeId, recordId);
  if (!NEEDS_IMPLEMENTATION.includes(t.disposition)) throw new Error('This disposition does not need implementation evidence.');
  if (!ref || ref.trim().length < 3) throw new Error('Enter the reference that shows it was done (revised instruction, amended PO…).');
  t.implementation = { ref: ref.trim(), by: userId, at: now };
  audit(d, userId, 'Implementation evidence recorded', `${changeId} · ${recordId} · ${t.implementation.ref}`, now);
}

export function addTaskNote(d, userId, changeId, recordId, text, now) {
  const u = guard(d, userId, ['engineer', 'reviewer'], 'add notes');
  const c = openChange(d, changeId);
  const t = c.tasks.find(x => x.recordId === recordId);
  if (u.role === 'reviewer' && t.department !== u.department) throw new PermissionError(`${u.name} reviews ${u.department} tasks only.`);
  if (!text.trim()) throw new Error('Write a note first.');
  t.notes.push({ by: userId, at: now, text: text.trim() });
  audit(d, userId, 'Note added', `${changeId} · ${recordId}`, now);
}

export function approveDeviation(d, userId, changeId, recordId, now) {
  guard(d, userId, ['engineer'], 'approve deviations');
  const c = openChange(d, changeId);
  const t = c.tasks.find(x => x.recordId === recordId);
  if (t.disposition !== 'Use as-is (deviation)') throw new Error('Only deviations need engineering approval.');
  t.deviationApprovedBy = userId;
  t.deviationApprovedAt = now;
  audit(d, userId, 'Deviation approved', `${changeId} · ${recordId}`, now);
}

export function closeChange(d, userId, changeId, now) {
  guard(d, userId, ['engineer'], 'close changes');
  const c = openChange(d, changeId);
  const b = closeBlockers(c, d.policy);
  if (b.length) throw new Error(b.join(' '));
  c.closed = { by: userId, at: now };
  audit(d, userId, 'Change closed', `${changeId} · ${c.tasks.length} dispositions`, now);
}

export function setRole(d, userId, targetId, role, now) {
  guard(d, userId, ['admin'], 'change roles');
  if (targetId === userId && role !== 'admin') throw new Error('You cannot remove your own administrator role.');
  const t = userById(d, targetId);
  if (role === 'reviewer' && !t.department) t.department = 'Production';
  const old = t.role;
  t.role = role;
  audit(d, userId, 'Role changed', `${t.name}: ${old} → ${role}`, now);
}

export function setDepartment(d, userId, targetId, department, now) {
  guard(d, userId, ['admin'], 'change departments');
  const t = userById(d, targetId);
  const old = t.department;
  t.department = department;
  audit(d, userId, 'Department changed', `${t.name}: ${old || '—'} → ${department}`, now);
}

export function setPolicy(d, userId, key, value, now) {
  guard(d, userId, ['admin'], 'change policy');
  const old = d.policy[key];
  d.policy[key] = value;
  audit(d, userId, 'Policy changed', `${key}: ${old} → ${value}`, now);
}

/** JSON impact report for export. */
export function impactReport(d, c) {
  const spec = specById(d, c.specId);
  return {
    title: `Revwake prototype · impact report ${c.id}`,
    notice: 'Fictional sample data. Dispositions record decisions; implementation is only as verified as the evidence references below. No ERP, purchase or production records were changed by this prototype.',
    change: { id: c.id, title: c.title, specification: `${spec.id} ${spec.title}`, from: c.from, to: c.to, closed: c.closed },
    attributeChanges: (() => { const a = spec.revisions.find(r => r.rev === c.from).attrs, b = spec.revisions.find(r => r.rev === c.to).attrs; return Object.keys({ ...a, ...b }).filter(k => a[k] !== b[k]).map(k => ({ attribute: k, old: a[k], new: b[k] })); })(),
    exposure: exposure(c.results, d.records),
    records: c.results.map(r => {
      const t = c.tasks.find(x => x.recordId === r.id);
      return { id: r.id, impact: r.impact, reason: r.reason, department: r.department, assignee: t ? displayName(d, t.assignee) : null, disposition: t?.disposition || null, dispositionReason: t?.reason || null, deviationApprovedBy: t?.deviationApprovedBy ? displayName(d, t.deviationApprovedBy) : null, implementationEvidence: t?.implementation?.ref || null };
    }),
    aiSuggestions: c.suggestions.map(s => ({ record: s.recordId, specification: s.specId, decision: s.decision })),
  };
}
