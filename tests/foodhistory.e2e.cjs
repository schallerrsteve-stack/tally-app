// Browser test: personal food history — scanned products and past entries stay searchable (on any device),
// "usual for this meal" + recent lists, and the usual amount is prefilled. Fake Supabase + Open Food Facts.
const { chromium } = require('playwright');
const REF = 'rwodweszrlvjgxgtpvxz';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 36000, uid = '00000000-0000-4000-8000-0000000000a7';
const jwt = [b64({ alg: 'HS256' }), b64({ sub: uid, email: 'h@t.com', exp, role: 'authenticated' }), 's'].join('.');
const sess = { access_token: jwt, refresh_token: 'r', expires_at: exp, expires_in: 36000, token_type: 'bearer', user: { id: uid, email: 'h@t.com', aud: 'authenticated', role: 'authenticated' } };
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') };
const ean = d12 => d12 + ((10 - (d12.split('').reduce((a, c, i) => a + +c * (i % 2 ? 3 : 1), 0) % 10)) % 10);
const BAR = ean('009661901234'), TOMS = ean('006038318002');
const per = (k, p, c, f) => ({ kcal: k, p, c, f, fib: 1, sug: 2, sod: 100 });
// Two past days with a scanned protein bar at breakfast (logged before food history existed)
const DOCS = { profile: { height: 175, units: 'metric' } };
for (const n of [-3, -2]) DOCS['d-' + day(n)] = { foods: [{ id: 'e' + n, fid: 'o' + BAR, name: 'Protein bar — Kirkland', meal: 'b', qty: 1, unit: 'bar', unitG: 60, g: 60, per: per(350, 35, 40, 12), n: per(210, 21, 24, 7) }] };
const OFF = { [TOMS]: { product_name: 'Diced tomatoes', brands: 'Aylmer', serving_size: '125 ml', serving_quantity: 125, nutriments: { 'energy-kcal_100g': 24, proteins_100g: 1, carbohydrates_100g: 4.5, fat_100g: 0.2 } } };
async function handle(route, req) {
  const url = new URL(req.url()), p = url.pathname, m = req.method();
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  if (p.startsWith('/auth/v1/')) return json(sess.user);
  if (p.startsWith('/rest/v1/user_docs')) {
    if (m === 'GET') return json(Object.entries(DOCS).map(([key, data]) => ({ key, data })));
    if (m === 'POST') { const b = JSON.parse(req.postData()); DOCS[b.key] = b.data; return route.fulfill({ status: 201, body: '' }) }
  }
  return json([]);
}
const results = []; const check = (n, ok, x) => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || x == null ? '' : '  → ' + x)) };
async function device(b) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 } });
  await ctx.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [`sb-${REF}-auth-token`, sess]);
  await ctx.route(`https://${REF}.supabase.co/**`, handle);
  await ctx.route('https://world.openfoodfacts.org/**', r => { const c = (r.request().url().match(/product\/(\d+)\.json/) || [])[1]; const pr = OFF[c];
    return r.fulfill({ status: pr ? 200 : 404, contentType: 'application/json', body: JSON.stringify(pr ? { status: 1, product: Object.assign({ code: c }, pr) } : { status: 0 }) }) });
  await ctx.route('https://search.openfoodfacts.org/**', r => r.fulfill({ status: 503, body: '' })); // packaged search down
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('[pageerror]', e.message));
  await pg.goto('http://localhost:4173/'); return pg;
}
const search = async (pg, q) => { await pg.fill('#fq', q); await pg.dispatchEvent('#fq', 'input'); await pg.waitForTimeout(500); return pg.locator('#fres').innerText() };
(async () => {
  const b = await chromium.launch();
  const A = await device(b); await A.waitForTimeout(6000); // backfill runs after the database loads
  check('history backfilled from past diary days and saved to the account', DOCS.foodhist && DOCS.foodhist.bf && Object.keys(DOCS.foodhist.items).some(k => k === 'o' + BAR), JSON.stringify(DOCS.foodhist || {}).slice(0, 200));
  await A.click('[data-act=add][data-meal=b]'); await A.waitForTimeout(800);
  const empty = await A.locator('#fres').innerText();
  check('empty search shows "Usual for Breakfast" with the protein bar', /Usual for Breakfast/i.test(empty) && /Protein bar/.test(empty), empty.slice(0, 300));
  check('shows the usual amount', /usually 1 bar/.test(empty));
  let r = await search(A, 'protein bar');
  check('scanned product found by name in search (first result)', /^Protein bar — Kirkland/.test(r.trim()), r.slice(0, 120));
  // scan a new product but don't log it
  await A.click('[data-tab=scan]'); await A.waitForTimeout(200); await A.fill('#bc-num', TOMS); await A.click('[data-act=bclookup]'); await A.waitForTimeout(800);
  await A.click('[data-act=back]').catch(() => {}); await A.click('[data-tab=search]'); await A.waitForTimeout(200);
  r = await search(A, 'diced');
  check('a scanned (not yet logged) product is searchable', /Diced tomatoes/.test(r.split('\n').slice(0, 4).join(' ')), r.slice(0, 160));
  // log 2 × 125 ml at lunch; picking it again prefills that
  await A.locator('#fres [data-act=pick]').first().click(); await A.waitForTimeout(200);
  await A.fill('#qty', '2'); await A.dispatchEvent('#qty', 'input'); await A.selectOption('#meal', 'l'); await A.click('[data-act=savefood]'); await A.waitForTimeout(600);
  await A.click('[data-act=add][data-meal=l]'); await A.waitForTimeout(500);
  await search(A, 'diced'); await A.locator('#fres [data-act=pick]').first().click(); await A.waitForTimeout(200);
  check('usual amount prefilled (2 × 125 ml)', await A.inputValue('#qty') === '2' && /125 ml/.test(await A.locator('#por option:checked').innerText()));
  await A.click('[data-act=close]');
  // a second phone with no local product cache still finds both
  const B2 = await device(b); await B2.waitForTimeout(2500);
  await B2.click('[data-act=add][data-meal=s]'); await B2.waitForTimeout(500);
  const r1 = await search(B2, 'kirkland'), r2 = await search(B2, 'diced tomatoes');
  check('on another phone: scanned products still found', /Protein bar — Kirkland/.test(r1) && /Diced tomatoes/.test(r2), r1.slice(0, 80) + ' | ' + r2.slice(0, 80));
  await B2.click('[data-act=close]');
  // My foods: food history, remove an item
  await B2.click('nav a[data-v=foods]'); await B2.waitForTimeout(400);
  const fv = await B2.locator('#view').innerText();
  check('My foods shows Food history', /Food history/.test(fv) && /Protein bar/.test(fv) && /logged 2×/.test(fv), fv.slice(0, 400));
  await B2.screenshot({ path: '/tmp/fh-myfoods.png', fullPage: true });
  await B2.click(`[data-act=fhdel][data-k="o${BAR}"]`); await B2.waitForTimeout(300);
  check('forgetting a food removes it from history', !DOCS.foodhist.items['o' + BAR]);
  await A.screenshot({ path: '/tmp/fh-a.png' });
  await b.close(); console.log(`\n${results.filter(Boolean).length}/${results.length} passed`); process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
