-- Drafts from the chats publish themselves (owner's choice, 02.10): the
-- admin bot then reports what went out, with one button to take it back.
--
-- `result` records what publishing created, so «↩️ Скасувати» can undo
-- exactly that: { note_ids, retired_note_ids, rule_change_id,
-- channel_post_id }. `undone_at` makes the undo one-shot.
alter table bot_actions
  add column result    jsonb,
  add column undone_at timestamptz;

-- 'on' publishes drafts at once; anything else falls back to approval
-- buttons. Toggled from the admin bot with /auto_on and /auto_off.
insert into app_settings (key, value) values ('auto_publish_drafts', 'on')
  on conflict (key) do nothing;
