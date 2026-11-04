// Browser test of the weekly check-in: weight average, BMI, measurements, private photos, AI comparison.
// Uses a fake Supabase (REST user_docs, Storage, the claude function). Run with vite preview on :4173.
// Usage: node tests/checkin.e2e.cjs <folder with front.jpg right.jpg left.jpg back.jpg>
const { chromium } = require('playwright');
const path = require('path');
const IMG = process.argv[2] || '/tmp/ciimg';
const REF = 'rwodweszrlvjgxgtpvxz';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 36000, uid = '00000000-0000-4000-8000-0000000000c1';
const jwt = [b64({ alg: 'HS256' }), b64({ sub: uid, email: 'c@t.com', exp, role: 'authenticated' }), 's'].join('.');
const sess = { access_token: jwt, refresh_token: 'r', expires_at: exp, expires_in: 36000, token_type: 'bearer', user: { id: uid, email: 'c@t.com', aud: 'authenticated', role: 'authenticated' } };
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') };
const T = day(0), P = day(-7);
// weigh-ins: last week ~82 kg, this week ~81 kg
const e = {}; for (let i = 0; i < 7; i++) { e[day(-7 - i)] = 82 + (i % 2 ? 0.4 : -0.2); e[day(-i)] = 81 + (i % 2 ? 0.3 : -0.1) }
const DOCS = { profile: { height: 180, units: 'metric', sex: 'male', age: 40, weight: 82 }, weights: { e } };
const FILES = {}; let claudeReq = null; const removed = [];

