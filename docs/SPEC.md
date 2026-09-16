
## ROLE
You are a senior full-stack engineer.
Stack: Next.js (App Router) + TypeScript (strict), Supabase (Postgres, Auth, RLS), Vercel,
Telegram Mini App (Web App) as a second entry point to the same codebase.
Discuss with me in Ukrainian. Code, comments, file names, commit messages and docs in English.
Direct answer first, reasoning after. If my spec is wrong or contradicts itself, say so before coding.

## OBJECTIVE
Build one mobile-first app, usable both in a browser and as a Telegram Mini App.
In it, a person in Spain picks a province and the documents they hold, and sees:
- the official locations where Ukrainian temporary protection applications are accepted;
- dated reports from other users who applied there, including the document sets those users had.

## CONTEXT
- New product. No existing code, no design files.
- Users are Ukrainians in Spain. They arrive from Telegram chats and use phones.
- The official location list (Ministry of the Interior XLSX) was last modified 2022-03-30.
  It has no street addresses. User reports are therefore the main source of current practice.
- The product stores reports of individual visits. It is not a list of "required documents".
  It never tells a user they are eligible.

## INPUTS (source-of-truth order, highest first)
1. Official Spanish government sources. They are listed in `seed/VERIFICATION.md`.
2. `seed/locations.csv`: 72 rows (4 CREADE + 68 police stations, all 52 provinces).
   - Columns: id, name, type, region, province, city, address, postal_code, phone, email,
     appointment_method, appointment_url, source_url, official_list_url, source_date,
     verified_at, verification_status, notes.
   - Allowed values:
     - type: `creade | police_station`
     - verification_status: `verified | official_2022 | conflict`
     - appointment_method: `phone | email | phone_or_email | icp_online`
     - phone: semicolon-separated E.164 numbers.
3. Published user reports.
4. Approved location edit suggestions.
5. Comments.

Rules for inputs:
- Never invent locations, addresses, phones, emails or URLs.
- Anything not verifiable from 1–2 is labelled UNVERIFIED in code comments and docs.
- If a user report conflicts with official data, show both. Label each with its origin. Never merge them silently.

## DOMAIN RULES

### Locations
- Official fields only. Documents are never attached to a location.
- Seed import:
  - `verified` and `official_2022` rows are imported as `published`.
  - `conflict` rows are imported as `pending`.
- Every location page shows the official-data origin and date.
  Example: "Офіційний список МВС, оновлено 03/2022".
- Email rule (applies to every row, not to named locations): on import, set
  `email_hidden = true` when the email fails basic syntax validation or its domain is not in
  `ALLOWED_OFFICIAL_EMAIL_DOMAINS` (config; initial value `policia.es`).
  Hidden emails stay in the DB and are never rendered. In the current seed this hides one email
  (Teruel, domain `polcia.es`).

### Location edit suggestions
- A user can propose a value for `address`, `postal_code`, `phone` or `appointment_url`
  on an existing location.
- Proposed values are stored in `location_suggestions` with status `pending`, together with
  `current_value` copied from the location at submit time, so the moderator sees a diff.
- A moderator applies them manually via the Supabase dashboard.
- Suggested values are never shown publicly until approved.

### Reports (one visit or one booking attempt)
| Field | Rule |
|---|---|
| `location_id` | required |
| `procedure` | required; code from `procedures`; MVP UI only offers `temporary_protection_application` and sets it automatically |
| `event_date` | required; date of the visit or of the booking attempt; not in the future; not before 2022-03-04 |
| `outcome` | required: `protection_granted`, `application_accepted_pending`, `turned_away`, `could_not_get_appointment` |
| document entries | required; at least 1 row in `report_documents` (see below) |
| `appointment_type` | optional: `booked_online_icp`, `booked_by_email_or_phone`, `walk_in` |
| `earliest_appointment_offered` | optional date; the first slot the user was offered (e.g. "only December") |
| `time_at_office` | optional: `under_1h`, `1_to_3h`, `over_3h`, `multiple_visits` |
| `people_count` | optional integer 1–10; people who applied together in this visit |
| `requested_list_complete` | required boolean: "Я пам'ятаю все, що в мене попросили" |
| `military_obligations_apply` | optional: `yes`, `no`, `prefer_not_to_say`; question text: "Чи стосуються вас військові обов'язки України?" |
| `comment` | optional; max 1000 chars; plain text only |

