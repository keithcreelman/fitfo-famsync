"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  MapPin, Clock, Trash2, User, AlertCircle, Navigation,
  Pencil, X, Check, Loader2, CheckCircle, HelpCircle, XCircle,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import {
  type CalendarEvent, type EventCategory, type Child,
  CATEGORY_LABELS, CATEGORY_COLORS,
} from "@/lib/types";

type RsvpStatus = "going" | "maybe" | "not_going";

interface EventCardProps {
  event: CalendarEvent;
  allChildren?: Child[];
  userId?: string;
  onDelete?: (eventId: string) => Promise<void>;
  onUpdate?: (eventId: string, updates: Record<string, unknown>, childIds?: string[]) => Promise<void>;
}

function getDirectionsUrl(location: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;
}

export default function EventCard({ event, allChildren, userId, onDelete, onUpdate }: EventCardProps) {
  const supabase = createClient();
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : null;
  const categoryColor = CATEGORY_COLORS[event.category] || "#6b7280";
  const childColor = event.children?.[0]?.color || null;
  const barColor = childColor || categoryColor;

  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // RSVP state — default to "going"
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>("going");
  const [rsvpNote, setRsvpNote] = useState("");
  const [rsvpLoaded, setRsvpLoaded] = useState(false);
  const [showRsvpNote, setShowRsvpNote] = useState(false);

  // Load RSVP on mount
  useState(() => {
    if (!userId) return;
    supabase
      .from("event_rsvps")
      .select("status, note")
      .eq("event_id", event.id)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRsvpStatus(data.status as RsvpStatus);
          setRsvpNote(data.note || "");
        }
        setRsvpLoaded(true);
      });
  });

  async function handleRsvpChange(newStatus: RsvpStatus) {
    if (!userId) return;
    setRsvpStatus(newStatus);

    await supabase.from("event_rsvps").upsert({
      event_id: event.id,
      user_id: userId,
      status: newStatus,
      note: rsvpNote || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id,user_id" });
  }

  async function handleRsvpNoteSave() {
    if (!userId) return;
    setShowRsvpNote(false);
    await supabase.from("event_rsvps").upsert({
      event_id: event.id,
      user_id: userId,
      status: rsvpStatus,
      note: rsvpNote || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id,user_id" });
  }

  // Edit fields
  const [editTitle, setEditTitle] = useState(event.title);
  const [editDate, setEditDate] = useState(format(startDate, "yyyy-MM-dd"));
  const [editStartTime, setEditStartTime] = useState(event.all_day ? "" : format(startDate, "HH:mm"));
  const [editEndTime, setEditEndTime] = useState(endDate ? format(endDate, "HH:mm") : "");
  const [editLocation, setEditLocation] = useState(event.location || "");
  const [editCategory, setEditCategory] = useState<EventCategory>(event.category);
  const [editChildIds, setEditChildIds] = useState<string[]>(
    event.children?.map((c) => c.id) || []
  );

  function startEdit() {
    setEditTitle(event.title);
    setEditDate(format(startDate, "yyyy-MM-dd"));
    setEditStartTime(event.all_day ? "" : format(startDate, "HH:mm"));
    setEditEndTime(endDate ? format(endDate, "HH:mm") : "");
    setEditLocation(event.location || "");
    setEditCategory(event.category);
    setEditChildIds(event.children?.map((c) => c.id) || []);
    setEditing(true);
  }

  function getTzOffset(): string {
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const m = String(Math.abs(offset) % 60).padStart(2, "0");
    return `${sign}${h}:${m}`;
  }

  async function handleSave() {
    if (!onUpdate || !editTitle || !editDate) return;
    setSaving(true);
    const tz = getTzOffset();
    const startDt = editStartTime
      ? `${editDate}T${editStartTime}:00${tz}`
      : `${editDate}T00:00:00${tz}`;
    const endDt = editEndTime ? `${editDate}T${editEndTime}:00${tz}` : null;

    await onUpdate(
      event.id,
      {
        title: editTitle,
        start_time: startDt,
        end_time: endDt,
        location: editLocation || null,
        category: editCategory,
        all_day: !editStartTime,
      },
      editChildIds
    );
    setSaving(false);
    setEditing(false);
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete(event.id);
    setDeleting(false);
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl border-2 border-[var(--color-primary)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-primary)]">Edit Event</span>
          <button onClick={() => setEditing(false)} className="p-1 text-[var(--color-text-secondary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Title"
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <input
            type="time"
            value={editStartTime}
            onChange={(e) => setEditStartTime(e.target.value)}
            placeholder="Start"
            className="px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <input
            type="time"
            value={editEndTime}
            onChange={(e) => setEditEndTime(e.target.value)}
            placeholder="End"
            className="px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
        <input
          type="text"
          value={editLocation}
          onChange={(e) => setEditLocation(e.target.value)}
          placeholder="Location"
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <div className="flex gap-2">
          <select
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value as EventCategory)}
            className="flex-1 px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {/* Child selector */}
        {allChildren && allChildren.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allChildren.map((child) => {
              const selected = editChildIds.includes(child.id);
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    if (selected) {
                      setEditChildIds(editChildIds.filter((id) => id !== child.id));
                    } else {
                      setEditChildIds([...editChildIds, child.id]);
                    }
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    selected
                      ? "border-transparent text-white"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] bg-white"
                  }`}
                  style={selected ? { backgroundColor: child.color || "var(--color-primary)" } : {}}
                >
                  {child.nickname || child.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !editTitle || !editDate}
            className="flex-1 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex gap-3">
      {/* Color bar */}
      <div
        className="w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: barColor }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[var(--color-text)] truncate">
            {event.title}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${categoryColor}15`,
                color: categoryColor,
              }}
            >
              {CATEGORY_LABELS[event.category]}
            </span>
            {onUpdate && !showConfirm && (
              <button
                onClick={startEdit}
                className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && !showConfirm && (
              <button
                onClick={() => setShowConfirm(true)}
                className="p-1 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {showConfirm ? (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-red-600">Delete this event?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs bg-red-600 text-white px-3 py-1 rounded-full font-medium"
            >
              {deleting ? "..." : "Yes, delete"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-xs text-[var(--color-text-secondary)] px-2 py-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {/* WHO */}
            <div className="flex items-center gap-1.5 mt-1.5">
              {event.children && event.children.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <User className="w-3.5 h-3.5 shrink-0" style={{ color: childColor || "var(--color-primary)" }} />
                  {event.children.map((c, i) => (
                    <span
                      key={c.id}
                      className="text-sm font-medium"
                      style={{ color: c.color || "var(--color-primary)" }}
                    >
                      {c.nickname || c.name}{i < event.children!.length - 1 ? "," : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-500">No child assigned</span>
                </>
              )}
            </div>

            {/* WHEN */}
            <div className="flex items-center gap-1 mt-1 text-sm text-[var(--color-text-secondary)]">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {event.all_day
                  ? "All day"
                  : endDate
                    ? `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`
                    : format(startDate, "h:mm a")}
              </span>
            </div>

            {/* WHERE */}
            {event.location && (
              <div className="flex items-center gap-1 mt-1 text-sm">
                <MapPin className="w-3.5 h-3.5 text-[var(--color-text-secondary)] shrink-0" />
                <a
                  href={getDirectionsUrl(event.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] hover:underline truncate flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate">{event.location}</span>
                  <Navigation className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}

            {/* RSVP / Availability */}
            {userId && rsvpLoaded && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRsvpChange("going")}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      rsvpStatus === "going"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    <CheckCircle className="w-3 h-3" /> Going
                  </button>
                  <button
                    onClick={() => handleRsvpChange("maybe")}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      rsvpStatus === "maybe"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    <HelpCircle className="w-3 h-3" /> Maybe
                  </button>
                  <button
                    onClick={() => handleRsvpChange("not_going")}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      rsvpStatus === "not_going"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    <XCircle className="w-3 h-3" /> Can&apos;t go
                  </button>
                  <button
                    onClick={() => setShowRsvpNote(!showRsvpNote)}
                    className={`p-1 rounded-full transition-colors ${
                      rsvpNote ? "text-[var(--color-primary)]" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
                {showRsvpNote && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={rsvpNote}
                      onChange={(e) => setRsvpNote(e.target.value)}
                      placeholder="Add a note (e.g. 'Can you drive?')"
                      className="flex-1 px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <button
                      onClick={handleRsvpNoteSave}
                      className="text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg font-medium"
                    >
                      Save
                    </button>
                  </div>
                )}
                {rsvpNote && !showRsvpNote && (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 italic">&quot;{rsvpNote}&quot;</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
