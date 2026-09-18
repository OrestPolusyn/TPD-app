import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeForSearch } from "./searchText";

describe("normalizeForSearch", () => {
  it("folds diacritics and case", () => {
    expect(normalizeForSearch("Málaga")).toBe("malaga");
    expect(normalizeForSearch("  A Coruña ")).toBe("a coruna");
  });

  it("keeps Cyrillic, unlike slugify()", () => {
    expect(normalizeForSearch("Приватність")).toBe("приватність");
  });
});

describe("matchesQuery", () => {
  it("matches an empty query against anything", () => {
    expect(matchesQuery("", "whatever")).toBe(true);
    expect(matchesQuery("   ", "whatever")).toBe(true);
  });

  it("ignores accents in either direction", () => {
    expect(matchesQuery("malaga", "CREADE Málaga")).toBe(true);
    expect(matchesQuery("Málaga", "creade malaga")).toBe(true);
  });

  it("matches terms in any order and across fields", () => {
    expect(matchesQuery("alicante cnp", "CNP Alicante NIE", "Alicante")).toBe(true);
    expect(matchesQuery("cnp elche", "CNP Elche", "Elche")).toBe(true);
  });

  it("requires every term to be present", () => {
    expect(matchesQuery("cnp valencia", "CNP Elche", "Elche")).toBe(false);
  });

  it("skips null and undefined fields", () => {
    expect(matchesQuery("elche", null, undefined, "CNP Elche")).toBe(true);
  });
});