Document entries (`report_documents.status`):
- `requested`: the office asked for it and the user had it.
- `requested_missing`: the office asked for it and the user did not have it.
- `not_requested`: the user states the office did not ask for it.
- No row for a code means "unknown / not mentioned". The form never pre-marks anything as `not_requested`.
- `other` with status `requested` or `requested_missing` requires the report comment to name the document.

A report records what the office asked for at that visit, not everything the user carried.
The form asks: "Що у вас попросили?" and "Що НЕ попросили, хоча ви очікували?".

### Manual entry only
- Every report is entered through the app form by the person who had the experience,
  while logged in. `reports.user_id` is required and must equal `auth.uid()` (RLS).
- No import, bulk-insert, CSV upload or "on behalf of" path exists for any role,
  including moderators. Moderators can only change `moderation_status`.
- The home page has a visible CTA "Поділитися своїм досвідом" next to the search.
  At launch this is the only way data enters the system.

Also:
- Never collect: real name, exact age, birth date, passport/NIE/TIE/any ID numbers,
  phone, home address, photos or file uploads.
- Limit: one report per user per location per procedure per `event_date`
  (unique constraint). A booking attempt and a later visit, or a second visit after being turned
  away, are separate reports.
- Anti-spam limit: at most `MAX_REPORTS_PER_USER_PER_DAY = 5` new reports per user per
  calendar day (Europe/Madrid), enforced in the DB.
- No demographic fields (sex, age band) in MVP.

### Procedures (future-proofing, one active in MVP)
- Lookup table `procedures(code, label_uk, label_es, is_active)`.
  Seed: `temporary_protection_application` (active).
- Table `location_procedures(location_id, procedure_code)`. Seed: all 72 locations
  with `temporary_protection_application`.
- Other procedures (TIE fingerprints, empadronamiento, reception programme) are
  added later as data only. No UI for them in MVP. Search, matching and aggregates always
  filter by procedure.

### Policy changes
- Table `policy_changes(id, procedure_code, effective_date, title_uk, source_url, created_at)`.
  Rows are maintained by a moderator in the Supabase dashboard.
- Seed: no rows. Do not invent dates. The README tells the moderator to add the
  military-obligation change once its effective date is confirmed from an official source.
- A report with `event_date` earlier than the latest `effective_date` for its procedure:
  - is labelled "До зміни правил від <date>: <title_uk>" with a link to `source_url`;
  - is excluded from default counts and badges, like an outdated report;
  - is shown behind the same toggle as outdated reports.

### Document types
- Seeded into `document_types`. Rows can be added later without code changes.
- Each row has `code`, `label_uk`, `label_es`, `sort_order`, `is_active`.
- Initial codes:

```
international_passport, internal_passport_or_id_card, birth_certificate,
proof_of_residence_in_ukraine, ukraine_residence_permit_third_country,
passport_exit_stamp, military_document_paper, military_document_reserve_plus,
marriage_certificate, child_birth_certificate, spanish_address_or_empadronamiento,
passport_photos, other
```

- Labels are short and neutral. Label text never states or implies that a document is required.

### Location page actions (no standalone vote counters)
- "У мене так само" and "У мене інакше" both open the report form, prefilled with this location.
- "Поскаржитись" creates a row in `flags` (target: report or comment).
- "Запропонувати правку" opens the edit-suggestion form.
- All per-location numbers are aggregates computed from published reports.

