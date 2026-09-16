# seed/locations.csv — verification notes

Checked: 2026-09-15

## Coverage
72 rows: 4 CREADE + 68 National Police stations. Covers all 52 provinces
(Madrid, Barcelona and Alicante are served by CREADE; the official list routes
their appointments through the MISSM phone line).

## Reconciliation with the official Interior XLSX
File: Comisarias_proteccion_temporal.xlsx (interior.gob.es), 71 locality rows.
File metadata: created 2022-01-11, last modified 2022-03-30.

Result of automated diff (localities, phones, emails, appointment method):
- 68 police-station rows: exact match, 0 differences.
- 3 rows (Barcelona, Alicante, Madrid-Pozuelo) say "cita previa a través de MISSM";
  they are represented by the CREADE rows.
- Nothing in the XLSX is missing from the CSV; nothing in the CSV is absent from the XLSX.

Conclusion: the list the Ministry currently links has not been updated since March 2022.
It is the best official source available, but it is old and has no street addresses.

## verification_status
- `verified` (3) — CREADE Pozuelo, Barcelona, Torrevieja (current MISSM page).
- `conflict` (1) — CREADE Málaga. Two official MISSM pages give different addresses:
  - inclusion.gob.es: Av. del Pintor Joaquín Sorolla 145, 29017
  - seg-social.es mirror: Av. José Ortega y Gasset 20, 29006
  Confirm by phone (+34 628 216 478) before publishing.
- `official_2022` (68) — police stations; match the official XLSX dated 2022-03-30.
  Address field empty (not in the official source).

## Known issues present in the official file
- Teruel: email domain `polcia.es` (likely a typo of `policia.es`). Hide this email until confirmed.
- Cantabria: locality given as "CANTABRIA"; email points to Santander.
- Mallorca: locality given as "MALLORCA"; city not stated.
- Villarreal: same email as Castellón.
- Jefatura labels (not imported): Almería, Granada, Jaén, Málaga are "Andalucía Oriental" in the XLSX.

## Import rule
- `verified` and `official_2022` → `published`. UI must show "Official list, last updated 03/2022".
- `conflict` → `pending`.
- Addresses for police stations come only from user-submitted location edits (moderated)
  or from a future official source. Never fill them in by guessing.

## Legal context (for UI copy, not for logic)
- The EU extended temporary protection to 4 March 2028 (Council agreement July 2026;
  secondary sources cite Implementing Decision (EU) 2026/1912).
- New applicants subject to Ukrainian military obligations must prove compliance or exemption.
  The Spanish MISSM page mentions this requirement from August 2026.
- The MISSM page still states 4 March 2027 as the end date (not updated at time of check).
