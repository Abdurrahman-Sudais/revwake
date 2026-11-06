/* Motion layer for the marketing pages. Runs after hydration, never hides content without JS,
   and does nothing beyond showing content when the visitor prefers reduced motion. */
export function startMotion({hero = '.hero', heroVisual = null, autoReveal = 'main section'} = {}) {
  if (typeof window === 'undefined' || window.__ppMotion) return;
  window.__ppMotion = true;
  const doc = document.documentElement;
  const mq = (q) => (typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false);
  const reduced = mq('(prefers-reduced-motion: reduce)') || typeof IntersectionObserver === 'undefined';
  const show = (el) => el.setAttribute('data-rv-in', '');

  // Tag existing content so it reveals as it scrolls in (attributes, so React re-renders leave them alone).
  const tag = () => {
    document.querySelectorAll(autoReveal).forEach((sec) => {
      if (sec.closest('.pp') || sec.matches(hero) || sec.hasAttribute('data-rv-done')) return;
      sec.setAttribute('data-rv-done', '');
      const heads = sec.querySelectorAll(':scope h2, :scope .eyebrow, :scope .section-heading');
      heads.forEach((h) => h.closest('[data-rv]') || h.setAttribute('data-rv', ''));
      sec.querySelectorAll(':scope ol > li, :scope ul > li, :scope [class*="card"], :scope [class*="row"], :scope figure, :scope details').forEach((el, i) => {
        if (el.closest('nav, header, footer, form, [data-rv]') || el.querySelector('[data-rv]')) return;
        el.setAttribute('data-rv', '');
        el.style.setProperty('--rv-d', `${(i % 6) * 70}ms`);
      });
    });
  };
  tag();

  if (reduced) { document.querySelectorAll('[data-rv]').forEach(show); return; }
  doc.classList.add('pp-js');
  if (hero) document.querySelector(hero)?.setAttribute('data-pp-hero', '');

  // Reveal on scroll
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); count(e.target); } }), {rootMargin: '0px 0px -10% 0px', threshold: 0.08});
  const observe = () => document.querySelectorAll('[data-rv]:not([data-rv-in])').forEach((el) => io.observe(el));
  observe();
  new MutationObserver(() => { tag(); observe(); }).observe(document.body, {childList: true, subtree: true});

  // Count-ups
  function count(root) {
    root.querySelectorAll?.('[data-count]').forEach((el) => {
      if (el.__done) return; el.__done = true;
      const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), t0 = performance.now();
      const tick = (now) => { const k = Math.min(1, (now - t0) / 1700); el.textContent = (to * (1 - Math.pow(1 - k, 4))).toFixed(dec); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }

  // Scroll progress bar
  const bar = document.createElement('div'); bar.className = 'pp-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);

  // Scroll-linked effects
  const lit = [...document.querySelectorAll('[data-lit]')];
  const lines = [...document.querySelectorAll('.pp-timeline')];
  const visual = heroVisual && document.querySelector(heroVisual);
  let raf = 0;
  const frame = () => {
    raf = 0;
    const vh = window.innerHeight, max = doc.scrollHeight - vh;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    lit.forEach((p) => {
      const r = p.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const words = p.__w || (p.__w = [...p.querySelectorAll('.pp-w')]);
      const n = Math.round(k * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    });
    lines.forEach((l) => {
      const r = l.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (vh * 0.8 - r.top) / r.height));
      l.style.setProperty('--pp-line', k.toFixed(3));
    });
    if (visual) { const y = Math.min(window.scrollY, vh); visual.style.transform = `translate3d(0, ${y * -0.06}px, 0)`; }
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
  window.addEventListener('scroll', onScroll, {passive: true});
  window.addEventListener('resize', onScroll, {passive: true});
  frame();

  // Tilt + spotlight on cards, gentle magnetic pull on primary buttons
  const fine = mq('(pointer: fine)');
  if (fine) {
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest?.('.pp-tilt');
      if (card) {
        const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${x * 100}%`); card.style.setProperty('--my', `${y * 100}%`);
        card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 6}deg) translateY(-4px)`;
      }
      const btn = e.target.closest?.('.button, .btn-primary');
      if (btn) { const r = btn.getBoundingClientRect(); btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px, ${(e.clientY - r.top - r.height / 2) * 0.2}px)`; }
    }, {passive: true});
    document.addEventListener('pointerout', (e) => {
      const card = e.target.closest?.('.pp-tilt'); if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
      const btn = e.target.closest?.('.button, .btn-primary'); if (btn && !btn.contains(e.relatedTarget)) btn.style.transform = '';
    }, {passive: true});
  }
}
