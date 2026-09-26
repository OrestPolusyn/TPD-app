/**
 * The ДПСУ border-crossing certificate guide: one source for the /guide/dovidka
 * page and the channel post.
 *
 * Only what the community chats have reported, dated. Nothing here is legal
 * advice or an official requirement, and where the chats did not say how
 * something is done (e.g. ordering the certificate without a lawyer) the
 * guide says so and asks, rather than filling the gap with a guess.
 */
export const GUIDE_AS_OF = "2026-09-25";

export interface GuideCity {
  locationId: string;
  label: string;
  note?: string;
}

export interface GuideCityGroup {
  title: string;
  cities: GuideCity[];
}

export const guideIntro =
  "Офіційна відповідь Державної прикордонної служби України з датами, коли ви перетинали кордон. Підтверджує виїзд з України після 24.02.2022, якщо в паспорті немає штампа.";

export const guideSections: { title: string; points: string[] }[] = [
  {
    title: "Як отримати",
    points: [
      "Найчастіше замовляють через адвоката (адвокатський запит до ДПСУ).",
      "Готова довідка приходить на e-mail у PDF з електронним підписом ДПСУ.",
      "Замовляли самостійно? Розкажіть як — кнопка «Знайшли неточність» унизу.",
    ],
  },
  {
    title: "Як показувати в поліції",
    points: [
      "Роздрукуйте PDF.",
      "Майте оригінальний PDF у телефоні: у поліції просять відкрити czo.gov.ua/verify, завантажити файл і показати результат перевірки підпису. Перевірте заздалегідь, що все відкривається.",
      "Адвокати радять мати PDF ще й на флешці.",
    ],
  },
  {
    title: "Термін дії",
    points: [
      "Довідка фіксує дати в минулому, тож окремого «терміну придатності» не має.",
      "«Дійсна до …» у документі — це строк дозволу на підпис, а не строк дії самої довідки.",
      "Але зважайте: відділок може хотіти, щоб після дати видачі не було нових перетинів кордону.",
    ],
  },
];

export const guideCityGroups: GuideCityGroup[] = [
  {
    title: "Потрібна мокра печатка",
    cities: [
      { locationId: "comisaria-malaga", label: "Малага" },
    ],
  },
  {
    title: "Потрібен присяжний переклад (traducción jurada)",
    cities: [
      { locationId: "comisaria-granada", label: "Гранада" },
      { locationId: "comisaria-cordoba", label: "Кордова", note: "і довідка, і Резерв+" },
      { locationId: "comisaria-sevilla", label: "Севілья" },
      { locationId: "comisaria-santa-cruz-de-tenerife", label: "Санта-Крус-де-Тенерифе" },
      { locationId: "comisaria-puerto-de-la-cruz", label: "Пуерто-де-ла-Крус" },
      { locationId: "comisaria-adeje", label: "Адехе" },
      { locationId: "comisaria-oviedo", label: "Ов'єдо", note: "усі документи — офіційна відповідь поліції (25.09)" },
    ],
  },
  {
    title: "Приймали без перекладу чи мокрої печатки",
    cities: [
      { locationId: "comisaria-alicante", label: "Аліканте", note: "переклад не взяли, дивились перевірку підпису (16.09)" },
      { locationId: "comisaria-barcelona", label: "Барселона", note: "роздруківка без мокрої печатки (23.09)" },
    ],
  },
  {
    title: "Довідку не визнають — потрібен штамп",
    cities: [
      { locationId: "comisaria-pozuelo-de-alarcon", label: "Мадрид", note: "з 25.09 — навіть з мокрою печаткою; довідку з QR-кодом не приймали й раніше" },
      { locationId: "comisaria-bilbao", label: "Більбао" },
    ],
  },
];

/** The channel version: the few lines people actually need, then a link. */
export function guidePostText(): string {
  const [wet, sworn, , rejected] = guideCityGroups;
  const names = (g: GuideCityGroup) => g.cities.map((c) => c.label).join(", ");
  return [
    "📌 Довідка ДПСУ про перетин кордону — коротко",
    "",
    "• Показуйте роздруківку + перевірку PDF на czo.gov.ua/verify зі свого телефона",
    `• Мокра печатка: ${names(wet)}`,
    `• Присяжний переклад: ${names(sworn)}`,
    `• Не визнають (потрібен штамп): ${names(rejected)}`,
    "• «Дійсна до» — строк дозволу на підпис, не самої довідки",
    "",
    "Усе докладно — кнопка «Детальніше». Щось змінилось — «✏️ Змінилось».",
    "#довідки",
  ].join("\n");
}
