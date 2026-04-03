"use client";

import { useState } from "react";
import { format } from "date-fns";
import { MapPin, Clock, Trash2, User, AlertCircle, Navigation } from "lucide-react";
import { type CalendarEvent, CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types";

interface EventCardProps {
  event: CalendarEvent;
  onDelete?: (eventId: string) => Promise<void>;
}

function getDirectionsUrl(location: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;
}

export default function EventCard({ event, onDelete }: EventCardProps) {
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : null;
  const categoryColor = CATEGORY_COLORS[event.category] || "#6b7280";
  // Use first child's color for the bar, fallback to category color
  const childColor = event.children?.[0]?.color || null;
  const barColor = childColor || categoryColor;
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
      {/* Color bar — child color if assigned, otherwise category */}
      <div
        className="w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: barColor }}
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
            {/* WHO — child name(s) */}
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

            {/* WHEN — time */}
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

            {/* WHERE — location with directions */}
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
          </>
        )}
      </div>
    </div>
  );
}
