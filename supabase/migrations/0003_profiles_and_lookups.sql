-- profiles.id IS auth.users.id: created by the Telegram auth bridge (server-side,
-- service role) the first time a given telegram_user_id authenticates. No self-signup,
-- no trigger on auth.users — see src/lib/telegram/authBridge.ts.
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  telegram_user_id  bigint unique not null,
  role              user_role_t not null default 'user',
  created_at        timestamptz not null default now()
);

create table procedures (
  code       text primary key,
  label_uk   text not null,
  label_es   text not null,
  is_active  boolean not null default true
);

insert into procedures (code, label_uk, label_es, is_active) values
  ('temporary_protection_application', 'Заява на тимчасовий захист', 'Solicitud de protección temporal', true);

create table document_types (
  code        text primary key,
  label_uk    text not null,
  label_es    text not null,
  sort_order  int not null,
  is_active   boolean not null default true
);

insert into document_types (code, label_uk, label_es, sort_order) values
  ('international_passport',                 'Закордонний паспорт',                                          'Pasaporte internacional', 1),
  ('internal_passport_or_id_card',            'Внутрішній паспорт / ID-картка',                               'Documento de identidad interno', 2),
  ('birth_certificate',                       'Свідоцтво про народження',                                     'Certificado de nacimiento', 3),
  ('proof_of_residence_in_ukraine',           'Підтвердження проживання в Україні',                           'Prueba de residencia en Ucrania', 4),
  ('ukraine_residence_permit_third_country',  'Дозвіл на проживання в Україні (для громадян третіх країн)',   'Permiso de residencia en Ucrania (terceros países)', 5),
  ('passport_exit_stamp',                     'Штамп про перетин кордону',                                    'Sello de salida en el pasaporte', 6),
  ('military_document_paper',                 'Військовий квиток (паперовий)',                                'Cartilla militar (papel)', 7),
  ('military_document_reserve_plus',          'Військово-обліковий документ (Резерв+)',                       'Documento militar (Reserv+)', 8),
  ('marriage_certificate',                    'Свідоцтво про шлюб',                                           'Certificado de matrimonio', 9),
  ('child_birth_certificate',                 'Свідоцтво про народження дитини',                              'Certificado de nacimiento del hijo/a', 10),
  ('spanish_address_or_empadronamiento',      'Іспанська адреса / empadronamiento',                           'Empadronamiento / domicilio en España', 11),
  ('passport_photos',                         'Фотографії паспортного зразка',                                'Fotografías tipo carné', 12),
  ('other',                                   'Інше',                                                          'Otro', 13);