### Matching
Definitions:
- `U` = documents the user selected.
- `R` = document codes in a report with status `requested` or `requested_missing`
  (what the office asked for). `passport_photos` is excluded from `U` and `R` for matching
  and shown only as a "що взяти" hint. `other` is never offered in the user's checklist,
  so a report whose `R` contains `other` can never match.
- `MILITARY_CODES` = {`military_document_paper`, `military_document_reserve_plus`, `passport_exit_stamp`}.
- A report is **successful** if its outcome is `protection_granted` or `application_accepted_pending`.
- A report is **fresh** if `event_date >= today - STALE_DAYS`, where `STALE_DAYS = 90`,
  and it is not older than the latest policy change for its procedure.

Rules:
- A report **MATCHES** if it is successful, `requested_list_complete = true`, and `R ⊆ U`.
  An empty `R` matches only when `requested_list_complete = true`.
- Successful reports with `requested_list_complete = false` never match. They appear in a block
  "Звіти з неповним списком документів" and still feed "Не просили" lines.
- Successful reports where `R ⊄ U` appear in a separate block,
  "У людей попросили більше документів". That block lists `R − U` for each report.
- For each location, compute per document code the number of fresh successful reports
  with status `not_requested`. Show it as "Не просили: <label> (N звітів)".
  For codes in `MILITARY_CODES`, count only reports with `military_obligations_apply = yes`,
  and phrase the line as "Не просили (у людей, яких стосуються військові обов'язки): <label>".
- Counts are based on distinct `user_id` values, not rows.
- Badge threshold: `MIN_REPORTS_FOR_BADGE = 2` distinct users.
  - At or above the threshold, "Не просили" lines and the walk-in badge render as highlighted badges.
  - Below it (exactly 1 user), they render as plain text with "1 звіт" and no highlight.
- Unsuccessful reports are always shown on the location page, labelled by outcome.
  They never count as matches.
- The search has an optional question "Чи стосуються вас військові обов'язки України?".
  If the user answers `yes`, reports with `military_obligations_apply = no` are excluded from
  that user's match counts. Any other answer applies no filter.
- Implement matching as one Postgres function. It must be callable by the anon role
  and read only published data.

### Search results (cold start matters: at launch there are zero reports)
- Always list every published location in the selected province,
  including locations with zero reports.
- Sort order:
  1. fresh matching report count, descending;
  2. latest matching `event_date`, descending;
  3. name, ascending.
- Each card shows:
  - name, type, city;
  - address, or "адреса не вказана в офіційному списку";
  - appointment method;
  - fresh matching count;
  - latest report date;
  - count of fresh unsuccessful reports;
  - if any fresh report has `appointment_type = walk_in`, the text
    "N звітів: приймали без запису" (badge styling only at `MIN_REPORTS_FOR_BADGE`), shown next to the official appointment method
    (both visible, neither hidden);
  - if any fresh report has `earliest_appointment_offered`, the latest such value as
    "Найближчий запис, про який повідомляли: <month year> (N звітів)".
- Older reports:
  - carry the label "застаріло";
  - are excluded from default counts;
  - are shown behind a toggle.

### Copy rules
- Never write "you can apply here", "document X is required", or any probability or score.
- Use "N користувачів повідомили…" and "Останній звіт: <date>".
- Every results page and location page shows:
  - a disclaimer ("Досвід спільноти, не юридична консультація");
  - a link to `OFFICIAL_INFO_URL`, which is an env/config value.
- Legal rules (the military-obligation requirement, the end date of protection) are never hardcoded in logic.
- The only place these legal rules appear is one editable info block, `content/legal-notice.uk.md`.
  Each statement in it carries its source link and check date.

## TELEGRAM MINI APP

### Single codebase
- The same Next.js routes serve both surfaces.
- Detect Telegram by the presence of `window.Telegram.WebApp.initData`.
  Load `https://telegram.org/js/telegram-web-app.js` only on client pages.
