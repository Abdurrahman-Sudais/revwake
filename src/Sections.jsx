import React from 'react';
import { ArrowUpRight, ArrowRight, Check } from 'lucide-react';

// Sections added alongside the original home page. Copy describes the prototype and the proposed
// product only: no customer numbers, testimonials, certifications or invented prices.

export function PrototypeCta() {
  return (
    <section id="prototype" className="prototype-cta" aria-labelledby="prototype-heading">
      <div>
        <span className="eyebrow"><span /> 04 / INTERACTIVE PROTOTYPE</span>
        <h2 id="prototype-heading">Run the whole change.<br />Every role, end to end.</h2>
      </div>
      <div>
        <p>The workspace above shows one revision. The prototype runs the full loop with fictional data: trace a revision through confirmed links, decide unconfirmed mappings, route review tasks to Production, Purchasing and Quality, record dispositions and implementation evidence, approve deviations and close the change.</p>
        <ul className="role-list">
          <li><strong>Change engineer</strong> Revision diff, impact analysis, mapping decisions, task routing, deviation approval, closure.</li>
          <li><strong>Department reviewer</strong> Only their department’s tasks: disposition, evidence, notes.</li>
          <li><strong>Administrator</strong> Roles, departments, policy, audit log and aggregate figures.</li>
        </ul>
        <div className="actions">
          <a className="button" href="/app">Open the prototype <ArrowUpRight size={17} aria-hidden="true" /></a>
          <span className="fine">No sign-up. Changes stay in your browser.</span>
        </div>
      </div>
    </section>
  );
}

const BENEFITS = [
  ['See the whole reach of a revision', 'Impact follows confirmed links from the specification to orders, then on to the purchases and inspections that depend on them.'],
  ['Find instructions still on the old revision', 'Every record is searched for superseded values, so an inspection that still says “8–12 µm” is flagged even when its link looks fine.'],
  ['Never lose an unmapped record', 'Records with unconfirmed links, or that mention the old value without a link, wait for a person’s decision instead of quietly dropping out.'],
  ['Send each department only its work', 'Orders go to Production, materials to Purchasing, inspections to Quality. Each reviewer sees their own tasks.'],
  ['Separate decision from done', 'A disposition says what should happen. Implementation evidence says it did. The change cannot close until both are recorded.'],
  ['Know what is exposed', 'Open work-order units and committed purchase value under review, per change, before work continues on the old requirement.'],
];

export function Benefits() {
  return (
    <section id="benefits" className="benefits" aria-labelledby="benefits-heading">
      <div className="section-heading"><div><span className="eyebrow"><span /> 05 / WHY TEAMS WOULD USE IT</span><h2 id="benefits-heading">Fewer surprises<br />after the revision.</h2></div><p>For the engineers who own the change and the departments who carry it out.</p></div>
      <div className="card-grid">{BENEFITS.map(([t, c], i) => <article className="grid-card" key={t}><span className="mono">0{i + 1}</span><h3>{t}</h3><p>{c}</p></article>)}</div>
    </section>
  );
}

const USES = [
  ['Customer finish and coating changes', 'A revised finish touches open orders, outside-processing purchases and inspection instructions at once.'],
  ['Tolerance tightening', 'A tighter dimension means inspection criteria and possibly in-process parts need a decision.'],
  ['Material substitutions', 'A changed grade or supplier affects open purchases, stock and every order that consumes it.'],
  ['Drawing and hole-pattern updates', 'Routings and fixtures that reference the old pattern are flagged alongside the orders.'],
  ['Records without a clean link', 'Older orders and routings that mention the old requirement but were never linked are surfaced for a mapping decision.'],
  ['Customer change audits', 'Export a report showing every connected record, its disposition, deviations and evidence.'],
];

export function UseCases() {
  return (
    <section id="use-cases" className="usecases" aria-labelledby="uses-heading">
      <span className="eyebrow"><span /> 07 / USE CASES</span>
      <h2 id="uses-heading">Where revisions tend<br />to slip through.</h2>
      <div className="card-grid">{USES.map(([t, c]) => <article className="grid-card plain" key={t}><h3>{t}</h3><p>{c}</p></article>)}</div>
    </section>
  );
}

