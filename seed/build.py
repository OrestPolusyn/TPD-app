import csv, re
from collections import Counter

# Current official sources, checked 2026-09-18.
LISTADO = "https://ucraniaurgente.inclusion.gob.es/listado-de-comisarias"
MISSM = "https://ucraniaurgente.inclusion.gob.es/proteccion-temporal1"
MISSM_OLD = "https://ucraniaurgente.inclusion.gob.es/w/tramites-proteccion-temporal-desplazados-ucrania"
MISSM_MIRROR = "https://ucraniaurgente.seg-social.es/w/tramites-proteccion-temporal-desplazados-ucrania"
# The exact link the "MODALIDAD CITA PREVIA" column points at.
ICP = "https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus"

FIELDS = ["id","name","type","region","province","city","address","postal_code","phone","email",
          "appointment_method","appointment_url","source_url","official_list_url","source_date",
          "verified_at","verification_status","notes"]

VERIFIED_AT = "2026-09-18"
SOURCE_DATE = "2026-09-18"

def slug(s):
    s = s.lower()
    for a, b in (("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ñ","n"),("ü","u"),("à","a"),("è","e")):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def tel(*nums):
    """Normalise to +34XXXXXXXXX. The page mixes national spacing ("956 588 424",
    "93 238 21 99") with numbers that already carry the country code
    ("+34 628 216 478"), so strip a leading 34 before prefixing."""
    out = []
    for n in nums:
        if not n:
            continue
        d = re.sub(r"\D", "", n)
        if len(d) == 11 and d.startswith("34"):
            d = d[2:]
        assert len(d) == 9, f"unexpected phone {n!r} -> {d!r}"
        out.append("+34" + d)
    return ";".join(out)

# Appointment modality, exactly as the "MODALIDAD CITA PREVIA" column gives it.
I = ("icp", "", "")                                   # link to the icpplus directory
def P(phones="", email=""): return ("contact", phones, email)

