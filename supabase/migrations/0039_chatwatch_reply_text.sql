-- The message a found chat message answers. Many reports are short replies
-- ("Ні, довідки не приймають, тільки штамп") whose city is named only in
-- the message above; without it the Claude pass has to skip them.
alter table chatwatch_found add column reply_text text;
