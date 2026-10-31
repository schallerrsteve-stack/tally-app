// Platform layer: Supabase auth + data sync, Claude proxy, Open Food Facts live lookup, native barcode scanning.
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const sb = createClient(SB_URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.localStorage },
});
export const isNative = Capacitor.isNativePlatform();

/* ---------------- auth ---------------- */
export async function currentUser() { const { data } = await sb.auth.getSession(); return data.session?.user ?? null; }
export async function sendCode(email) {
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}
export async function verifyCode(email, token) {
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data.user;
}
export async function signOut() { await sb.auth.signOut(); }

/* ---------------- private data sync (user_docs) ----------------
   Local-first: every doc is cached on the phone, writes are queued and retried when back online. */
export function createStore({ uid, onChange }) {
  const CK = 'tally.cache.' + uid, PK = 'tally.pending.' + uid;
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
  let docs = load(CK, {});
  const pending = new Set(load(PK, []));
  const saveCache = () => { try { localStorage.setItem(CK, JSON.stringify(docs)); localStorage.setItem(PK, JSON.stringify([...pending])); } catch {} };
  let flushing = false, status = 'syncing';

  async function flush() {
    if (flushing || !pending.size || !navigator.onLine) return;
    flushing = true;
    try {
      for (const key of [...pending]) {
        const data = docs[key];
        const q = data == null
          ? sb.from('user_docs').delete().eq('user_id', uid).eq('key', key)
          : sb.from('user_docs').upsert({ user_id: uid, key, data, updated_at: new Date().toISOString() });
        const { error } = await q;
        if (error) { console.warn('sync', key, error.message); status = 'error'; break; }
        if (docs[key] === data) pending.delete(key); // unchanged since we sent it
      }
      if (!pending.size) status = 'synced';
    } finally { flushing = false; saveCache(); onChange('status'); if (pending.size && status !== 'error') setTimeout(flush, 500); }
  }

  async function pull() {
    const all = {}; let from = 0;
    for (;;) {
      const { data, error } = await sb.from('user_docs').select('key,data').eq('user_id', uid).range(from, from + 999);
      if (error) { status = navigator.onLine ? 'error' : 'offline'; onChange('status'); return; }
      data.forEach(r => all[r.key] = r.data);
      if (data.length < 1000) break; from += 1000;
    }
    for (const k of Object.keys(all)) if (!pending.has(k)) docs[k] = all[k];
    for (const k of Object.keys(docs)) if (!(k in all) && !pending.has(k)) delete docs[k];
    status = pending.size ? 'syncing' : 'synced';
    saveCache(); onChange('docs'); flush();
  }

  const channel = sb.channel('docs-' + uid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_docs', filter: 'user_id=eq.' + uid }, (p) => {
      const key = (p.new && p.new.key) || (p.old && p.old.key);
      if (!key || pending.has(key)) return;
      if (p.eventType === 'DELETE') delete docs[key]; else docs[key] = p.new.data;
      saveCache(); onChange('docs');
    }).subscribe();

  window.addEventListener('online', () => { pull(); });
  window.addEventListener('offline', () => { status = 'offline'; onChange('status'); });
  pull();

  return {
    get docs() { return docs; },
    get status() { return navigator.onLine ? status : 'offline'; },
    put(key, data) { if (data == null) delete docs[key]; else docs[key] = data; pending.add(key); status = 'syncing'; saveCache(); flush(); },
    pull,
    close() { sb.removeChannel(channel); },
  };
}

/* ---------------- Claude (via the `claude` edge function) ---------------- */
const blobToB64 = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); });
export async function sample(prompt, opts = {}) {
  const images = [];
  for (const b of opts.images || []) images.push({ media_type: b.type || 'image/jpeg', data: await blobToB64(b) });
  const { data, error } = await sb.functions.invoke('claude', { body: { prompt, images } });
  if (error) {
    const st = error.context && error.context.status;
    const e = new Error('Claude request failed'); e.code = st === 429 ? 'rate_limited' : st === 401 ? 'not_granted' : 'failed'; throw e;
  }
  return { text: data.text || '' };
}
sample.limits = async () => ({ images: true });