- Inside Telegram:
  - call `ready()` and `expand()`;
  - map `themeParams` to CSS variables;
  - use the native BackButton on non-root routes;
  - use MainButton for the primary action on forms
    ("Знайти", "Надіслати звіт").
- Outside Telegram, render normal in-page buttons.

### Deep links
- `startapp=loc_<location_id>` opens `/locations/<id>`.
- `startapp=search_<province_slug>` opens results for that province.
- Validate the param against `^[A-Za-z0-9_-]{1,64}$`. On mismatch, ignore it and open `/`.

### Bot
- Only what is needed to launch the Mini App: menu button + `/start` replying with an "Open app" button.
- No conversational logic, no broadcasts, no notifications in MVP.

### Share
- The location page offers two actions:
  - "Копіювати посилання": the web URL, which has Open Graph tags,
    so it expands in Telegram chats;
  - "Відкрити в Telegram": the `t.me` Mini App link with `startapp`.

## AUTH

### Browsing
- Browsing and search require no login, on both surfaces.

### Identity: Telegram only in MVP
- Inside the Mini App, the client sends raw `initData` to a server route. The server:
  - validates the HMAC with the bot token, per Telegram's Web App docs;
  - rejects `auth_date` older than 24 h.
- On the web, use the Telegram Login Widget. Validate it server-side per Telegram's docs.
- Both flows map to one user, keyed by `telegram_user_id`.
- Before implementing, re-read the current Telegram docs for both validation algorithms
  and cite the URLs in the README.

### Creating a Supabase session from a validated Telegram identity
- This is UNVERIFIED and is an architectural blocker.
- In Phase 1, before designing anything else that depends on auth:
  1. Read the current Supabase Auth docs. Cite every URL used.
  2. List 2–3 candidate approaches. For each: how the session is issued, how `auth.uid()`
     is populated, how refresh works, what breaks if Supabase changes its key model, and
     whether it is documented or a workaround.
  3. Recommend one, and stop for my approval.
- Constraints:
  - The session must be a real Supabase Auth session: a row in `auth.users` and tokens issued
    by Supabase Auth. A self-made JWT or cookie scheme that imitates Supabase Auth is not allowed.
  - RLS must work with `auth.uid()`.
  - The service-role key and bot token are used only in server code and never reach the client.
- If no documented approach meets these constraints, say so in BLOCKING QUESTIONS instead of
  inventing one.

### Stored identity data
- Store only: `telegram_user_id` (never rendered anywhere), `role`, `created_at`.
- Do not store Telegram username, first/last name or photo.
- Public author label on every report and comment is "Користувач". No display names,
  no public profile pages, no way to list all reports of one user publicly.
- Reason: `military_obligations_apply = yes` combined with "military document not requested"
  is sensitive. No public view may link two reports to the same person.

### Privacy policy
- `/privacy` in Ukrainian: what is stored, why, retention, deletion, contact.
- The data controller name and contact come from env/config (`PRIVACY_CONTROLLER_NAME`,
  `PRIVACY_CONTACT_EMAIL`). Do not invent them. If they are unset, the build fails.

### Account deletion
- `/me` has "Видалити акаунт".
- It deletes the profile, reports, comments, flags and suggestions of that user.
- Aggregates recompute from the remaining data.

## DATA MODEL (minimum)

Tables:

