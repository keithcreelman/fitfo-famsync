"use client";

import { format, isSameDay, isSameMonth } from "date-fns";
import { AlertTriangle, Car, MapPin } from "lucide-react";
import { type CalendarEvent, isGameEvent } from "@/lib/types";

interface MonthSummaryProps {
  events: CalendarEvent[];
  currentMonth: Date;
  onSelectDate: (date: Date) => void;
}

interface DayIssue {
  date: Date;
  dateLabel: string;
  type: "conflict" | "heavy_travel" | "busy";
  description: string;
  eventCount: number;
  gameCount: number;
}

function getDayIssues(events: CalendarEvent[], month: Date): DayIssue[] {
  // Group events by day
  const byDay = new Map<string, { date: Date; events: CalendarEvent[] }>();
  for (const e of events) {
    const d = new Date(e.start_time);
    if (!isSameMonth(d, month)) continue;
    const key = format(d, "yyyy-MM-dd");
    if (!byDay.has(key)) byDay.set(key, { date: d, events: [] });
    byDay.get(key)!.events.push(e);
  }

  const issues: DayIssue[] = [];

  for (const [, { date, events: dayEvents }] of byDay) {
    const gameCount = dayEvents.filter((e) => isGameEvent(e.title)).length;
    const dateLabel = format(date, "EEE, MMM d");

    // Check for conflicts (different children, close times)
    const sorted = [...dayEvents].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    let hasConflict = false;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const aChildIds = new Set(a.children?.map((c) => c.id) || []);
      const bChildIds = new Set(b.children?.map((c) => c.id) || []);
      if ([...aChildIds].some((id) => bChildIds.has(id))) continue;
      if (aChildIds.size === 0 || bChildIds.size === 0) continue;
      const aEnd = a.end_time ? new Date(a.end_time) : new Date(new Date(a.start_time).getTime() + 3600000);
      const gap = (new Date(b.start_time).getTime() - aEnd.getTime()) / 60000;
      if (gap < 40) {
        hasConflict = true;
        break;
      }
    }

    // Count unique locations
    const locations = new Set(dayEvents.map((e) => e.location).filter(Boolean));
    const isHighTravel = locations.size >= 2;

    // Busy day (3+ events)
    const isBusy = dayEvents.length >= 3;

    if (hasConflict) {
      const childNames = [...new Set(dayEvents.flatMap((e) => e.children?.map((c) => c.nickname || c.name) || []))];
      issues.push({
        date,
        dateLabel,
        type: "conflict",
        description: `${childNames.join(" & ")} — tight turnaround`,
        eventCount: dayEvents.length,
        gameCount,
      });
    } else if (isHighTravel) {
      issues.push({
        date,
        dateLabel,
        type: "heavy_travel",
        description: `${locations.size} locations across ${dayEvents.length} events`,
        eventCount: dayEvents.length,
        gameCount,
      });
    } else if (isBusy) {
      issues.push({
        date,
        dateLabel,
        type: "busy",
        description: `${dayEvents.length} events${gameCount > 0 ? ` (${gameCount} game${gameCount > 1 ? "s" : ""})` : ""}`,
        eventCount: dayEvents.length,
        gameCount,
      });
    }
  }

  // Sort by date
  issues.sort((a, b) => a.date.getTime() - b.date.getTime());
  return issues;
}

export default function MonthSummary({ events, currentMonth, onSelectDate }: MonthSummaryProps) {
  const issues = getDayIssues(events, currentMonth);

  if (issues.length === 0) return null;

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
        <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
          Heads Up — {format(currentMonth, "MMMM")}
        </h3>
      </div>
      <div className="divide-y divide-gray-50">
        {issues.map((issue) => (
          <button
            key={issue.dateLabel}
            onClick={() => onSelectDate(issue.date)}
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              issue.type === "conflict"
                ? "bg-red-100"
                : issue.type === "heavy_travel"
                  ? "bg-amber-100"
                  : "bg-blue-50"
            }`}>
              {issue.type === "conflict" ? (
                <AlertTriangle className="w-3 h-3 text-red-500" />
              ) : issue.type === "heavy_travel" ? (
                <Car className="w-3 h-3 text-amber-600" />
              ) : (
                <MapPin className="w-3 h-3 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-text)]">{issue.dateLabel}</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{issue.description}</p>
            </div>
            {issue.gameCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                {issue.gameCount}G
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