# (region, province, city, modality, address, postal_code, note)
# `city` is the LOCALIDAD column; where that column names a province rather than
# a town, the real town is used so the map can place it and `note` records the
# discrepancy.
rows_src = [
 # ANDALUCÍA — jefatura "ANDALUCÍA OCCIDENTAL" on the page, which also covers
 # the four eastern provinces; recorded per province as the app groups by province.
 ("Andalucía","Cádiz","Algeciras",P(tel("956 588 424"),"algeciras.ucrif3@policia.es"),"","",""),
 ("Andalucía","Cádiz","Cádiz",P(tel("956 297 560"),"cadiz.asilo@policia.es"),"","",""),
 ("Andalucía","Córdoba","Córdoba",P(tel("957 594 725")),"","",""),
 ("Andalucía","Huelva","Huelva",P(tel("959 541 922"),"huelva.asilos@policia.es"),"","",""),
 ("Andalucía","Sevilla","Sevilla",I,"","",""),
 ("Andalucía","Almería","Almería",P(tel("950 623 105"),"almeria.bdep@policia.es"),"","",""),
 ("Andalucía","Málaga","Málaga",P(tel("+34 628 216 478")),"","",
  "Офіційний список: запис через MISSM. Це той самий номер, що й у CREADE Málaga — див. локацію «CREADE Málaga»."),
 ("Andalucía","Granada","Granada",P(tel("958 808 178","958 808 532")),"","",""),
 ("Andalucía","Jaén","Jaén",P(tel("953 295 318","953 295 311")),"","",""),
 # ARAGÓN
 ("Aragón","Huesca","Huesca",P("","huesca.ucrania@policia.es"),"","",""),
 ("Aragón","Teruel","Teruel",P("","teruel.bped@polcia.es"),"","",
  "Адресу e-mail наведено так, як в офіційному списку («polcia.es») — імовірна друкарська помилка джерела."),
 ("Aragón","Zaragoza","Zaragoza",P("","zaragoza.udeye@policia.es"),"","",""),
 # PRINCIPADO DE ASTURIAS
 ("Asturias","Asturias","Gijón",I,"","",""),
 ("Asturias","Asturias","Oviedo",I,"","",""),
 # ILLES BALEARS
 ("Illes Balears","Illes Balears","Ibiza",P(tel("971 398 831")),"","",""),
 ("Illes Balears","Illes Balears","Mahón",P(tel("971 363 712")),"","",""),
 ("Illes Balears","Illes Balears","Mallorca",I,"","",
  "В офіційному списку локацію названо «MALLORCA» без конкретного міста."),
 # ISLAS CANARIAS
 ("Canarias","Las Palmas","Arrecife",P(tel("928 844 000","928 844 299"),"arrecife.documentacion@policia.es"),"","",""),
 ("Canarias","Las Palmas","Las Palmas de Gran Canaria",P(tel("928 304 660"),"laspalmas.protecciontemporal@policia.es"),"","",""),
 ("Canarias","Las Palmas","Puerto del Rosario",P(tel("928 855 924"),"prosario.extdoc@policia.es"),"","",""),
 ("Canarias","Santa Cruz de Tenerife","Santa Cruz de Tenerife",P(tel("922 235 635"),"sctenerife.citaudex@policia.es"),"","",""),
 # CANTABRIA
 ("Cantabria","Cantabria","Santander",P(tel("942 361 120"),"santander.protecciontemporal@policia.es"),"","",
  "В офіційному списку локацію названо «CANTABRIA»; e-mail вказує на Сантандер."),
 # CASTILLA-LA MANCHA
 ("Castilla-La Mancha","Albacete","Albacete",P("","albacete.asilo@policia.es"),"","",""),
 ("Castilla-La Mancha","Ciudad Real","Ciudad Real",P(tel("926 277 903","926 277 926"),"ciudadreal.extranjeria@policia.es"),"","",""),
 ("Castilla-La Mancha","Cuenca","Cuenca",P(tel("969 240 795"),"cuenca.bped@policia.es"),"","",""),
 ("Castilla-La Mancha","Guadalajara","Guadalajara",I,"","",""),
 ("Castilla-La Mancha","Toledo","Toledo",P("","toledo.desplazados_ucrania@policia.es"),"","",""),
 # CASTILLA Y LEÓN
 ("Castilla y León","Ávila","Ávila",I,"","",""),
 ("Castilla y León","Burgos","Burgos",P(tel("947 282 345")),"","",""),
 ("Castilla y León","León","León",P(tel("987 218 907","987 218 908","987 218 965")),"","",""),
 ("Castilla y León","Palencia","Palencia",P(tel("979 167 415","979 167 412")),"","",""),
 ("Castilla y León","Salamanca","Salamanca",P(tel("923 127 709","923 127 779")),"","",""),
 ("Castilla y León","Segovia","Segovia",P(tel("921 414 705")),"","",""),
 ("Castilla y León","Soria","Soria",P(tel("975 239 332")),"","",""),
 ("Castilla y León","Valladolid","Valladolid",P(tel("983 456 526")),"","",""),
 ("Castilla y León","Zamora","Zamora",P(tel("980 509 266")),"","",""),
 # CATALUÑA
 ("Cataluña","Barcelona","Barcelona",P(tel("93 238 21 99")),"Calle Guadalajara, 1-3","",
  "Приймають з тимчасового захисту: пн-чт, 9:00-14:00, лише за попереднім записом через CREADE."),
 ("Cataluña","Girona","Girona",I,"","",""),
 ("Cataluña","Lleida","Lleida",P(tel("973 728 500")),"","",""),
 ("Cataluña","Tarragona","Reus",I,"","",""),
 ("Cataluña","Tarragona","Tarragona",I,"","",""),
 ("Cataluña","Tarragona","Tortosa",I,"","",""),
 # CEUTA
 ("Ceuta","Ceuta","Ceuta",I,"","",""),
 # COMUNITAT VALENCIANA
 ("Comunitat Valenciana","Castellón","Castellón de la Plana",P("","castellon.protecciontemporal@policia.es"),"","",
  "В офіційному списку локацію названо «CASTELLON»."),
 ("Comunitat Valenciana","Alicante","Alicante",P(tel("965019300")),
  "Calle Ebanistería (Polígono de Babel), 4 y 6","03071",""),
 ("Comunitat Valenciana","Valencia","Valencia",P("","valencia.proteccioninternacional1@policia.es"),"","",""),
 ("Comunitat Valenciana","Castellón","Villarreal",P("","castellon.protecciontemporal@policia.es"),"","",
  "Спільна адреса e-mail з комісаріатом Кастельона."),
 # EXTREMADURA
 ("Extremadura","Badajoz","Badajoz",P(tel("924 205 494"),"badajoz.bped@policia.es"),"","",""),
 ("Extremadura","Cáceres","Cáceres",P(tel("927 626 525")),"","",""),
 # GALICIA
 ("Galicia","A Coruña","Ferrol",I,"","",""),
 ("Galicia","A Coruña","A Coruña",I,"","",""),
 ("Galicia","Lugo","Lugo",I,"","",""),
 ("Galicia","Ourense","Ourense",P(tel("988 391 830"),"orense.bped@policia.es"),"","",
  "В офіційному списку локацію названо «ORENSE» (кастильською)."),
 ("Galicia","Pontevedra","Pontevedra",P(tel("986 868 327","986 868 847")),"","",""),
 ("Galicia","A Coruña","Santiago de Compostela",I,"","",""),
 ("Galicia","Pontevedra","Tui",P(tel("986 619 703")),"","",""),
 ("Galicia","Pontevedra","Vigo",P(tel("986 820 687")),"","",""),
 # LA RIOJA
 ("La Rioja","La Rioja","Logroño",I,"","",""),
 # COMUNIDAD DE MADRID
 ("Comunidad de Madrid","Madrid","Pozuelo de Alarcón",P(tel("+34666800194")),"","",
  "Офіційний список: запис через MISSM. Це той самий номер, що й у CREADE Pozuelo de Alarcón — див. ту локацію."),
 # MELILLA
 ("Melilla","Melilla","Melilla",P(tel("952 696 391")),"","",""),
 # REGIÓN DE MURCIA
 ("Región de Murcia","Murcia","Lorca",P(tel("968 477 278")),"","",""),
 # COMUNIDAD FORAL DE NAVARRA
 ("Navarra","Navarra","Tudela",P(tel("948 827 450")),"","",""),
 ("Navarra","Navarra","Pamplona",I,"","",""),
 # PAÍS VASCO
 ("País Vasco","Bizkaia","Bilbao",I,"","",""),
 ("País Vasco","Gipuzkoa","San Sebastián",I,"","",
  "В офіційному списку локацію названо «SAN SEBASTIAN»."),
 ("País Vasco","Araba/Álava","Vitoria-Gasteiz",I,"","",
  "В офіційному списку локацію названо «VITORIA»."),
]

