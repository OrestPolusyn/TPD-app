-- "Змінилось" on its own tells a moderator that the brief is wrong but not
-- what is right, which leaves them nothing to update it with. A "changed"
-- verdict now carries the person's description of what is different; it is
-- relayed to the moderator chat and kept here for the record.
--
-- Required at the DB level too, not just by the API: a bare "changed" row is
-- exactly the unactionable signal this column exists to prevent.
alter table location_brief_confirmations
  add column detail text
    check (detail is null or char_length(detail) <= 1000),
  add constraint chk_changed_has_detail
    check (stance <> 'changed' or length(trim(coalesce(detail, ''))) > 0);

-- Switching a "changed" back to "still_true" clears the detail in the same
-- update, so the column needs to be writable alongside stance.
grant update (stance, detail) on location_brief_confirmations to authenticated;
