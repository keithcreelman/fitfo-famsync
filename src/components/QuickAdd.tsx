"use client";

import { useState, useRef, useEffect } from "react";
import { X, Loader2, Sparkles, Camera, FileText, Calendar, Table } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type EventCategory,
  type ParsedEventData,
  CATEGORY_LABELS,
} from "@/lib/types";

interface QuickAddProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: {
    title: string;
    start_time: string;
    end_time?: string;
    category: EventCategory;
    location?: string;
    description?: string;
    child_ids?: string[];
    all_day?: boolean;
  }) => Promise<void>;
  children: { id: string; name: string }[];
  householdId: string;
}

export default function QuickAdd({
  isOpen,
  onClose,
  onSave,
  children,
  householdId,
}: QuickAddProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"nlp" | "form">("nlp");
  const [nlpInput, setNlpInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<ParsedEventData | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<EventCategory>("other");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function resetForm() {
    setNlpInput("");
    setParsed(null);
    setTitle("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setCategory("other");
    setLocation("");
    setDescription("");
    setSelectedChildren([]);
    setMode("nlp");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleNlpParse() {
    if (!nlpInput.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/parse-nlp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: nlpInput,
          household_id: householdId,
          children_names: children.map((c) => c.name),
        }),
      });
      const data = await res.json();
      if (data.parsed) {
        setParsed(data.parsed);
        // Populate form fields from parsed data
        setTitle(data.parsed.title || nlpInput);
        if (data.parsed.date) setDate(data.parsed.date);
        if (data.parsed.start_time) setStartTime(data.parsed.start_time);
        if (data.parsed.end_time) setEndTime(data.parsed.end_time);
        if (data.parsed.category) setCategory(data.parsed.category);
        if (data.parsed.location) setLocation(data.parsed.location);
        if (data.parsed.child_name) {
          const match = children.find(
            (c) =>
              c.name.toLowerCase() === data.parsed.child_name?.toLowerCase()
          );
          if (match) setSelectedChildren([match.id]);
        }
        setMode("form");
      }
    } catch {
      // Fallback to manual form
      setTitle(nlpInput);
      setMode("form");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    if (!title || !date) return;
    setSaving(true);
    try {
      const startDateTime = startTime
        ? `${date}T${startTime}:00`
        : `${date}T00:00:00`;
      const endDateTime = endTime ? `${date}T${endTime}:00` : undefined;

      await onSave({
        title,
        start_time: startDateTime,
        end_time: endDateTime,
        category,
        location: location || undefined,
        description: description || undefined,
        child_ids: selectedChildren.length > 0 ? selectedChildren : undefined,
        all_day: !startTime,
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold">Add Event</h2>
          <button onClick={handleClose} className="p-1">
            <X className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {mode === "nlp" ? (
            <>
              {/* NLP Input */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Type it naturally
                </label>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={nlpInput}
                    onChange={(e) => setNlpInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNlpParse()}
                    placeholder='e.g. "Parker dentist Tuesday 3:30"'
                    className="flex-1 px-4 py-3 border border-[var(--color-border)] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <button
                    onClick={handleNlpParse}
                    disabled={parsing || !nlpInput.trim()}
                    className="px-4 py-3 bg-[var(--color-primary)] text-white rounded-xl disabled:opacity-50 flex items-center gap-1"
                  >
                    {parsing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">
                  Include child name, event, date, and time — we&apos;ll parse
                  it for you.
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  or
                </span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>

              {/* Manual / Import buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("form")}
                  className="flex flex-col items-center gap-2 p-4 border border-[var(--color-border)] rounded-xl hover:bg-gray-50"
                >
                  <FileText className="w-6 h-6 text-[var(--color-text-secondary)]" />
                  <span className="text-sm font-medium">Manual</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push("/import/review?type=screenshot");
                  }}
                  className="flex flex-col items-center gap-2 p-4 border border-[var(--color-border)] rounded-xl hover:bg-gray-50"
                >
                  <Camera className="w-6 h-6 text-[var(--color-text-secondary)]" />
                  <span className="text-sm font-medium">Screenshot</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push("/import/review?type=ics");
                  }}
                  className="flex flex-col items-center gap-2 p-4 border border-[var(--color-border)] rounded-xl hover:bg-gray-50"
                >
                  <Calendar className="w-6 h-6 text-[var(--color-text-secondary)]" />
                  <span className="text-sm font-medium">ICS File</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push("/import/review?type=csv");
                  }}
                  className="flex flex-col items-center gap-2 p-4 border border-[var(--color-border)] rounded-xl hover:bg-gray-50"
                >
                  <Table className="w-6 h-6 text-[var(--color-text-secondary)]" />
                  <span className="text-sm font-medium">CSV/Excel</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Parsed indicator */}
              {parsed && (
                <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Parsed from: &quot;{nlpInput}&quot; — edit anything below.
                </div>
              )}

              {/* Structured form */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Event title"
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
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
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
                  placeholder="Optional"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              {/* Child selection */}
              {children.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Which child?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() =>
                          setSelectedChildren((prev) =>
                            prev.includes(child.id)
                              ? prev.filter((id) => id !== child.id)
                              : [...prev, child.id]
                          )
                        }
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                          selectedChildren.includes(child.id)
                            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                            : "bg-white text-[var(--color-text)] border-[var(--color-border)] hover:bg-gray-50"
                        }`}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Notes
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                  rows={2}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                {parsed && (
                  <button
                    onClick={() => {
                      resetForm();
                    }}
                    className="flex-1 py-3 px-4 border border-[var(--color-border)] text-[var(--color-text)] font-semibold rounded-xl"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !title || !date}
                  className="flex-1 py-3 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Save Event"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