out = []

# CREADE — from the MISSM protección temporal page. Not re-verified in this
# pass: the comisarías list does not carry CREADE addresses, so these rows keep
# their previous provenance and dates.
creade = [
 ("creade-pozuelo","CREADE Pozuelo de Alarcón","Comunidad de Madrid","Madrid","Pozuelo de Alarcón",
  "Paseo de la Casa de Campo, 1","28223","+34666800194;+34913990009","verified",""),
 ("creade-barcelona","CREADE Barcelona","Cataluña","Barcelona","Barcelona",
  "Calle de Sant Fructuós, 78-80","08004","+34932382199;+34913990009","verified",""),
 ("creade-torrevieja","CREADE Alicante (Torrevieja)","Comunitat Valenciana","Alicante","Torrevieja",
  "Calle Urbano Arregui, 8","03185","+34913990009","verified",
  "Local phone not listed on source page; general line only."),
 ("creade-malaga","CREADE Málaga","Andalucía","Málaga","Málaga",
  "Avenida del Pintor Joaquín Sorolla, 145","29017","+34628216478;+34913990009","conflict",
  "ADDRESS CONFLICT: inclusion.gob.es shows Av. Pintor Joaquín Sorolla 145, 29017; mirror seg-social.es shows Av. José Ortega y Gasset 20, 29006. Confirm by phone before publishing."),
]
for cid, name, reg, prov, city, addr, pc, phone, status, note in creade:
    out.append(dict(id=cid, name=name, type="creade", region=reg, province=prov, city=city, address=addr,
        postal_code=pc, phone=phone, email="", appointment_method="phone", appointment_url="",
        source_url=MISSM if cid != "creade-malaga" else MISSM_OLD + " ; " + MISSM_MIRROR,
        official_list_url="", source_date="2026", verified_at="2026-09-15",
        verification_status=status, notes=note))

for reg, prov, city, appt, addr, pc, note in rows_src:
    kind, phones, email = appt
    method = "icp_online" if kind == "icp" else ("phone_or_email" if phones and email else ("phone" if phones else "email"))
    out.append(dict(id="comisaria-" + slug(city), name=f"Comisaría Policía Nacional — {city}",
        type="police_station", region=reg, province=prov, city=city, address=addr, postal_code=pc,
        phone=phones, email=email,
        appointment_method=method, appointment_url=ICP if kind == "icp" else "",
        source_url=LISTADO, official_list_url=LISTADO, source_date=SOURCE_DATE,
        verified_at=VERIFIED_AT, verification_status="verified", notes=note))

ids = [r["id"] for r in out]
assert len(ids) == len(set(ids)), "dup ids: " + str([i for i in ids if ids.count(i) > 1])
with open("locations.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS)
    w.writeheader()
    w.writerows(out)

print(len(out), "rows;", Counter(r["type"] for r in out), Counter(r["verification_status"] for r in out))
print(Counter(r["appointment_method"] for r in out))
print(len({r["province"] for r in out}), "provinces;", len({r["city"] for r in out}), "cities")
print(sum(1 for r in out if r["address"]), "rows with an address")
