# seed/locations.csv — verification notes

Checked: 2026-09-18

## Coverage
70 rows: 4 CREADE + 66 National Police localities. Covers all 52 provinces.
Six rows carry a street address (the 4 CREADE rows plus Alicante and
Barcelona); the official comisarías list gives an address for those two only.

## Source
Police localities: <https://ucraniaurgente.inclusion.gob.es/listado-de-comisarias>
(MISSM), table "Comisarías" with columns COMUNIDAD AUTONOMA / JEFATURA /
LOCALIDAD / MODALIDAD CITA PREVIA. Transcribed verbatim — phones normalised to
`+34XXXXXXXXX`, nothing added.

CREADE: <https://ucraniaurgente.inclusion.gob.es/proteccion-temporal1>. **These
four rows were not re-verified in this pass** — the comisarías table carries no
CREADE addresses, so they keep their earlier provenance (`source_date` 2026,
`verified_at` 2026-09-15). Re-check them when that page is next read.

## What changed from the previous version of this file
The previous 68 police rows came from the Interior XLSX
(`Comisarias_proteccion_temporal.xlsx`, last modified 2022-03-30), which had no
street addresses and had not been updated since March 2022. The current MISSM
list supersedes it. Net effect:

- removed 6 localities the current list no longer names: `comisaria-murcia`,
  `comisaria-cartagena`, `comisaria-alcantarilla`, `comisaria-molina-de-segura`,
  `comisaria-yecla` (Región de Murcia now lists Lorca only) and
  `comisaria-cantabria` (superseded by `comisaria-santander`);
- added 4: `comisaria-alicante` (with an address — the old list routed the whole
  province through CREADE Torrevieja), `comisaria-barcelona` (with an address and
  opening hours), `comisaria-pozuelo-de-alarcon`, `comisaria-santander`;
- 20 localities now book through the Sede Electrónica `icpplus` directory rather
  than by phone or email.

`npm run seed` hides the removed ids rather than deleting them, so community
reports attached to them survive — see the retirement step in `scripts/seed.ts`.

## verification_status
- `verified` (69) — 66 police localities from the current MISSM list, plus
  CREADE Pozuelo, Barcelona and Torrevieja.
- `conflict` (1) — CREADE Málaga. Two official MISSM pages give different
  addresses:
  - inclusion.gob.es: Av. del Pintor Joaquín Sorolla 145, 29017
  - seg-social.es mirror: Av. José Ortega y Gasset 20, 29006
  Confirm by phone (+34 628 216 478) before publishing.
- `official_2022` — no longer used by any row. The enum value and its UI label
  stay in place; `OfficialBlock` uses that branch as its fallback.

## Known issues present in the official list (recorded in each row's `notes`)
- Teruel: email domain `polcia.es`, a likely typo of `policia.es`. The DB
  trigger hides it because the domain is not in
  `app_config.allowed_official_email_domains`.
- Cantabria: LOCALIDAD given as "CANTABRIA"; the email points to Santander, so
  the row's `city` is Santander.
- Mallorca: LOCALIDAD given as "MALLORCA", no town stated.
- Villarreal / Castellón: share one email address.
- Ourense and San Sebastián / Vitoria are spelled "ORENSE", "SAN SEBASTIAN" and
  "VITORIA" in the source.
- The JEFATURA cell for all nine Andalusian localities reads "ANDALUCÍA
  OCCIDENTAL", including the four eastern provinces. Jefatura is not imported;
  `region`/`province` are recorded per province.
- Málaga and Madrid-Pozuelo de Alarcón appear both as police localities (booking
  "a través del MISSM") and as CREADE rows, with the same phone numbers. Both are
  kept, because both appear on official pages, and each row's `notes` points at
  the other.
- Spellings on the Cita Previa portal differ from this list (e.g. Alicante is
  offered there as "CNP Alicante NIE", "CNP Alicante TIE", "OEX ALICANTE" and
  eleven more). Those are booking-system entries for several trámites at one
  jefatura, not separate official locations, and are deliberately not imported.

## Import rule
- `verified` → `published`; `conflict` → `pending`.
- Addresses come only from an official source or a moderated user edit. Never
  fill one in by guessing.

## Legal context (for UI copy, not for logic)
- The EU extended temporary protection to 4 March 2028 (Council agreement July
  2026; secondary sources cite Implementing Decision (EU) 2026/1912).
- New applicants subject to Ukrainian military obligations must prove compliance
  or exemption. The Spanish MISSM page mentions this requirement from August 2026.
- The MISSM page still states 4 March 2027 as the end date (not updated at time
  of check).
