// Impact analysis for the Revwake prototype. Pure functions, no DOM.
// The same rules are implemented in backend/lambdas/analyse_impact/handler.py; both are tested
// against backend/tests/fixtures/cases.json so the prototype and the proposed Lambda stay in step.

export const normalise = text => String(text || '').toLowerCase().replace(/[^a-z0-9µ]+/g, ' ').trim();
const words = t => normalise(t).split(' ').filter(w => w.length > 2);

export const DEPARTMENT = { Order: 'Production', Routing: 'Production', Material: 'Purchasing', Inspection: 'Quality' };

/** Attribute-level differences between two revisions of a specification. */
export function diff(spec, from, to) {
  const a = spec.revisions.find(r => r.rev === from)?.attrs;
  const b = spec.revisions.find(r => r.rev === to)?.attrs;
  if (!a || !b) throw new Error(`Revision ${!a ? from : to} not found for ${spec.id}.`);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter(k => normalise(a[k]) !== normalise(b[k]))
    .map(k => ({ key: k, old: a[k] ?? '—', new: b[k] ?? '—' }));
}

/**
 * Shortest confirmed dependency path from `rootId` (a specification) to every record.
 * Records point at what they depend on (`links: [{to, confirmed}]`); only confirmed links count.
 */
export function paths(rootId, records) {
  const children = new Map();
  for (const r of records) for (const l of r.links) if (l.confirmed) {
    if (!children.has(l.to)) children.set(l.to, []);
    children.get(l.to).push(r.id);
  }
  const out = new Map([[rootId, [rootId]]]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    for (const child of (children.get(id) || []).sort()) if (!out.has(child)) {
      out.set(child, [...out.get(id), child]);
      queue.push(child);
    }
  }
  out.delete(rootId);
  return out;
}

/** Superseded values (from the diff) that a record's text still mentions. */
export function mentions(record, changes) {
  const text = ` ${normalise(record.text)} `;
  return changes.filter(c => c.old !== '—' && text.includes(` ${normalise(c.old)} `)).map(c => c.old);
}

/**
 * Classify every record for a change. Results:
 *  - Review required: a confirmed path to the specification and the record is still open
 *  - Complete: confirmed path, but the record is already complete (kept for traceability)
 *  - Mapping required: an unconfirmed link, or no path but its text names a superseded value
 *  - Unaffected: no confirmed path and nothing in its text points at the change
 */
export function analyse(spec, from, to, records) {
  const changes = diff(spec, from, to);
  const reach = paths(spec.id, records);
  return records.map(r => {
    const path = reach.get(r.id) || null;
    const stale = mentions(r, changes);
    const unconfirmed = r.links.some(l => !l.confirmed && (l.to === spec.id || reach.has(l.to)));
    let impact, reason;
    if (path && r.state === 'Complete') {
      impact = 'Complete'; reason = `Confirmed link via ${path.join(' → ')}, but the record is complete. Kept for traceability; no open work to review.`;
    } else if (path) {
      impact = 'Review required';
      reason = `Confirmed link via ${path.join(' → ')}.${stale.length ? ` Still references superseded ${stale.map(s => `“${s}”`).join(', ')}.` : ''}`;
    } else if ((r.notDependsOn || []).includes(spec.id)) {
      impact = 'Unaffected'; reason = `A person confirmed it does not depend on ${spec.id}.`;
    } else if (unconfirmed || stale.length) {
      impact = 'Mapping required';
      reason = unconfirmed ? 'Has an unconfirmed specification link. A person must confirm or reject the mapping.' : `No confirmed link, but the record mentions ${stale.map(s => `“${s}”`).join(', ')}. A person must confirm whether it depends on ${spec.id}.`;
    } else {
      impact = 'Unaffected'; reason = `No confirmed dependency on ${spec.id}.`;
    }
    return { id: r.id, impact, reason, path, stale, department: DEPARTMENT[r.type] };
  });
}

/** Open quantity and committed value exposed to the change (records needing review only). */
export function exposure(results, records) {
  const byId = new Map(records.map(r => [r.id, r]));
  const review = results.filter(x => x.impact === 'Review required').map(x => byId.get(x.id));
  return {
    units: review.filter(r => r.type === 'Order').reduce((s, r) => s + (r.qty || 0), 0),
    committed: review.filter(r => r.type === 'Material').reduce((s, r) => s + (r.value || 0), 0),
    records: review.length,
  };
}

/**
 * Simulated AI mapping suggestion. In production Amazon Bedrock compares a record's text with the
 * specification and must quote both. Here a deterministic word-overlap rule produces the same shape.
 */
export function suggestMappings(record, specs) {
  const mine = new Set(words(record.text));
  return specs.map(s => {
    const text = s.revisions.map(r => `${s.title} ${Object.values(r.attrs).join(' ')}`).join(' ');
    const shared = [...new Set(words(text))].filter(w => mine.has(w));
    return { specId: s.id, shared, score: shared.length };
  }).filter(x => x.score >= 2).sort((a, b) => b.score - a.score || a.specId.localeCompare(b.specId)).slice(0, 1)
    .map(x => ({ id: `map:${record.id}:${x.specId}`, recordId: record.id, specId: x.specId, shared: x.shared, recordQuote: record.text }));
}

export const DISPOSITIONS = ['Update to new revision', 'Use as-is (deviation)', 'Rework', 'Scrap', 'Cancel or amend purchase', 'No change needed'];
export const NEEDS_IMPLEMENTATION = ['Update to new revision', 'Rework', 'Cancel or amend purchase'];

/** Reasons a change cannot be closed yet. Empty = may close. */
export function closeBlockers(change, policy) {
  const out = [];
  if (!change.analysed) out.push('Run the impact analysis.');
  const unmapped = change.results.filter(r => r.impact === 'Mapping required').length;
  if (unmapped) out.push(`${unmapped} record${unmapped > 1 ? 's need' : ' needs'} a mapping decision.`);
  const open = change.tasks.filter(t => !t.disposition).length;
  if (open) out.push(`${open} review task${open > 1 ? 's have' : ' has'} no disposition.`);
  const dev = change.tasks.filter(t => t.disposition === 'Use as-is (deviation)' && !t.deviationApprovedBy).length;
  if (dev) out.push(`${dev} deviation${dev > 1 ? 's need' : ' needs'} engineering approval.`);
  if (policy.requireImplementationEvidence) {
    const impl = change.tasks.filter(t => NEEDS_IMPLEMENTATION.includes(t.disposition) && !t.implementation).length;
    if (impl) out.push(`${impl} task${impl > 1 ? 's need' : ' needs'} implementation evidence.`);
  }
  return out;
}

export function changeStatus(change, policy) {
  if (change.closed) return 'Closed';
  if (!change.analysed) return 'Draft';
  if (change.results.some(r => r.impact === 'Mapping required')) return 'Mapping required';
  if (change.tasks.some(t => !t.disposition)) return 'In review';
  return closeBlockers(change, policy).length ? 'Awaiting sign-off' : 'Ready to close';
}

export function csv(rows) {
  return rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}
