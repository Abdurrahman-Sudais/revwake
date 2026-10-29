import React, { useState } from 'react';
import { ArrowRight, Download, Check, X, Play, ChevronRight, FileText } from 'lucide-react';
import { diff, exposure, changeStatus, closeBlockers, NEEDS_IMPLEMENTATION } from './engine.js';
import {
  createChange, runAnalysis, decideMapping, assignTask, approveDeviation, closeChange, impactReport,
  specById, recordById, displayName,
} from './actions.js';
import { Link, PageHead, AiBadge, Status, Kpi, Empty, StackBar, fmtDate, download } from './ui.jsx';

const taskState = t => (!t.disposition ? 'Open' : t.disposition === 'Use as-is (deviation)' && !t.deviationApprovedBy ? 'Deviation pending' : NEEDS_IMPLEMENTATION.includes(t.disposition) && !t.implementation ? 'Needs evidence' : 'Done');
const money = n => `$${Number(n).toLocaleString('en-US')}`;

/* ---------------- Dashboard ---------------- */
export function EngineerDashboard({ data, user }) {
  const open = data.changes.filter(c => !c.closed);
  const tasks = open.flatMap(c => c.tasks.map(t => ({ c, t })));
  const mapping = open.reduce((s, c) => s + c.results.filter(r => r.impact === 'Mapping required').length, 0);
  const ex = open.reduce((m, c) => { const e = exposure(c.results, data.records); return { units: m.units + e.units, committed: m.committed + e.committed }; }, { units: 0, committed: 0 });
  const st = s => tasks.filter(x => taskState(x.t) === s).length;
  return (
    <>
      <PageHead title={`Good morning, ${user.name.split(' ')[0]}`} sub="Open specification changes, what they touch, and who still needs to decide." />
      <div className="pa-kpis">
        <Kpi value={open.length} label="open changes" to="#/changes" />
        <Kpi value={mapping} label="records waiting on a mapping decision" />
        <Kpi value={ex.units} label="open work-order units under review" />
        <Kpi value={money(ex.committed)} label="open purchase value under review" />
      </div>
      <div className="pa-grid2">
        <section className="pa-card" aria-labelledby="next">
          <h2 id="next">Changes</h2>
          <ul className="pa-list">
            {open.map(c => {
              const status = changeStatus(c, data.policy);
              const next = { Draft: ['Run the impact analysis', 'impact'], 'Mapping required': ['Decide unconfirmed mappings', 'mapping'], 'In review': ['Departments are reviewing', 'tasks'], 'Awaiting sign-off': ['Approve deviations or collect evidence', 'tasks'], 'Ready to close': ['Close the change', 'close'] }[status];
              return (
                <li key={c.id}>
                  <Link to={`#/changes/${c.id}/${next[1]}`}><strong>{c.id} · {c.title}</strong><small>{c.specId} Rev {c.from} → {c.to}</small></Link>
                  <Status value={status} />
                  <span className="pa-next">{next[0]} <ArrowRight size={14} aria-hidden="true" /></span>
                </li>
              );
            })}
          </ul>
          {!open.length && <Empty>No open changes.</Empty>}
        </section>
        <section className="pa-card" aria-labelledby="tasks">
          <h2 id="tasks">Review tasks across open changes</h2>
          <StackBar parts={[{ label: 'Open', value: st('Open'), tone: 'warn' }, { label: 'Deviation pending', value: st('Deviation pending'), tone: 'bad' }, { label: 'Needs evidence', value: st('Needs evidence'), tone: 'info' }, { label: 'Done', value: st('Done'), tone: 'ok' }]} />
          <ul className="pa-legend"><li><i className="warn" />Open {st('Open')}</li><li><i className="bad" />Deviation pending {st('Deviation pending')}</li><li><i className="info" />Needs evidence {st('Needs evidence')}</li><li><i className="ok" />Done {st('Done')}</li></ul>
          <h2>Recent activity</h2>
          <ol className="pa-feed">{data.audit.slice(-5).reverse().map(a => <li key={a.id}><span>{a.action}</span><small>{a.detail} · {fmtDate(a.at)}</small></li>)}</ol>
        </section>
      </div>
    </>
  );
}

