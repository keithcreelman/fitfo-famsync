"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { ArrowLeft, Loader2, Check, X, SkipForward, FileText, Pencil } from "lucide-react";
import { type EventCategory, CATEGORY_LABELS } from "@/lib/types";

interface ParsedEvent {
  title?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  category?: string;
  notes?: string;
  all_day?: boolean;
}

export default function PdfImportPage() {
  const router = useRouter();
  const supabase = createClient();

  const [householdId, setHouseholdId] = useState("");
  const [userId, setUserId] = useState("");
  const [children, setChildren] = useState<{ id: string; name: string; nickname: string | null }[]>([]);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Review state
  const [allEvents, setAllEvents] = useState<ParsedEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [done, setDone] = useState(false);

  // Edit fields for current event
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editCategory, setEditCategory] = useState<EventCategory>("school");
  const [editChildIds, setEditChildIds] = useState<string[]>([]);

  const loadContext = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: memberships } = await supabase
      .from("household_members").select("household_id")
      .eq("user_id", user.id).eq("invite_status", "accepted").limit(1);
    const membership = memberships?.[0];
    if (!membership) return;
    setHouseholdId(membership.household_id);
    const { data: childrenData } = await supabase
      .from("children").select("id, name, nickname")
      .eq("household_id", membership.household_id);
    setChildren(childrenData || []);
  }, [supabase]);

  useEffect(() => { loadContext(); }, [loadContext]);

  function populateFromEvent(ev: ParsedEvent) {
    setEditTitle(ev.title || "");
    setEditDate(ev.date || "");
    setEditStartTime(ev.start_time || "");
    setEditEndTime(ev.end_time || "");
    setEditCategory((ev.category as EventCategory) || "school");
    setEditChildIds([]);
    setEditing(false);
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("children_names", children.map((c) => c.name).join(", "));

    try {
      const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
      const responseText = await res.text();
      let data;
      try { data = JSON.parse(responseText); } catch {
        setUploadError(`Non-JSON response: ${responseText.substring(0, 200)}`);
        setUploading(false);
        return;
      }
      if (!res.ok) {
        setUploadError(data.error || "Failed to parse PDF");
        setUploading(false);
        return;
      }
      if (!data.events || data.events.length === 0) {
        setUploadError("No events found in PDF");
        setUploading(false);
        return;
      }
      // Sort by date
      const sorted = data.events.sort((a: ParsedEvent, b: ParsedEvent) =>
        (a.date || "").localeCompare(b.date || "")
      );
      setAllEvents(sorted);
      setCurrentIndex(0);
      populateFromEvent(sorted[0]);
    } catch (err) {
      setUploadError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  function getTzOffset(): string {
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const m = String(Math.abs(offset) % 60).padStart(2, "0");
    return `${sign}${h}:${m}`;
  }

  async function handleConfirm() {
    if (!editTitle || !editDate || !householdId) return;
    const tz = getTzOffset();
    const startDt = editStartTime ? `${editDate}T${editStartTime}:00${tz}` : `${editDate}T00:00:00${tz}`;
    const endDt = editEndTime ? `${editDate}T${editEndTime}:00${tz}` : null;

    const { data: newEvent } = await supabase.from("events").insert({
      household_id: householdId,
      title: editTitle,
      start_time: startDt,
      end_time: endDt,
      category: editCategory,
      all_day: !editStartTime,
      source_type: "ics_import",
      created_by: userId,
    }).select("id").single();

    if (newEvent && editChildIds.length > 0) {
      await supabase.from("event_children").insert(
        editChildIds.map((cid) => ({ event_id: newEvent.id, child_id: cid }))
      );
    }

    setSavedCount((c) => c + 1);
    goNext();
  }

  function handleSkip() {
    setSkippedCount((c) => c + 1);
    goNext();
  }

  function goNext() {
    const next = currentIndex + 1;
    if (next >= allEvents.length) {
      setDone(true);
    } else {
      setCurrentIndex(next);
      populateFromEvent(allEvents[next]);
    }
  }

  const current = allEvents[currentIndex];

  return (
    <div className="min-h-screen pb-8">
      <header className="bg-white border-b border-[var(--color-border)] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="text-lg font-bold">Import School Calendar</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {done ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Import Complete</h2>
            <p className="text-[var(--color-text-secondary)] mb-1">{savedCount} event{savedCount !== 1 ? "s" : ""} added</p>
            <p className="text-[var(--color-text-secondary)] mb-6">{skippedCount} skipped</p>
            <button onClick={() => router.push("/calendar")} className="py-3 px-6 bg-[var(--color-primary)] text-white font-semibold rounded-xl">
              View Calendar
            </button>
          </div>
        ) : allEvents.length === 0 ? (
          /* Upload step */
          <div>
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-12 text-center hover:border-[var(--color-primary)] transition-colors">
                <FileText className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-3" />
                <p className="font-semibold">Upload a school calendar PDF</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  AI will extract all dates and events for you to review one by one
                </p>
              </div>
              <input type="file" accept=".pdf,application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            </label>
            {uploading && (
              <div className="text-center py-8">
                <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin mx-auto mb-3" />
                <p className="font-semibold">Reading PDF...</p>
                <p className="text-sm text-[var(--color-text-secondary)]">This may take 10-15 seconds</p>
              </div>
            )}
            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                <p className="text-red-700 text-sm">{uploadError}</p>
              </div>
            )}
          </div>
        ) : (
          /* Review step — one event at a time */
          <div>
            {/* Progress */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Event {currentIndex + 1} of {allEvents.length}
              </span>
              <div className="flex gap-2 text-xs">
                <span className="text-green-600 font-medium">{savedCount} saved</span>
                <span className="text-gray-400">{skippedCount} skipped</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
              <div className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all"
                style={{ width: `${((currentIndex) / allEvents.length) * 100}%` }} />
            </div>

            {/* Event card */}
            <div className="bg-white border-2 border-[var(--color-border)] rounded-xl p-5 space-y-3">
              {!editing ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{current?.title}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{current?.date}</p>
                      {current?.start_time && (
                        <p className="text-sm text-[var(--color-text-secondary)]">{current.start_time}{current.end_time ? ` - ${current.end_time}` : ""}</p>
                      )}
                      {current?.notes && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1 italic">{current.notes}</p>
                      )}
                    </div>
                    <button onClick={() => { setEditing(true); }} className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Child selector */}
                  {children.length > 0 && (
                    <div>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-1.5">Assign to:</p>
                      <div className="flex gap-2 flex-wrap">
                        {children.map((child) => {
                          const sel = editChildIds.includes(child.id);
                          return (
                            <button key={child.id} onClick={() => {
                              setEditChildIds(sel ? editChildIds.filter((id) => id !== child.id) : [...editChildIds, child.id]);
                            }} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${sel ? "bg-[var(--color-primary)] text-white border-transparent" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>
                              {child.nickname || child.name}
                            </button>
                          );
                        })}
                        <button onClick={() => setEditChildIds(children.map((c) => c.id))}
                          className={`text-xs px-3 py-1.5 rounded-full border font-medium ${editChildIds.length === children.length ? "bg-gray-600 text-white border-transparent" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>
                          Both
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Edit mode */
                <div className="space-y-3">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title"
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                      className="px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
                    <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} placeholder="Start"
                      className="px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
                    <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} placeholder="End"
                      className="px-2 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
                  </div>
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as EventCategory)}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-white">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <button onClick={() => setEditing(false)} className="text-sm text-[var(--color-primary)] font-medium">Done editing</button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4">
              <button onClick={handleSkip}
                className="flex-1 py-3 border border-[var(--color-border)] rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 text-[var(--color-text-secondary)]">
                <SkipForward className="w-4 h-4" /> Skip
              </button>
              <button onClick={handleConfirm} disabled={!editTitle || !editDate}
                className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Check className="w-4 h-4" /> Add Event
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
