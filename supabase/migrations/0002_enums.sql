create type location_type_t         as enum ('creade', 'police_station');
-- 'user_submitted': a location proposed via /locations/new, not yet checked
-- against any official source. Always paired with moderation_status='pending'.
create type verification_status_t   as enum ('verified', 'official_2022', 'conflict', 'user_submitted');
create type appointment_method_t    as enum ('phone', 'email', 'phone_or_email', 'icp_online');
create type moderation_status_t     as enum ('pending', 'published', 'flagged', 'rejected', 'hidden');
create type suggestion_status_t     as enum ('pending', 'approved', 'rejected');
create type suggestion_field_t      as enum ('address', 'postal_code', 'phone', 'appointment_url');
create type report_outcome_t        as enum ('protection_granted', 'application_accepted_pending', 'turned_away', 'could_not_get_appointment');
create type appointment_type_t      as enum ('booked_online_icp', 'booked_by_email_or_phone', 'walk_in');
create type time_at_office_t        as enum ('under_1h', '1_to_3h', 'over_3h', 'multiple_visits');
create type military_obligations_t  as enum ('yes', 'no', 'prefer_not_to_say');
create type document_status_t       as enum ('requested', 'requested_missing', 'not_requested');
create type flag_target_t           as enum ('report', 'comment');
create type user_role_t             as enum ('user', 'moderator');
