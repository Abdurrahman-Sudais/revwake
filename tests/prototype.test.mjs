import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

test('prototype route and new sections are prerendered', () => {
  const html = fs.readFileSync('dist/app/index.html', 'utf8');
  assert.match(html, /<title>Interactive prototype — Revwake<\/title>/);
  assert.match(html, /Prototype · fictional data/);
  assert.match(html, /Good morning, Alex/);
  assert.match(html, /noindex,nofollow/);
  const home = fs.readFileSync('dist/index.html', 'utf8');
  for (const id of ['prototype', 'benefits', 'use-cases', 'safeguards', 'pricing', 'faq']) assert.match(home, new RegExp(`id="${id}"`), id);
  assert.match(home, /href="\/app"/);
  assert.doesNotMatch(home, /\$\d+\s*\/\s*(month|mo|user)/i, 'no invented prices');
});

test('prototype UI across all three roles in a DOM simulation (not browser layout QA)', async () => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://revwake.space/app' });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, location: w.location, localStorage: w.localStorage, HTMLElement: w.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  globalThis.addEventListener = w.addEventListener.bind(w);
  globalThis.removeEventListener = w.removeEventListener.bind(w);
  const downloads = [];
  globalThis.URL.createObjectURL = () => 'blob:x';
  globalThis.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
  const React = await import('react');
  const { act } = React;
  const { createRoot } = await import('react-dom/client');
  const { App } = await import('../.ssr/entry-server.js');
  let root = createRoot(document.getElementById('app'));
  await act(async () => root.render(React.createElement(App, { path: '/app' })));
  const text = () => document.body.textContent;
  const btn = s => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(s));
  const link = s => [...document.querySelectorAll('a')].find(a => a.textContent.trim().startsWith(s));
  const click = async el => { assert.ok(el, 'control exists'); await act(async () => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }))); };
  const change = async (el, value) => {
    const proto = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    await act(async () => el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })));
  };
  const nav = async hash => { await act(async () => { w.location.hash = hash; w.dispatchEvent(new w.HashChangeEvent('hashchange')); }); };
  const demoAs = name => change(document.querySelector('[aria-label="Demo as user"]'), [...document.querySelectorAll('[aria-label="Demo as user"] option')].find(o => o.textContent.startsWith(name)).value);
  const submit = async form => act(async () => form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })));

  // Engineer: mapping decisions and task routing.
  await click(link('ECN-41 · Customer finish change'));
  assert.equal(w.location.hash, '#/changes/ECN-41/mapping');
  assert.match(text(), /Shared wording: “finish”, “zinc”, “plating”, “natural”/);
  await click(btn('Depends on SP-204'));
  assert.match(text(), /WO-235 linked to SP-204; a review task was created/);
  await change(document.querySelector('.pa-reason input'), 'Step 40 is for the older bracket family only.');
  await submit(document.querySelector('.pa-reason'));
  assert.match(text(), /No records need a mapping decision/);
  await click(link('Impact'));
  assert.match(text(), /420open work-order units/);
  await click(link('Review tasks'));
  await change(document.querySelector('[aria-label="Assignee for PO-731"]'), 'u-jo');
  await click(btn('Impact report'));
  assert.deepEqual(downloads, ['revwake-ECN-41-impact-report.json']);

  // Purchasing reviewer sees only Purchasing tasks.
  await demoAs('Jo Taylor');
  assert.equal(w.location.hash, '#/reviews');
  assert.match(text(), /PO-731/);
  assert.doesNotMatch(text(), /QC-07/);
  await nav('#/changes/ECN-41');
  assert.match(text(), /Not available for this role/);
  await nav('#/reviews/ECN-41/PO-731');
  await change(document.querySelector('.pa-form select'), 'Cancel or amend purchase');
  await change(document.querySelector('.pa-form textarea'), 'Amend PO to powder coating service.');
  await submit(document.querySelector('.pa-form'));
  assert.match(text(), /Disposition recorded/);
  await change([...document.querySelectorAll('.pa-form')].at(-1).querySelector('input'), 'PO-731 amendment A1');
  await submit([...document.querySelectorAll('.pa-form')].at(-1));
  assert.match(text(), /PO-731 amendment A1/);

  // Persistence, then admin.
  await act(async () => root.unmount());
  root = createRoot(document.getElementById('app'));
  await act(async () => root.render(React.createElement(App, { path: '/app' })));
  await demoAs('Mei Tan');
  await nav('#/admin/audit');
  assert.match(text(), /Implementation evidence recorded/);
  assert.match(text(), /Mapping rejected/);
  await click(btn('Reset demo data'));
  assert.equal(localStorage.getItem('revwake-prototype-v1'), null);
  await nav('#/changes/ECN-41/mapping');
  assert.match(text(), /WO-235 · Custom housings/);
  await act(async () => root.unmount());
  w.close();
});
