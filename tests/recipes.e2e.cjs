// Browser test: My recipes — ingredients from search, several barcodes in a row, and a scanned/pasted recipe.
// Fakes Supabase (user_docs + claude function) and Open Food Facts. Run with vite preview on :4173.
const { chromium } = require('playwright');
const REF = 'rwodweszrlvjgxgtpvxz';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 36000, uid = '00000000-0000-4000-8000-0000000000f1';
const jwt = [b64({ alg: 'HS256' }), b64({ sub: uid, email: 'r@t.com', exp, role: 'authenticated' }), 's'].join('.');
const sess = { access_token: jwt, refresh_token: 'r', expires_at: exp, expires_in: 36000, token_type: 'bearer', user: { id: uid, email: 'r@t.com', aud: 'authenticated', role: 'authenticated' } };
const ean = d12 => d12 + ((10 - (d12.split('').reduce((a, c, i) => a + +c * (i % 2 ? 3 : 1), 0) % 10)) % 10);
const BEANS = ean('005974989449'), TOMS = ean('006038318002');
const OFF = {
  [BEANS]: { product_name: 'Red kidney beans', brands: 'Clover Leaf', serving_size: '130 g', serving_quantity: 130, nutriments: { 'energy-kcal_100g': 90, proteins_100g: 6, carbohydrates_100g: 15, fat_100g: 0.5, fiber_100g: 6, sodium_100g: 0.2 } },
  [TOMS]: { product_name: 'Diced tomatoes', brands: 'Aylmer', serving_size: '125 ml', serving_quantity: 125, nutriments: { 'energy-kcal_100g': 24, proteins_100g: 1, carbohydrates_100g: 4.5, fat_100g: 0.2, fiber_100g: 1, sodium_100g: 0.18 } },
};
const DOCS = { profile: { height: 175, units: 'metric' } }; const asks = [];
const RECIPE = { name: 'Turkey chili', servings: 6, items: [
  { name: 'Lean ground turkey', amount: '1 lb', grams: 454, kcal: 676, protein_g: 86, carbs_g: 0, fat_g: 36 },
  { name: 'Olive oil', amount: '1 tbsp', grams: 13.5, kcal: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5 }] };
