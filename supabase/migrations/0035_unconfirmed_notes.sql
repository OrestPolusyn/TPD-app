-- A third kind of community note: a single chat report nobody has confirmed
-- yet. It is shown as a comment at the bottom of the office's page, apart
-- from the card's bullets, and is not news for /feed or the channel. When a
-- second report or the police confirm it, a normal document/info note
-- replaces it (retire_note_ids in the draft hides this one).
alter table community_notes drop constraint community_notes_kind_check;
alter table community_notes add constraint community_notes_kind_check
  check (kind in ('document', 'info', 'unconfirmed'));
