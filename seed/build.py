import csv
ICP = "https://sede.administracionespublicas.gob.es/icpplus/index.html"
TRANSCRIPT = "https://blogextranjeriaprogestion.org/2022/04/05/donde-solicitar-proteccion-temporal-por-conflicto-en-ucrania-espana/"
OFFICIAL_XLSX = "https://www.interior.gob.es/opencms/export/sites/default/.galleries/ucrania/Comisarias_proteccion_temporal.xlsx"
MISSM = "https://ucraniaurgente.inclusion.gob.es/w/tramites-proteccion-temporal-desplazados-ucrania"
MISSM_MIRROR = "https://ucraniaurgente.seg-social.es/w/tramites-proteccion-temporal-desplazados-ucrania"

# (region, province, city_as_in_source, appointment)  appointment: ('icp',) | ('phone', phones, email)
P = lambda phones="", email="": ("contact", phones, email)
I = ("icp", "", "")
rows_src = [
 ("Andalucía","Cádiz","Algeciras",P("956588424","algeciras.ucrif3@policia.es")),
 ("Andalucía","Cádiz","Cádiz",P("956297560","cadiz.asilo@policia.es")),
 ("Andalucía","Córdoba","Córdoba",P("957594725")),
 ("Andalucía","Huelva","Huelva",P("959541922","huelva.asilos@policia.es")),
 ("Andalucía","Sevilla","Sevilla",I),
 ("Andalucía","Almería","Almería",P("950623105","almeria.bdep@policia.es")),
 ("Andalucía","Granada","Granada",P("958808178;958808532")),
 ("Andalucía","Jaén","Jaén",P("953295318;953295311")),
 ("Andalucía","Málaga","Málaga",P("952046212","malaga.catextranjeria@policia.es")),
 ("Aragón","Huesca","Huesca",P("","huesca.ucrania@policia.es")),
 ("Aragón","Teruel","Teruel",P("","teruel.bped@polcia.es")),
 ("Aragón","Zaragoza","Zaragoza",P("","zaragoza.udeye@policia.es")),
 ("Asturias","Asturias","Gijón",I),
 ("Asturias","Asturias","Oviedo",I),
 ("Illes Balears","Illes Balears","Ibiza",P("971398831")),
 ("Illes Balears","Illes Balears","Mahón",P("971363712")),
 ("Illes Balears","Illes Balears","Mallorca",I),
 ("Canarias","Las Palmas","Arrecife",P("928844000;928844299","arrecife.documentacion@policia.es")),
 ("Canarias","Las Palmas","Las Palmas de Gran Canaria",P("928304660","laspalmas.protecciontemporal@policia.es")),
 ("Canarias","Las Palmas","Puerto del Rosario",P("928855924","prosario.extdoc@policia.es")),
 ("Canarias","Santa Cruz de Tenerife","Santa Cruz de Tenerife",P("922235635","sctenerife.citaudex@policia.es")),
 ("Cantabria","Cantabria","Cantabria",P("942361120","santander.protecciontemporal@policia.es")),
 ("Castilla-La Mancha","Albacete","Albacete",P("","albacete.asilo@policia.es")),
 ("Castilla-La Mancha","Ciudad Real","Ciudad Real",P("926277903;926277926","ciudadreal.extranjeria@policia.es")),
 ("Castilla-La Mancha","Cuenca","Cuenca",P("969240795","cuenca.bped@policia.es")),
 ("Castilla-La Mancha","Guadalajara","Guadalajara",I),
 ("Castilla-La Mancha","Toledo","Toledo",P("","toledo.desplazados_ucrania@policia.es")),
 ("Castilla y León","Ávila","Ávila",I),
 ("Castilla y León","Burgos","Burgos",P("947282345")),
 ("Castilla y León","León","León",P("987218907;987218908;987218965")),
 ("Castilla y León","Palencia","Palencia",P("979167415;979167412")),
 ("Castilla y León","Salamanca","Salamanca",P("923127709;923127779")),
 ("Castilla y León","Segovia","Segovia",P("921414705")),
 ("Castilla y León","Soria","Soria",P("975239332")),
 ("Castilla y León","Valladolid","Valladolid",P("983456526")),
 ("Castilla y León","Zamora","Zamora",P("980509266")),
 ("Cataluña","Girona","Girona",I),
 ("Cataluña","Lleida","Lleida",P("973728500")),
 ("Cataluña","Tarragona","Reus",I),
 ("Cataluña","Tarragona","Tarragona",I),
 ("Cataluña","Tarragona","Tortosa",I),
 ("Ceuta","Ceuta","Ceuta",I),
 ("Comunitat Valenciana","Castellón","Castellón de la Plana",P("","castellon.protecciontemporal@policia.es")),
 ("Comunitat Valenciana","Valencia","Valencia",P("","valencia.proteccioninternacional1@policia.es")),
 ("Comunitat Valenciana","Castellón","Villarreal",P("","castellon.protecciontemporal@policia.es")),
 ("Extremadura","Badajoz","Badajoz",P("924205494","badajoz.bped@policia.es")),
 ("Extremadura","Cáceres","Cáceres",P("927626525")),
 ("Galicia","A Coruña","Ferrol",I),
 ("Galicia","A Coruña","A Coruña",I),
 ("Galicia","Lugo","Lugo",I),
 ("Galicia","Ourense","Ourense",P("988391830","orense.bped@policia.es")),
 ("Galicia","Pontevedra","Pontevedra",P("986868327;986868847")),
 ("Galicia","A Coruña","Santiago de Compostela",I),
 ("Galicia","Pontevedra","Tui",P("986619703")),
 ("Galicia","Pontevedra","Vigo",P("986820687")),
 ("La Rioja","La Rioja","Logroño",I),
 ("Melilla","Melilla","Melilla",P("952696391")),
 ("Región de Murcia","Murcia","Cartagena",P("968321285")),
 ("Región de Murcia","Murcia","Alcantarilla",P("968801100")),
 ("Región de Murcia","Murcia","Yecla",P("968751302")),
 ("Región de Murcia","Murcia","Lorca",P("968477278")),
 ("Región de Murcia","Murcia","Molina de Segura",P("968386303")),
 ("Región de Murcia","Murcia","Murcia",P("968889605")),
 ("Navarra","Navarra","Tudela",P("948827450")),
 ("Navarra","Navarra","Pamplona",I),
 ("País Vasco","Bizkaia","Bilbao",I),
 ("País Vasco","Gipuzkoa","San Sebastián",I),
 ("País Vasco","Araba/Álava","Vitoria-Gasteiz",I),
]
notes_extra = {
 "Teruel": "Official XLSX itself has email domain 'polcia.es' (likely typo of policia.es). Do not show this email until confirmed.",
 "Cantabria": "Source lists locality as 'CANTABRIA'; email suggests Santander. Confirm city.",
 "Mallorca": "Source lists locality as 'MALLORCA'; exact city (likely Palma) not stated. Confirm.",
 "Villarreal": "Shares email with Castellón in source.",
}

