// Mirrors the enum types and jsonb shape produced by
// supabase/migrations/0002_enums.sql and 0007_matching.sql.

export type LocationType = "creade" | "police_station";
export type VerificationStatus = "verified" | "official_2022" | "conflict" | "user_submitted";
export type AppointmentMethod = "phone" | "email" | "phone_or_email" | "icp_online";
export type ModerationStatus = "pending" | "published" | "flagged" | "rejected" | "hidden";
export type ReportOutcome =
  | "protection_granted"
  | "application_accepted_pending"
  | "turned_away"
  | "could_not_get_appointment";
export type AppointmentType = "booked_online_icp" | "booked_by_email_or_phone" | "walk_in";
export type TimeAtOffice = "under_1h" | "1_to_3h" | "over_3h" | "multiple_visits";
export type MilitaryObligations = "yes" | "no" | "prefer_not_to_say";
export type DocumentStatus = "requested" | "requested_missing" | "not_requested";

export const DOCUMENT_CODES = [
  "international_passport",
  "internal_passport_or_id_card",
  "birth_certificate",
  "proof_of_residence_in_ukraine",
  "ukraine_residence_permit_third_country",
  "passport_exit_stamp",
  "military_document_paper",
  "military_document_reserve_plus",
  "marriage_certificate",
  "child_birth_certificate",
  "spanish_address_or_empadronamiento",
  "passport_photos",
  "other",
] as const;
export type DocumentCode = (typeof DOCUMENT_CODES)[number];

/** Codes offered in the user's search checklist — "other" is deliberately excluded. */
export const CHECKLIST_DOCUMENT_CODES = DOCUMENT_CODES.filter((c) => c !== "other");

export const PROCEDURE_CODE = "temporary_protection_application" as const;

export interface LocationRow {
  id: string;
  name: string;
  type: LocationType;
  region: string;
  province: string;
  province_slug: string;
  city: string;
  address: string | null;
  postal_code: string | null;
  phones: string[];
  email: string | null;
  email_hidden: boolean;
  appointment_method: AppointmentMethod;
  appointment_url: string | null;
  source_url: string;
  official_list_url: string | null;
  source_date: string | null;
  verified_at: string;
  verification_status: VerificationStatus;
  notes: string | null;
  /** Community-reported practice at this office — see supabase/migrations/0015. */
  practical_info: string | null;
  practical_info_updated_at: string | null;
  moderation_status: ModerationStatus;
}

export interface MatchedReport {
  report_id: string;
  event_date: string;
  outcome?: ReportOutcome;
  is_fresh: boolean;
  is_policy_outdated?: boolean;
  extra_docs?: DocumentCode[];
}

export interface NotRequestedLine {
  document_code: DocumentCode;
  user_count: number;
  highlighted: boolean;
}

export interface PolicyChangeInfo {
  effective_date: string;
  title_uk: string;
  source_url: string;
}

export interface EarliestAppointmentInfo {
  earliest_appointment_offered: string;
  user_count: number;
}

/** Return shape of fn_location_page_data(). */
export interface LocationPageData {
  matches: MatchedReport[];
  incomplete: MatchedReport[];
  more_docs: MatchedReport[];
  unsuccessful: MatchedReport[];
  not_requested: NotRequestedLine[];
  walk_in_count: number;
  walk_in_highlighted: boolean;
  earliest_appointment: EarliestAppointmentInfo | null;
  fresh_matching_count: number;
  latest_matching_date: string | null;
  fresh_unsuccessful_count: number;
  policy_change: PolicyChangeInfo | null;
  flagged_count: number;
}

export interface SearchResultRow {
  location_id: string;
  data: LocationPageData;
}