```
profiles(id = auth.users.id, telegram_user_id unique, role user|moderator, created_at)
procedures(code pk, label_uk, label_es, is_active)
location_procedures(location_id, procedure_code, pk(location_id, procedure_code))
policy_changes(id, procedure_code, effective_date, title_uk, source_url, created_at)
locations(id text pk from seed, name, type, region, province, province_slug, city, address,
          postal_code, phones text[], email, email_hidden bool, appointment_method,
          appointment_url, source_url, official_list_url, source_date, verified_at,
          verification_status, notes, moderation_status, created_by null, created_at, updated_at)
location_suggestions(id, location_id, field, current_value, proposed_value, user_id,
                     status pending|approved|rejected, created_at, reviewed_at)
document_types(code pk, label_uk, label_es, sort_order, is_active)
reports(id, location_id, procedure_code, user_id not null, event_date, outcome,
        appointment_type, earliest_appointment_offered, time_at_office, people_count,
        requested_list_complete, military_obligations_apply, comment, moderation_status,
        created_at, updated_at,
        unique(user_id, location_id, procedure_code, event_date))
report_documents(report_id, document_code, status requested|requested_missing|not_requested,
                 pk(report_id, document_code))
comments(id, report_id, user_id, body, moderation_status, created_at)
flags(id, target_type report|comment, target_id, user_id, reason, created_at,
      unique(user_id, target_type, target_id))
```

`moderation_status` values: `pending | published | flagged | rejected | hidden`.

Defaults:
- user-created locations: `pending`;
- reports and comments: `published`;
- a report or comment flagged by 3 or more distinct users becomes `flagged` via a trigger.
  A `flagged` item stays public but collapsed with the label "На перевірці", and is excluded
  from all counts, matches and badges. Only a moderator moves it to `published` or `hidden`.
  Nothing becomes `hidden` automatically.

Other rules:
- New locations submitted by users go to `pending` and must pass a duplicate check:
  same `province_slug` + normalized address, or same province + normalized name.

## ROUTES

```
/                     search: province + document checklist + optional military-obligations question
/results              ?province=&docs=&mil=  (state lives in the URL, shareable)
/locations            all published locations grouped by province
/locations/[id]       server-rendered, Open Graph meta, official block + community block
/reports/new          ?location=<id>
/locations/new        submit a missing location (pending)
/locations/[id]/suggest
/me                   own reports, comments, suggestions with moderation status; delete account
/about                disclaimer, sources, legal notice
/privacy              privacy policy
/api/auth/telegram    initData + Login Widget validation
```

## OUT OF SCOPE
- AI or chat assistant; conversational bot; notifications.
- Maps and geocoding.
- Spanish UI. The app must be i18n-ready: every UI string lives in `messages/uk.json`.
- Admin UI. Moderation happens in the Supabase dashboard.
- Scraping, file uploads, payments, analytics beyond Vercel defaults.
- Email or Google login.
- Any import or bulk entry of reports (including from Telegram chats).
- Follow-up reminders from the bot ("Як пройшло?"): planned for v2.
- UI for procedures other than temporary protection.
- Service catalog, ads, donations or any monetization.

## STATES AND EDGE CASES
- **Loading:** skeleton cards.
- **Empty province:** impossible with the seed. If it happens, show "Немає локацій" and a link to `/locations/new`.
- **Zero matching reports:** show locations anyway, with "Поки немає звітів з вашим набором документів" and a CTA to add a report.
- **Error:** human-readable message plus a retry button. Raw error text is never shown.
- **Result count:** one result has no layout gaps. More than 20 results paginate at 20 per page.
- **Pending requests:** submit buttons (and MainButton) are disabled and show progress while a request is in flight. A double tap creates one record.
- **Duplicate report (same location, procedure and date):** show a message with a link to the existing report.
- **Daily report limit reached:** show "Ліміт звітів на сьогодні вичерпано" and keep the form data.
- **Possible duplicate location:** warn and show the matching location before submit.
- **Invalid Telegram auth:** invalid or expired `initData` returns 401. The UI offers "Відкрити заново".
- **Mini App opened without `initData`:** e.g. the URL was opened in a plain browser. The app works as the web version.
- **Wrapping:** long addresses, comments and document lists wrap at 320 px. No horizontal scroll.
- **Telegram themes:** dark and light themes both keep text contrast ≥ 4.5:1.

