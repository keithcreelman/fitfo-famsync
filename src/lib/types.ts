export type EventCategory =
  | "school"
  | "sports"
  | "lacrosse"
  | "soccer"
  | "basketball"
  | "flag_football"
  | "medical"
  | "band"
  | "appointment"
  | "chore"
  | "homework"
  | "workout"
  | "parenting_discussion"
  | "travel"
  | "other";

export type SourceType =
  | "manual"
  | "nlp_quick_add"
  | "ics_import"
  | "screenshot_import"
  | "email_import"
  | "pdf_import"
  | "calendar_sync";

export type NotePriority = "urgent" | "next_meeting" | "future" | "informational";
export type NoteStatus = "open" | "discussed" | "resolved" | "deferred";
export type MeetingStatus = "scheduled" | "completed" | "missed" | "rescheduled";
export type MemberRole = "parent" | "guardian" | "viewer";
export type InviteStatus = "pending" | "accepted" | "declined";

export interface Household {
  id: string;
  name: string;
  invite_code: string | null;
  created_at: string;
  created_by: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  home_address: string | null;
  home_label: string | null;
}

// Known parent homes for drive time estimates
export const PARENT_HOMES: Record<string, { address: string; label: string }> = {
  dad: { address: "341 The Trail, Fiskdale, MA", label: "Dad's" },
  mom: { address: "176 Arvidson Rd, Woodstock, CT", label: "Mom's" },
};

// Estimate drive time from a home to a venue (minutes)
// Heuristic based on central MA/CT geography
export function estimateDriveFromHome(homeAddress: string, eventLocation: string): number {
  if (!eventLocation) return 20;
  const home = homeAddress.toLowerCase();
  const venue = eventLocation.toLowerCase();

  // Same town check
  const homeTown = home.includes("fiskdale") ? "fiskdale"
    : home.includes("woodstock") ? "woodstock"
    : home.includes("sturbridge") ? "sturbridge"
    : home.split(",")[1]?.trim() || "";

  if (venue.includes(homeTown) && homeTown.length > 3) return 5;

  // Adjacent town heuristics for central MA/CT
  const nearPairs: Record<string, string[]> = {
    fiskdale: ["sturbridge", "tantasqua", "brimfield", "holland"],
    sturbridge: ["fiskdale", "tantasqua", "southbridge", "charlton"],
    woodstock: ["southbridge", "putnam", "thompson", "pomfret"],
    southbridge: ["sturbridge", "woodstock", "charlton", "dudley"],
    charlton: ["sturbridge", "southbridge", "oxford", "dudley"],
    westborough: ["northborough", "shrewsbury", "southborough"],
    boylston: ["shrewsbury", "west_boylston", "sterling"],
    mendon: ["milford", "uxbridge", "bellingham", "hopedale"],
    billerica: ["chelmsford", "bedford", "burlington", "tewksbury"],
  };

  for (const [town, neighbors] of Object.entries(nearPairs)) {
    if (home.includes(town) && neighbors.some((n) => venue.includes(n))) return 15;
    if (venue.includes(town) && neighbors.some((n) => home.includes(n))) return 15;
  }

  // Check if event is at a known nearby venue
  if (home.includes("fiskdale") || home.includes("sturbridge")) {
    if (venue.includes("tantasqua")) return 5;
    if (venue.includes("southbridge")) return 15;
    if (venue.includes("woodstock")) return 20;
    if (venue.includes("charlton") || venue.includes("dudley")) return 20;
    if (venue.includes("westborough")) return 35;
    if (venue.includes("shrewsbury")) return 30;
    if (venue.includes("milford") || venue.includes("mendon")) return 40;
    if (venue.includes("boylston")) return 35;
    if (venue.includes("billerica")) return 60;
    if (venue.includes("ashburnham")) return 55;
  }

  if (home.includes("woodstock")) {
    if (venue.includes("woodstock")) return 5;
    if (venue.includes("tantasqua") || venue.includes("fiskdale") || venue.includes("sturbridge")) return 30;
    if (venue.includes("southbridge")) return 15;
    if (venue.includes("charlton") || venue.includes("dudley")) return 30;
    if (venue.includes("westborough")) return 50;
    if (venue.includes("shrewsbury")) return 45;
    if (venue.includes("milford") || venue.includes("mendon")) return 50;
    if (venue.includes("boylston")) return 45;
    if (venue.includes("billerica")) return 75;
    if (venue.includes("ashburnham")) return 65;
    if (venue.includes("putnam")) return 15;
    if (venue.includes("pomfret") || venue.includes("thompson")) return 15;
  }

  // Default: unknown distance
  return 30;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string | null;
  role: MemberRole;
  invited_at: string;
  joined_at: string | null;
  invite_email: string | null;
  invite_status: InviteStatus;
  privacy_acknowledged_at: string | null;
}

