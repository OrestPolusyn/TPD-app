/**
 * Ukrainian names for the cities offices are in, for Telegram posts and
 * notices. "Pozuelo de Alarcón" means nothing to someone looking for Madrid,
 * so towns outside a provincial capital carry the place people know in
 * brackets.
 */
const CITY_UK: Record<string, string> = {
  "A Coruña": "А-Корунья",
  Adeje: "Адехе (Тенерифе)",
  Albacete: "Альбасете",
  Alcantarilla: "Алькантарілья (Мурсія)",
  Algeciras: "Альхесірас (Кадіс)",
  Alicante: "Аліканте",
  Almería: "Альмерія",
  Alzira: "Альсіра (Валенсія)",
  Arrecife: "Арресіфе (Лансароте)",
  Ávila: "Авіла",
  Badajoz: "Бадахос",
  Barcelona: "Барселона",
  Bilbao: "Більбао",
  Burgos: "Бургос",
  Cáceres: "Касерес",
  Cádiz: "Кадіс",
  Cantabria: "Кантабрія",
  Cartagena: "Картахена (Мурсія)",
  "Castellón de la Plana": "Кастельйон",
  Ceuta: "Сеута",
  "Ciudad Real": "Сьюдад-Реаль",
  Córdoba: "Кордова",
  Cuenca: "Куенка",
  Ferrol: "Ферроль (А-Корунья)",
  Gandia: "Гандія (Валенсія)",
  Gijón: "Хіхон (Астурія)",
  Girona: "Жирона",
  Granada: "Гранада",
  Guadalajara: "Гвадалахара",
  Huelva: "Уельва",
  Huesca: "Уеска",
  Ibiza: "Ібіца (Балеари)",
  Jaén: "Хаен",
  "Las Palmas de Gran Canaria": "Лас-Пальмас (Гран-Канарія)",
  León: "Леон",
  Lleida: "Льєйда",
  Logroño: "Логроньо",
  Lorca: "Лорка (Мурсія)",
  Lugo: "Луго",
  Mahón: "Маон (Менорка)",
  Málaga: "Малага",
  Mallorca: "Пальма (Мальорка)",
  Melilla: "Мелілья",
  "Molina de Segura": "Моліна-де-Сегура (Мурсія)",
  Murcia: "Мурсія",
  Ourense: "Оуренсе",
  Oviedo: "Ов'єдо (Астурія)",
  Palencia: "Паленсія",
  Pamplona: "Памплона",
  Paterna: "Патерна (Валенсія)",
  Pontevedra: "Понтеведра",
  "Pozuelo de Alarcón": "Мадрид (Посуело-де-Аларкон)",
  "Puerto de la Cruz": "Пуерто-де-ла-Крус (Тенерифе)",
  "Puerto del Rosario": "Пуерто-дель-Росаріо (Фуертевентура)",
  Reus: "Реус (Таррагона)",
  Sagunto: "Сагунто (Валенсія)",
  Salamanca: "Саламанка",
  "San Sebastián": "Сан-Себастьян",
  "Santa Cruz de Tenerife": "Санта-Крус-де-Тенерифе",
  Santander: "Сантандер",
  "Santiago de Compostela": "Сантьяго-де-Компостела",
  Segovia: "Сеговія",
  Sevilla: "Севілья",
  Soria: "Сорія",
  Tarragona: "Таррагона",
  Teruel: "Теруель",
  Toledo: "Толедо",
  Torrevieja: "Торрев'єха (Аліканте)",
  Tortosa: "Тортоса (Таррагона)",
  Tudela: "Тудела (Наварра)",
  Tui: "Туй (Понтеведра)",
  Valencia: "Валенсія",
  Valladolid: "Вальядолід",
  Vigo: "Віго (Понтеведра)",
  Villarreal: "Вільяреал (Кастельйон)",
  "Vitoria-Gasteiz": "Віторія",
  Xirivella: "Шірівелья (Валенсія)",
  Yecla: "Єкла (Мурсія)",
  Zamora: "Самора",
  Zaragoza: "Сарагоса",
};

/** "Мадрид (Посуело-де-Аларкон)"; an unknown city falls back to itself. */
export function cityUk(city: string): string {
  return CITY_UK[city] ?? city;
}

/** "#Мадрид", "#Альсіра" — the place before any bracket, letters only. */
export function cityHashtagUk(city: string): string {
  const base = cityUk(city).split(" (")[0];
  return `#${base.replace(/[^\p{L}\p{N}]/gu, "")}`;
}

/** Every city the table knows, for the completeness test. */
export const KNOWN_CITIES = Object.keys(CITY_UK);
