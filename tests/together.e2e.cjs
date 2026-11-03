// Two-person end-to-end test for routine sharing and "work out together".
// Runs the built app (vite preview on :4173) in two browser contexts against an in-memory fake of
// Supabase's REST + realtime APIs, so live updates flow between "Alice" and "Bob".
// Usage: npx vite preview --port 4173 &  node tests/together.e2e.cjs
const { chromium } = require('playwright');
const REF = 'rwodweszrlvjgxgtpvxz';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 36000;
const U = {
  alice: { id: '00000000-0000-4000-8000-00000000000a', email: 'alice@t.com', name: 'Alice', emoji: '🦊' },
  bob: { id: '00000000-0000-4000-8000-00000000000b', email: 'bob@t.com', name: 'Bob', emoji: '🐻' },
};
const jwt = u => [b64({ alg: 'HS256', typ: 'JWT' }), b64({ sub: u.id, email: u.email, exp, role: 'authenticated', aud: 'authenticated' }), 'sig'].join('.');
const uidFromAuth = h => { try { return JSON.parse(Buffer.from((h || '').replace(/^Bearer /, '').split('.')[1], 'base64url')).sub } catch { return null } };
const uuid = () => require('crypto').randomUUID();
const now = () => new Date().toISOString();

/* ---------- fake database ---------- */
const DB = {
  profiles: Object.values(U).map(u => ({ id: u.id, display_name: u.name, avatar_emoji: u.emoji })),
  friendships: [{ user_a: U.alice.id, user_b: U.bob.id, created_at: now() }],
  user_docs: [
    { user_id: U.alice.id, key: 'routines', data: { list: [
      { id: 'r1', name: 'Push day', kind: 'std', items: [{ ex: 'bench', sets: 3, reps: 8, wt: 60, rest: 90 }, { ex: 'myex1', sets: 2, reps: 10, rest: 60 }] },
      { id: 'r2', name: 'Sparring', kind: 'int', int: { style: 'round', work: 8, rest: 4, rounds: 2, warm: 0, warn: 0, cool: 0 } }] }, updated_at: now() },
    { user_id: U.alice.id, key: 'exercises', data: { list: [{ id: 'myex1', name: 'Sled push', group: 'Legs', kind: 'w' }] }, updated_at: now() },
  ],
  invites: [], shared_stats: [], achievements: [], reactions: [], challenges: [], challenge_participants: [],
  conversations: [], conversation_members: [], messages: [], sessions: [], session_members: [],
};
let msgId = 1;
const friends = (a, b) => DB.friendships.some(f => (f.user_a === a && f.user_b === b) || (f.user_a === b && f.user_b === a));
const inConv = (c, u) => DB.conversation_members.some(m => m.conversation_id === c && m.user_id === u);
const inSess = (s, u) => DB.session_members.some(m => m.session_id === s && m.user_id === u);
const canSee = (t, r, u) => ({
  friendships: () => r.user_a === u || r.user_b === u, user_docs: () => r.user_id === u,
  conversations: () => inConv(r.id, u), conversation_members: () => inConv(r.conversation_id, u), messages: () => inConv(r.conversation_id, u),
  sessions: () => inSess(r.id, u), session_members: () => inSess(r.session_id, u),
  shared_stats: () => r.user_id === u || friends(r.user_id, u), achievements: () => r.user_id === u || friends(r.user_id, u),
}[t] || (() => true))();
const canWrite = (t, r, u) => ({
  user_docs: () => r.user_id === u, session_members: () => r.user_id === u, sessions: () => r.host_id === u,
  conversation_members: () => r.user_id === u, messages: () => r.sender_id === u && inConv(r.conversation_id, u),
}[t] || (() => true))();

function parseFilters(sp) {
  const f = [];
  for (const [k, v] of sp) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const m = v.match(/^(eq|neq|gte|lte|gt|lt|in|is)\.(.*)$/); if (!m) continue;
    f.push([k, m[1], m[2]]);
  }
  return r => f.every(([k, op, val]) => {
    const x = r[k] == null ? null : String(r[k]);
    if (op === 'eq') return x === val; if (op === 'neq') return x !== val;
    if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(x);
    if (op === 'is') return val === 'null' ? x == null : true;
    if (op === 'gte') return x >= val; if (op === 'lte') return x <= val; if (op === 'gt') return x > val; if (op === 'lt') return x < val;
    return true;
  });
}

