"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { format, addMonths, setDate, getDay, startOfMonth, addDays } from "date-fns";
import {
  Calendar,
  Clock,
  Plus,
  ChevronRight,
  Loader2,
  AlertCircle,
  MessageSquare,
  Eye,
  EyeOff,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import type {
  MeetingSchedule,
  DiscussionNote,
  NotePriority,
} from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PRIORITY_LABELS: Record<NotePriority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#dc2626" },
  next_meeting: { label: "Next Meeting", color: "#2563eb" },
  future: { label: "Future", color: "#64748b" },
  informational: { label: "Info", color: "#16a34a" },
};

export default function MeetingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [householdId, setHouseholdId] = useState("");
  const [userId, setUserId] = useState("");
  const [schedule, setSchedule] = useState<MeetingSchedule | null>(null);
  const [notes, setNotes] = useState<DiscussionNote[]>([]);
  const [sharedNotes, setSharedNotes] = useState<DiscussionNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Schedule form
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [weekOfMonth, setWeekOfMonth] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState("18:00");
  const [duration, setDuration] = useState<15 | 30>(30);
  const [backupDay, setBackupDay] = useState<number | null>(null);
  const [backupTime, setBackupTime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  // New note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [notePriority, setNotePriority] = useState<NotePriority>("next_meeting");
  const [savingNote, setSavingNote] = useState(false);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("invite_status", "accepted")
      .single();

    if (!membership) return;
    setHouseholdId(membership.household_id);

    // Get meeting schedule
    const { data: scheduleData } = await supabase
      .from("meeting_schedules")
      .select("*")
      .eq("household_id", membership.household_id)
      .single();
    setSchedule(scheduleData);

    // Get my private notes
    const { data: myNotes } = await supabase
      .from("discussion_notes")
      .select("*")
      .eq("household_id", membership.household_id)
      .eq("created_by", user.id)
      .eq("is_private", true)
      .in("status", ["open"])
      .order("created_at", { ascending: false });
    setNotes(myNotes || []);

    // Get shared agenda items
    const { data: shared } = await supabase
      .from("discussion_notes")
      .select("*")
      .eq("household_id", membership.household_id)
      .eq("is_private", false)
      .in("status", ["open"])
      .order("priority")
      .order("created_at", { ascending: false });
    setSharedNotes(shared || []);

    setLoading(false);
  }, [supabase]);

  // Calculate next meeting date from schedule
  function getNextMeetingDate(sched: typeof schedule): Date | null {
    if (!sched) return null;
    const now = new Date();

    for (let monthOffset = 0; monthOffset <= 2; monthOffset++) {
      const targetMonth = addMonths(now, monthOffset);
      const firstOfMonth = startOfMonth(targetMonth);
      const firstDayOfWeek = getDay(firstOfMonth);

      // Calculate the nth occurrence of the target day of week
      let dayOffset = sched.day_of_week - firstDayOfWeek;
      if (dayOffset < 0) dayOffset += 7;
      const firstOccurrence = addDays(firstOfMonth, dayOffset);
      const nthOccurrence = addDays(firstOccurrence, (sched.week_of_month - 1) * 7);

      // Parse time
      const [hours, minutes] = sched.time_of_day.split(":").map(Number);
      const meetingDate = new Date(nthOccurrence);
      meetingDate.setHours(hours, minutes, 0, 0);

      if (meetingDate > now) return meetingDate;
    }
    return null;
  }

  const nextMeeting = getNextMeetingDate(schedule);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    const payload = {
      household_id: householdId,
      week_of_month: weekOfMonth,
      day_of_week: dayOfWeek,
      time_of_day: timeOfDay,
      duration_minutes: duration,
      backup_day_of_week: backupDay,
      backup_time: backupTime || null,
    };

    if (schedule) {
      await supabase
        .from("meeting_schedules")
        .update(payload)
        .eq("id", schedule.id);
    } else {
      await supabase.from("meeting_schedules").insert(payload);
    }

    setShowScheduleForm(false);
    setSavingSchedule(false);
    loadData();
  }

  async function handleSaveNote() {
    if (!noteTitle.trim()) return;
    setSavingNote(true);

    await supabase.from("discussion_notes").insert({
      household_id: householdId,
      created_by: userId,
      title: noteTitle.trim(),
      body: noteBody.trim() || null,
      priority: notePriority,
      is_private: true,
    });

    setNoteTitle("");
    setNoteBody("");
    setNotePriority("next_meeting");
    setShowNoteForm(false);
    setSavingNote(false);
    loadData();
  }

  async function handlePromoteNote(noteId: string) {
    await supabase
      .from("discussion_notes")
      .update({
        is_private: false,
        promoted_at: new Date().toISOString(),
      })
      .eq("id", noteId);
    loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-[var(--color-border)] px-4 py-4 pt-[env(safe-area-inset-top)]">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold">Monthly Meeting</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Prep notes & shared agenda
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Meeting schedule */}
        <section className="bg-white border border-[var(--color-border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
              Meeting Schedule
            </h2>
            <button
              onClick={() => setShowScheduleForm(!showScheduleForm)}
              className="text-sm text-[var(--color-primary)] font-medium"
            >
              {schedule ? "Edit" : "Set Up"}
            </button>
          </div>

          {schedule && !showScheduleForm ? (
            <div className="space-y-3">
              {nextMeeting && (
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">Next Meeting</p>
                  <p className="text-lg font-bold text-[var(--color-primary)]">
                    {format(nextMeeting, "EEEE, MMMM d")}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {format(nextMeeting, "h:mm a")} · {schedule.duration_minutes} min
                  </p>
                </div>
              )}
              <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
                <p>
                  <strong>Recurring:</strong> Week {schedule.week_of_month},{" "}
                  {DAYS[schedule.day_of_week]} at {schedule.time_of_day}
                </p>
                {schedule.backup_day_of_week !== null && (
                  <p>
                    <strong>Backup:</strong> {DAYS[schedule.backup_day_of_week]}{" "}
                    {schedule.backup_time && `at ${schedule.backup_time}`}
                  </p>
                )}
              </div>
            </div>
          ) : showScheduleForm ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Week of month
                  </label>
                  <select
                    value={weekOfMonth}
                    onChange={(e) => setWeekOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg bg-white text-sm"
                  >
                    {[1, 2, 3, 4].map((w) => (
                      <option key={w} value={w}>
                        Week {w}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Day
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg bg-white text-sm"
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value) as 15 | 30)}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg bg-white text-sm"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Backup day
                  </label>
                  <select
                    value={backupDay ?? ""}
                    onChange={(e) =>
                      setBackupDay(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg bg-white text-sm"
                  >
                    <option value="">None</option>
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Backup time
                  </label>
                  <input
                    type="time"
                    value={backupTime}
                    onChange={(e) => setBackupTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="w-full py-2.5 bg-[var(--color-primary)] text-white font-medium rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingSchedule ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Save Schedule"
                )}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No meeting schedule set up yet.
            </p>
          )}
        </section>

        {/* My private notes */}
        <section className="bg-white border border-[var(--color-border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-[var(--color-text-secondary)]" />
              My Prep Notes
              <span className="text-xs bg-gray-100 text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full">
                Private
              </span>
            </h2>
            <button
              onClick={() => setShowNoteForm(!showNoteForm)}
              className="text-sm text-[var(--color-primary)] font-medium flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {showNoteForm && (
            <div className="mb-4 space-y-3 bg-gray-50 rounded-lg p-3">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Topic title"
                autoFocus
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Details (optional)"
                rows={2}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <div className="flex gap-2">
                {(Object.entries(PRIORITY_LABELS) as [NotePriority, { label: string; color: string }][]).map(
                  ([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => setNotePriority(key)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                        notePriority === key
                          ? "text-white"
                          : "bg-white"
                      }`}
                      style={{
                        backgroundColor:
                          notePriority === key ? color : undefined,
                        borderColor: color,
                        color: notePriority === key ? "white" : color,
                      }}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
              <button
                onClick={handleSaveNote}
                disabled={savingNote || !noteTitle.trim()}
                className="w-full py-2.5 bg-[var(--color-primary)] text-white font-medium rounded-lg text-sm disabled:opacity-50"
              >
                {savingNote ? "Saving..." : "Save Note"}
              </button>
            </div>
          )}

          {notes.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No prep notes yet. Add topics you want to discuss at the next
              meeting.
            </p>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start justify-between gap-2 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: `${PRIORITY_LABELS[note.priority].color}15`,
                          color: PRIORITY_LABELS[note.priority].color,
                        }}
                      >
                        {PRIORITY_LABELS[note.priority].label}
                      </span>
                      <h3 className="font-medium text-sm truncate">
                        {note.title}
                      </h3>
                    </div>
                    {note.body && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                        {note.body}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handlePromoteNote(note.id)}
                    className="text-xs text-[var(--color-primary)] font-medium shrink-0 flex items-center gap-1 mt-1"
                    title="Share with co-parent"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Share
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Shared agenda */}
        <section className="bg-white border border-[var(--color-border)] rounded-xl p-4">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-[var(--color-primary)]" />
            Shared Agenda
          </h2>

          {sharedNotes.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No shared agenda items yet. Promote your private notes when
              you&apos;re ready.
            </p>
          ) : (
            <div className="space-y-2">
              {sharedNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 bg-blue-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `${PRIORITY_LABELS[note.priority].color}15`,
                        color: PRIORITY_LABELS[note.priority].color,
                      }}
                    >
                      {PRIORITY_LABELS[note.priority].label}
                    </span>
                    <h3 className="font-medium text-sm">{note.title}</h3>
                  </div>
                  {note.body && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {note.body}
                    </p>
                  )}
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                    Added{" "}
                    {format(new Date(note.created_at), "MMM d")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
