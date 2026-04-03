"use client";

import { useState } from "react";
import { format, isSameMonth } from "date-fns";
import { AlertTriangle, Car, ChevronDown, ChevronUp } from "lucide-react";
import { type CalendarEvent, isGameEvent } from "@/lib/types";
import { getResponsibleParent, getCustodyName } from "@/lib/custody";

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
  gameCount: number;
}

function getDayIssues(events: CalendarEvent[], month: Date): DayIssue[] {
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

    // Check for same-parent conflicts
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

      // Only flag if same parent is responsible
      const aNames = a.children?.map((c) => c.nickname || c.name) || [];
      const bNames = b.children?.map((c) => c.nickname || c.name) || [];
      const aParent = a.assigned_parent || getResponsibleParent(new Date(a.start_time), a.title, aNames, a.category);
      const bParent = b.assigned_parent || getResponsibleParent(new Date(b.start_time), b.title, bNames, b.category);
      if (aParent !== bParent) continue;

      const aEnd = a.end_time ? new Date(a.end_time) : new Date(new Date(a.start_time).getTime() + 3600000);
      const gap = (new Date(b.start_time).getTime() - aEnd.getTime()) / 60000;
      if (gap < 40) {
        hasConflict = true;
        break;
      }
    }

    const locations = new Set(dayEvents.map((e) => e.location).filter(Boolean));
    const isHighTravel = locations.size >= 2 && dayEvents.length >= 2;
    const isBusy = dayEvents.length >= 3;

    if (hasConflict) {
      const parent = getCustodyName(getResponsibleParent(date, "", [], "other"));
      issues.push({ date, dateLabel, type: "conflict", description: `${parent} has a tight turnaround`, gameCount });
    } else if (isHighTravel && isBusy) {
      issues.push({ date, dateLabel, type: "heavy_travel", description: `${dayEvents.length} events, ${locations.size} locations`, gameCount });
    }
  }

  issues.sort((a, b) => a.date.getTime() - b.date.getTime());
  return issues;
}

export default function MonthSummary({ events, currentMonth, onSelectDate }: MonthSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const issues = getDayIssues(events, currentMonth);

  if (issues.length === 0) return null;

  const conflictCount = issues.filter((i) => i.type === "conflict").length;
  const travelCount = issues.filter((i) => i.type === "heavy_travel").length;

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
            {format(currentMonth, "MMMM")} Heads Up
          </span>
          <div className="flex gap-1">
            {conflictCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                {conflictCount} conflict{conflictCount > 1 ? "s" : ""}
              </span>
            )}
            {travelCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">
                {travelCount} busy
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)]">
          {issues.map((issue) => (
            <button
              key={issue.dateLabel}
              onClick={() => { onSelectDate(issue.date); setExpanded(false); }}
              className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
            >
              {issue.type === "conflict" ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              ) : (
                <Car className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span className="text-xs font-medium text-[var(--color-text)] w-20 shrink-0">{issue.dateLabel}</span>
              <span className="text-[11px] text-[var(--color-text-secondary)] flex-1 truncate">{issue.description}</span>
              {issue.gameCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                  {issue.gameCount}G
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