/* ---------- fake realtime ---------- */
const sockets = []; // {uid, ws, chans:[{topic, binds:[{id,event,table}]}]}
function emit(table, type, record, old) {
  for (const s of sockets) for (const ch of s.chans) {
    if (!canSee(table, record || old, s.uid)) continue;
    const ids = ch.binds.filter(b => b.table === table && (b.event === '*' || b.event === type)).map(b => b.id);
    if (!ids.length) continue;
    s.ws.send(JSON.stringify([null, null, ch.topic, 'postgres_changes', { ids, data: { schema: 'public', table, type, record: record || null, old_record: old || null, columns: [], commit_timestamp: now(), errors: null } }]));
  }
}

/* ---------- RPCs ---------- */
const RPC = {
  start_conversation(u, { member_ids }) {
    const other = member_ids.find(x => x !== u);
    const ex = DB.conversations.find(c => !c.is_group && inConv(c.id, u) && inConv(c.id, other));
    if (ex) return ex.id;
    const c = { id: uuid(), is_group: false, title: null, created_by: u, created_at: now(), last_message_at: now() };
    DB.conversations.push(c);
    for (const x of [u, other]) DB.conversation_members.push({ conversation_id: c.id, user_id: x, joined_at: now(), last_read_at: now() });
    return c.id;
  },
  start_session(u, { r, invitees }) {
    if (!invitees || !invitees.length) throw new Error('Pick at least one friend');
    for (const f of invitees) if (!friends(u, f)) throw new Error('You can only invite friends');
    const s = { id: uuid(), host_id: u, routine: r, clock: {}, status: 'open', created_at: now(), updated_at: now() };
    DB.sessions.push(s);
    const rows = [{ session_id: s.id, user_id: u, status: 'joined', progress: {}, updated_at: now() }].concat(invitees.map(x => ({ session_id: s.id, user_id: x, status: 'invited', progress: {}, updated_at: now() })));
    DB.session_members.push(...rows);
    rows.forEach(m => emit('session_members', 'INSERT', m));
    return s.id;
  },
};

async function handleRest(route, req) {
  const url = new URL(req.url()), u = uidFromAuth(req.headers()['authorization']);
  const json = (b, st = 200) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(b) });
  if (url.pathname.startsWith('/auth/v1/')) { const usr = Object.values(U).find(x => x.id === u); return json(usr ? { id: usr.id, email: usr.email, aud: 'authenticated', role: 'authenticated' } : {}); }
  if (url.pathname.startsWith('/functions/v1/')) return json({ error: 'not in test' }, 404);
  const m = url.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z_]+)/); if (!m) return json({}, 404);
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (m[1]) { try { return json(RPC[m[2]](u, body)) } catch (e) { return json({ message: e.message }, 400) } }
  const t = m[2], tbl = DB[t] || (DB[t] = []), match = parseFilters(url.searchParams), method = req.method();
  const prefer = req.headers()['prefer'] || '', single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  const out = rows => {
    if (single) return rows.length ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows', details: '', hint: null }, 406);
    return json(rows);
  };
  if (method === 'GET' || method === 'HEAD') {
    let rows = tbl.filter(r => canSee(t, r, u) && match(r));
    const ord = url.searchParams.get('order'); if (ord) { const [c, d] = ord.split('.'); rows.sort((a, b) => (a[c] > b[c] ? 1 : -1) * (d === 'desc' ? -1 : 1)); }
    const lim = url.searchParams.get('limit'); if (lim) rows = rows.slice(0, +lim);
    const rg = req.headers()['range']; if (rg) { const [a, b] = rg.split('-').map(Number); rows = rows.slice(a, b + 1); }
    return out(rows);
  }
  if (method === 'POST') {
    const items = Array.isArray(body) ? body : [body], res = [];
    for (const it of items) {
      if (t === 'messages') { Object.assign(it, { id: msgId++, created_at: now(), sender_id: it.sender_id || u, routine: it.routine || null }); }
      if (!canWrite(t, it, u)) return json({ message: 'rls' }, 403);
      const key = t === 'user_docs' ? r => r.user_id === it.user_id && r.key === it.key : t === 'shared_stats' ? r => r.user_id === it.user_id : null;
      const ex = prefer.includes('merge-duplicates') && key ? tbl.find(key) : null;
      if (ex) { const old = { ...ex }; Object.assign(ex, it); emit(t, 'UPDATE', ex, old); res.push(ex); }
      else { const row = { ...it }; tbl.push(row); emit(t, 'INSERT', row); res.push(row); }
    }
    return prefer.includes('return=representation') ? out(res) : route.fulfill({ status: 201, body: '' });
  }
  if (method === 'PATCH') {
    const rows = tbl.filter(r => canSee(t, r, u) && match(r) && canWrite(t, r, u));
    for (const r of rows) { const old = { ...r }; Object.assign(r, body); emit(t, 'UPDATE', r, old); }
    return prefer.includes('return=representation') ? out(rows) : route.fulfill({ status: 204, body: '' });
  }
  if (method === 'DELETE') {
    const rows = tbl.filter(r => canSee(t, r, u) && match(r) && canWrite(t, r, u));
    for (const r of rows) { tbl.splice(tbl.indexOf(r), 1); emit(t, 'DELETE', null, r); }
    return route.fulfill({ status: 204, body: '' });
  }
  return json({}, 405);
}

