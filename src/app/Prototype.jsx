import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, LayoutDashboard, GitBranch, FilePlus2, ClipboardCheck, Gauge, ScrollText, Users, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { seed } from './seed.js';
import { PermissionError } from './actions.js';
import { NavContext, Link } from './ui.jsx';
import { EngineerDashboard, ChangeList, NewChange, ChangeDetail } from './EngineerViews.jsx';
import { ReviewerQueue, ReviewerTask } from './ReviewerViews.jsx';
import { AdminOverview, AdminUsers, AdminPolicy, AdminAudit, AdminPermissions } from './AdminViews.jsx';

const STORE = 'revwake-prototype-v1';
const HOME = { engineer: '#/dashboard', reviewer: '#/reviews', admin: '#/admin' };
const NAV = {
  engineer: [['#/dashboard', 'Dashboard', LayoutDashboard], ['#/changes', 'Changes', GitBranch], ['#/changes/new', 'New change', FilePlus2]],
  reviewer: [['#/reviews', 'My review tasks', ClipboardCheck]],
  admin: [['#/admin', 'Overview', Gauge], ['#/admin/users', 'Users & departments', Users], ['#/admin/policy', 'Policy', SlidersHorizontal], ['#/admin/audit', 'Audit log', ScrollText], ['#/admin/permissions', 'Permissions', ShieldCheck]],
};
export const ROLE_LABEL = { engineer: 'Change engineer', reviewer: 'Department reviewer', admin: 'Administrator' };

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (parsed?.data?.version === 1) return parsed;
  } catch { /* storage unavailable */ }
  return null;
}
function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* works without persistence */ }
}

export default function Prototype() {
  // First render uses the deterministic seed so it matches the prerendered HTML; saved state loads after.
  const [data, setData] = useState(seed);
  const [userId, setUserId] = useState('u-alex');
  const [route, setRoute] = useState('#/dashboard');
  const [toast, setToast] = useState(null);
  const [persisted, setPersisted] = useState(true);
  const mainRef = useRef(null);

  useEffect(() => {
    const saved = load();
    if (saved) { setData(saved.data); setUserId(saved.userId); }
    try { localStorage.setItem(STORE + '-probe', '1'); localStorage.removeItem(STORE + '-probe'); } catch { setPersisted(false); }
    const sync = () => setRoute(location.hash && location.hash !== '#' ? location.hash : '#/dashboard');
    sync();
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const user = data.users.find(u => u.id === userId) || data.users[0];
  const section = route.startsWith('#/admin') ? 'admin' : route.startsWith('#/reviews') ? 'reviewer' : 'engineer';

  function go(hash) {
    if (location.hash !== hash) location.hash = hash;
    setRoute(hash);
    mainRef.current?.focus();
  }
  const notify = (text, tone = 'ok') => setToast({ text, tone, at: Date.now() });

  /** Apply an action to a copy of the data, persist it, and report errors as a toast. */
  function act(fn, ...args) {
    const draft = structuredClone(data);
    try {
      const result = fn(draft, user.id, ...args, new Date().toISOString());
      setData(draft);
      save({ data: draft, userId: user.id });
      return { ok: true, result };
    } catch (e) {
      notify(e instanceof PermissionError ? `Not permitted: ${e.message}` : e.message, 'bad');
      return { ok: false };
    }
  }

  function switchUser(id) {
    const next = data.users.find(u => u.id === id);
    setUserId(id);
    save({ data, userId: id });
    go(HOME[next.role]);
    notify(`Now viewing as ${next.name} (${next.department ? `${next.department} reviewer` : ROLE_LABEL[next.role]}).`);
  }

  function reset() {
    setData(seed());
    setUserId('u-alex');
    try { localStorage.removeItem(STORE); } catch { /* ignore */ }
    go('#/dashboard');
    notify('Demo data restored to the original fictional sample.');
  }

  const ctx = { data, user, act, go, notify, route };
  const parts = route.replace(/^#\//, '').split('/');
  let page;
  if (section !== user.role) {
    page = (
      <div className="pa-card pa-denied">
        <h1>Not available for this role</h1>
        <p>{user.name} is signed in as {ROLE_LABEL[user.role]}. This area belongs to another role; in production the server would refuse the request too.</p>
        <Link className="button" to={HOME[user.role]}>Go to your home page</Link>
      </div>
    );
  } else if (section === 'admin') {
    page = { users: <AdminUsers {...ctx} />, policy: <AdminPolicy {...ctx} />, audit: <AdminAudit {...ctx} />, permissions: <AdminPermissions {...ctx} /> }[parts[1]] || <AdminOverview {...ctx} />;
  } else if (section === 'reviewer') {
    page = parts[1] && parts[2] ? <ReviewerTask {...ctx} changeId={parts[1]} recordId={parts[2]} /> : <ReviewerQueue {...ctx} />;
  } else if (parts[0] === 'changes' && parts[1] === 'new') page = <NewChange {...ctx} />;
  else if (parts[0] === 'changes' && parts[1]) page = <ChangeDetail {...ctx} id={parts[1]} tab={parts[2] || 'impact'} />;
  else if (parts[0] === 'changes') page = <ChangeList {...ctx} />;
  else page = <EngineerDashboard {...ctx} />;

  return (
    <NavContext.Provider value={{ go }}>
      <div className="pa">
        <a className="skip" href="#pa-main" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
        <header className="pa-top">
          <a href="/" className="pa-back" aria-label="Back to the Revwake website"><ArrowLeft size={16} aria-hidden="true" /><img src="/brand/revwake-dark.svg" alt="Revwake" width="116" height="30" /></a>
          <span className="pa-tag">Prototype · fictional data</span>
          <div className="pa-top-actions">
            <label className="pa-demo-as"><span>Demo as</span>
              <select value={user.id} onChange={e => switchUser(e.target.value)} aria-label="Demo as user">
                {data.users.map(u => <option key={u.id} value={u.id}>{u.name} · {u.role === 'reviewer' ? `${u.department} reviewer` : ROLE_LABEL[u.role]}</option>)}
              </select>
            </label>
            <button type="button" className="text-button" onClick={reset}><RotateCcw size={16} aria-hidden="true" /> Reset demo data</button>
          </div>
        </header>
        <div className="pa-body">
          <nav className="pa-side" aria-label="Prototype navigation">
            <div className="pa-who"><span className="pa-avatar">{user.initials}</span><div><strong>{user.name}</strong><small>{user.title}</small></div></div>
            {NAV[user.role].map(([href, label, Icon]) => {
              const current = href === route || (href === '#/changes' && /^#\/changes\/(?!new)/.test(route)) || (href === '#/reviews' && route.startsWith('#/reviews/'));
              return <Link key={href} to={href} aria-current={current ? 'page' : undefined}><Icon size={16} aria-hidden="true" /> {label}</Link>;
            })}
            <p className="pa-side-note">All customers, specifications, records and people are invented. No ERP, purchasing or production system is connected. Changes are saved in this browser{persisted ? '' : ' (storage unavailable: changes last until reload)'}.</p>
          </nav>
          <main id="pa-main" className="pa-main" tabIndex={-1} ref={mainRef}>{page}</main>
        </div>
        <div className={`pa-toast ${toast ? toast.tone : ''}`} role="status" aria-live="polite">{toast?.text}</div>
      </div>
    </NavContext.Provider>
  );
}
