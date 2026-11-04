// Browser test: bigger exercise library, How-to view, and building routines with Claude (text + photo).
// Fake Supabase (user_docs + the claude function). Run with vite preview on :4173.
// Usage: node tests/exercises.e2e.cjs [photo.jpg]
const { chromium } = require('playwright');
const REF = 'rwodweszrlvjgxgtpvxz';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 36000, uid = '00000000-0000-4000-8000-0000000000e1';
const jwt = [b64({ alg: 'HS256' }), b64({ sub: uid, email: 'e@t.com', exp, role: 'authenticated' }), 's'].join('.');
const sess = { access_token: jwt, refresh_token: 'r', expires_at: exp, expires_in: 36000, token_type: 'bearer', user: { id: uid, email: 'e@t.com', aud: 'authenticated', role: 'authenticated' } };
const DOCS = { profile: { height: 180, units: 'metric' } }; const asks = [];
const REPLIES = [
  JSON.stringify({ name: 'Dumbbell upper body', kind: 'std', notes: 'Leave 1–2 reps in reserve on each set.', items: [
    { exercise: 'Dumbbell Bench Press', type: 'weight', sets: 4, reps: 8, rest: 90 },
    { exercise: 'One-Arm Dumbbell Row', type: 'weight', sets: 3, reps: 10, rest: 90 },
    { exercise: 'Arnold Dumbbell Press', type: 'weight', sets: 3, reps: 10, rest: 75 },
    { exercise: 'Plank', type: 'timed', sets: 3, seconds: 40, rest: 45 },
    { exercise: 'Zercher-style sandbag carry thing', type: 'weight', sets: 2, reps: 12, rest: 60 }] }),
  'Here you go:\n' + JSON.stringify({ name: 'Bag rounds', kind: 'interval', style: 'round', work: 180, rest: 60, rounds: 6, warmup: 10 }),
];
async function handle(route, req) {
  const url = new URL(req.url()), p = url.pathname, m = req.method();
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  if (p.startsWith('/auth/v1/')) return json(sess.user);
  if (p.startsWith('/functions/v1/claude')) { const b = JSON.parse(req.postData()); asks.push(b); return json({ text: REPLIES[asks.length - 1] || '{}' }) }
  if (p.startsWith('/rest/v1/user_docs')) {
    if (m === 'GET') return json(Object.entries(DOCS).map(([key, data]) => ({ key, data })));
    if (m === 'POST') { const b = JSON.parse(req.postData()); DOCS[b.key] = b.data; return route.fulfill({ status: 201, body: '' }) }
  }
  return json([]);
}
const results = []; const check = (n, ok, x) => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || x == null ? '' : '  → ' + x)) };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 400, height: 860 } });
  await ctx.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [`sb-${REF}-auth-token`, sess]);
  await ctx.route(`https://${REF}.supabase.co/**`, handle);
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('[pageerror]', e.message));
  await pg.goto('http://localhost:4173/'); await pg.waitForTimeout(2000);
  await pg.click('nav a[data-v=workouts]'); await pg.waitForTimeout(500);

  // 1) Picker: full library, search, filters, how-to
  await pg.click('[data-act=newroutine]'); await pg.waitForTimeout(300); await pg.click('[data-act=radd]'); await pg.waitForTimeout(800);
  const ph = await pg.getAttribute('#pq', 'placeholder');
  check('picker searches the full library (850+)', +((ph.match(/Search (\d+)/) || [])[1]) > 850, ph);
  await pg.fill('#pq', 'arnold'); await pg.dispatchEvent('#pq', 'input'); await pg.waitForTimeout(300);
  check('search finds library exercise (Arnold press)', /Arnold Dumbbell Press/.test(await pg.locator('#pres').innerText()));
  await pg.fill('#pq', ''); await pg.dispatchEvent('#pq', 'input');
  await pg.selectOption('#pg', 'Glutes'); await pg.selectOption('#pe', 'kettlebells'); await pg.waitForTimeout(300);
  const filt = await pg.locator('#pres .res .nm').allInnerTexts();
  check('filters by muscle group + equipment', filt.length > 0 && filt.every(n => /kettlebell/i.test(n) || n === 'Kettlebell swing'), filt.slice(0, 5).join(' | '));
  await pg.selectOption('#pg', ''); await pg.selectOption('#pe', '');
  await pg.fill('#pq', 'bench press'); await pg.dispatchEvent('#pq', 'input'); await pg.waitForTimeout(300);
  const names = await pg.locator('#pres .res .nm').allInnerTexts();
  check('built-in Bench press listed once (no duplicate)', names.filter(n => /^Bench press$|^Barbell Bench Press - Medium Grip$/.test(n)).length === 1, names.slice(0, 6).join(' | '));
  await pg.click('[data-act=howto][data-id=bench]'); await pg.waitForTimeout(1500);
  check('how-to shows steps for a built-in exercise', await pg.locator('.hxsteps li').count() >= 3);
  const imgOk = await pg.evaluate(() => [...document.querySelectorAll('.hximg img')].map(i => i.complete && i.naturalWidth > 0));
  check('how-to start/finish photos load', imgOk.length === 2 && imgOk.every(Boolean), JSON.stringify(imgOk));
  await pg.screenshot({ path: '/tmp/ex-1-howto.png' });
  await pg.click('[data-act=pickex][data-id=bench]'); await pg.waitForTimeout(300);
  check('Add from how-to puts it in the routine', /Bench press/.test(await pg.locator('#modal').innerText()));
  await pg.click('[data-act=close]');

  // 2) Build with Claude (text)
  await pg.click('[data-act=buildopen]'); await pg.waitForTimeout(400);
  await pg.fill('#bd-in', 'Upper body, 45 min, dumbbells and a bench');
  await pg.click('[data-act=bdrun]'); await pg.waitForTimeout(1500);
  check('prompt sent once with request', asks.length === 1 && /dumbbells and a bench/.test(asks[0].prompt) && asks[0].images.length === 0);
  check('prompt under the function\'s 8000-char limit', asks[0].prompt.length < 8000, asks[0].prompt.length);
  const ed = await pg.locator('#modal').innerText();
  check('opens routine editor with Claude\'s routine', /Dumbbell upper body/.test(await pg.inputValue('#r-name')) && /Built by Claude|reps in reserve/.test(ed));
  check('names matched to built-ins and library', /Dumbbell bench press/.test(ed) && /Dumbbell row/.test(ed) && /Arnold Dumbbell Press/.test(ed) && /Plank/.test(ed), ed.slice(0, 500));
  check('unknown exercise becomes a custom one', /Zercher-style sandbag carry thing/.test(ed));
  await pg.screenshot({ path: '/tmp/ex-2-built.png', fullPage: true });
  await pg.click('[data-act=saveroutine]'); await pg.waitForTimeout(800)
  const rts = (DOCS.routines || {}).list || [], rt = rts.find(r => r.name === 'Dumbbell upper body');
  check('routine saved with sets/reps', rt && rt.items.length === 5 && rt.items[0].sets === 4 && rt.items[0].reps === 8, JSON.stringify(rt));
  check('custom exercise saved only on save', ((DOCS.exercises || {}).list || []).some(e => /Zercher/.test(e.name)));
  // 3) Build from a photo → interval/round result
  await pg.click('[data-act=buildopen]'); await pg.waitForTimeout(300);
  const fc = pg.waitForEvent('filechooser'); await pg.click('label:has(#bd-file)'); (await fc).setFiles(process.argv[2] || '/tmp/ciimg/front.jpg'); await pg.waitForTimeout(300);
  await pg.click('[data-act=bdrun]'); await pg.waitForTimeout(1500);
  check('photo sent with the request', asks[1] && asks[1].images.length === 1 && /attached photo shows a workout plan/.test(asks[1].prompt));
  check('round-timer reply opens the round clock editor', /Bag rounds/.test(await pg.inputValue('#r-name').catch(() => '')) && await pg.locator('#rc-rounds').count() === 1);
  await pg.click('[data-act=close]');
  // 4) Start the built routine; how-to from the workout screen
  await pg.click(`[data-act=startroutine][data-id=${rt.id}]`); await pg.waitForTimeout(500);
  check('workout screen has how-to buttons', await pg.locator('.ses h3 [data-act=howto]').count() >= 3);
  await pg.locator('.ses h3 [data-act=howto]').nth(2).click(); await pg.waitForTimeout(800);
  check('how-to opens during a workout', /Arnold/.test(await pg.locator('#modal').innerText()));
  await b.close(); console.log(`\n${results.filter(Boolean).length}/${results.length} passed`); process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