async function open(browser, who) {
  const u = U[who], ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const sess = { access_token: jwt(u), refresh_token: 'r', expires_at: exp, expires_in: 36000, token_type: 'bearer', user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated' } };
  await ctx.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(s)) }, [`sb-${REF}-auth-token`, sess]);
  await ctx.route(`https://${REF}.supabase.co/**`, handleRest);
  await ctx.routeWebSocket(/realtime\/v1\/websocket/, ws => {
    const sock = { uid: null, ws, chans: [] };
    const q = new URL(ws.url()).searchParams; sock.uid = U[who].id; sockets.push(sock);
    ws.onMessage(raw => {
      const [jr, ref, topic, event, payload] = JSON.parse(raw);
      if (event === 'heartbeat' || event === 'access_token') return ws.send(JSON.stringify([jr, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
      if (event === 'phx_join') {
        const pc = (payload.config && payload.config.postgres_changes) || [];
        const binds = pc.map((b, i) => ({ ...b, id: Math.floor(Math.random() * 1e9) + i }));
        sock.chans = sock.chans.filter(c => c.topic !== topic).concat([{ topic, binds }]);
        return ws.send(JSON.stringify([jr, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: binds } }]));
      }
      if (event === 'phx_leave') { sock.chans = sock.chans.filter(c => c.topic !== topic); return ws.send(JSON.stringify([jr, ref, topic, 'phx_reply', { status: 'ok', response: {} }])); }
    });
    ws.onClose(() => { const i = sockets.indexOf(sock); if (i >= 0) sockets.splice(i, 1) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log(`[${who} pageerror]`, e.message));
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500);
  return p;
}
const results = [];
const check = (name, ok, extra) => { results.push([name, !!ok]); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !extra ? '' : '  → ' + extra)); };
const nav = (p, v) => p.click(`nav a[data-v="${v}"]`);
const tap = (p, sel) => p.locator(sel).first().click();

