"""
Is a chat message about temporary protection in Spain?

A score, not a keyword list: one mention of "email" or "документ" is not
enough (that is how rentals, jobs and cita-selling ads got through), while
a message naming Резерв+, the ДПСУ certificate, a stamp or a sworn
translation almost certainly is. City names and procedure words add a
little; ads, rentals and jobs take a lot away.

Tuned on the community digests ("Города где требуют Резерв+ …"), which are
exactly what should come through. Words are matched at the start of a word
in Russian, Ukrainian and Spanish, so a stem ("справк") covers its forms.
"""

from __future__ import annotations

import re

# (points, stems). Each group counts once per message, however often it occurs.
_GROUPS: list[tuple[int, list[str]]] = [
    # What the protection procedure is about.
    (3, [r"резерв\s*\+?", r"reserv\+"]),
    (3, [r"довідк", r"справк"]),
    (3, [r"штамп", r"sello"]),
    (3, [r"мокр\w*\s+печат"]),
    (3, [r"хурад", r"jurad", r"присяжн"]),
    (3, [r"пересечени\w*\s+границ", r"перетин\w*\s+кордон", r"легальн\w*\s+(?:выезд|виїзд)", r"виїзд\w*\s+з\s+україн", r"выезд\w*\s+из\s+украин"]),
    (3, [r"временн\w*\s+защит", r"тимчасов\w*\s+захист", r"protecci[oó]n\s+temporal", r"тз(?!\w)"]),
    (3, [r"exento", r"aplazamiento", r"no\s+apto", r"военн\w*\s+учет", r"військов\w*\s+облік", r"воинск", r"мобилизац", r"мобілізац", r"отсрочк", r"відстрочк"]),
    (3, [r"сит[аиуеыо](?!\w)", r"cita(?!\w)", r"citas(?!\w)"]),
    (3, [r"комиссар", r"комисар", r"комісар", r"comisar", r"extranjer", r"полици", r"поліці", r"polic[ií]a", r"creade"]),
    (2, [r"защит", r"захист"]),
    (2, [r"huella", r"отпечат", r"відбит", r"tie(?!\w)", r"nie(?!\w)", r"resoluci[oó]n", r"резолюци", r"резолюці"]),
    # Context: where, how, to whom.
    (1, [r"мадрид", r"madrid", r"барселон", r"barcelon", r"валенси", r"валенсі", r"valenci", r"малаг", r"m[aá]laga",
         r"алікант", r"аликант", r"alicante", r"бильбао", r"більбао", r"bilbao", r"сарагос", r"zaragoza", r"севиль", r"севіль",
         r"sevill", r"гранад", r"granad", r"кордов", r"кордоб", r"c[oó]rdoba", r"толедо", r"toledo", r"таррагон", r"tarragon",
         r"тенериф", r"tenerif", r"мурси", r"мурсі", r"murcia", r"кастельон", r"castell[oó]n", r"вальядолид", r"вальядолід",
         r"valladolid", r"овьедо", r"ов.єдо", r"oviedo", r"пальм", r"майорк", r"мальорк", r"mallorca", r"луго", r"lugo",
         r"бадахос", r"badajoz", r"касерес", r"c[aá]ceres", r"альсир", r"alzira", r"гандия", r"гандія", r"gand[ií]a", r"патерн",
         r"paterna", r"сагунт", r"sagunt", r"тортос", r"tortosa", r"альбасет", r"albacet", r"кадис", r"кадіс", r"c[aá]diz",
         r"сан\s*себастьян", r"donostia", r"вильяреал", r"вільяреал", r"villarreal", r"теруэль", r"теруель", r"tэруэль", r"teruel",
         r"чиривель", r"xirivell", r"пуэрто", r"пуерто", r"puerto", r"адех", r"adeje", r"ов'єдо"]),
    (1, [r"e-?mail", r"имейл", r"мейл", r"пошт", r"почт"]),
    (1, [r"адрес\w*\s+(?:проживан|прожив)", r"падрон", r"empadron"]),
    (1, [r"очеред", r"черг", r"при[её]м", r"прийом", r"запис"]),
    (1, [r"отказ", r"відмов", r"отказа", r"denegad"]),
    (1, [r"документ", r"перевод", r"переклад", r"паспорт"]),
    (1, [r"мужчин", r"чоловік", r"женщин", r"жінк"]),
    (1, [r"\d+\s*(?:дней|днів|дня)"]),
    # Not about the procedure: ads, rentals, jobs, services for sale.
    (-4, [r"сдам", r"сдаю", r"сниму", r"здам", r"здаю", r"зніму", r"аренд", r"оренд", r"alquil", r"комнат", r"кімнат"]),
    (-4, [r"ваканси", r"вакансі", r"подработ", r"підробіт", r"ищу\s+работ", r"шукаю\s+робот", r"требуются", r"потрібні\s+працівн", r"зарплат"]),
    (-4, [r"продам", r"продаю", r"куплю", r"трансфер", r"перевоз", r"посылк", r"посилк", r"доставк", r"кредит", r"займ",
          r"скидк", r"знижк", r"розыгрыш", r"розіграш", r"реклам", r"маникюр", r"манікюр", r"ресниц", r"стрижк"]),
    (-4, [r"поможем", r"допоможемо", r"оформим", r"оформлю", r"услуг", r"послуг", r"гарант", r"под\s+ключ", r"cita\s*master"]),
    (-2, [r"цен[аы](?!\w)", r"ціна", r"стоимост", r"вартіст", r"€", r"евро", r"євро", r"\d+\s*eur"]),
]

_COMPILED = [
    (points, re.compile(r"(?<![\w])(?:" + "|".join(stems) + ")", re.IGNORECASE | re.UNICODE))
    for points, stems in _GROUPS
]

LEVELS = {
    # name: (minimum score, needs at least one 3-point term)
    "off": (None, False),
    "normal": (4, True),
    "strict": (6, True),
}


def score(text: str) -> tuple[int, bool, list[str]]:
    """(score, has a core term, the words that matched — for highlighting)."""
    total = 0
    core = False
    hits: list[str] = []
    for points, pattern in _COMPILED:
        found = [m.group(0) for m in pattern.finditer(text)]
        if not found:
            continue
        total += points
        if points >= 3:
            core = True
        if points > 0:
            hits.extend(found)
    return total, core, sorted(set(hits), key=len, reverse=True)


def is_relevant(text: str, level: str = "normal") -> tuple[bool, list[str]]:
    minimum, needs_core = LEVELS.get(level, LEVELS["normal"])
    total, core, hits = score(text)
    if minimum is None:
        return True, hits
    if len(text.strip()) < 20:
        return False, hits
    return total >= minimum and (core or not needs_core), hits