async function handle(route, req) {
  const url = new URL(req.url()), p = url.pathname, m = req.method();
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  if (p.startsWith('/auth/v1/')) return json(sess.user);
  if (p.startsWith('/functions/v1/claude')) { claudeReq = JSON.parse(req.postData()); return json({ text: 'Overall, a steady week.\n• Shoulders look a touch broader.\n• Waist looks slightly narrower from the front.\n• Lighting differs a little — same spot next week helps.\nKeep it up!' }) }
  if (p.startsWith('/storage/v1/object/sign/checkins')) { const b = JSON.parse(req.postData()); return json(b.paths.map(x => ({ path: x, signedURL: `/object/sign/checkins/${x}?token=t`, error: FILES[x] ? null : 'not found' }))) }
  if (p.startsWith('/storage/v1/object/list/checkins')) return json(Object.keys(FILES).filter(k => k.startsWith(uid + '/')).map(k => ({ name: k.split('/')[1] })));
  if (m === 'DELETE' && p === '/storage/v1/object/checkins') { const b = JSON.parse(req.postData()); b.prefixes.forEach(x => { removed.push(x); delete FILES[x] }); return json([]) }
  const sm = p.match(/^\/storage\/v1\/object\/(?:authenticated\/|sign\/)?checkins\/(.+)$/);
  if (sm) { const k = decodeURIComponent(sm[1]);
    if (m === 'POST' || m === 'PUT') { if (!k.startsWith(uid + '/')) return json({ message: 'rls' }, 403); const raw = req.postDataBuffer(), ct = req.headers()['content-type'] || '';
      if (ct.startsWith('multipart/')) { const bnd = Buffer.from('--' + ct.split('boundary=')[1]); const at = raw.indexOf(Buffer.from('Content-Type: image/'));
        const st = raw.indexOf(Buffer.from('\r\n\r\n'), at) + 4, en = raw.indexOf(bnd, st) - 2; FILES[k] = raw.subarray(st, en) } else FILES[k] = raw; return json({ Key: 'checkins/' + k }) }
    return FILES[k] ? route.fulfill({ status: 200, contentType: 'image/jpeg', body: FILES[k] }) : json({ message: 'not found' }, 404) }
  if (p.startsWith('/rest/v1/user_docs')) {
    if (m === 'GET') return json(Object.entries(DOCS).map(([key, data]) => ({ key, data })));
    if (m === 'POST') { const b = JSON.parse(req.postData()); DOCS[b.key] = b.data; return route.fulfill({ status: 201, body: '' }) }
    if (m === 'DELETE') { delete DOCS[url.searchParams.get('key').replace('eq.', '')]; return route.fulfill({ status: 204, body: '' }) }
  }
  return json([]);
}
const results = []; const check = (n, ok, x) => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || x == null ? '' : '  → ' + x)) };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 400, height: 860 } });
  await ctx.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [`sb-${REF}-auth-token`, sess]);
  await ctx.route(`https://${REF}.supabase.co/**`, handle);
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('[pageerror]', e.message)); pg.on('console', m => { if (m.type() === 'warning') console.log('[warn]', m.text()) });
  await pg.goto('http://localhost:4173/'); await pg.waitForTimeout(2000);
  check('cog icon in header', await pg.locator('header a.cog').count() === 1);
  check('Check-in tab in menu, Settings gone from menu', await pg.locator('nav a[data-v=checkin]').count() === 1 && await pg.locator('nav a[data-v=profile]').count() === 0);
  await pg.click('header a.cog'); await pg.waitForTimeout(400);
  check('cog opens Settings', /Profile|targets/i.test(await pg.locator('#view').innerText()));
  await pg.screenshot({ path: '/tmp/ci-0-header.png', clip: { x: 0, y: 0, width: 400, height: 130 } });
  await pg.click('nav a[data-v=checkin]'); await pg.waitForTimeout(400);

  const doWeek = async (date, meas, label) => {
    await pg.fill('#ci-date', date); await pg.dispatchEvent('#ci-date', 'change'); await pg.waitForTimeout(300);
    for (const [k, v] of Object.entries(meas)) { const i = pg.locator(`.ci-m[data-k=${k}]`); await i.fill(String(v)); await i.dispatchEvent('change'); await pg.waitForTimeout(150) }
    for (const pose of ['front', 'right', 'left', 'back']) {
      const fc = pg.waitForEvent('filechooser'); await pg.click(`[data-act=ciphoto][data-p=${pose}]`); (await fc).setFiles(path.join(IMG, pose + '.jpg')); await pg.waitForTimeout(700) }
    await pg.waitForTimeout(500);
  };
  await doWeek(P, { waist: 92, hips: 101, chest: 104, biceps: 36, thighs: 58 }, 'last');
  const list1 = (DOCS.checkins || {}).list || [];
  check('first check-in saved with 4 photos', list1.length === 1 && Object.keys(list1[0].photos).length === 4, JSON.stringify(list1));
  check('photos stored in own private folder', Object.keys(FILES).length === 4 && Object.keys(FILES).every(k => k.startsWith(uid + '/')));
  check('photos shrunk before upload', Object.values(FILES).every(f => f.length < 400000));
  await doWeek(T, { waist: 90.5, hips: 100, chest: 104.5, biceps: 36.4, thighs: 57.5 }, 'this');
  const list = DOCS.checkins.list, cur = list.find(x => x.date === T), prv = list.find(x => x.date === P);
  check('7-day average weight auto-calculated', cur && Math.abs(cur.avg - 81.1) < 0.2 && Math.abs(prv.avg - 82.06) < 0.2, cur && `${cur.avg} / ${prv.avg}`);
  check('BMI auto-calculated (81.1 kg, 180 cm ≈ 25.0)', cur && Math.abs(cur.bmi - 25.0) < 0.15, cur && cur.bmi);
  check('measurements saved in cm', cur && cur.meas.waist === 90.5 && cur.meas.thighs === 57.5);
  const v = await pg.locator('#view').innerText();
  check('week-to-week changes shown', /−1\.5 cm/.test(v) && /−1\.0 kg|−0\.9 kg|−1\.1 kg/.test(v), v.slice(0, 600));
  await pg.waitForTimeout(800);
  check('side-by-side photos loaded', await pg.locator('.cicmp img[src]').count() === 2);
  await pg.screenshot({ path: '/tmp/ci-1-top.png', fullPage: true });
  await pg.click('[data-act=cicompare]'); await pg.waitForTimeout(2500);
  if (claudeReq) require('fs').writeFileSync('/tmp/ci-comp.jpg', Buffer.from(claudeReq.images[1].data, 'base64'));
  check('AI got exactly 2 combined images', claudeReq && claudeReq.images.length === 2, claudeReq && claudeReq.images.length);
  check('prompt keeps feedback neutral', claudeReq && /no comments on attractiveness/.test(claudeReq.prompt) && /no body-fat/.test(claudeReq.prompt));
  check('AI feedback shown and saved', /broader/.test(await pg.locator('.ciai').innerText().catch(() => '')) && DOCS.checkins.list.find(x => x.date === T).ai);
  await pg.screenshot({ path: '/tmp/ci-2-full.png', fullPage: true });
  // replace a photo removes the old file
  const before = DOCS.checkins.list.find(x => x.date === T).photos.front;
  const fc = pg.waitForEvent('filechooser'); await pg.click('[data-act=ciphoto][data-p=front]'); (await fc).setFiles(path.join(IMG, 'back.jpg')); await pg.waitForTimeout(1200);
  check('replacing a photo deletes the old file', removed.includes(before) && !FILES[before]);
  // switching to imperial shows inches
  DOCS.profile.units = 'imperial';
  await b.close(); console.log(`\n${results.filter(Boolean).length}/${results.length} passed`); process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
