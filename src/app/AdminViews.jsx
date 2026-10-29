import React, { useState } from 'react';
import { Download, Check, X } from 'lucide-react';
import { changeStatus, csv } from './engine.js';
import { setRole, setDepartment, setPolicy, PERMISSIONS, displayName } from './actions.js';
import { PageHead, Kpi, StackBar, Empty, fmtDate, download } from './ui.jsx';

const ROLES = [['engineer', 'Change engineer'], ['reviewer', 'Department reviewer'], ['admin', 'Administrator']];
const DEPTS = ['Production', 'Purchasing', 'Quality'];

export function AdminOverview({ data }) {
  const results = data.changes.flatMap(c => c.results);
  const tasks = data.changes.flatMap(c => c.tasks);
  const ai = data.changes.flatMap(c => c.suggestions);
  const by = k => results.filter(r => r.impact === k).length;
  const disp = tasks.reduce((m, t) => (t.disposition ? { ...m, [t.disposition]: (m[t.disposition] || 0) + 1 } : m), {});
  return (
    <>
      <PageHead title="Workspace overview" sub="Aggregate figures only. Change contents stay with engineers and department reviewers." />
      <div className="pa-kpis">
        <Kpi value={data.changes.filter(c => !c.closed).length} label="open changes" />
        <Kpi value={by('Review required')} label="records flagged for review" />
        <Kpi value={by('Mapping required')} label="records awaiting a mapping decision" />
        <Kpi value={tasks.filter(t => t.disposition === 'Use as-is (deviation)').length} label="deviations recorded" />
      </div>
      <div className="pa-grid2">
        <section className="pa-card"><h2>Changes by status</h2>
          <table className="pa-table"><tbody>{Object.entries(data.changes.reduce((m, c) => { const s = changeStatus(c, data.policy); return { ...m, [s]: (m[s] || 0) + 1 }; }, {})).map(([k, n]) => <tr key={k}><td>{k}</td><td className="num">{n}</td></tr>)}</tbody></table>
          <h2>Dispositions</h2>
          {Object.keys(disp).length ? <table className="pa-table"><tbody>{Object.entries(disp).map(([k, n]) => <tr key={k}><td>{k}</td><td className="num">{n}</td></tr>)}</tbody></table> : <Empty>No dispositions recorded yet.</Empty>}
        </section>
        <section className="pa-card"><h2>AI mapping suggestions</h2>
          <StackBar parts={[{ label: 'Confirmed', value: ai.filter(s => s.decision === 'confirmed').length, tone: 'ok' }, { label: 'Rejected', value: ai.filter(s => s.decision === 'rejected').length, tone: 'muted' }, { label: 'Pending', value: ai.filter(s => s.decision === 'pending').length, tone: 'ai' }]} />
          <p className="pa-hint">Track how often engineers confirm suggested mappings. Missing links are the main reason impact is missed, so unconfirmed mappings are never treated as unaffected.</p>
        </section>
      </div>
    </>
  );
}

export function AdminUsers({ data, user, act, notify }) {
  return (
    <>
      <PageHead title="Users & departments" sub="Reviewers see only their department’s tasks. Tasks are routed by department." />
      <div className="pa-card pa-tablewrap">
        <table className="pa-table">
          <thead><tr><th>Name</th><th>Role</th><th>Department</th></tr></thead>
          <tbody>{data.users.map(u => (
            <tr key={u.id}>
              <td><span className="pa-avatar">{u.initials}</span> {u.name}{u.id === user.id && ' (you)'}<small>{u.title}</small></td>
              <td><select aria-label={`Role for ${u.name}`} value={u.role} onChange={e => { if (act(setRole, u.id, e.target.value).ok) notify(`${u.name} is now ${ROLES.find(r => r[0] === e.target.value)[1]}.`); }}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
              <td>{u.role === 'reviewer' ? <select aria-label={`Department for ${u.name}`} value={u.department} onChange={e => { if (act(setDepartment, u.id, e.target.value).ok) notify(`${u.name} moved to ${e.target.value}.`); }}>{DEPTS.map(x => <option key={x}>{x}</option>)}</select> : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

export function AdminPolicy({ data, act, notify }) {
  const p = data.policy;
  const toggle = (key, label) => <label className="check-label"><input type="checkbox" checked={p[key]} onChange={e => { if (act(setPolicy, key, e.target.checked).ok) notify(`${label} ${e.target.checked ? 'on' : 'off'}.`); }} /> {label}</label>;
  return (
    <>
      <PageHead title="Policy" sub="Workspace-wide controls. Every change is written to the audit log." />
      <section className="pa-card pa-form">
        {toggle('requireImplementationEvidence', 'Require implementation evidence before a change can close')}
        {toggle('aiSuggestions', 'AI mapping suggestions')}
        <p className="pa-hint">Dependency tracing and superseded-value checks always run. AI only suggests mappings, is always labelled, and never decides. Deviations always need engineering approval.</p>
      </section>
    </>
  );
}

export function AdminAudit({ data }) {
  const [q, setQ] = useState('');
  const rows = data.audit.filter(a => `${a.action} ${a.detail} ${displayName(data, a.user)}`.toLowerCase().includes(q.toLowerCase())).reverse();
  return (
    <>
      <PageHead title="Audit log" sub="Append-only record of who did what, and when.">
        <button className="text-button" onClick={() => download('revwake-audit.csv', csv([['id', 'time', 'user', 'action', 'detail'], ...data.audit.map(a => [a.id, a.at, displayName(data, a.user), a.action, a.detail])]), 'text/csv')}><Download size={16} aria-hidden="true" /> Export CSV</button>
      </PageHead>
      <div className="pa-filters"><label><span className="sr-only">Filter audit log</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by action, change or person…" /></label></div>
      <div className="pa-card pa-tablewrap">
        <table className="pa-table">
          <thead><tr><th>Time (UTC)</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>{rows.map(a => <tr key={a.id}><td>{fmtDate(a.at)}</td><td>{displayName(data, a.user)}</td><td>{a.action}</td><td>{a.detail}</td></tr>)}</tbody>
        </table>
        {!rows.length && <Empty>No entries match.</Empty>}
      </div>
    </>
  );
}

export function AdminPermissions() {
  const cell = v => (v === true ? <Check size={14} aria-label="Allowed" /> : v === false ? <X size={14} aria-label="Not allowed" /> : <small>{v}</small>);
  return (
    <>
      <PageHead title="Permissions" sub="What each role can do. The prototype checks this on every action; production enforces it on the server and in PostgreSQL row-level security." />
      <div className="pa-card pa-tablewrap">
        <table className="pa-table pa-matrix">
          <thead><tr><th>Capability</th><th>Engineer</th><th>Reviewer</th><th>Administrator</th></tr></thead>
          <tbody>{PERMISSIONS.map(([label, r]) => <tr key={label}><td>{label}</td><td>{cell(r.engineer)}</td><td>{cell(r.reviewer)}</td><td>{cell(r.admin)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