/* ---------------- Open Food Facts: live lookup + on-device cache ---------------- */
const OFFC = 'tally.offcache';
const offCache = () => { try { return JSON.parse(localStorage.getItem(OFFC) || '{}'); } catch { return {}; } };
function cachePut(code, rec) {
  const c = offCache(); c[code] = Object.assign(rec, { t: Date.now() });
  const ks = Object.keys(c); if (ks.length > 800) ks.sort((a, b) => c[a].t - c[b].t).slice(0, ks.length - 800).forEach(k => delete c[k]);
  try { localStorage.setItem(OFFC, JSON.stringify(c)); } catch {}
}
const OFFMAP = { p: ['proteins_100g', 1], c: ['carbohydrates_100g', 1], f: ['fat_100g', 1], fib: ['fiber_100g', 1], sug: ['sugars_100g', 1], na: ['sodium_100g', 1000], k: ['potassium_100g', 1000], ca: ['calcium_100g', 1000], fe: ['iron_100g', 1000], vc: ['vitamin-c_100g', 1000], sf: ['saturated-fat_100g', 1], chol: ['cholesterol_100g', 1000], mg: ['magnesium_100g', 1000], zn: ['zinc_100g', 1000], va: ['vitamin-a_100g', 1e6], vd: ['vitamin-d_100g', 1e6], b12: ['vitamin-b12_100g', 1e6], fol: ['folates_100g', 1e6] };
const r3 = (v) => v == null ? null : Math.round(v * 1000) / 1000;
function fromOff(p) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g']; if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184;
  if (kcal == null || !(p.product_name || p.product_name_en)) return null;
  const per = { kcal: r3(+kcal) };
  for (const [k, [col, mul]] of Object.entries(OFFMAP)) { const v = n[col]; per[k] = v == null || v === '' || isNaN(+v) ? null : r3(+v * mul); }
  const sq = +p.serving_quantity;
  return { name: String(p.product_name_en || p.product_name).trim().slice(0, 80), brand: String(p.brands || '').split(',')[0].trim().slice(0, 40), serving: String(p.serving_size || '').slice(0, 40), sq: sq > 0 && sq <= 2000 ? sq : null, per };
}
export async function offProduct(code) {
  const c = offCache();
  const alt = code.length === 13 && code[0] === '0' ? code.slice(1) : null;
  if (c[code]) return c[code].miss ? null : c[code];
  const fields = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments';
  for (const k of [code, alt].filter(Boolean)) {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${k}.json?fields=${fields}`);
    if (!r.ok && r.status !== 404) throw new Error('lookup failed ' + r.status);
    const j = await r.json().catch(() => ({}));
    if (j.status === 1 && j.product) { const rec = fromOff(j.product); if (rec) { cachePut(code, rec); return rec; } }
  }
  cachePut(code, { miss: true });
  return null;
}
export function offCached(q) {
  const c = offCache(), out = [];
  for (const [code, r] of Object.entries(c)) if (!r.miss && (r.name + ' ' + r.brand).toLowerCase().includes(q)) out.push(Object.assign({ code }, r));
  return out.slice(0, 10);
}
export async function offSearch(q, signal) {
  // Open Food Facts' search service; best-effort (falls back to cached products in the UI)
  const r = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=20&fields=code,product_name,brands&langs=en,fr`, { signal });
  if (!r.ok) throw new Error('search ' + r.status);
  const j = await r.json();
  return (j.hits || []).filter(h => h.code && h.product_name).map(h => ({ code: h.code, name: String(h.product_name).slice(0, 80), brand: String(Array.isArray(h.brands) ? h.brands[0] : (h.brands || '')).split(',')[0] }));
}

/* ---------------- native barcode scanning (Google ML Kit) ---------------- */
export async function nativeScan() {
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (!available) {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
    const e = new Error('Installing the scanner — try again in a few seconds'); e.code = 'installing'; throw e;
  }
  const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Ean13, BarcodeFormat.UpcA, BarcodeFormat.Ean8, BarcodeFormat.UpcE] });
  const b = barcodes && barcodes[0];
  if (!b) return null;
  return b.format === 'UPC_E' ? upcEtoA(b.rawValue) : b.rawValue;
}
export function upcEtoA(e) {
  e = String(e).replace(/\D/g, ''); if (e.length !== 8) return e;
  const n = e[0], d = e.slice(1, 7), cd = e[7]; let m;
  const L = d[5];
  if ('012'.includes(L)) m = d[0] + d[1] + L + '0000' + d[2] + d[3] + d[4];
  else if (L === '3') m = d[0] + d[1] + d[2] + '00000' + d[3] + d[4];
  else if (L === '4') m = d[0] + d[1] + d[2] + d[3] + '00000' + d[4];
  else m = d[0] + d[1] + d[2] + d[3] + d[4] + '0000' + L;
  return n + m + cd;
}
