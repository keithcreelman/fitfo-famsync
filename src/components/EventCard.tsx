"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  MapPin, Clock, Trash2, User, AlertCircle, Navigation,
  Pencil, X, Check, Loader2, CheckCircle, HelpCircle, XCircle,
  MessageSquare, Car,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import {
  type CalendarEvent, type EventCategory, type Child,
  CATEGORY_LABELS, CATEGORY_COLORS, isGameEvent,
  PARENT_HOMES, estimateDriveFromHome,
} from "@/lib/types";
import { getResponsibleParent, getCustodyName } from "@/lib/custody";

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
  const [rsvpLoaded, setRsvpLoaded] = useState(false);

  // Comments
  const [comments, setComments] = useState<{ id: string; user_id: string; body: string; created_at: string; profile?: { display_name: string } }[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentCount, setCommentCount] = useState(0);

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
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id,user_id" });
  }

  // Load comment count on mount
  useState(() => {
    supabase
      .from("event_comments")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .then(({ count }) => setCommentCount(count || 0));
  });

  async function loadComments() {
    const { data } = await supabase
      .from("event_comments")
      .select("id, user_id, body, created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });

    // Get profile names for commenters
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.display_name]));

      setComments(data.map((c) => ({
        ...c,
        profile: { display_name: profileMap.get(c.user_id) || "Parent" },
      })));
    } else {
      setComments([]);
    }
  }

  async function handlePostComment() {
    if (!newComment.trim() || !userId) return;
    await supabase.from("event_comments").insert({
      event_id: event.id,
      user_id: userId,
      body: newComment.trim(),
    });
    setNewComment("");
    setCommentCount((c) => c + 1);
    await loadComments();
  }

  async function toggleComments() {
    if (!showComments) {
      await loadComments();
    }
    setShowComments(!showComments);
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

  const isGame = isGameEvent(event.title);

  return (
    <div className={`rounded-xl p-4 flex gap-3 ${
      isGame
        ? "bg-white border-2 shadow-sm"
        : "bg-gray-50/70 border border-[var(--color-border)]"
    }`} style={isGame ? { borderColor: barColor } : {}}>
      {/* Color bar */}
      <div
        className={`rounded-full shrink-0 ${isGame ? "w-2" : "w-1.5"}`}
        style={{ backgroundColor: barColor }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`truncate ${isGame ? "font-bold text-[var(--color-text)]" : "font-semibold text-[var(--color-text)]"}`}>
            {event.title}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {isGame && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wider">
                Game
              </span>
            )}
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

            {/* RESPONSIBLE PARENT + DEPART BY */}
            {(() => {
              const childNames = event.children?.map((c) => c.nickname || c.name) || [];
              // Check for manual override stored in description
              const overrideMatch = event.description?.match(/assigned_parent:(dad|mom)/);
              const defaultParent = getResponsibleParent(startDate, event.title, childNames, event.category);
              const responsible = overrideMatch ? overrideMatch[1] as "dad" | "mom" : defaultParent;
              const isOverridden = overrideMatch && overrideMatch[1] !== defaultParent;
              const parentName = getCustodyName(responsible);
              const otherParent = responsible === "dad" ? "mom" : "dad";
              const parentHome = PARENT_HOMES[responsible];
              const driveMin = event.location ? estimateDriveFromHome(parentHome.address, event.location) : null;
              const arriveEarly = isGame ? 40 : 10;
              const departBy = driveMin !== null && !event.all_day
                ? new Date(startDate.getTime() - (driveMin + arriveEarly) * 60000)
                : null;

              return (
                <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                  <button
                    onClick={async () => {
                      if (!onUpdate) return;
                      // Toggle to the other parent
                      const newParent = otherParent;
                      const currentDesc = event.description || "";
                      const cleanDesc = currentDesc.replace(/\s*assigned_parent:(dad|mom)/, "");
                      const newDesc = newParent === defaultParent
                        ? cleanDesc // switching back to default, remove override
                        : `${cleanDesc} assigned_parent:${newParent}`;
                      await onUpdate(event.id, { description: newDesc.trim() });
                    }}
                    className={`font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${
                      responsible === "dad" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}
                    title="Tap to switch parent"
                  >
                    {parentName}
                    <svg className="w-2.5 h-2.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                  {isOverridden && (
                    <span className="text-[10px] text-amber-500 font-medium">swapped</span>
                  )}
                  {departBy && (
                    <span className="text-[var(--color-text-secondary)] flex items-center gap-1">
                      <Car className="w-3 h-3" />
                      leave by <span className="font-semibold text-[var(--color-text)]">{format(departBy, "h:mm a")}</span>
                      <span className="text-[10px]">({driveMin}m)</span>
                    </span>
                  )}
                </div>
              );
            })()}

            {/* RSVP + Comments */}
            {userId && rsvpLoaded && (
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
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
                <span className="text-gray-200">|</span>
                <button
                  onClick={toggleComments}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                    commentCount > 0
                      ? "text-[var(--color-primary)] font-medium"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  {commentCount > 0 ? commentCount : ""}
                </button>
              </div>
            )}

            {/* Comment thread */}
            {userId && showComments && (
              <div className="mt-2 space-y-2">
                {/* Thread */}
                {comments.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 shrink-0 mt-0.5">
                          {c.profile?.display_name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="text-xs">
                            <span className="font-medium">{c.profile?.display_name || "Parent"}</span>
                            <span className="text-[var(--color-text-secondary)] ml-1.5">
                              {format(new Date(c.created_at), "MMM d, h:mm a")}
                            </span>
                          </p>
                          <p className="text-xs text-[var(--color-text)] mt-0.5">{c.body}</p>
                        </div>
                      </div>
                    ))}

                    {/* New comment input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handlePostComment(); }}
                        placeholder="Add a comment..."
                        className="flex-1 px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                      <button
                        onClick={handlePostComment}
                        disabled={!newComment.trim()}
                        className="text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg font-medium disabled:opacity-50"
                      >
                        Post
                      </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