/* ---------------- Change list ---------------- */
export function ChangeList({ data }) {
  return (
    <>
      <PageHead title="Changes" sub="Each change compares two revisions of one specification and traces what depends on it."><Link className="button" to="#/changes/new">New change</Link></PageHead>
      <div className="pa-card pa-tablewrap">
        <table className="pa-table">
          <thead><tr><th>Change</th><th>Specification</th><th>Review required</th><th>Mapping required</th><th>Status</th></tr></thead>
          <tbody>
            {data.changes.map(c => (
              <tr key={c.id}>
                <td><Link to={`#/changes/${c.id}`}><strong>{c.id} · {c.title}</strong></Link><small>Owner {displayName(data, c.owner)} · {fmtDate(c.created)}</small></td>
                <td>{c.specId} Rev {c.from} → {c.to}<small>{specById(data, c.specId).customer}</small></td>
                <td className="num">{c.analysed ? c.results.filter(r => r.impact === 'Review required').length : '—'}</td>
                <td className="num">{c.analysed ? c.results.filter(r => r.impact === 'Mapping required').length : '—'}</td>
                <td><Status value={changeStatus(c, data.policy)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- New change ---------------- */
export function NewChange({ data, act, go, notify }) {
  const [specId, setSpecId] = useState('SP-310');
  const spec = specById(data, specId);
  const latest = spec.revisions.at(-1);
  const nextRev = String.fromCharCode(latest.rev.charCodeAt(0) + 1);
  const [title, setTitle] = useState('');
  const [attrs, setAttrs] = useState({});
  function submit(e) {
    e.preventDefault();
    const res = act(createChange, { specId, newRev: nextRev, attrs, title });
    if (res.ok) { notify(`${res.result} created. Run the impact analysis next.`); go(`#/changes/${res.result}/revision`); }
  }
  return (
    <>
      <PageHead title="New change" sub="In production you upload the revised specification and the changed requirements are extracted for you to confirm. Here you type the new values.">
        <button type="button" className="text-button" onClick={() => { setSpecId('SP-310'); setTitle('Hole pattern update for new shelf clips'); setAttrs({ 'Hole pattern': 'HP-3' }); }}><FileText size={16} aria-hidden="true" /> Fill with an example</button>
      </PageHead>
      <form className="pa-card pa-form" onSubmit={submit} noValidate>
        <div className="pa-form-grid">
          <label>Specification<select value={specId} onChange={e => { setSpecId(e.target.value); setAttrs({}); }}>{data.specs.map(s => <option key={s.id} value={s.id}>{s.id} · {s.title}</option>)}</select></label>
          <label>Change title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} /></label>
        </div>
        <fieldset>
          <legend>Rev {latest.rev} → Rev {nextRev}: change any attribute</legend>
          <div className="pa-tablewrap">
            <table className="pa-table">
              <thead><tr><th>Attribute</th><th>Rev {latest.rev}</th><th>Rev {nextRev} (leave blank if unchanged)</th></tr></thead>
              <tbody>{Object.entries(latest.attrs).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td><td><input aria-label={`${k} in Rev ${nextRev}`} value={attrs[k] || ''} onChange={e => setAttrs(a => ({ ...a, [k]: e.target.value }))} /></td></tr>)}</tbody>
            </table>
          </div>
        </fieldset>
        <button className="button">Create change</button>
      </form>
    </>
  );
}

/* ---------------- Change detail ---------------- */
const TABS = [['revision', 'Revision'], ['impact', 'Impact'], ['mapping', 'Mapping'], ['tasks', 'Review tasks'], ['close', 'Close'], ['activity', 'Activity']];

export function ChangeDetail(props) {
  const { data, id, tab } = props;
  const c = data.changes.find(x => x.id === id);
  if (!c) return <div className="pa-card pa-denied"><h1>Change not found</h1><Link className="button" to="#/changes">All changes</Link></div>;
  const spec = specById(data, c.specId);
  const Tab = { revision: RevisionTab, impact: ImpactTab, mapping: MappingTab, tasks: TasksTab, close: CloseTab, activity: ActivityTab }[tab] || ImpactTab;
  const counts = { mapping: c.results.filter(r => r.impact === 'Mapping required').length, tasks: c.tasks.filter(t => taskState(t) !== 'Done').length };
  return (
    <>
      <PageHead title={`${c.id} · ${c.title}`} sub={`${spec.id} ${spec.title} · ${spec.customer} · Rev ${c.from} → ${c.to}`}>
        <button className="text-button" disabled={!c.analysed} onClick={() => download(`revwake-${c.id}-impact-report.json`, JSON.stringify(impactReport(data, c), null, 2), 'application/json')}><Download size={16} aria-hidden="true" /> Impact report</button>
      </PageHead>
      <div className="pa-review-status"><Status value={changeStatus(c, data.policy)} /><span>Owner {displayName(data, c.owner)}</span></div>
      <nav className="pa-tabs" aria-label="Change sections">
        {TABS.map(([k, label]) => <Link key={k} to={`#/changes/${c.id}/${k}`} aria-current={k === tab ? 'page' : undefined}>{label}{counts[k] ? <span className="pa-count">{counts[k]}</span> : null}</Link>)}
      </nav>
      <Tab {...props} c={c} spec={spec} />
    </>
  );
}

function RevisionTab({ c, spec }) {
  const changes = diff(spec, c.from, c.to);
  const a = spec.revisions.find(r => r.rev === c.from), b = spec.revisions.find(r => r.rev === c.to);
  return (
    <section className="pa-card">
      <h2>What changed</h2>
      <div className="pa-tablewrap">
        <table className="pa-table pa-compare">
          <thead><tr><th>Attribute</th><th>Rev {c.from} · {a.date}</th><th>Rev {c.to} · {b.date}</th></tr></thead>
          <tbody>{Object.keys({ ...a.attrs, ...b.attrs }).map(k => { const ch = changes.find(x => x.key === k); return <tr key={k} className={ch ? 'diff' : ''}><td>{k}</td><td>{ch ? <del>{a.attrs[k]}</del> : a.attrs[k]}</td><td>{ch ? <ins>{b.attrs[k]}</ins> : b.attrs[k]}</td></tr>; })}</tbody>
        </table>
      </div>
      <p className="pa-hint">{changes.length} attribute{changes.length === 1 ? '' : 's'} changed. Superseded values are also searched for in each record’s text, so instructions that still say “{changes[0]?.old}” are flagged.</p>
    </section>
  );
}

function ImpactTab({ data, c, act, notify }) {
  const [filter, setFilter] = useState('All');
  if (!c.analysed) {
    return (
      <section className="pa-card">
        <h2>Impact analysis</h2>
        <p>Follows confirmed links from {c.specId} through orders, purchases, inspections and routings, and searches every record for superseded values.</p>
        <button className="button" onClick={() => { if (act(runAnalysis, c.id).ok) notify('Impact analysis complete.'); }}><Play size={16} aria-hidden="true" /> Run impact analysis</button>
      </section>
    );
  }
  const ex = exposure(c.results, data.records);
  const rows = c.results.filter(r => filter === 'All' || r.impact === filter);
  return (
    <>
      <div className="pa-kpis">
        <Kpi value={ex.records} label="records need review" />
        <Kpi value={c.results.filter(r => r.impact === 'Mapping required').length} label="need a mapping decision" />
        <Kpi value={ex.units} label="open work-order units" />
        <Kpi value={money(ex.committed)} label="open purchase value" />
      </div>
      <section className="pa-card">
        <div className="pa-row between">
          <h2>Connected records</h2>
          <label className="pa-inline">Show<select value={filter} onChange={e => setFilter(e.target.value)}>{['All', 'Review required', 'Mapping required', 'Complete', 'Unaffected'].map(x => <option key={x}>{x}</option>)}</select></label>
        </div>
        <div className="pa-tablewrap">
          <table className="pa-table">
            <thead><tr><th>Record</th><th>Impact</th><th>Why</th><th>Department</th></tr></thead>
            <tbody>{rows.map(r => { const rec = recordById(data, r.id); return (
              <tr key={r.id}>
                <td><strong className="mono">{r.id}</strong><small>{rec.type} · {rec.title}{rec.qty ? ` · ${rec.qty} units` : ''}{rec.value ? ` · ${money(rec.value)}` : ''}</small></td>
                <td><Status value={r.impact} /></td>
                <td>{r.path && <span className="pa-path">{r.path.map((p, i) => <React.Fragment key={p}>{i > 0 && <ChevronRight size={12} aria-hidden="true" />}<span>{p}</span></React.Fragment>)}</span>}<small>{r.reason}</small></td>
                <td>{r.department}</td>
              </tr>); })}</tbody>
          </table>
        </div>
        <button className="text-button" onClick={() => { if (act(runAnalysis, c.id).ok) notify('Analysis re-run.'); }} disabled={!!c.closed}><Play size={16} aria-hidden="true" /> Re-run analysis</button>
        <p className="pa-hint">Only confirmed links create a dependency. Records with unconfirmed links, or that mention a superseded value without a link, are never silently marked unaffected.</p>
      </section>
    </>
  );
}

function MappingTab({ data, c, act, notify }) {
  const [reason, setReason] = useState({});
  const pending = c.results.filter(r => r.impact === 'Mapping required');
  return (
    <section className="pa-card">
      <h2>Mapping decisions</h2>
      <p className="pa-hint">A person decides whether each record depends on {c.specId}. Confirming adds a confirmed link and creates a review task; “not dependent” is recorded with a reason. {data.policy.aiSuggestions ? 'AI suggestions point to the shared wording but never decide.' : 'AI suggestions are switched off by your administrator.'}</p>
      {!c.analysed ? <Empty>Run the impact analysis first.</Empty> : pending.length ? pending.map(r => {
        const rec = recordById(data, r.id);
        const s = c.suggestions.find(x => x.recordId === r.id && x.decision === 'pending');
        return (
          <article className="pa-suggestion" key={r.id}>
            <div className="pa-row between"><strong className="mono">{r.id} · {rec.title}</strong>{s && <AiBadge />}</div>
            <p>{r.reason}</p>
            <p className="pa-quote">“{rec.text}”</p>
            {s && <p className="pa-hint">AI suggestion: this record may depend on {s.specId}. Shared wording: {s.shared.map(w => `“${w}”`).join(', ')}.</p>}
            {!c.closed && (
              <div className="pa-actions">
                <button className="button" onClick={() => { if (act(decideMapping, c.id, r.id, true, '').ok) notify(`${r.id} linked to ${c.specId}; a review task was created.`); }}><Check size={16} aria-hidden="true" /> Depends on {c.specId}</button>
                <form className="pa-reason" onSubmit={e => { e.preventDefault(); if (act(decideMapping, c.id, r.id, false, reason[r.id] || '').ok) notify(`${r.id} recorded as not dependent.`); }}>
                  <label>Not dependent, because…<input value={reason[r.id] || ''} onChange={e => setReason(x => ({ ...x, [r.id]: e.target.value }))} placeholder="e.g. Housings follow drawing D-77, not SP-204" maxLength={300} /></label>
                  <button className="text-button"><X size={16} aria-hidden="true" /> Record as not dependent</button>
                </form>
              </div>
            )}
          </article>
        );
      }) : <Empty>No records need a mapping decision.</Empty>}
      {c.suggestions.some(s => s.decision !== 'pending') && (
        <>
          <h3>Decided</h3>
          <ul className="pa-feed">{c.suggestions.filter(s => s.decision !== 'pending').map(s => <li key={s.id}><span>{s.recordId} → {s.specId}: AI suggestion {s.decision}</span><small>{displayName(data, s.by)} · {fmtDate(s.at)}</small></li>)}</ul>
        </>
      )}
    </section>
  );
}

function TasksTab({ data, c, act, notify }) {
  if (!c.analysed) return <section className="pa-card"><Empty>Run the impact analysis first.</Empty></section>;
  return (
    <section className="pa-card">
      <h2>Review tasks</h2>
      <p className="pa-hint">One task per open record that needs review, routed by record type: orders and routings to Production, materials to Purchasing, inspections to Quality. Departments record the disposition; engineering approves deviations.</p>
      <div className="pa-tablewrap">
        <table className="pa-table">
          <thead><tr><th>Record</th><th>Department</th><th>Assignee</th><th>Disposition</th><th>State</th></tr></thead>
          <tbody>{c.tasks.map(t => {
            const rec = recordById(data, t.recordId);
            const people = data.users.filter(u => u.role === 'reviewer' && u.department === t.department);
            return (
              <tr key={t.recordId}>
                <td><strong className="mono">{t.recordId}</strong><small>{rec.title}</small></td>
                <td>{t.department}</td>
                <td><select aria-label={`Assignee for ${t.recordId}`} value={t.assignee} disabled={!!c.closed} onChange={e => act(assignTask, c.id, t.recordId, e.target.value)}><option value="Unassigned">Unassigned</option>{people.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                <td>{t.disposition || '—'}<small>{t.reason}{t.implementation ? ` · evidence ${t.implementation.ref}` : ''}</small></td>
                <td>
                  <Status value={taskState(t)} />
                  {taskState(t) === 'Deviation pending' && !c.closed && <button className="text-button" onClick={() => { if (act(approveDeviation, c.id, t.recordId).ok) notify(`Deviation on ${t.recordId} approved.`); }}><Check size={14} aria-hidden="true" /> Approve deviation</button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {!c.tasks.length && <Empty>No records need review.</Empty>}
    </section>
  );
}

function CloseTab({ data, c, act, notify }) {
  const blockers = closeBlockers(c, data.policy);
  if (c.closed) return <section className="pa-card"><h2>Closed</h2><p>Closed by {displayName(data, c.closed.by)} on {fmtDate(c.closed.at)}.</p></section>;
  return (
    <section className="pa-card">
      <h2>Close the change</h2>
      <ul className="pa-checklist">
        {[
          ['Impact analysis run', c.analysed],
          ['Every unconfirmed mapping decided', c.analysed && !c.results.some(r => r.impact === 'Mapping required')],
          ['Every review task has a disposition', c.analysed && !c.tasks.some(t => !t.disposition)],
          ['Deviations approved by engineering', !c.tasks.some(t => t.disposition === 'Use as-is (deviation)' && !t.deviationApprovedBy)],
          ...(data.policy.requireImplementationEvidence ? [['Implementation evidence for every update, rework or purchase change (policy)', !c.tasks.some(t => NEEDS_IMPLEMENTATION.includes(t.disposition) && !t.implementation)]] : []),
        ].map(([l, ok]) => <li key={l} className={ok ? 'ok' : 'bad'}>{ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />} {l}</li>)}
      </ul>
      <button className="button" disabled={!!blockers.length} onClick={() => { if (act(closeChange, c.id).ok) notify(`${c.id} closed.`); }}>Close {c.id}</button>
      <p className="pa-hint">Closing records that every connected record was reviewed. It does not change any ERP, purchasing or production system.</p>
    </section>
  );
}

function ActivityTab({ data, c }) {
  const rows = data.audit.filter(a => a.detail.startsWith(c.id)).reverse();
  return <section className="pa-card"><h2>Activity</h2>{rows.length ? <ol className="pa-feed">{rows.map(a => <li key={a.id}><span>{a.action} · {displayName(data, a.user)}</span><small>{a.detail} · {fmtDate(a.at)}</small></li>)}</ol> : <Empty>No activity yet.</Empty>}</section>;
}
