-- 1. The ICP booking link. The directory page the ministry list pointed at
--    (sede.administracionespublicas.gob.es/.../icpplus) is not where people
--    book; this is. Mirrored in seed/locations.csv.
update locations
set appointment_url = 'https://icp.administracionelectronica.gob.es/icpplus/index.html'
where appointment_url = 'https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus';

-- 2. Every published office is searchable again.
--
-- 0021 hid 17 offices on the premise of one office per province; the chats
-- then showed several of them (Tortosa, Puerto del Rosario) taking
-- applications after all, and practice changes week to week (Villarreal took
-- them until mid-September). Hiding an office means a reader cannot find it
-- even to read that it stopped — and the briefs on those pages already say so
-- ("ТЗ тут не оформлюють", "скеровують у Кастельйон"). So all offices are
-- found; the brief says what each one does. The column stays, for an office
-- that really must be withheld.
update locations set accepts_applications = true where not accepts_applications;
