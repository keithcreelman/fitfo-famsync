"use client";

import { useState } from "react";
import { format } from "date-fns";
import { MapPin, Clock, Trash2, X } from "lucide-react";
import { type CalendarEvent, CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types";

interface EventCardProps {
  event: CalendarEvent;
  onDelete?: (eventId: string) => Promise<void>;
}

export default function EventCard({ event, onDelete }: EventCardProps) {
  const startDate = new Date(event.start_time);
  const categoryColor = CATEGORY_COLORS[event.category] || "#6b7280";
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete(event.id);
    setDeleting(false);
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex gap-3">
      {/* Category color bar */}
      <div
        className="w-1 rounded-full shrink-0"
        style={{ backgroundColor: categoryColor }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[var(--color-text)] truncate">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${categoryColor}15`,
                color: categoryColor,
              }}
            >
              {CATEGORY_LABELS[event.category]}
            </span>
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
            <div className="flex items-center gap-3 mt-1.5 text-sm text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {event.all_day ? "All day" : format(startDate, "h:mm a")}
              </span>
              {event.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {event.location}
                </span>
              )}
            </div>

            {event.children && event.children.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {event.children.map((child) => (
                  <span
                    key={child.id}
                    className="text-xs bg-gray-100 text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full"
                  >
                    {child.nickname || child.name}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
