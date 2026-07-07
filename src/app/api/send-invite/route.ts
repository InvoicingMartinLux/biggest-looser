import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // user-scoped client: all queries run under the caller's RLS permissions
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false } }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { kind?: string; team_id?: string | null; competition_id?: string | null; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { kind, team_id, competition_id, email } = body;
  if ((kind !== "team" && kind !== "competition") || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid invite data" }, { status: 400 });
  }
  if (kind === "team" && !team_id) return NextResponse.json({ error: "Missing team" }, { status: 400 });
  if (kind === "competition" && !competition_id) return NextResponse.json({ error: "Missing competition" }, { status: 400 });

  const { data: invite, error: insertError } = await supabase
    .from("invites")
    .insert({
      kind,
      team_id: kind === "team" ? team_id : null,
      competition_id: kind === "competition" ? competition_id : null,
      email: email.toLowerCase().trim(),
      invited_by: user.id,
    })
    .select()
    .single();
  if (insertError || !invite) {
    // RLS rejects inserts from non-captains / non-creators
    return NextResponse.json({ error: insertError?.message ?? "Not allowed to invite" }, { status: 403 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const link = `${origin}/invite/${invite.token}`;

  let contextName = "";
  if (kind === "team") {
    const { data } = await supabase.from("teams").select("name").eq("id", team_id!).maybeSingle();
    contextName = data?.name ?? "a team";
  } else {
    const { data } = await supabase.from("competitions").select("name").eq("id", competition_id!).maybeSingle();
    contextName = data?.name ?? "a competition";
  }
  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const inviterName = inviterProfile?.display_name || user.email || "A friend";

  let emailSent = false;
  let emailError: string | undefined;
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const subject =
        kind === "team"
          ? `${inviterName} invited you to join team "${contextName}" on Biggest Looser`
          : `${inviterName} challenged you: "${contextName}" on Biggest Looser`;
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM ?? "Biggest Looser <onboarding@resend.dev>",
        to: email,
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2>🏆 Biggest Looser</h2>
            <p><strong>${inviterName}</strong> invited you to ${
              kind === "team" ? `join the team <strong>${contextName}</strong>` : `compete in <strong>${contextName}</strong>`
            }.</p>
            <p>Lose the most weight (in percentages) and claim the crown!</p>
            <p style="margin:24px 0">
              <a href="${link}" style="background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">
                View invitation
              </a>
            </p>
            <p style="color:#666;font-size:12px">Or open this link: ${link}</p>
          </div>`,
      });
      if (sendError) emailError = sendError.message;
      else emailSent = true;
    } catch (e) {
      emailError = e instanceof Error ? e.message : "Failed to send email";
    }
  }

  return NextResponse.json({ emailSent, link, emailError });
}
