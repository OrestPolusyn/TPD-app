import { describe, expect, it } from "vitest";
import { citiesIn, isRelevant, score } from "./relevance";

// The same samples as tools/chat-collector/test_relevance.py: both filters
// read one rules file and must agree.
const DIGEST = `Города где требуют Резерв+
даже при наличи легального выезда из Украины.
Бильбао - справку не признают. Нет штампа, смотрят Резерв+
Гранада - справка только с хурадо перпводом
Мадрид - Справка с мокрой печатью. Пересечение границы не позже 90 дней.
Где на 07.09.2026 для временной защиты нужна только печать или справка о пересечении границы.
Тэруэль - по email отвечают очень быстро. Необходима долгосрочная аренда, не хостел.`;

const RELEVANT = [
  DIGEST,
  "Сегодня в Мадриде у 2 человек защиту дали только по штампу в паспорте. Резерв+ не требовали.",
  "Вальядолид - сита только по email. Уже нет по живой очереди.",
  "Луго - без ситы, не требовали ни штамп, ни Резерв.",
  "В Малаге подали на ТЗ, справку с мокрой печатью приняли, Резерв+ не смотрели",
  "Сьогодні в поліції в Аліканте прийняли документи на тимчасовий захист зі штампом",
];

const NOISE = [
  "Привіт усім, хто знає гарного стоматолога в Валенсії?",
  "Сдам комнату в Валенсии, 400€ в месяц, документы для падрона дам",
  "Не удается схватить ситу? Cita Master — поможем записаться, гарантия результата!",
  "Требуются работники на склад в Мадрид, зарплата 1400 евро",
  "Дякую!",
  "Кто едет завтра в Барселону? Могу взять посылку",
  "Добрый день, подскажите, где купить сим-карту с интернетом?",
];

describe("chat relevance", () => {
  it.each(RELEVANT)("keeps a protection message: %s", (text) => {
    expect(isRelevant(text)).toBe(true);
  });

  it.each(NOISE)("drops noise: %s", (text) => {
    expect(isRelevant(text)).toBe(false);
  });

  it("keeps the city digest even when strict", () => {
    expect(isRelevant(DIGEST, "strict")).toBe(true);
  });

  it("matches Cyrillic word forms, which a plain JS \\w would miss", () => {
    expect(score("справка с мокрой печатью").hits).toContain("мокрой печат");
  });

  it("names the cities in the order a message mentions them", () => {
    expect(citiesIn("В Сарагосе, а потом в Мадриде")).toEqual(["Сарагоса", "Мадрид"]);
    expect(citiesIn("Пальма де Майорка — штамп")).toEqual(["Майорка"]);
    expect(citiesIn("без міста")).toEqual([]);
  });
});
