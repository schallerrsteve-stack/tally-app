// Sends a friend invite by email.
// - Records the invite (row-level security makes sure it's from the signed-in user)
// - New people get Supabase's invite email with a sign-up link; when they join they're friended automatically
// - People who already have an account see the invite in the app's Friends screen
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") ?? "ca.tallyfit.app://auth";

  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Not signed in" }, 401);

  let email = "";
  try { email = String((await req.json()).email ?? "").trim().toLowerCase(); } catch { /* fallthrough */ }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address" }, 400);
  if (email === user.email?.toLowerCase()) return json({ error: "You can't invite yourself" }, 400);

  const admin = createClient(url, service);

  // Simple abuse limit: 20 invites per person per day
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await admin.from("invites").select("id", { count: "exact", head: true })
    .eq("inviter_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= 20) return json({ error: "Invite limit reached for today" }, 429);

  const { error: insErr } = await asUser.from("invites").insert({ inviter_id: user.id, email });
  if (insErr && !insErr.message.includes("duplicate")) return json({ error: insErr.message }, 400);
  if (insErr) {
    // Re-inviting: reopen a revoked/declined invite
    await admin.from("invites").update({ status: "pending", responded_at: null }).eq("inviter_id", user.id).eq("email", email);
  }

  const { data: me } = await admin.from("profiles").select("display_name").eq("id", user.id).single();
  const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { invited_by: me?.display_name ?? "A friend" },
  });
  // An existing account can't be "invited" by Supabase Auth — they'll see it in the app instead
  const existing = !!mailErr && /already|registered|exists/i.test(mailErr.message);
  if (mailErr && !existing) return json({ error: "Invite saved, but the email could not be sent: " + mailErr.message }, 502);

  return json({ ok: true, emailed: !existing, existing_user: existing });
});
