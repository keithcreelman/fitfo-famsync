export type EventCategory =
  | "school"
  | "sports"
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
