import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { CITY_COORDINATES } from "./cityCoordinates";

/**
 * LocationsMap drops any location whose `city` is missing from the lookup —
 * silently, by design, so a new moderator-approved city cannot break the map.
 * That also means a seed-data swap can quietly delete markers, which is what
 * these tests catch. They need no database: the CSV is the seed's source.
 */
const seedRows = parse(readFileSync("seed/locations.csv", "utf8"), {
  columns: true,
  skip_empty_lines: true,
}) as { id: string; city: string; province: string; phone: string; verification_status: string }[];

describe("CITY_COORDINATES vs seed/locations.csv", () => {
  it("has an entry for every seeded city, so no marker is silently dropped", () => {
    const missing = [...new Set(seedRows.map((r) => r.city))].filter((city) => !(city in CITY_COORDINATES));
    expect(missing).toEqual([]);
  });

  it("has no entries left over from cities the seed no longer lists", () => {
    const seeded = new Set(seedRows.map((r) => r.city));
    expect(Object.keys(CITY_COORDINATES).filter((city) => !seeded.has(city))).toEqual([]);
  });

  it("places every city inside Spain's bounding box, Canaries and Melilla included", () => {
    for (const [city, [lat, lng]] of Object.entries(CITY_COORDINATES)) {
      expect(lat, city).toBeGreaterThan(27);
      expect(lat, city).toBeLessThan(44);
      expect(lng, city).toBeGreaterThan(-19);
      expect(lng, city).toBeLessThan(5);
    }
  });
});

describe("seed/locations.csv integrity", () => {
  it("has unique ids", () => {
    const ids = seedRows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all 52 provinces with at least one publishable row", () => {
    const publishable = seedRows.filter((r) => r.verification_status !== "conflict");
    expect(new Set(publishable.map((r) => r.province)).size).toBe(52);
  });

  it("stores phones as semicolon-separated E.164 numbers", () => {
    for (const row of seedRows) {
      if (!row.phone) continue;
      for (const phone of row.phone.split(";")) {
        expect(phone, `${row.id}: ${phone}`).toMatch(/^\+34\d{9}$/);
      }
    }
  });
});
