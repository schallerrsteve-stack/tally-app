// Proxy for Claude features ("Describe it", reading nutrition labels and barcodes).
// The Anthropic API key stays on the server as a secret; only signed-in Tally users can call this.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5";
const DAILY_LIMIT = Number(Deno.env.get("CLAUDE_DAILY_LIMIT") ?? "60");
const usage = new Map<string, { day: string; n: number }>(); // per-instance soft limit

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await sb.auth.getUser();
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
  const images = (body.images ?? []).slice(0, 2).filter((i) => /^image\/(jpeg|png|webp)$/.test(i.media_type) && i.data.length < 7_000_000);

  const content = [
    ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
    { type: "text", text: prompt },
  ];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) return json({ error: "Claude request failed", status: r.status }, 502);
  const out = await r.json();
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  return json({ text });
});
