// Tally — Claude proxy for "Describe it", reading nutrition labels and reading barcodes from photos.
// The Anthropic API key stays here on the server (as the ANTHROPIC_API_KEY secret); only signed-in Tally users can call this.
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor → name it `claude` → paste this file → Deploy.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5";
const DAILY_LIMIT = Number(Deno.env.get("CLAUDE_DAILY_LIMIT") ?? "60");
const usage = new Map<string, { day: string; n: number }>(); // soft per-user daily limit

// Check the caller is a signed-in Tally user by asking Supabase Auth who the token belongs to.
async function signedInUser(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!auth.startsWith("Bearer ") || !apikey) return null;
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "ANTHROPIC_API_KEY secret is not set" }, 500);

  const user = await signedInUser(req);
  if (!user) return json({ error: "Not signed in" }, 401);

  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(user.id);
  const n = u && u.day === day ? u.n : 0;
  if (n >= DAILY_LIMIT) return json({ error: "rate_limited" }, 429);
  usage.set(user.id, { day, n: n + 1 });

  let body: { prompt?: string; images?: { media_type: string; data: string }[] };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const prompt = String(body.prompt ?? "").slice(0, 8000);
  if (!prompt) return json({ error: "Missing prompt" }, 400);
  const images = (body.images ?? []).slice(0, 2)
    .filter((i) => /^image\/(jpeg|png|webp|gif)$/.test(i.media_type) && typeof i.data === "string" && i.data.length < 7_000_000);

  const content = [
    ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
    { type: "text", text: prompt },
  ];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    console.error("Anthropic error", r.status, detail.slice(0, 500));
    return json({ error: "Claude request failed", status: r.status }, 502);
  }
  const out = await r.json();
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  return json({ text });
});
