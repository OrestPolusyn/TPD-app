import { describe, expect, it } from "vitest";
import type { LocationRow } from "@/lib/matching/types";
import { toProvinceGroups } from "./locations";

function row(overrides: Partial<LocationRow>): LocationRow {
  return {
    id: "x",
    name: "Office",
    type: "police_station",
    region: "Andalucía",
    province: "Almería",
    province_slug: "almeria",
    city: "Almería",
    address: null,
    postal_code: null,
    phones: [],
    email: null,
    email_hidden: false,
    appointment_method: "phone",
    appointment_url: null,
    source_url: "https://example.test",
    official_list_url: null,
    source_date: null,
    verified_at: "2026-09-15",
    verification_status: "official_2022",
    notes: null,
    ...overrides,
  } as LocationRow;
}

describe("toProvinceGroups", () => {
  it("returns one group per province, carrying the slug and region from its rows", () => {
    const grouped = new Map<string, LocationRow[]>([
      ["Almería", [row({ id: "a1" })]],
      [
        "Murcia",
        [
          row({ id: "m1", province: "Murcia", province_slug: "murcia", region: "Región de Murcia", city: "Murcia" }),
          row({ id: "m2", province: "Murcia", province_slug: "murcia", region: "Región de Murcia", city: "Lorca" }),
        ],
      ],
    ]);

    const groups = toProvinceGroups(grouped);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ province: "Almería", provinceSlug: "almeria", region: "Andalucía" });
    expect(groups[1]).toMatchObject({ province: "Murcia", provinceSlug: "murcia", region: "Región de Murcia" });
    expect(groups[1].offices.map((o) => o.id)).toEqual(["m1", "m2"]);
  });

  it("sorts provinces the Spanish way, so accents do not fall to the end", () => {
    const grouped = new Map<string, LocationRow[]>([
      ["Zaragoza", [row({ province: "Zaragoza", province_slug: "zaragoza" })]],
      ["Ávila", [row({ province: "Ávila", province_slug: "avila" })]],
      ["Badajoz", [row({ province: "Badajoz", province_slug: "badajoz" })]],
    ]);

    expect(toProvinceGroups(grouped).map((g) => g.province)).toEqual(["Ávila", "Badajoz", "Zaragoza"]);
  });

  it("never yields a province with no offices — the old picker's dead end", () => {
    const grouped = new Map<string, LocationRow[]>([
      ["Almería", []],
      ["Murcia", [row({ id: "m1", province: "Murcia", province_slug: "murcia" })]],
    ]);

    const groups = toProvinceGroups(grouped);
    expect(groups.map((g) => g.province)).toEqual(["Murcia"]);
    expect(groups.every((g) => g.offices.length > 0)).toBe(true);
  });

  it("returns an empty array for no published locations, which drives the empty state", () => {
    expect(toProvinceGroups(new Map())).toEqual([]);
  });

  it("keeps only the fields the list renders", () => {
    const groups = toProvinceGroups(new Map([["Almería", [row({ id: "a1", address: "Calle X, 1" })]]]));
    expect(Object.keys(groups[0].offices[0]).sort()).toEqual(["address", "city", "id", "name", "type"]);
  });
});
