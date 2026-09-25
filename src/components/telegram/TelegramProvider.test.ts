import { describe, it, expect } from "vitest";
import { resolveDeepLink } from "./TelegramProvider";

describe("resolveDeepLink", () => {
  it("resolves a loc_ startapp param to /locations/<id>", () => {
    expect(resolveDeepLink("loc_comisaria-lugo")).toBe("/locations/comisaria-lugo");
  });

  it("resolves a report_ startapp param to that office's report form", () => {
    expect(resolveDeepLink("report_comisaria-alicante")).toBe("/reports/new?location=comisaria-alicante");
    expect(resolveDeepLink("report_")).toBeNull();
  });

  it("resolves a search_ startapp param to /results?province=<slug>", () => {
    expect(resolveDeepLink("search_madrid")).toBe("/results?province=madrid");
  });

  it("ignores an undefined param", () => {
    expect(resolveDeepLink(undefined)).toBeNull();
  });

  it("ignores a param with no recognized prefix", () => {
    expect(resolveDeepLink("unknown_thing")).toBeNull();
  });

  it("ignores a param that fails the ^[A-Za-z0-9_-]{1,64}$ regex (bad characters)", () => {
    expect(resolveDeepLink("loc_../../etc/passwd")).toBeNull();
    expect(resolveDeepLink("loc_<script>")).toBeNull();
    expect(resolveDeepLink("search_madrid;drop table")).toBeNull();
  });

  it("ignores a param over 64 characters", () => {
    expect(resolveDeepLink(`loc_${"a".repeat(65)}`)).toBeNull();
  });

  it("ignores a bare prefix with no id/slug", () => {
    expect(resolveDeepLink("loc_")).toBeNull();
    expect(resolveDeepLink("search_")).toBeNull();
  });
});