## CONSTRAINTS
- **Accessibility:** WCAG 2.2 AA:
  - labelled controls;
  - visible focus;
  - errors linked via `aria-describedby`;
  - outcome shown as icon + text, never color alone;
  - every action reachable by keyboard on web.
- **Performance:** `/locations/[id]` and `/results` render server-side. Client JS for `/` is under 150 KB gzipped (report it from the build output).
- **Dependencies:** allowed without asking: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, one form library, `next-intl` (or an equivalent i18n library, named and justified in Phase 1). Anything else: ask first.
- **Secrets:** bot token and service-role key are server-only env vars. `.env.example` lists every variable with a comment.
- **Branding:** no third-party branding, logos or copied copy. No government logos.

## PHASE 1 OUTPUT (no app code)
Output exactly these sections, then stop and wait for my answer:
1. SCHEMA: SQL migration, including seed import from `seed/locations.csv`.
2. RLS POLICIES: SQL.
3. MATCHING FUNCTION: SQL, plus 3 example calls with expected output.
4. TELEGRAM AUTH DESIGN: validation steps with doc URLs; the chosen Supabase session approach with justification; the risks.
5. ROUTE MAP and component tree.
6. BLOCKING QUESTIONS: only questions that change the schema or the auth design. Maximum 3, each with a default.

## PHASE 2 OUTPUT
Deliver:
- migrations and seed;
- app code;
- bot setup notes (BotFather steps as a checklist);
- tests;
- `.env.example`;
- a README containing: setup, how to register the Mini App, how to moderate in the Supabase dashboard, and the doc URLs used.

Required tests:
- matching function (SQL or integration);
- RLS: anon and cross-user cases;
- Telegram `initData` validation: valid, tampered hash, expired `auth_date`;
- report form validation;
- seed import against `seed/locations.csv`.

## ACCEPTANCE CRITERIA (each yes/no)

### Data
- [ ] The seed test reads `seed/locations.csv` and asserts:
  - [ ] location rows in DB = CSV data rows, each CSV `id` present exactly once;
  - [ ] every `verified` or `official_2022` row is `published`; every `conflict` row is `pending`;
  - [ ] the current fixture expectation holds: 72 rows, 71 `published`, 1 `pending`.
    The test fails if the CSV no longer matches this, so the numbers are updated deliberately.
- [ ] Every seeded location is linked to `temporary_protection_application`.
- [ ] `policy_changes` is empty after seeding.
- [ ] All 52 provinces have at least one published location.
- [ ] Every email failing syntax or the domain allowlist has `email_hidden = true` and is not rendered anywhere (currently exactly 1).
- [ ] Every location page shows the official source date.

### Search and matching
- [ ] An anonymous user can search a province and open a location page, on web and inside Telegram.
- [ ] A search in a province with zero reports still lists all its published locations.
- [ ] Matching test with U = {international_passport, internal_passport_or_id_card}:
  - [ ] Report R = {international_passport}, `protection_granted`, 10 days ago → counted as a fresh match.
  - [ ] Report R = {international_passport, spanish_address_or_empadronamiento}, `protection_granted` → not a match; listed under "попросили більше документів" with empadronamiento.
  - [ ] Report R = {international_passport}, `turned_away` → not a match; shown as unsuccessful.
  - [ ] Report R = {international_passport}, `protection_granted`, 120 days ago → labelled "застаріло"; not in the default count.
  - [ ] Report with only `not_requested` rows plus `passport_photos` as `requested`,
    `requested_list_complete = true` → R is empty → counted as a match.
  - [ ] Same report with `requested_list_complete = false` → not a match; listed under
    "неповним списком"; its `not_requested` rows still count in "Не просили".
  - [ ] Report R = {international_passport, other}, successful, complete → not a match.