async function handle(route, req) {
  const url = new URL(req.url()), p = url.pathname, m = req.method();
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  if (p.startsWith('/auth/v1/')) return json(sess.user);
  if (p.startsWith('/functions/v1/claude')) { asks.push(JSON.parse(req.postData())); return json({ text: JSON.stringify(RECIPE) }) }
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
  await ctx.route('https://world.openfoodfacts.org/**', r => { const c = (r.request().url().match(/product\/(\d+)\.json/) || [])[1]; const pr = OFF[c] || OFF['0' + c];
    return r.fulfill({ status: pr ? 200 : 404, contentType: 'application/json', body: JSON.stringify(pr ? { status: 1, product: Object.assign({ code: c }, pr) } : { status: 0 }) }) });
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('[pageerror]', e.message));
  await pg.goto('http://localhost:4173/'); await pg.waitForTimeout(2500);
  await pg.click('nav a[data-v=foods]'); await pg.waitForTimeout(400);
  check('My recipes section on My foods', /My recipes/.test(await pg.locator('#view').innerText()));
  await pg.click('[data-act=newrecipe]'); await pg.waitForTimeout(300);
  await pg.fill('#rc-name', 'Turkey chili'); await pg.fill('#rc-sv', '6'); await pg.dispatchEvent('#rc-sv', 'change');

  // search ingredient: onion, 150 g
  await pg.click('[data-act=rcpadd][data-tab=search]'); await pg.waitForTimeout(2500);
  check('ingredient window has no Quick add / meal picker', await pg.locator('[data-tab=quick]').count() === 0 && /Add an ingredient/.test(await pg.locator('#modal').innerText()));
  await pg.fill('#fq', 'onions raw'); await pg.dispatchEvent('#fq', 'input'); await pg.waitForTimeout(800);
  await pg.locator('#fres [data-act=pick]').first().click(); await pg.waitForTimeout(300);
  const gIdx = await pg.evaluate(() => [...document.querySelectorAll('#por option')].findIndex(o => o.textContent.trim() === 'g'));
  await pg.selectOption('#por', String(gIdx)); await pg.fill('#qty', '150'); await pg.dispatchEvent('#qty', 'input');
  check('detail shows Add to recipe, no meal', /Add to recipe/.test(await pg.locator('[data-act=savefood]').innerText()) && await pg.locator('#meal').count() === 0);
  await pg.click('[data-act=savefood]'); await pg.waitForTimeout(300);
  check('back in the recipe with the onion', /onion/i.test(await pg.locator('#modal').innerText()) && /New recipe/.test(await pg.locator('#modal').innerText()));

  // scan two barcodes in a row (typed codes use the same lookup as camera scans)
  for (const [code, qty] of [[BEANS, '2'], [TOMS, '4']]) {
    await pg.click('[data-act=rcpadd][data-tab=scan]'); await pg.waitForTimeout(300);
    await pg.fill('#bc-num', code); await pg.click('[data-act=bclookup]'); await pg.waitForTimeout(800);
    await pg.fill('#qty', qty); await pg.dispatchEvent('#qty', 'input'); await pg.click('[data-act=savefood]'); await pg.waitForTimeout(300);
  }
  const t1 = await pg.locator('#modal').innerText();
  check('both scanned products added', /kidney beans/i.test(t1) && /Diced tomatoes/.test(t1), t1.slice(0, 400));

  // scan a recipe (pasted text) → Claude adds the rest
  await pg.click('[data-act=rcpscan]'); await pg.waitForTimeout(200);
  await pg.fill('#rs-text', '1 lb lean ground turkey\n1 tbsp olive oil'); await pg.click('[data-act=rsrun]'); await pg.waitForTimeout(1200);
  check('recipe prompt sent and under 8000 chars', asks.length === 1 && /ground turkey/.test(asks[0].prompt) && asks[0].prompt.length < 8000);
  const t2 = await pg.locator('#modal').innerText();
  check('Claude ingredients added (marked as estimates)', /Lean ground turkey/.test(t2) && /Olive oil/.test(t2) && /estimate/.test(t2));
  check('name and servings kept (not overwritten)', await pg.inputValue('#rc-name') === 'Turkey chili' && await pg.inputValue('#rc-sv') === '6');
  // edit a gram amount: olive oil 13.5 → 27 g doubles it
  const oilIdx = await pg.evaluate(() => [...document.querySelectorAll('.rcpi .nm')].findIndex(n => /Olive oil/.test(n.textContent)));
  const gi = pg.locator(`.rc-g[data-i="${oilIdx}"]`); await gi.fill('27'); await gi.dispatchEvent('change'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: '/tmp/rc-1-editor.png', fullPage: true });
  await pg.click('[data-act=rcpsave]'); await pg.waitForTimeout(800);
  const rc = ((DOCS.custom || {}).foods || []).find(f => f.recipe);
  check('recipe saved as a food with its ingredients', rc && rc.name === 'Turkey chili' && rc.recipe.items.length === 5 && rc.recipe.servings === 6, rc && JSON.stringify(rc).slice(0, 300));
  if (rc) {
    const tot = rc.recipe.items.reduce((a, i) => a + i.n.kcal, 0), g = rc.recipe.items.reduce((a, i) => a + i.g, 0);
    const servKcal = rc.per.kcal * rc.portions[0][1] / 100;
    check('per-serving calories = total ÷ 6', Math.abs(servKcal - tot / 6) < 1, `${servKcal} vs ${tot / 6}`);
    check('serving weight = total ÷ 6', Math.abs(rc.portions[0][1] - g / 6) < 0.5, `${rc.portions[0][1]} vs ${g / 6}`);
    check('beans 2 × 130 g = 260 g, 234 kcal', rc.recipe.items.some(i => /kidney/i.test(i.name) && i.g === 260 && Math.round(i.n.kcal) === 234));
    check('olive oil edited to 27 g = 238 kcal', rc.recipe.items.some(i => /Olive oil/.test(i.name) && i.g === 27 && Math.round(i.n.kcal) === 238));
  }
  const fv = await pg.locator('#view').innerText();
  check('recipe listed under My recipes', /Turkey chili/.test(fv) && /makes 6/.test(fv));
  await pg.screenshot({ path: '/tmp/rc-2-list.png' });
  // log a serving
  await pg.click('[data-act=logrecipe]'); await pg.waitForTimeout(300);
  await pg.click('[data-act=savefood]'); await pg.waitForTimeout(500);
  const today = new Date().toLocaleDateString('en-CA'), d = DOCS['d-' + today];
  check('one serving logged to the diary', d && d.foods.some(f => f.name === 'Turkey chili' && f.qty === 1), d && JSON.stringify(d.foods));
  // recipe shows in food search
  await pg.click('nav a[data-v=diary]'); await pg.waitForTimeout(300); await pg.click('[data-act=add][data-meal]'); await pg.waitForTimeout(300);
  await pg.fill('#fq', 'turkey chili'); await pg.dispatchEvent('#fq', 'input'); await pg.waitForTimeout(500);
  check('recipe found in food search', /Turkey chili/.test(await pg.locator('#fres').innerText()));
  await pg.click('[data-act=close]');
  // edit: open, closing an ingredient window returns to the recipe, then delete
  await pg.click('nav a[data-v=foods]'); await pg.waitForTimeout(300); await pg.click('[data-act=editrecipe]'); await pg.waitForTimeout(300);
  await pg.click('[data-act=rcpadd][data-tab=search]'); await pg.waitForTimeout(300); await pg.click('#modal [data-act=close]'); await pg.waitForTimeout(300);
  check('closing the ingredient window returns to the recipe', /Edit recipe/.test(await pg.locator('#modal').innerText()));
  await b.close(); console.log(`\n${results.filter(Boolean).length}/${results.length} passed`); process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
