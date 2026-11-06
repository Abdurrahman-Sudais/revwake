import React from 'react';
import {ArrowUpRight, Check, X} from 'lucide-react';
import PURPOSE from './purpose-data.js';

/* Purpose sections — story, stakes, principles, founders' letter and vision.
   Server-rendered; motion is layered on by src/motion.js after hydration. */

const Words = ({text}) => text.split(' ').map((w, i) => <span className="pp-w" key={i}>{w} </span>);

export function PurposeTop() {
  const p = PURPOSE;
  return (
    <>
      <section className="pp pp-manifesto" id="purpose" aria-labelledby="pp-purpose-title">
        <div className="pp-wrap">
          <p className="pp-eyebrow" data-rv><span className="pp-pulse" aria-hidden="true" /> {p.eyebrow}</p>
          <h2 id="pp-purpose-title" className="pp-sr">Why {p.name} exists</h2>
          <p className="pp-manifesto-text" data-lit><Words text={p.manifesto} /></p>
          <div className="pp-purpose-grid">
            <div data-rv><p className="pp-kicker">Our purpose</p><p className="pp-big">{p.purpose}</p></div>
            <div data-rv style={{'--rv-d': '120ms'}}><p className="pp-kicker">Why it matters</p><p>{p.why}</p></div>
          </div>
        </div>
      </section>

      <section className="pp pp-stakes" aria-labelledby="pp-stakes-title">
        <div className="pp-wrap">
          <div className="pp-head" data-rv><p className="pp-kicker">The stakes</p><h2 id="pp-stakes-title">{p.stakesTitle}</h2></div>
          <div className="pp-stats">
            {p.stats.map((s, i) => (
              <figure className="pp-stat pp-tilt" key={s.label} data-rv style={{'--rv-d': `${i * 120}ms`}}>
                <div className="pp-stat-v">{s.prefix && <small>{s.prefix}</small>}<b data-count={s.value} data-dec={s.dec || 0}>{Number(s.value).toFixed(s.dec || 0)}</b><span>{s.suffix}</span></div>
                <span className="pp-stat-bar" aria-hidden="true" />
                <figcaption><p>{s.label}</p><a href={s.url} target="_blank" rel="noopener noreferrer">Source: {s.source} <ArrowUpRight size={13} aria-hidden="true" /></a></figcaption>
              </figure>
            ))}
          </div>
          <p className="pp-note" data-rv>{p.statsNote}</p>
        </div>
      </section>

      <section className="pp pp-change" aria-labelledby="pp-change-title">
        <div className="pp-wrap">
          <div className="pp-head" data-rv><p className="pp-kicker">What changes</p><h2 id="pp-change-title">{p.changeTitle}</h2></div>
          <div className="pp-change-grid">
            <div className="pp-before" data-rv>
              <p className="pp-kicker">Today</p>
              <ul>{p.before.map((t, i) => <li key={t} style={{'--rv-d': `${i * 90}ms`}}><X size={16} aria-hidden="true" /><span className="pp-strike">{t}</span></li>)}</ul>
            </div>
            <div className="pp-after" data-rv style={{'--rv-d': '140ms'}}>
              <p className="pp-kicker">With {p.name}</p>
              <ul>{p.after.map((t, i) => <li key={t} style={{'--rv-d': `${i * 90}ms`}}><span className="pp-tick" aria-hidden="true"><Check size={14} /></span><span>{t}</span></li>)}</ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function PurposeBottom() {
  const p = PURPOSE;
  return (
    <>
      <section className="pp pp-principles" aria-labelledby="pp-principles-title">
        <div className="pp-wrap">
          <div className="pp-head" data-rv><p className="pp-kicker">What we believe</p><h2 id="pp-principles-title">{p.principlesTitle}</h2></div>
          <ol className="pp-principle-grid">
            {p.principles.map(([t, d], i) => (
              <li className="pp-principle pp-tilt" key={t} data-rv style={{'--rv-d': `${(i % 3) * 110}ms`}}>
                <span className="pp-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pp pp-letter" aria-labelledby="pp-letter-title">
        <div className="pp-wrap pp-letter-wrap">
          <div data-rv><p className="pp-kicker">A note from the founders</p><h2 id="pp-letter-title">{p.letterTitle}</h2></div>
          <div className="pp-letter-body" data-rv style={{'--rv-d': '120ms'}}>
            {p.letter.map((para, i) => <p key={i}>{para}</p>)}
            <svg className="pp-sign" viewBox="0 0 320 70" aria-hidden="true"><path d="M6 48c18-26 34-34 40-24s-14 30-4 30 24-36 36-36-6 34 6 34 18-22 28-22-2 20 10 20 20-30 34-30-8 28 6 28 26-18 40-18 6 14 18 14 24-10 40-12 26-2 48 0" /></svg>
            <p className="pp-signoff">{p.founders.map((f) => `${f.name}, ${f.role}`).join(' · ')}</p>
          </div>
        </div>
      </section>

      <section className="pp pp-vision" aria-labelledby="pp-vision-title">
        <div className="pp-wrap">
          <div className="pp-head" data-rv><p className="pp-kicker">Where we’re going</p><h2 id="pp-vision-title">{p.visionTitle}</h2><p>{p.visionIntro}</p></div>
          <ol className="pp-timeline">
            <span className="pp-timeline-line" aria-hidden="true"><i /></span>
            {p.vision.map((v, i) => (
              <li key={v.stage} data-rv style={{'--rv-d': `${i * 120}ms`}} className={i === 0 ? 'pp-now' : ''}>
                <span className="pp-dot" aria-hidden="true" />
                <p className="pp-kicker">{v.stage}</p>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