FIELDS = ["id","name","type","region","province","city","address","postal_code",
          "phone","email","appointment_method","appointment_url",
          "source_url","official_list_url","source_date","verified_at",
          "verification_status","notes"]
out = []
def slug(s):
    import unicodedata,re
    s = unicodedata.normalize("NFKD", s).encode("ascii","ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+","-",s).strip("-")

# CREADE (current official MISSM page, checked 2026-09-15)
creade = [
 ("creade-pozuelo","CREADE Pozuelo de Alarcón","Comunidad de Madrid","Madrid","Pozuelo de Alarcón",
  "Paseo de la Casa de Campo, 1","28223","+34666800194;+34913990009","verified",""),
 ("creade-barcelona","CREADE Barcelona","Cataluña","Barcelona","Barcelona",
  "Calle de Sant Fructuós, 78-80","08004","+34932382199;+34913990009","verified",""),
 ("creade-torrevieja","CREADE Alicante (Torrevieja)","Comunitat Valenciana","Alicante","Torrevieja",
  "Calle Urbano Arregui, 8","03185","+34913990009","verified","Local phone not listed on source page; general line only."),
 ("creade-malaga","CREADE Málaga","Andalucía","Málaga","Málaga",
  "Avenida del Pintor Joaquín Sorolla, 145","29017","+34628216478;+34913990009","conflict",
  "ADDRESS CONFLICT: inclusion.gob.es shows Av. Pintor Joaquín Sorolla 145, 29017; mirror seg-social.es shows Av. José Ortega y Gasset 20, 29006. Confirm by phone before publishing."),
]
for cid,name,reg,prov,city,addr,pc,phone,status,note in creade:
    out.append(dict(id=cid,name=name,type="creade",region=reg,province=prov,city=city,address=addr,
        postal_code=pc,phone=phone,email="",appointment_method="phone",appointment_url="",
        source_url=MISSM if cid!="creade-malaga" else MISSM+" ; "+MISSM_MIRROR,
        official_list_url="",source_date="2026",verified_at="2026-09-15",
        verification_status=status,notes=note))

for reg,prov,city,appt in rows_src:
    kind,phones,email = appt
    phone = ";".join("+34"+p for p in phones.split(";")) if phones else ""
    note = "Matches official Interior XLSX (file last modified 2022-03-30). Official list has no street address; confirm address separately."
    if city in notes_extra: note += " " + notes_extra[city]
    out.append(dict(id="comisaria-"+slug(city),name=f"Comisaría Policía Nacional — {city}",
        type="police_station",region=reg,province=prov,city=city,address="",postal_code="",
        phone=phone,email=email,
        appointment_method="icp_online" if kind=="icp" else ("phone_or_email" if phones and email else ("phone" if phones else "email")),
        appointment_url=ICP if kind=="icp" else "",
        source_url=OFFICIAL_XLSX,official_list_url=OFFICIAL_XLSX,source_date="2022-03-30",
        verified_at="2026-09-15",verification_status="official_2022",notes=note))

ids=[r["id"] for r in out]; assert len(ids)==len(set(ids)), "dup ids"
with open("locations.csv","w",newline="",encoding="utf-8") as f:
    w=csv.DictWriter(f,fieldnames=FIELDS); w.writeheader(); w.writerows(out)
from collections import Counter
print(len(out), Counter(r["verification_status"] for r in out), Counter(r["type"] for r in out))
print(len({r['province'] for r in out}), "provinces")