export interface Child {
  id: string;
  household_id: string;
  name: string;
  nickname: string | null;
  birth_date: string | null;
  grade: string | null;
  color: string | null;
}

// Detect if event is a game (vs practice/training)
export function isGameEvent(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes(" vs ") ||
    lower.includes(" vs.") ||
    lower.includes("game") ||
    lower.includes("match") ||
    lower.includes("tourney") ||
    lower.includes("tournament") ||
    lower.includes("playoff") ||
    lower.includes("championship") ||
    lower.includes("scrimmage")
  );
}

// Preset child colors — good, distinct, accessible
export const CHILD_COLOR_OPTIONS = [
  { value: "#EC4899", label: "Pink" },
  { value: "#22C55E", label: "Green" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EF4444", label: "Red" },
  { value: "#06B6D4", label: "Cyan" },
  { value: "#F97316", label: "Orange" },
];

export interface CalendarEvent {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  start_time: string;
  end_time: string | null;
  location: string | null;
  all_day: boolean;
  source_type: SourceType;
  requires_discussion: boolean;
  created_by: string;
  created_at: string;
  children?: Child[];
}

export interface MeetingSchedule {
  id: string;
  household_id: string;
  week_of_month: number;
  day_of_week: number;
  time_of_day: string;
  duration_minutes: 15 | 30;
  backup_day_of_week: number | null;
  backup_time: string | null;
  reminder_hours_before: number[];
}

export interface MeetingInstance {
  id: string;
  household_id: string;
  schedule_id: string;
  scheduled_date: string;
  is_backup: boolean;
  status: MeetingStatus;
  completed_at: string | null;
  notes: string | null;
}

export interface DiscussionNote {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  body: string | null;
  priority: NotePriority;
  is_private: boolean;
  promoted_at: string | null;
  meeting_instance_id: string | null;
  child_id: string | null;
  status: NoteStatus;
  created_at: string;
}

export interface Import {
  id: string;
  household_id: string;
  uploaded_by: string;
  source_type: "ics" | "screenshot" | "email" | "pdf";
  file_path: string | null;
  raw_extracted_text: string | null;
  parsed_data: ParsedEventData | null;
  confidence_score: number | null;
  status: "pending" | "reviewed" | "accepted" | "rejected";
  event_id: string | null;
}

export interface ParsedEventData {
  title?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  notes?: string;
  category?: EventCategory;
  child_name?: string;
  confidence?: number;
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  school: "School",
  sports: "Sports",
  lacrosse: "\uD83E\uDD4D Lacrosse",
  soccer: "\u26BD Soccer",
  basketball: "\uD83C\uDFC0 Basketball",
  flag_football: "\uD83C\uDFC8 Flag Football",
  medical: "Medical",
  band: "Band",
  appointment: "Appointment",
  chore: "Chore",
  homework: "Homework",
  workout: "Workout",
  parenting_discussion: "Parenting Discussion",
  travel: "Travel",
  other: "Other",
};

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  school: "#2563eb",
  sports: "#16a34a",
  lacrosse: "#16a34a",
  soccer: "#16a34a",
  basketball: "#f97316",
  flag_football: "#7c3aed",
  medical: "#dc2626",
  band: "#9333ea",
  appointment: "#f59e0b",
  chore: "#64748b",
  homework: "#0891b2",
  workout: "#ea580c",
  parenting_discussion: "#be185d",
  travel: "#4f46e5",
  other: "#6b7280",
};
