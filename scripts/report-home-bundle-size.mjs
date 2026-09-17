/**
 * Reports the gzipped client-JS size for "/" after `next build`. Originally
 * enforced docs/SPEC.md's "under 150 KB gzipped" constraint; "/" now embeds
 * a Leaflet map (see src/components/home/LocationsMap.tsx), a deliberate,
 * user-requested tradeoff that pushes it over that number. This script is
 * informational only (never exits non-zero) — treat the 150KB line below as
 * a historical reference point, not a build gate.
 *
 * Sums: rootMainFiles (the App Router + React runtime shipped to every page)
 * + "/"'s own page-specific client chunks (from its client-reference-manifest).
 * Deliberately excludes `polyfillFiles`: Next.js serves those via
 * `<script nomodule>` for legacy browsers only (see
 * node_modules/next/dist/docs/03-architecture/supported-browsers.md) — any
 * browser modern enough to run this app (including Telegram's in-app
 * WebView) ignores that tag and never downloads it, so counting it would
 * measure a browser nobody in this product's audience actually uses.
 *
 * Usage: npm run build && node scripts/report-home-bundle-size.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const NEXT_DIR = path.resolve(process.cwd(), ".next");

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function gzipSize(relPath) {
  const abs = path.join(NEXT_DIR, relPath);
  if (!existsSync(abs)) return 0;
  return gzipSync(readFileSync(abs), { level: 9 }).length;
}

const buildManifest = readJson(path.join(NEXT_DIR, "server/app/page/build-manifest.json"));
const rootMainFiles = buildManifest.rootMainFiles;

const clientRefManifestPath = path.join(NEXT_DIR, "server/app/page_client-reference-manifest.js");
let pageSpecificFiles = [];
if (existsSync(clientRefManifestPath)) {
  const src = readFileSync(clientRefManifestPath, "utf8");
  pageSpecificFiles = [...new Set(src.match(/static\/chunks\/[a-zA-Z0-9_.-]*\.js/g) ?? [])];
}

const allFiles = [...new Set([...rootMainFiles, ...pageSpecificFiles])];
let total = 0;
for (const f of allFiles) {
  const size = gzipSize(f);
  total += size;
  console.log(`${f}: ${size} B gzip`);
}

const totalKb = (total / 1024).toFixed(1);
console.log(`\nTotal "/" client JS (gzip, modern browsers): ${total} B = ${totalKb} KB`);
console.log(`Budget: 150 KB — ${total <= 150 * 1024 ? "OK" : "OVER BUDGET"}`);