const SAFEGUARDS = [
  ['People confirm every link', 'Dependencies come from confirmed links only. AI can suggest a mapping, quoting the shared wording, but an engineer decides.'],
  ['Unknown is never “unaffected”', 'Records with unconfirmed links, or that mention a superseded value, stay visible until someone decides.'],
  ['Deviations need engineering', 'A department can propose using a part as-is, but the change cannot close until engineering approves the deviation.'],
  ['Decisions are not implementation', 'Revwake records dispositions and evidence. It never edits ERP records, purchases or production instructions itself.'],
  ['Need-to-know access', 'Reviewers see their own department’s tasks. Administrators see aggregates. Every action checks the role.'],
  ['Traceable', 'Analyses, mapping decisions, dispositions, approvals and closures go into an exportable audit log.'],
];

export function Safeguards() {
  return (
    <section id="safeguards" className="safeguards" aria-labelledby="safeguards-heading">
      <div className="section-heading"><div><span className="eyebrow"><span /> 08 / SAFEGUARDS</span><h2 id="safeguards-heading">AI suggests.<br />People confirm.</h2></div><p>The prototype already enforces these review gates. Hosting and security items describe the proposed production design.</p></div>
      <div className="card-grid">{SAFEGUARDS.map(([t, c]) => <article className="grid-card" key={t}><Check size={18} aria-hidden="true" /><h3>{t}</h3><p>{c}</p></article>)}</div>
    </section>
  );
}

const PLANS = [
  ['Pilot', 'One plant, one customer’s specifications.', ['Guided import of specifications and records', 'Impact analysis and superseded-value checks', 'Department review tasks', 'Exportable impact reports']],
  ['Team', 'Engineering, production, purchasing and quality together.', ['Everything in Pilot', 'Roles, departments and audit log', 'AI mapping suggestions', 'Deviation approval and implementation evidence']],
  ['Multi-site', 'Several plants or business units.', ['Everything in Team', 'Single sign-on', 'ERP and PLM record import', 'Data-region options and a data-processing agreement']],
];

export function Plans() {
  return (
    <section id="pricing" className="plans" aria-labelledby="pricing-heading">
      <div className="section-heading"><div><span className="eyebrow"><span /> 09 / PLANS</span><h2 id="pricing-heading">Start with one plant.<br />Grow with your revisions.</h2></div><p>Proposed plans for early access. Prices are agreed with each early-access customer; none are published yet.</p></div>
      <div className="plan-grid">
        {PLANS.map(([name, d, items], i) => (
          <article className={`plan ${i === 1 ? 'featured' : ''}`} key={name}>
            {i === 1 && <span className="plan-tag">Most complete</span>}
            <h3>{name}</h3>
            <p className="plan-price">Pricing on request</p>
            <p>{d}</p>
            <ul>{items.map(x => <li key={x}><Check size={14} aria-hidden="true" /> {x}</li>)}</ul>
            <a className={i === 1 ? 'button' : 'button secondary'} href="#contact">Request early access <ArrowRight size={16} aria-hidden="true" /></a>
          </article>
        ))}
      </div>
    </section>
  );
}

const FAQS = [
  ['Does Revwake change our ERP or production instructions?', 'No. It shows what a revision touches, routes review tasks and records decisions and evidence. Updating instructions, purchases and parts stays with your team and your systems.'],
  ['How does it decide what is affected?', 'It follows confirmed links from the specification to the records that depend on it, and onward to records that depend on those. It also searches each record’s text for values the revision replaced.'],
  ['What about records that were never linked?', 'If a record mentions a superseded value, or has an unconfirmed link, it is marked “mapping required”. An engineer confirms or rejects the dependency, and rejections need a reason.'],
  ['What does the AI do?', 'In the proposed product, AI suggests which specification an unmapped record may depend on, quoting the shared wording. It never confirms a link, assigns a disposition or closes a change.'],
  ['Can a department accept parts as they are?', 'Yes, as a deviation with a reason. Engineering must approve it before the change can close.'],
  ['Which documents does it read?', 'The first focus is text-based specification PDFs and record exports from spreadsheets or ERP. Scanned drawings and CAD are not in scope for the first release.'],
  ['Is it available today?', 'Revwake is in the building stage. The prototype runs in your browser with fictional data; imports, extraction and AI need the production backend described in the architecture section.'],
  ['How do we get early access?', 'Use the form above to describe your change-review workflow. We reply by email.'],
];

export function Faq() {
  return (
    <section id="faq" className="faq" aria-labelledby="faq-heading">
      <span className="eyebrow"><span /> 13 / FAQ</span>
      <h2 id="faq-heading">Questions engineering<br />teams ask.</h2>
      <div className="faq-list">{FAQS.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
    </section>
  );
}
