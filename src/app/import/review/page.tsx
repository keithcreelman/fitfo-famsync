"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  ArrowLeft,
  Loader2,
  Check,
  Camera,
  FileText,
} from "lucide-react";
import {
  type EventCategory,
  type ParsedEventData,
  CATEGORY_LABELS,
} from "@/lib/types";

function ImportReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importType = searchParams.get("type") || "screenshot";
  const supabase = createClient();

  const [householdId, setHouseholdId] = useState("");
  const [userId, setUserId] = useState("");
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [events, setEvents] = useState<ParsedEventData[]>([]);
  const [editIndex, setEditIndex] = useState(0);

  // CSV-specific state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvStep, setCsvStep] = useState<"map" | "review">("map");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Editable fields for current event
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<EventCategory>("other");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saveError, setSaveError] = useState("");

  const loadContext = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: memberships } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("invite_status", "accepted")
      .limit(1);
    const membership = memberships?.[0] || null;

    if (!membership) return;
    setHouseholdId(membership.household_id);

    const { data: childrenData } = await supabase
      .from("children")
      .select("id, name")
      .eq("household_id", membership.household_id);
    setChildren(childrenData || []);
  }, [supabase]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  function populateFromParsed(parsed: ParsedEventData) {
    setTitle(parsed.title || "");
    setDate(parsed.date || "");
    setStartTime(parsed.start_time || "");
    setEndTime(parsed.end_time || "");
    setCategory(parsed.category || "other");
    setLocation(parsed.location || "");
    setNotes(parsed.notes || "");
  }

  async function handleFileUpload(selectedFile: File, additionalFiles?: File[]) {
    setFile(selectedFile);
    setParsing(true);
    setParseError("");

    try {
      if (importType === "screenshot") {
        const allFiles = [selectedFile, ...(additionalFiles || [])];
        const allEvents: ParsedEventData[] = [];

        for (const f of allFiles) {
          const formData = new FormData();
          formData.append("file", f);
          formData.append("children_names", children.map((c) => c.name).join(", "));

          const res = await fetch("/api/parse-screenshot", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();

          if (!res.ok) {
            setParseError(`Failed to parse ${f.name}: ${data.error || "unknown error"}`);
            continue;
          }

          if (data.events && data.events.length > 0) {
            allEvents.push(...data.events);
          }
        }

        if (allEvents.length > 0) {
          setEvents(allEvents);
          populateFromParsed(allEvents[0]);
          setEditIndex(0);
        } else if (!parseError) {
          setParseError("No events found in the uploaded image(s). Try a clearer screenshot.");
        }
      } else if (importType === "ics") {
        // Read ICS file as text and parse client-side
        const text = await selectedFile.text();
        // Simple ICS parsing (basic VEVENT extraction)
        const veventMatch = text.match(
          /BEGIN:VEVENT[\s\S]*?END:VEVENT/g
        );
        if (veventMatch) {
          const parsedEvents: ParsedEventData[] = veventMatch.map(
            (vevent) => {
              const getField = (field: string) => {
                const match = vevent.match(
                  new RegExp(`${field}[^:]*:(.*)`)
                );
                return match ? match[1].trim() : undefined;
              };

              const summary = getField("SUMMARY");
              const dtstart = getField("DTSTART");
              const dtend = getField("DTEND");
              const loc = getField("LOCATION");
              const desc = getField("DESCRIPTION");

              // Parse date/time from ICS format
              let parsedDate = "";
              let parsedStartTime = "";
              let parsedEndTime = "";

              if (dtstart) {
                const d = dtstart.replace(/[TZ]/g, "");
                if (d.length >= 8) {
                  parsedDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
                }
                if (d.length >= 12) {
                  parsedStartTime = `${d.slice(8, 10)}:${d.slice(10, 12)}`;
                }
              }
              if (dtend) {
                const d = dtend.replace(/[TZ]/g, "");
                if (d.length >= 12) {
                  parsedEndTime = `${d.slice(8, 10)}:${d.slice(10, 12)}`;
                }
              }

              return {
                title: summary,
                date: parsedDate,
                start_time: parsedStartTime,
                end_time: parsedEndTime,
                location: loc,
                notes: desc,
                category: "other" as EventCategory,
              };
            }
          );

          setEvents(parsedEvents);
          if (parsedEvents.length > 0) {
            populateFromParsed(parsedEvents[0]);
            setEditIndex(0);
          }
        }
      } else if (importType === "csv") {
        // CSV or Excel file
        const XLSX = (await import("xlsx")).default;
        const bytes = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(bytes, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        if (jsonData.length >= 2) {
          const headers = (jsonData[0] as string[]).map((h) =>
            String(h || "").trim()
          );
          const rows = jsonData.slice(1).filter((row: string[]) =>
            row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== "")
          ) as string[][];

          setCsvHeaders(headers);
          setCsvRows(rows);

          // Auto-map columns by guessing from header names
          const autoMap: Record<string, string> = {};
          headers.forEach((h, i) => {
            const lower = h.toLowerCase();
            if (lower.includes("title") || lower.includes("event") || lower.includes("name") || lower.includes("subject")) {
              autoMap.title = String(i);
            } else if (lower.includes("date") && !lower.includes("end") && !lower.includes("time")) {
              autoMap.date = String(i);
            } else if (lower.includes("start") && lower.includes("time")) {
              autoMap.start_time = String(i);
            } else if (lower.includes("end") && lower.includes("time")) {
              autoMap.end_time = String(i);
            } else if (lower.includes("time") && !autoMap.start_time) {
              autoMap.start_time = String(i);
            } else if (lower.includes("location") || lower.includes("place") || lower.includes("venue")) {
              autoMap.location = String(i);
            } else if (lower.includes("note") || lower.includes("description") || lower.includes("detail")) {
              autoMap.notes = String(i);
            }
          });
          setCsvMapping(autoMap);

          // Select all rows by default
          setSelectedRows(new Set(rows.map((_, i) => i)));
          setCsvStep("map");
        }
      }
    } catch (error) {
      console.error("Parse error:", error);
      setParseError(`Upload error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const additional = Array.from(files).slice(1);
      handleFileUpload(files[0], additional);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function applyCsvMapping() {
    const mapped: ParsedEventData[] = [];
    csvRows.forEach((row, i) => {
      if (!selectedRows.has(i)) return;
      const event: ParsedEventData = {};
      if (csvMapping.title) event.title = String(row[Number(csvMapping.title)] || "");
      if (csvMapping.date) event.date = String(row[Number(csvMapping.date)] || "");
      if (csvMapping.start_time) event.start_time = String(row[Number(csvMapping.start_time)] || "");
      if (csvMapping.end_time) event.end_time = String(row[Number(csvMapping.end_time)] || "");
      if (csvMapping.location) event.location = String(row[Number(csvMapping.location)] || "");
      if (csvMapping.notes) event.notes = String(row[Number(csvMapping.notes)] || "");
      event.category = "other";
      if (event.title) mapped.push(event);
    });
    setEvents(mapped);
    if (mapped.length > 0) {
      populateFromParsed(mapped[0]);
      setEditIndex(0);
    }
    setCsvStep("review");
  }

  async function handleSaveAll() {
    if (!householdId) return;
    setSavingAll(true);
    try {
      for (const event of events) {
        const startDateTime = event.start_time
          ? `${event.date}T${event.start_time}:00`
          : `${event.date}T00:00:00`;
        const endDateTime = event.end_time ? `${event.date}T${event.end_time}:00` : null;

        await supabase.from("events").insert({
          household_id: householdId,
          title: event.title,
          start_time: startDateTime,
          end_time: endDateTime,
          category: event.category || "other",
          location: event.location || null,
          description: event.notes || null,
          all_day: !event.start_time,
          source_type: importType === "ics" ? "ics_import" : importType === "csv" ? "ics_import" : "screenshot_import",
          created_by: userId,
        });
      }
      setSaved(true);
    } catch (error) {
      console.error("Bulk save error:", error);
      setSaveError("Failed to save some events. Try again.");
    } finally {
      setSavingAll(false);
    }
  }

  async function handleSave() {
    if (!title || !date || !householdId) return;
    setSaving(true);

    try {
      const startDateTime = startTime
        ? `${date}T${startTime}:00`
        : `${date}T00:00:00`;
      const endDateTime = endTime ? `${date}T${endTime}:00` : null;

      await supabase.from("events").insert({
        household_id: householdId,
        title,
        start_time: startDateTime,
        end_time: endDateTime,
        category,
        location: location || null,
        description: notes || null,
        all_day: !startTime,
        source_type: importType === "ics" ? "ics_import" : "screenshot_import",
        created_by: userId,
      });

      // If there are more events to review
      if (editIndex < events.length - 1) {
        const nextIndex = editIndex + 1;
        setEditIndex(nextIndex);
        populateFromParsed(events[nextIndex]);
        setSaving(false);
      } else {
        setSaved(true);
        setSaving(false);
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen pb-8">
      <header className="bg-white border-b border-[var(--color-border)] px-4 py-3 pt-[env(safe-area-inset-top)]">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">
            {importType === "csv" ? "Import CSV/Excel" : importType === "ics" ? "Import ICS File" : "Import Screenshot"}
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {saved ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Events Saved</h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              {events.length} event{events.length !== 1 ? "s" : ""} added to
              your shared calendar.
            </p>
            <button
              onClick={() => router.push("/calendar")}
              className="py-3 px-6 bg-[var(--color-primary)] text-white font-semibold rounded-xl"
            >
              View Calendar
            </button>
          </div>
        ) : !file ? (
          /* File upload */
          <label className="block cursor-pointer" onDrop={handleDrop} onDragOver={handleDragOver}>
            <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-12 text-center hover:border-[var(--color-primary)] transition-colors">
              {importType === "screenshot" ? (
                <Camera className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-3" />
              ) : (
                <FileText className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-3" />
              )}
              <p className="font-semibold text-[var(--color-text)]">
                {importType === "csv"
                  ? "Upload a CSV or Excel file"
                  : importType === "screenshot"
                    ? "Upload a screenshot or photo"
                    : "Upload an .ics file"}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                {importType === "csv"
                  ? "From TeamSnap, GameChanger, school systems, or any spreadsheet"
                  : importType === "screenshot"
                    ? "Take a photo of a sports schedule, school flyer, etc."
                    : "From a calendar invite or exported events"}
              </p>
            </div>
            <input
              type="file"
              accept={
                importType === "csv"
                  ? ".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  : importType === "screenshot"
                    ? "image/*"
                    : ".ics,text/calendar"
              }
              multiple={importType === "screenshot"}
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const additional = Array.from(files).slice(1);
                  handleFileUpload(files[0], additional);
                }
              }}
              className="hidden"
            />
          </label>
        ) : parsing ? (
          <div className="text-center py-12">
            <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin mx-auto mb-3" />
            <p className="font-semibold">Extracting event details...</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              This may take a few seconds.
            </p>
          </div>
        ) : parseError && events.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-700 text-sm">{parseError}</p>
            </div>
            <button
              onClick={() => { setFile(null); setParseError(""); }}
              className="py-3 px-6 bg-[var(--color-primary)] text-white font-semibold rounded-xl"
            >
              Try Again
            </button>
          </div>
        ) : importType === "csv" && csvStep === "map" && csvHeaders.length > 0 ? (
          /* CSV Column Mapping */
          <div className="space-y-4">
            <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg">
              Found {csvRows.length} rows. Map columns to event fields, then select which rows to import.
            </div>

            <div className="space-y-3">
              {[
                { key: "title", label: "Event Title *", required: true },
                { key: "date", label: "Date *", required: true },
                { key: "start_time", label: "Start Time", required: false },
                { key: "end_time", label: "End Time", required: false },
                { key: "location", label: "Location", required: false },
                { key: "notes", label: "Notes", required: false },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-28 text-sm font-medium text-[var(--color-text-secondary)] shrink-0">
                    {label}
                  </label>
                  <select
                    value={csvMapping[key] || ""}
                    onChange={(e) =>
                      setCsvMapping((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="flex-1 px-3 py-2.5 border border-[var(--color-border)] rounded-lg bg-white text-sm"
                  >
                    <option value="">— Skip —</option>
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={String(i)}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview first 3 rows */}
            <div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Preview ({Math.min(3, csvRows.length)} of {csvRows.length} rows):
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-[var(--color-border)] rounded-lg">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-2 py-1.5 text-left w-8">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === csvRows.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRows(new Set(csvRows.map((_, i) => i)));
                            } else {
                              setSelectedRows(new Set());
                            }
                          }}
                        />
                      </th>
                      {csvHeaders.map((h, i) => (
                        <th key={i} className="px-2 py-1.5 text-left font-medium truncate max-w-[100px]">
                          {h || `Col ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className={`border-t border-[var(--color-border)] ${!selectedRows.has(i) ? "opacity-40" : ""}`}>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(i)}
                            onChange={(e) => {
                              const next = new Set(selectedRows);
                              if (e.target.checked) next.add(i);
                              else next.delete(i);
                              setSelectedRows(next);
                            }}
                          />
                        </td>
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1.5 truncate max-w-[100px]">
                            {String(cell || "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvRows.length > 5 && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  + {csvRows.length - 5} more rows (all selected by default)
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFile(null);
                  setCsvHeaders([]);
                  setCsvRows([]);
                }}
                className="py-3 px-4 border border-[var(--color-border)] text-[var(--color-text)] font-semibold rounded-xl"
              >
                Back
              </button>
              <button
                onClick={applyCsvMapping}
                disabled={!csvMapping.title || !csvMapping.date || selectedRows.size === 0}
                className="flex-1 py-3 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50"
              >
                Import {selectedRows.size} Event{selectedRows.size !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        ) : importType === "csv" && csvStep === "review" && events.length > 0 ? (
          /* CSV Bulk Review — show all parsed events, save all at once */
          <div className="space-y-4">
            <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg">
              {events.length} event{events.length !== 1 ? "s" : ""} ready to import. Review below.
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {events.map((event, i) => (
                <div key={i} className="bg-white border border-[var(--color-border)] rounded-lg p-3">
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {event.date}{event.start_time ? ` at ${event.start_time}` : ""}{event.location ? ` — ${event.location}` : ""}
                  </p>
                </div>
              ))}
            </div>

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{saveError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setCsvStep("map")}
                className="py-3 px-4 border border-[var(--color-border)] text-[var(--color-text)] font-semibold rounded-xl"
              >
                Back
              </button>
              <button
                onClick={handleSaveAll}
                disabled={savingAll}
                className="flex-1 py-3 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingAll ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  `Save All ${events.length} Events`
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Review form (screenshot/ICS single-event review) */
          <div className="space-y-4">
            {events.length > 1 && (
              <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg text-center">
                Event {editIndex + 1} of {events.length}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as EventCategory)
                  }
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Start time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  End time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !title || !date}
              className="w-full py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : editIndex < events.length - 1 ? (
                "Save & Next Event"
              ) : (
                "Save Event"
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ImportReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      }
    >
      <ImportReviewContent />
    </Suspense>
  );
}
