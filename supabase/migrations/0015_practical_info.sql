-- What an office actually does this week, as opposed to what the official
-- list says it does.
--
-- Everything the app showed about a location came from an official source and
-- changes slowly. The thing people actually need — which documents are being
-- asked for right now, whether the queue is live or by appointment, whether
-- that office has quietly stopped accepting applications — lives in community
-- chats and is gone from view in a day.
--
-- `notes` could not hold it: that column is moderator-facing and never
-- rendered, and it already carries internal annotations in mixed languages.
-- This is a separate, user-facing field, always shown with its date and
-- labelled as community-sourced, because that is exactly what it is: useful,
-- current, and not verified against an official source.
alter table locations
  add column practical_info            text,
  add column practical_info_updated_at date;
