// Browser test: check-in + meal reminders, with a fake LocalNotifications plugin. Run with vite preview on :4173.
const { chromium } = require('playwright');
const REF = 'rwodweszrlvjgxgtpvxz';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 36000, uid = '00000000-0000-4000-8000-0000000000d1';
const jwt = [b64({ alg: 'HS256' }), b64({ sub: uid, email: 'n@t.com', exp, role: 'authenticated' }), 's'].join('.');
const sess = { access_token: jwt, refresh_token: 'r', expires_at: exp, expires_in: 36000, token_type: 'bearer', user: { id: uid, email: 'n@t.com', aud: 'authenticated', role: 'authenticated' } };
const DOCS = { profile: { height: 175, units: 'metric' } };
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
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 400, height: 860 } });
  await ctx.addInitScript(([k, s]) => {
    localStorage.setItem(k, JSON.stringify(s));
    // fake plugin: keeps pending notifications in window.__pend
    window.__pend = []; window.__asked = 0; window.__listeners = {};
    window.__tallyNotifMock = {
      checkPermissions: async () => ({ display: window.__asked ? 'granted' : 'prompt' }),
      requestPermissions: async () => { window.__asked++; return { display: 'granted' } },
      getPending: async () => ({ notifications: window.__pend.map(n => ({ id: n.id })) }),
      cancel: async ({ notifications }) => { const ids = new Set(notifications.map(n => n.id)); window.__pend = window.__pend.filter(n => !ids.has(n.id)) },
      schedule: async ({ notifications }) => { window.__pend.push(...notifications.map(n => Object.assign({}, n, { at: n.schedule.at ? new Date(n.schedule.at).toISOString() : null }))); return { notifications } },
      addListener: (ev, fn) => { window.__listeners[ev] = fn; return { remove() {} } },
    };
  }, [`sb-${REF}-auth-token`, sess]);
  await ctx.route(`https://${REF}.supabase.co/**`, handle);
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('[pageerror]', e.message));
  await pg.goto('http://localhost:4173/'); await pg.waitForTimeout(3500);
  const pend = () => pg.evaluate(() => window.__pend);
  let P = await pend();
  check('asked for notification permission once', await pg.evaluate(() => window.__asked) === 1);
  const ci = P.find(n => n.id === 9001);
  check('weekly check-in: Wednesday 6:30', ci && ci.schedule.on.weekday === 4 && ci.schedule.on.hour === 6 && ci.schedule.on.minute === 30, ci && JSON.stringify(ci.schedule));
  check('check-in opens the Check-in tab', ci && ci.extra.view === 'checkin');
  const meals = P.filter(n => n.id >= 200000);
  check('meal reminders for the coming days at 7:00 pm', meals.length >= 13 && meals.every(n => { const d = new Date(n.at); return d.getHours() === 19 && d.getMinutes() === 0 }), meals.map(n => n.at).slice(0, 3).join(', '));
  check('no reminder scheduled in the past', meals.every(n => new Date(n.at) > new Date()));
  const t = new Date(); const todays = meals.find(n => new Date(n.at).toDateString() === t.toDateString());
  const before7 = t.getHours() < 19;
  check(before7 ? 'today’s 7 pm reminder is set (nothing logged yet)' : 'after 7 pm: today skipped', before7 ? !!todays : !todays);
  // log a food today → today's reminder is cancelled, the rest stay
  await pg.click('[data-act=add][data-meal]'); await pg.waitForTimeout(2500);
  await pg.fill('#fq', 'banana'); await pg.dispatchEvent('#fq', 'input'); await pg.waitForTimeout(600);
  await pg.locator('#fres [data-act=pick]').first().click(); await pg.waitForTimeout(300); await pg.click('[data-act=savefood]'); await pg.waitForTimeout(2500);
  P = await pend(); const meals2 = P.filter(n => n.id >= 200000);
  check('logging food cancels today’s meal reminder', !meals2.some(n => new Date(n.at).toDateString() === t.toDateString()));
  check('future days still have reminders', meals2.length >= 12);
  check('no duplicate notifications after rescheduling', new Set(P.map(n => n.id)).size === P.length);
  // settings: change check-in to Sunday 8:15 and turn meals off
  await pg.click('header a.cog'); await pg.waitForTimeout(500);
  check('Reminders card in Settings', /Weekly check-in/.test(await pg.locator('#view').innerText()));
  await pg.selectOption('.remset[data-k=ciDay]', '1'); await pg.waitForTimeout(400);
  await pg.fill('.remset[data-k=ciTime]', '08:15'); await pg.dispatchEvent('.remset[data-k=ciTime]', 'change'); await pg.waitForTimeout(400);
  await pg.uncheck('.remtog[data-k=meal]'); await pg.waitForTimeout(600);
  P = await pend(); const ci2 = P.find(n => n.id === 9001);
  check('check-in moved to Sunday 8:15', ci2 && ci2.schedule.on.weekday === 1 && ci2.schedule.on.hour === 8 && ci2.schedule.on.minute === 15, ci2 && JSON.stringify(ci2.schedule));
  check('meal reminders turned off', !P.some(n => n.id >= 200000));
  check('settings saved to your account', DOCS.reminders && DOCS.reminders.ciDay === 1 && DOCS.reminders.meal === false);
  await pg.evaluate(() => document.activeElement.blur()); await pg.click('nav a[data-v=diary]'); await pg.click('header a.cog'); await pg.waitForTimeout(400);
  check('settings show the saved day and time', await pg.inputValue('.remset[data-k=ciDay]') === '1' && await pg.inputValue('.remset[data-k=ciTime]') === '08:15');
  await pg.locator('.remrow').first().scrollIntoViewIfNeeded();
  await pg.screenshot({ path: '/tmp/rem-settings.png', clip: { x: 0, y: 0, width: 400, height: 860 }, fullPage: false });
  // tapping a notification opens the right tab
  await pg.evaluate(() => window.__listeners.localNotificationActionPerformed({ notification: { extra: { view: 'checkin' } } })); await pg.waitForTimeout(400);
  const h2 = await pg.locator('#view h2').first().innerText(); check('tapping the check-in notification opens Check-in', /Weekly check-in/.test(h2), h2 + ' ' + await pg.evaluate(() => location.hash));
  await b.close(); console.log(`\n${results.filter(Boolean).length}/${results.length} passed`); process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
