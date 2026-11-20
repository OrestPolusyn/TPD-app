import { describe, expect, it } from "vitest";
import { navPostText } from "./navPost";

describe("navigation post", () => {
  it("lists city hashtags the way posts carry them, most written-about first", () => {
    const text = navPostText(["Zaragoza", "Pozuelo de Alarcón", "Gijón", "Zaragoza"]);
    expect(text).toContain("#Сарагоса #Мадрид #Хіхон");
    expect(text).toContain("#не_підтверджено");
    expect(text).not.toContain("Інші міста");
  });

  it("sorts the less frequent cities alphabetically under their own heading", () => {
    const top = ["Zaragoza", "Pozuelo de Alarcón", "Málaga", "Gijón", "Alicante", "Valencia", "Granada", "Barcelona", "Mallorca", "Lugo"];
    const text = navPostText([...top, "Teruel", "Bilbao"]);
    expect(text).toContain("<b>Інші міста:</b>\n#Більбао #Теруель");
  });
});
