// Fictional seed data for the prototype. Every customer, specification, record and person is invented.
// SP-204 and its six records match the sample workspace on the home page.
import { analyse, suggestMappings, DEPARTMENT } from './engine.js';

export const USERS = [
  { id: 'u-alex', name: 'Alex Morgan', title: 'Change engineer', role: 'engineer', initials: 'AM' },
  { id: 'u-kai', name: 'Kai Brennan', title: 'Production planner', role: 'reviewer', department: 'Production', initials: 'KB' },
  { id: 'u-jo', name: 'Jo Taylor', title: 'Purchasing lead', role: 'reviewer', department: 'Purchasing', initials: 'JT' },
  { id: 'u-sam', name: 'Sam Ellis', title: 'Quality lead', role: 'reviewer', department: 'Quality', initials: 'SE' },
  { id: 'u-mei', name: 'Mei Tan', title: 'Workspace administrator', role: 'admin', initials: 'MT' },
];

export const DEFAULT_POLICY = { aiSuggestions: true, requireImplementationEvidence: true };

const SPECS = [
  {
    id: 'SP-204', title: 'Bracket and plate surface finish', customer: 'Northfield Enclosures (fictional)',
    revisions: [
      { rev: 'B', date: '2026-03-02', attrs: { 'Surface finish': 'Zinc plating', 'Coating thickness': '8–12 µm', 'Salt-spray resistance': '96 h', Colour: 'Natural' } },
      { rev: 'C', date: '2026-10-12', attrs: { 'Surface finish': 'Powder coating', 'Coating thickness': '60–80 µm', 'Salt-spray resistance': '500 h', Colour: 'RAL 7016 anthracite' } },
    ],
  },
  {
    id: 'SP-310', title: 'Support rail profile', customer: 'Brightline Shelving (fictional)',
    revisions: [
      { rev: 'A', date: '2025-11-20', attrs: { Material: 'S235 steel', 'Length tolerance': '±0.5 mm', 'Hole pattern': 'HP-2' } },
      { rev: 'B', date: '2026-10-20', attrs: { Material: 'S235 steel', 'Length tolerance': '±0.2 mm', 'Hole pattern': 'HP-2' } },
    ],
  },
];

const L = (to, confirmed = true) => ({ to, confirmed });
const RECORDS = [
  { id: 'WO-218', type: 'Order', title: 'Enclosure brackets', state: 'Open', qty: 240, text: 'Finish: zinc plating per SP-204.', links: [L('SP-204')] },
  { id: 'WO-221', type: 'Order', title: 'Mounting plates', state: 'Open', qty: 120, text: 'Finish per SP-204. Mask threaded holes before finishing.', links: [L('SP-204')] },
  { id: 'WO-229', type: 'Order', title: 'Support rails', state: 'Open', qty: 80, text: 'Cut to length per SP-310, accept ±0.5 mm.', links: [L('SP-310')] },
  { id: 'WO-235', type: 'Order', title: 'Custom housings', state: 'Open', qty: 60, text: 'Housing finish: zinc plating, natural colour.', links: [] },
  { id: 'PO-731', type: 'Material', title: 'Zinc finish purchase', state: 'Open', value: 1850, text: 'Zinc plating service for 240 brackets, Halden Finishing (fictional).', links: [L('WO-218')] },
  { id: 'QC-07', type: 'Inspection', title: 'Surface finish inspection', state: 'Open', text: 'Check zinc plating coverage, 8–12 µm. Reference SP-204 Rev B.', links: [L('SP-204')] },
  { id: 'WO-205', type: 'Order', title: 'Enclosure brackets (earlier batch)', state: 'Complete', qty: 300, text: 'Finish: zinc plating per SP-204.', links: [L('SP-204')] },
  { id: 'RT-12', type: 'Routing', title: 'Finishing route, step 40', state: 'Open', text: 'Step 40: send out for zinc plating.', links: [L('SP-204', false)] },
  { id: 'QC-11', type: 'Inspection', title: 'Rail length inspection', state: 'Open', text: 'Measure rail length, accept ±0.5 mm.', links: [L('SP-310')] },
];

export function buildAnalysis(change, specs, records, policy) {
  const spec = specs.find(s => s.id === change.specId);
  const results = analyse(spec, change.from, change.to, records);
  const keep = new Map(change.tasks.map(t => [t.recordId, t]));
  const tasks = results.filter(r => r.impact === 'Review required').map(r => keep.get(r.id) || {
    recordId: r.id, department: DEPARTMENT[records.find(x => x.id === r.id).type], assignee: 'Unassigned', disposition: '', reason: '', notes: [],
  });
  const kept = change.suggestions.filter(s => results.find(r => r.id === s.recordId)?.impact === 'Mapping required' || s.decision !== 'pending');
  const fresh = policy.aiSuggestions ? results.filter(r => r.impact === 'Mapping required').flatMap(r => suggestMappings(records.find(x => x.id === r.id), specs))
    .filter(s => s.specId === change.specId && !kept.some(k => k.id === s.id)).map(s => ({ ...s, decision: 'pending' })) : [];
  return { ...change, analysed: true, results, tasks, suggestions: [...kept, ...fresh] };
}

export function seed() {
  const specs = structuredClone(SPECS), records = structuredClone(RECORDS), policy = { ...DEFAULT_POLICY };
  const changes = [
    buildAnalysis({ id: 'ECN-41', specId: 'SP-204', from: 'B', to: 'C', title: 'Customer finish change: zinc plating to powder coating', owner: 'u-alex', created: '2026-10-13T09:00:00Z', analysed: false, results: [], tasks: [], suggestions: [], closed: null }, specs, records, policy),
    { id: 'ECN-42', specId: 'SP-310', from: 'A', to: 'B', title: 'Tighter rail length tolerance', owner: 'u-alex', created: '2026-10-21T10:30:00Z', analysed: false, results: [], tasks: [], suggestions: [], closed: null },
  ];
  const audit = [
    ['2026-10-13T09:00:00Z', 'u-alex', 'Change created', 'ECN-41 · SP-204 Rev B → C'],
    ['2026-10-13T09:04:00Z', 'u-alex', 'Impact analysis run', 'ECN-41 · 4 review required, 2 mapping required, 1 complete'],
    ['2026-10-21T10:30:00Z', 'u-alex', 'Change created', 'ECN-42 · SP-310 Rev A → B'],
  ].map(([at, user, action, detail], i) => ({ id: i + 1, at, user, action, detail }));
  return { version: 1, users: USERS.map(u => ({ ...u })), policy, specs, records, changes, audit };
}
