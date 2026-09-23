import { getTranslations } from "next-intl/server";
import type { CommunityNote } from "@/lib/data/communityNotes";
import { SHOWN_CONFIRMERS } from "@/lib/data/communityNotes";
import { Avatar } from "@/components/shared/Avatar";
import { NoteConfirm } from "@/components/location/NoteConfirm";
import { formatDate, daysSince } from "@/lib/format";

/** Past this with nobody vouching for it, a claim is a lead, not information. */
const STALE_AFTER_DAYS = 45;

/**
 * One community claim, rendered as a comment.
 *
 * This used to be a single paragraph per office in a tinted box, which read as
 * an announcement from the site and gave the reader nothing to do with it. A
 * claim someone can confirm — or contradict — is worth more than the same
 * sentence asserted by nobody, and the confirmations are what make the
 * activity here visible at all.
 */
export async function CommunityNoteCard({
  note,
  children,
}: {
  note: CommunityNote;
  /** Where the claim comes from — used by /feed to name the office. */
  children?: React.ReactNode;
}) {
  const t = await getTranslations("location");
  const tCommon = await getTranslations("common");
  const disputed = note.moderation_status !== "published";
  const stale = daysSince(note.observed_on) > STALE_AFTER_DAYS && note.still_true === 0;

  return (
    <li
      id={`note-${note.id}`}
      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-center gap-2">
        <Avatar name={t("noteAuthor")} size={28} />
        <div className="min-w-0 leading-tight">
          <p className="font-medium">{t("noteAuthor")}</p>
          <p className="text-xs text-[var(--muted)]">
            {t("noteObserved", { date: formatDate(note.observed_on) })}
            {stale ? ` · ${t("noteStale")}` : null}
          </p>
        </div>
      </div>

      {children}

      <p className={disputed ? "mt-2 whitespace-pre-wrap text-[var(--muted)] line-through" : "mt-2 whitespace-pre-wrap"}>
        {note.body}
      </p>

      {disputed ? <p className="mt-1 text-xs text-[var(--warning)]">{t("noteDisputed")}</p> : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <NoteConfirm
          noteId={note.id}
          stance={note.my_stance}
          stillTrue={note.still_true}
          changed={note.changed}
          labels={{
            confirm: t("noteConfirm"),
            deny: t("noteDeny"),
            signIn: t("noteSignIn"),
            generic: tCommon("errorGeneric"),
          }}
        />

        {note.confirmers.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {note.confirmers.map((p, i) => (
                <Avatar
                  key={`${p.display_name}-${i}`}
                  name={p.display_name}
                  photoUrl={p.avatar_url}
                  size={22}
                  className="ring-2 ring-[var(--surface)]"
                />
              ))}
            </div>
            {note.still_true > SHOWN_CONFIRMERS ? (
              <span className="text-xs text-[var(--muted)]">
                {t("noteConfirmersMore", { count: note.still_true - SHOWN_CONFIRMERS })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The claims about one office, above its personal reports.
 *
 * On an office nobody has filed a report for yet this is the only thing on the
 * page that answers "what actually happens here", so it comes first inside
 * "Досвід спільноти" — but as a list of checkable claims, never as the site's
 * own word.
 */
export async function CommunityNotes({ notes }: { notes: CommunityNote[] }) {
  const t = await getTranslations("location");
  if (notes.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium">{t("notesTitle")}</h3>
      <p className="mb-2 text-xs text-[var(--muted)]">
        {t("notesSubtitle")} {t("noteDisclaimer")}
      </p>
      <ul className="flex flex-col gap-2">
        {notes.map((note) => (
          <CommunityNoteCard key={note.id} note={note} />
        ))}
      </ul>
    </div>
  );
}