- [ ] Fixture "Lugo walk-in": location `comisaria-lugo`, `application_accepted_pending`,
  `walk_in`, `under_1h`, `people_count = 2`, `passport_photos` requested;
  `military_document_paper`, `military_document_reserve_plus`, `passport_exit_stamp`
  not_requested; `requested_list_complete = true`; `military_obligations_apply = yes`;
  submitted by two different test users.
  - [ ] The Lugo page shows the walk-in badge next to the official online (ICP)
    appointment method, and highlighted "Не просили" lines for those three codes.
  - [ ] With only one of the two reports present, the same lines render as plain text
    with "1 звіт" and no badge styling.
  - [ ] If both reports have `military_obligations_apply = no`, no "Не просили" line
    appears for the three military codes; the walk-in badge still appears.
- [ ] Policy change test: add a `policy_changes` row with `effective_date` = 5 days ago.
  A matching report from 10 days ago gets the "До зміни правил" label and leaves the
  default count; a matching report from 2 days ago stays counted.
- [ ] Search state is fully reproducible from the `/results` URL.

### Reports and moderation
- [ ] A report without `event_date`, `outcome` or at least one document entry is rejected by the DB.
- [ ] A report with a future `event_date` is rejected by the DB.
- [ ] A report whose `user_id` differs from `auth.uid()` is rejected by RLS (tested).
- [ ] A moderator cannot insert a report for another user (tested); a moderator can change `moderation_status`.
- [ ] No API route, script or UI accepts more than one report per request.
- [ ] A second report by the same user for the same location, procedure and `event_date` is rejected by the DB.
- [ ] Two reports by the same user for the same location and procedure with different `event_date` values are both accepted.
- [ ] A 6th report by the same user on the same day is rejected by the DB.
- [ ] A report flagged by 3 distinct users becomes `flagged`: still visible collapsed as "На перевірці",
  excluded from counts and matches, and not `hidden`.
- [ ] A location suggestion stores `current_value` equal to the location's value at submit time.
- [ ] The same user cannot flag the same item twice.
- [ ] A location suggestion is not publicly visible while `pending`.
- [ ] A user-submitted location is `pending` and not publicly listed.

### Security and privacy
- [ ] Anonymous inserts into reports, comments, flags, suggestions and locations are rejected by RLS (tested).
- [ ] User A cannot update or delete user B's report (tested).
- [ ] Tampered `initData` returns 401 (tested).
- [ ] `initData` with `auth_date` older than 24 h returns 401 (tested).
- [ ] No page or API response exposes `telegram_user_id`, Telegram username or photo.
- [ ] Every public report and comment shows the author as "Користувач"; no public route lists reports by user.
- [ ] `/privacy` exists; the build fails when `PRIVACY_CONTROLLER_NAME` or `PRIVACY_CONTACT_EMAIL` is unset.
- [ ] "Видалити акаунт" removes all of that user's rows. Aggregates on the affected location change accordingly.
- [ ] The service-role key and bot token do not appear in any client bundle (grep of `.next/static` returns nothing).

### Telegram Mini App
- [ ] Opening `t.me/<bot>/<app>?startapp=loc_<id>` lands on that location page.
- [ ] An invalid `startapp` value lands on `/`.
- [ ] The native BackButton is visible on non-root routes and hidden on `/`.
- [ ] The primary form action uses MainButton inside Telegram and an in-page button on web.
- [ ] Text contrast is ≥ 4.5:1 in both Telegram light and dark themes.

### UX and accessibility
- [ ] `/`, `/results` and `/locations/[id]` have no horizontal scroll at 320 px.
- [ ] Every outcome has a visible text label.
- [ ] Every interactive control has an accessible name.
- [ ] `/results` renders at most 20 cards per page.
- [ ] A double tap on submit creates exactly one record.
- [ ] Results and location pages show the disclaimer and `OFFICIAL_INFO_URL`.
- [ ] The home page shows the "Поділитися своїм досвідом" CTA without scrolling at 375 px.
- [ ] No UI string outside `messages/uk.json`, except content in `content/*.md`.

## FIRST ACTION
Do not write application code. Produce the Phase 1 output and stop.
