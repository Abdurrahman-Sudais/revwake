export default {
  name: 'Revwake',
  eyebrow: 'Why Revwake exists',
  manifesto: 'A specification changes in one document and quietly stays the same in a dozen others. We believe every revision should arrive with a clear map of what it touches — and a person responsible for each change it causes.',
  purpose: 'Revwake exists to make specification changes traceable: compare revisions, follow their impact into the orders, materials and instructions that depend on them, and make sure every affected record has an owner before work continues.',
  why: 'When a finish, tolerance or material requirement changes, the cost is rarely the change itself. It’s the old instruction still on the shop floor, the purchase order nobody revisited, the batch built to last month’s drawing.',
  stakesTitle: 'The cost of a missed change is rarely small.',
  stats: [
    { value: 20, prefix: 'up to', suffix: '%', label: 'of sales revenue can be lost to quality-related costs in many organisations — rework, scrap and errors that started upstream.', source: 'ASQ, Cost of Quality', url: 'https://asq.org/quality-resources/cost-of-quality' },
    { value: 72, suffix: '%', label: 'average cost growth from the initial estimate on defense contracts that saw requirement changes.', source: 'Journal of Cost Analysis and Parametrics, Change Order Percentages in Defense Contracts', url: 'https://iceaaonline.com/wp-content/uploads/2024/11/JCAPv10i2-ChangeOrderPercentagesDefenseContracts-Miller.pdf' },
    { value: 11, suffix: '%', label: 'cost growth on comparable contracts without requirement changes — the difference is what unmanaged change costs.', source: 'Journal of Cost Analysis and Parametrics, Change Order Percentages in Defense Contracts', url: 'https://iceaaonline.com/wp-content/uploads/2024/11/JCAPv10i2-ChangeOrderPercentagesDefenseContracts-Miller.pdf' }
  ],
  statsNote: 'Published figures from third-party sources, linked above. They describe the cost of quality and requirement change, not Revwake results. Revwake supports human change review; it does not approve changes.',
  changeTitle: 'From “who else uses this spec?” to a clear change map.',
  before: ['A revised PDF arrives by email; the old one is still in three folders.', 'Nobody is sure which orders and work instructions reference it.', 'Impact is assessed from memory in a meeting.', 'Changes are acknowledged, then quietly missed downstream.', 'Weeks later, someone asks who signed off — and nobody knows.'],
  after: ['Revisions compared clause by clause, with every difference highlighted.', 'Linked orders, materials and instructions traced automatically.', 'Each affected record gets an owner and a due date.', 'Suggested mappings are reviewed by engineers before they count.', 'A complete trail of who reviewed what, and when.'],
  principlesTitle: 'The rules we build by.',
  principles: [
    ['Traceable by default', 'Every impact is linked to the clause that changed and the record that references it.'],
    ['Engineers decide', 'Revwake suggests and organises. Accepting a change, or its impact, is always a person’s decision.'],
    ['Explicit over implied', 'We follow references that exist in your records — and flag where links are missing, instead of guessing.'],
    ['Nothing silently skipped', 'If an affected record has no owner, Revwake keeps it visible until someone takes it.'],
    ['Fits your systems', 'Starting with text-based PDFs and the manufacturing records you already keep.'],
    ['Your designs stay yours', 'In the proposed design, specifications are encrypted, scoped to your organisation and never used to train models.']
  ],
  letterTitle: 'Why we’re building this.',
  letter: [
    'Every manufacturer we talk to has a version of the same story: a requirement changed, the new drawing was issued, and somewhere an old instruction kept being followed.',
    'We started Revwake because tracking a change shouldn’t depend on someone remembering every place a specification is used. The links are already in your records; they just aren’t connected.',
    'We’re building Revwake with engineering, quality and operations teams who live with change every day — and we’d love to build it with you.'
  ],
  founders: [{ name: 'Femi Adebisi', role: 'Founder & CEO' }, { name: 'Ridwan Adisa', role: 'Co-founder & CTO' }],
  visionTitle: 'Every change, followed all the way through.',
  visionIntro: 'Our plan, shaped by early-access teams. The order may change as pilots teach us more.',
  vision: [
    { stage: 'Now', title: 'Prototype & early access', text: 'An interactive change desk on fictional records: revision comparison, impact tracing, mappings and engineer review.' },
    { stage: 'Next', title: 'Pilots with real revisions', text: 'Your specification PDFs and manufacturing records, linked and compared.' },
    { stage: 'Then', title: 'Everyday change control', text: 'ERP and PLM connections, notifications for record owners and change reports for audits.' },
    { stage: 'Later', title: 'Change without surprises', text: 'Supplier-side change notices and impact previews before a revision is even issued.' }
  ]
};
