# TP Spain

Mobile-first Next.js app (App Router, TypeScript strict, Supabase, Tailwind),
usable both as a normal website and as a Telegram Mini App, letting Ukrainians
in Spain search official temporary-protection locations by province and see
dated community reports of what documents each office actually asked for.

See `docs/SPEC.md` for the full product/domain specification this app
implements, and `docs/BOTFATHER.md` for the Telegram bot/Mini App setup
checklist.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com) (or run one
   locally with the Supabase CLI — see "Local development" below).
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings → **API Keys**
     (Supabase is retiring the old "anon"/"service_role" JWT pair for
     "Publishable"/"Secret" keys — see the comment in `.env.example` for
     which goes where; the variable names here don't change either way).
3. Apply the migrations in order (`supabase/migrations/0001_*.sql` through
   `0008_*.sql`) — via the Supabase CLI (`supabase db push`, once the project
   is linked) or by pasting each file into the SQL Editor in the dashboard,
   in filename order.
4. Run the seed script to import `seed/locations.csv`:
   ```bash
   SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run seed
   ```
   This is idempotent (safe to re-run against an unchanged database — see the
   caveat in `scripts/seed.ts`'s header about re-running after moderation).

### 3. Create the Telegram bot

Follow `docs/BOTFATHER.md`, then fill in `TELEGRAM_BOT_TOKEN`,
`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME` in
`.env.local`.

### 4. Fill in the remaining env vars

- `NEXT_PUBLIC_SITE_URL` — your dev/prod URL.
- `OFFICIAL_INFO_URL` — a real link to official government information;
  never invent this.
- `PRIVACY_CONTROLLER_NAME`, `PRIVACY_CONTACT_EMAIL` — the real data
  controller's name and contact email. **The production build fails if
  either is unset** (see `src/lib/config.ts` `getPrivacyConfig()`); in
  development, `/privacy` shows a "TODO: not configured" banner instead.
- `DEV_LOGIN_ENABLED` — `true` to enable `GET /api/auth/dev?user=1|2` for
  testing without a real Telegram login (only takes effect outside
  production regardless of this flag — see "Dev login" below).

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local development without Docker/the Supabase CLI

This was built and tested in a sandbox with no Docker daemon and no way to
fetch the PostgREST/GoTrue binaries the Supabase CLI's `supabase start` needs
— `npx supabase start` fails there with a Docker-socket connection error.
Everything that only needs Postgres itself (not the full Supabase stack) was
instead verified against a plain local PostgreSQL 16 instance:

```bash
createdb tpd_test
psql -d tpd_test -f supabase/tests/00_supabase_stub.sql   # NEVER run against a real Supabase project — see its header
for f in supabase/migrations/*.sql; do psql -d tpd_test -v ON_ERROR_STOP=1 -f "$f"; done
psql -d tpd_test -v ON_ERROR_STOP=1 -f supabase/tests/01_load_fixture_seed.sql
```

`00_supabase_stub.sql` provides a minimal `auth.users` table, `auth.uid()`
function and `anon`/`authenticated` roles — just enough to exercise RLS and
the matching function with real SQL, without GoTrue/PostgREST. This is how
every acceptance criterion under "Data", "Search and matching", "Reports and
moderation" and most of "Security and privacy" in `docs/SPEC.md` was actually
verified (see the milestone commits for specifics, including two real bugs
this caught: `flags_promote_to_flagged()` needing `SECURITY DEFINER`, and a
missing `location_procedures` INSERT grant).

What this setup **cannot** verify: anything requiring real GoTrue-issued
JWTs/sessions or a live HTTP PostgREST endpoint — i.e. `npm run dev` actually
rendering pages against real data, and the Telegram auth bridge's
`generateLink`/`verifyOtp` exchange end-to-end. Those need either
Docker + the Supabase CLI, or a real hosted Supabase project. If you have
either, prefer `supabase start && supabase db reset` over the manual steps
above — `supabase db reset` applies `supabase/migrations/` automatically.

### Testing

```bash
npm run lint          # eslint (Next.js config)
npm run build          # production build; also where "/" client-JS budget is enforced
npm test               # vitest: pure-function/unit tests, no database needed
npm run test:db        # vitest: DB integration tests — needs TEST_DATABASE_URL
                        #   (defaults to the Supabase CLI's local port 54322;
                        #   point it at the plain-Postgres setup above instead
                        #   with e.g. TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/tpd_test)
npm run report:home-bundle   # prints "/"'s gzipped client-JS size after a build
```

## Deploying to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket and import it in Vercel.
2. Add every variable from `.env.example` in Project Settings → Environment
   Variables (for Production **and** Preview, if you want preview
   deployments to work) — `SUPABASE_SERVICE_ROLE_KEY` and
   `TELEGRAM_BOT_TOKEN` must be added as server-only (never exposed to the
   client; Vercel does this automatically for vars without the
   `NEXT_PUBLIC_` prefix).
3. Set `NEXT_PUBLIC_SITE_URL` to the production domain, then update the
   Mini App's Web App URL and the Login Widget's domain in @BotFather to
   match (`docs/BOTFATHER.md` steps 2 and 5).
4. Deploy. `PRIVACY_CONTROLLER_NAME`/`PRIVACY_CONTACT_EMAIL` being unset will
   fail the build here, by design.

## Registering the Mini App

See `docs/BOTFATHER.md` — bot creation, Mini App registration, menu button,
`/start`, and linking the Login Widget's domain.

## Moderating in the Supabase dashboard

There is no admin UI in this app (out of scope, per `docs/SPEC.md`) —
everything below happens in the Supabase dashboard's Table Editor / SQL
Editor.

- **Pending locations** (`locations` where `moderation_status = 'pending'`):
  either a `conflict` seed row needing a phone call to verify (see
  `seed/VERIFICATION.md`), or a user submission (`verification_status =
  'user_submitted'`). Check it, then set `moderation_status = 'published'`
  (or `'rejected'`).
- **Location edit suggestions** (`location_suggestions` where `status =
  'pending'`): compare `current_value` (a snapshot from submit time) against
  `proposed_value`. If you accept it, manually update the corresponding
  column on the `locations` row, then set the suggestion's `status` to
  `'approved'` (this is a manual two-step edit — there is no auto-apply, per
  spec: "no import, bulk-insert... path exists for any role, including
  moderators").
- **Flagged reports/comments** (`moderation_status = 'flagged'`, reached
  automatically at 3 distinct flaggers): review, then set to `'published'`
  (restore) or `'hidden'`. Never gets there automatically from `'hidden'`.
- **Policy changes**: add a row to `policy_changes` once a change's
  `effective_date` is confirmed from an official source — never invent a
  date. This immediately affects the matching function's "До зміни правил"
  labelling and default counts for older reports (see
  `supabase/migrations/0007_matching.sql`). The military-obligation
  requirement mentioned in `content/legal-notice.uk.md` is exactly the kind
  of change this table exists for.
- **Roles**: promote a user to moderator with
  `update profiles set role = 'moderator' where id = '<uuid>';`. There is no
  self-service path to this role.

## Documentation URLs used

Cited inline in the relevant source files; collected here per the build
prompt's requirement.

**Telegram** (validation algorithms — `src/lib/telegram/`):
- Mini App `initData` validation: <https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app>
- Login Widget validation: <https://core.telegram.org/widgets/login#checking-authorization>

**Supabase** (the Telegram→Supabase-session auth bridge — `src/lib/telegram/authBridge.ts`):
- Admin API guide: <https://supabase.com/docs/guides/auth/auth-admin-api>
- `admin.generateLink`: <https://supabase.com/docs/reference/javascript/auth-admin-generatelink>
- `verifyOtp`: <https://supabase.com/docs/reference/javascript/auth-verifyotp>
- Server-side Next.js (`@supabase/ssr` cookie pattern) — `src/lib/supabase/server.ts`, `src/proxy.ts`: <https://supabase.com/docs/guides/auth/server-side/nextjs>

Network access to `core.telegram.org` and `supabase.com` was blocked by this
sandbox's egress proxy, so these algorithms/APIs were corroborated via
multiple independent secondary sources (community write-ups reproducing the
official pseudocode verbatim) rather than a direct fetch of the pages above,
and the exact `verifyOtp` parameter shape was additionally checked directly
against the installed `@supabase/auth-js` TypeScript types (see the comment
in `authBridge.ts`) rather than trusted from a blog post. **Before shipping
this to production, fetch both doc pages directly and diff against the
algorithms implemented here** — they are stable, well-known algorithms, but
this was not independently re-verified against the live pages in this
environment.

## Known limitations / not independently verified here

- No end-to-end run of `npm run dev` against a live Supabase project (no
  Docker/Supabase CLI, no external Supabase project credentials in this
  sandbox) — see "Local development" above for exactly what was and wasn't
  verified.
- The Telegram auth bridge's `generateLink`/`verifyOtp` exchange was checked
  against the installed SDK's TypeScript types and is expected to work per
  the SDK's documented contract, but was not exercised against a real
  Supabase Auth server (needs a real project + a real or synthetic Telegram
  login).
- Telegram doc URLs above were not fetched directly in this environment (see
  above).