(async () => {
  const browser = await chromium.launch();
  const A = await open(browser, 'alice'), B = await open(browser, 'bob');

  // 1) Send a routine through chat
  await nav(A, 'workouts'); await A.waitForTimeout(400);
  await tap(A, '[data-act=rtshare][data-id=r1]'); await A.waitForTimeout(1200);
  await A.check(`.pickf[value="${U.bob.id}"]`); await tap(A, '[data-act=sendroutine]'); await A.waitForTimeout(800);
  check('routine message stored with routine card', DB.messages.length === 1 && DB.messages[0].routine && DB.messages[0].routine.name === 'Push day');
  check('custom exercise travels with routine', DB.messages[0] && (DB.messages[0].routine.exDefs || []).some(e => e.id === 'myex1'));
  await nav(B, 'social'); await B.waitForTimeout(1000);
  await tap(B, '[data-act=stab][data-t=chat]'); await B.waitForTimeout(300);
  await tap(B, '[data-act=openconv]'); await B.waitForTimeout(800);
  check('Bob sees routine card', await B.locator('.rcard').count() === 1);
  await B.screenshot({ path: '/tmp/tg-1-chatcard.png' });
  await tap(B, '[data-act=saveshared]'); await B.waitForTimeout(1500);
  const bobDocs = () => Object.fromEntries(DB.user_docs.filter(d => d.user_id === U.bob.id).map(d => [d.key, d.data]));
  check('Bob saved Push day to his routines', ((bobDocs().routines || {}).list || []).some(r => r.name === 'Push day'));
  check('Bob got the custom exercise', ((bobDocs().exercises || {}).list || []).some(e => e.id === 'myex1'));
  check('button shows Saved', /Saved/.test(await B.locator('[data-act=saveshared]').innerText()));
  await tap(B, '[data-act=closeconv]');

  // 2) Strength routine together
  await tap(A, '[data-act=rtshare][data-id=r1]'); await A.waitForTimeout(500);
  await A.check(`.pickf[value="${U.bob.id}"]`); await tap(A, '[data-act=starttogether]'); await A.waitForTimeout(1200);
  check('session created', DB.sessions.length === 1 && DB.session_members.length === 2);
  check('Alice is in the session view', await A.locator('#tg-strip').count() === 1);
  check('Alice sees Bob invited', /invited/.test(await A.locator('#tg-strip').innerText()));
  await nav(B, 'diary'); await B.waitForTimeout(800);
  check('Bob sees the join banner', await B.locator('.tgb').count() === 1);
  await B.screenshot({ path: '/tmp/tg-2-banner.png' });
  await tap(B, '[data-act=tgjoin]'); await B.waitForTimeout(1500);
  check('Bob joined and is in the workout', await B.locator('#tg-strip').count() === 1 && /Bench press/.test(await B.locator('#view').innerText()));
  await A.waitForTimeout(500);
  check('Alice sees Bob joined', !/invited/.test(await A.locator('#tg-strip').innerText()), await A.locator('#tg-strip').innerText());
  // Alice logs a bench set: 60 × 8 (prefilled from the routine) → tick
  await tap(A, '[data-act=wsdone][data-i="0"][data-s="0"]'); await A.waitForTimeout(1500);
  const bBench = await B.locator('.tgpart[data-ex=bench]').innerText();
  check('Bob sees Alice\'s bench set live', /Alice/.test(bBench) && /60/.test(bBench) && /8/.test(bBench), bBench);
  // Bob enters his own numbers: 40 × 10
  const bw = B.locator('input.si[data-i="0"][data-s="0"][data-k="w"]'), br = B.locator('input.si[data-i="0"][data-s="0"][data-k="r"]');
  await bw.fill('40'); await bw.dispatchEvent('input'); await br.fill('10'); await br.dispatchEvent('input');
  await tap(B, '[data-act=wsdone][data-i="0"][data-s="0"]'); await B.waitForTimeout(1500);
  const aBench = await A.locator('.tgpart[data-ex=bench]').innerText();
  check('Alice sees Bob\'s own numbers (40 × 10)', /Bob/.test(aBench) && /40/.test(aBench) && /10/.test(aBench), aBench);
  check('strip shows progress', /1 set done/.test(await A.locator('#tg-strip').innerText()), await A.locator('#tg-strip').innerText());
  await A.screenshot({ path: '/tmp/tg-3-alice-session.png', fullPage: true });
  await B.screenshot({ path: '/tmp/tg-3-bob-session.png', fullPage: true });
  // Bob finishes; his workout is his own
  await tap(B, '[data-act=wsfinish]'); await B.waitForTimeout(1500);
  const bobWk = Object.entries(bobDocs()).filter(([k]) => k.startsWith('wk-')).flatMap(([, v]) => v.list || []);
  check('Bob\'s workout saved with his numbers', bobWk.some(w => w.items.some(it => it.ex === 'bench' && it.sets.some(s => +s.w === 40 && +s.r === 10))), JSON.stringify(bobWk));
  await A.waitForTimeout(800);
  check('Alice sees Bob finished', /finished/.test(await A.locator('#tg-strip').innerText()), await A.locator('#tg-strip').innerText());
  await tap(B, '[data-act=close]').catch(() => {});
  await tap(A, '[data-act=wsfinish]'); await A.waitForTimeout(1200);
  check('session ended when host finished', DB.sessions[0].status === 'ended');
  await tap(A, '[data-act=close]').catch(() => {});

  // 3) Round clock together: host runs the clock for both
  await nav(A, 'workouts'); await A.waitForTimeout(300);
  await tap(A, '[data-act=rtshare][data-id=r2]'); await A.waitForTimeout(400);
  await A.check(`.pickf[value="${U.bob.id}"]`); await tap(A, '[data-act=starttogether]'); await A.waitForTimeout(1200);
  await nav(B, 'diary'); await B.waitForTimeout(600);
  await tap(B, '[data-act=tgjoin]'); await B.waitForTimeout(1500);
  check('Bob waits for Alice to start the clock', /runs the clock/.test(await B.locator('#view').innerText()) && await B.locator('[data-act=intpause]').count() === 0);
  await tap(A, '[data-act=intpause]'); await A.waitForTimeout(3000);
  const ta = await A.locator('#int-left').innerText(), tb = await B.locator('#int-left').innerText();
  const pa = await A.locator('#int-phase').innerText(), pb = await B.locator('#int-phase').innerText();
  check('clocks match on both phones', ta === tb && pa === pb, `${pa} ${ta} vs ${pb} ${tb}`);
  await A.waitForTimeout(6500);
  const pa2 = await A.locator('#int-phase').innerText(), pb2 = await B.locator('#int-phase').innerText();
  check('both moved to rest together', /^rest$/i.test(pa2) && /^rest$/i.test(pb2), `${pa2} vs ${pb2}`);
  await tap(A, '[data-act=intpause]'); await A.waitForTimeout(1200);
  check('pause reaches Bob', /paused/.test(await B.locator('#view').innerText()));
  await B.screenshot({ path: '/tmp/tg-4-bob-clock.png' });

  await browser.close();
  const f = results.filter(r => !r[1]).length;
  console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
