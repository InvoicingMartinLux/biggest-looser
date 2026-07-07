# 🏆 Biggest Looser

A friendly weight-loss competition app inspired by the TV show *The Biggest Loser*.
Track your weight, build teams, and compete 1-vs-1 or team-vs-team — the winner is
whoever loses the most weight **in percentages**, so everyone competes on equal footing.

## Features

- **Auth** — email/password sign-up and Google sign-in (Supabase Auth)
- **Profile** — name, profile image, preferred unit (kg/lbs), current & target weight
- **Weigh-ins** — log your weight any time, see your history on a progress chart with a target line
- **Teams** — create a team with name, image and description; invite members by email;
  the captain can remove members and send new invites; members can leave
- **Competitions**
  - solo (1 vs 1) or team (2 teams) competitions
  - configurable weigh-in interval: daily, weekly or monthly
  - start and end date
  - invite opponents by email (token links)
  - live standings: % of body weight lost since the competition start
  - per-interval results: who entered their weight, % change per interval, interval winner
  - at the end date the champion is crowned 👑 (biggest total % lost)

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) — Postgres, Auth, Storage (with row-level security)
- [Resend](https://resend.com) — invitation emails (optional; falls back to shareable links)
- Deployable on [Vercel](https://vercel.com)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

Environment variables (`.env.local`):

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase publishable (anon) key |
| `RESEND_API_KEY` | no | Enables real invitation emails |
| `RESEND_FROM` | no | From address, e.g. `Biggest Looser <invites@yourdomain.com>` |

## Database setup

The full schema (tables, row-level-security policies, invite RPCs, storage buckets)
lives in [`supabase/migrations`](supabase/migrations). On a fresh Supabase project run
the files in order in the SQL editor, or use the Supabase CLI:

```bash
supabase db push
```

## Deploying to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com/new).
2. Add the environment variables above in Vercel → Project → Settings → Environment Variables.
3. Deploy. Then in **Supabase → Authentication → URL Configuration**:
   - set **Site URL** to your Vercel URL (e.g. `https://biggest-looser.vercel.app`)
   - add `https://<your-app>.vercel.app/**` to **Redirect URLs**

## Enabling Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an
   **OAuth client ID** (type *Web application*).
   - Authorized redirect URI: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
2. In **Supabase → Authentication → Sign In / Up → Google**: enable the provider and paste
   the Client ID and Client Secret.

The Google button in the app works as soon as the provider is enabled.

## Enabling invitation emails

1. Create a [Resend](https://resend.com) account and an API key.
2. Verify your sending domain (or use the `onboarding@resend.dev` test sender, which only
   delivers to your own account email).
3. Set `RESEND_API_KEY` and `RESEND_FROM` in your environment.

Without a key the app still works: every invite generates a shareable link you can copy.

## How winners are decided

For each participant the **baseline** is the last weigh-in on or before the competition
start date (or the first weigh-in during the competition if they started logging late).
For teams the weights of all members are summed. The score is:

```
% lost = (baseline weight − current weight) / baseline weight × 100
```

Interval results compare the aggregate weight at the end of each interval with the
previous interval (carrying forward the last known weight when someone skips an entry).
After the end date, standings freeze at the last weigh-in on or before the end date and
the entrant with the biggest percentage lost is crowned the Biggest Looser. 👑
