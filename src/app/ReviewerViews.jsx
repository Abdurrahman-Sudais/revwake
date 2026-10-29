import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { diff, DISPOSITIONS, NEEDS_IMPLEMENTATION } from './engine.js';
import { recordDisposition, recordImplementation, addTaskNote, recordById, specById, displayName } from './actions.js';
import { Link, PageHead, Status, Empty, fmtDate } from './ui.jsx';

const state = t => (!t.disposition ? 'Open' : t.disposition === 'Use as-is (deviation)' && !t.deviationApprovedBy ? 'Deviation pending' : NEEDS_IMPLEMENTATION.includes(t.disposition) && !t.implementation ? 'Needs evidence' : 'Done');

export function ReviewerQueue({ data, user }) {
  const rows = data.changes.filter(c => !c.closed).flatMap(c => c.tasks.filter(t => t.department === user.department).map(t => ({ c, t })));
  return (
    <>
      <PageHead title={`${user.department} review tasks`} sub="Records in your department that depend on a changed specification. Other departments’ tasks are not shown." />
      <div className="pa-card pa-tablewrap">
        <table className="pa-table">
          <thead><tr><th>Record</th><th>Change</th><th>Assignee</th><th>State</th></tr></thead>
          <tbody>{rows.map(({ c, t }) => { const rec = recordById(data, t.recordId); return (
            <tr key={c.id + t.recordId}>
              <td><Link to={`#/reviews/${c.id}/${t.recordId}`}><strong className="mono">{t.recordId}</strong></Link><small>{rec.title}</small></td>
              <td>{c.id}<small>{c.specId} Rev {c.from} → {c.to}</small></td>
              <td>{displayName(data, t.assignee)}{t.assignee === user.id ? ' (you)' : ''}</td>
              <td><Status value={state(t)} /></td>
            </tr>); })}</tbody>
        </table>
        {!rows.length && <Empty>No open tasks for {user.department}. Tasks appear after a change engineer runs an impact analysis.</Empty>}
      </div>
    </>
  );
}

export function ReviewerTask({ data, user, changeId, recordId, act, notify }) {
  const c = data.changes.find(x => x.id === changeId);
  const t = c?.tasks.find(x => x.recordId === recordId);
  const [disp, setDisp] = useState(t?.disposition || '');
  const [reason, setReason] = useState('');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  if (!t) return <div className="pa-card"><Empty>Task not found.</Empty></div>;
  if (t.department !== user.department) return <div className="pa-card pa-denied"><h1>Not your department</h1><p>This task belongs to {t.department}.</p><Link className="button" to="#/reviews">Your tasks</Link></div>;
  const rec = recordById(data, recordId);
  const spec = specById(data, c.specId);
  const res = c.results.find(r => r.id === recordId);
  const changes = diff(spec, c.from, c.to);
  const closed = !!c.closed;
  return (
    <>
      <PageHead title={`${recordId} · ${rec.title}`} sub={`${c.id} · ${spec.id} Rev ${c.from} → ${c.to} · ${t.department}`} />
      <div className="pa-review-status"><Status value={state(t)} /><span>Assignee {displayName(data, t.assignee)}</span></div>
      <div className="pa-grid2">
        <section className="pa-card">
          <h2>Why this record is included</h2>
          <p>{res.reason}</p>
          <p className="pa-quote">“{rec.text}”</p>
          <h3>Specification changes</h3>
          <ul className="pa-feed">{changes.map(x => <li key={x.key}><span>{x.key}</span><small><del>{x.old}</del> → <ins>{x.new}</ins></small></li>)}</ul>
        </section>
        <section className="pa-card">
          <h2>Disposition</h2>
          {t.disposition && <p>Recorded: <strong>{t.disposition}</strong> by {displayName(data, t.by)} · {fmtDate(t.at)}<br /><span className="pa-hint">{t.reason}</span>{t.deviationApprovedBy && <><br />Deviation approved by {displayName(data, t.deviationApprovedBy)}</>}</p>}
          {!closed && (
            <form className="pa-form" onSubmit={e => { e.preventDefault(); if (act(recordDisposition, changeId, recordId, disp, reason).ok) { notify('Disposition recorded.'); setReason(''); } }}>
              <label>Disposition<select value={disp} onChange={e => setDisp(e.target.value)}><option value="">Choose…</option>{DISPOSITIONS.map(x => <option key={x}>{x}</option>)}</select></label>
              <label>Reason<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={600} placeholder="What will happen to this record, and why?" /></label>
              {disp === 'Use as-is (deviation)' && <p className="pa-hint">A deviation needs engineering approval before the change can close.</p>}
              <button className="button">{t.disposition ? 'Replace disposition' : 'Record disposition'}</button>
            </form>
          )}
          {NEEDS_IMPLEMENTATION.includes(t.disposition) && (
            <>
              <h3>Implementation evidence</h3>
              {t.implementation ? <p><Check size={14} aria-hidden="true" /> {t.implementation.ref} · {displayName(data, t.implementation.by)} · {fmtDate(t.implementation.at)}</p> : !closed && (
                <form className="pa-form" onSubmit={e => { e.preventDefault(); if (act(recordImplementation, changeId, recordId, ref).ok) notify('Implementation evidence recorded.'); }}>
                  <label>Reference that shows it was done<input value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. WO-218 instruction rev 4, PO-731 amendment A1" maxLength={120} /></label>
                  <button className="button">Record evidence</button>
                </form>
              )}
              <p className="pa-hint">A disposition says what should happen. Evidence says it did. Revwake does not change the instruction or purchase itself.</p>
            </>
          )}
          <h3>Notes</h3>
          {t.notes.length ? <ul className="pa-comments">{t.notes.map((n, i) => <li key={i}><strong>{displayName(data, n.by)}</strong> · <small>{fmtDate(n.at)}</small><p>{n.text}</p></li>)}</ul> : <p className="pa-hint">No notes yet.</p>}
          {!closed && <form className="pa-comment-form" onSubmit={e => { e.preventDefault(); if (note.trim() && act(addTaskNote, changeId, recordId, note).ok) setNote(''); }}><label><span className="sr-only">Add a note</span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="Add a note…" /></label><button className="text-button" disabled={!note.trim()}>Add note</button></form>}
        </section>
      </div>
    </>
  );
}
