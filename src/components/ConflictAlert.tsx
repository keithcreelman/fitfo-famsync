"use client";

import { AlertTriangle, Car } from "lucide-react";
import { type CalendarEvent, isGameEvent } from "@/lib/types";

interface ConflictAlertProps {
  events: CalendarEvent[];
}

interface Conflict {
  eventA: CalendarEvent;
  eventB: CalendarEvent;
  type: "overlap" | "tight";
  gapMinutes: number;
  driveEstimate: string;
  canMakeIt: "likely" | "tight" | "unlikely";
}

// Rough drive time estimate between two locations (in minutes)
// Uses straight-line heuristic — real implementation would use Google Maps API
function estimateDriveMinutes(locA: string | null, locB: string | null): number {
  if (!locA || !locB) return 15; // unknown — assume 15 min

  // If same venue, no drive needed
  const normalizeVenue = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
  if (normalizeVenue(locA) === normalizeVenue(locB)) return 0;

  // Check if same town (look for town name in address)
  const townA = extractTown(locA);
  const townB = extractTown(locB);
  if (townA && townB && townA === townB) return 10;

  // Different towns — estimate 20-30 min for central MA distances
  return 25;
}

function extractTown(location: string): string | null {
  // Try to find town name from typical address patterns
  // "Fiskdale - Tantasqua HS - Stadium Field, 319 Brookfield Road, Sturbridge, Massachusetts 01518"
  // "Southbridge Gym, 25 Cole Ave, Southbridge, MA 01550, USA"
  // "Woodstock Middle School"
  const parts = location.split(",").map((s) => s.trim());
  // Usually the town is the 2nd-to-last or 3rd-to-last part
  for (const part of parts) {
    const clean = part.replace(/\d{5}.*/, "").replace(/\b(MA|Massachusetts|USA|CT|Connecticut)\b/gi, "").trim();
    if (clean.length > 2 && clean.length < 30 && !/^\d/.test(clean)) {
      return clean.toLowerCase();
    }
  }
  // Fallback: first word of location
  const firstWord = location.split(/[\s,-]/)[0].toLowerCase();
  return firstWord.length > 2 ? firstWord : null;
}

function detectConflicts(events: CalendarEvent[]): Conflict[] {
  const conflicts: Conflict[] = [];
  if (events.length < 2) return conflicts;

  // Sort by start time
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      // Skip if same child (no logistic conflict)
      const aChildIds = new Set(a.children?.map((c) => c.id) || []);
      const bChildIds = new Set(b.children?.map((c) => c.id) || []);
      const sameChild = [...aChildIds].some((id) => bChildIds.has(id));
      if (sameChild) continue;

      // Skip if both unassigned
      if (aChildIds.size === 0 && bChildIds.size === 0) continue;

      const aEnd = a.end_time ? new Date(a.end_time) : new Date(new Date(a.start_time).getTime() + 60 * 60000);
      const bStart = new Date(b.start_time);

      const gapMinutes = Math.round((bStart.getTime() - aEnd.getTime()) / 60000);
      const driveMin = estimateDriveMinutes(a.location, b.location);

      let type: "overlap" | "tight";
      let canMakeIt: "likely" | "tight" | "unlikely";

      if (gapMinutes < 0) {
        // Events overlap in time
        type = "overlap";
        canMakeIt = "unlikely";
      } else if (gapMinutes < driveMin + 10) {
        // Gap is less than drive time + 10 min buffer
        type = "tight";
        canMakeIt = gapMinutes >= driveMin ? "tight" : "unlikely";
      } else {
        // Plenty of time
        continue;
      }

      const driveEstimate = driveMin === 0
        ? "Same venue"
        : `~${driveMin} min drive`;

      conflicts.push({
        eventA: a,
        eventB: b,
        type,
        gapMinutes,
        driveEstimate,
        canMakeIt,
      });
    }
  }

  return conflicts;
}

export default function ConflictAlert({ events }: ConflictAlertProps) {
  const conflicts = detectConflicts(events);
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      {conflicts.map((conflict, i) => {
        const aChild = conflict.eventA.children?.[0];
        const bChild = conflict.eventB.children?.[0];
        const aIsGame = isGameEvent(conflict.eventA.title);
        const bIsGame = isGameEvent(conflict.eventB.title);

        return (
          <div
            key={i}
            className={`rounded-xl p-3 text-sm ${
              conflict.canMakeIt === "unlikely"
                ? "bg-red-50 border border-red-200"
                : "bg-amber-50 border border-amber-200"
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  conflict.canMakeIt === "unlikely" ? "text-red-500" : "text-amber-500"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-xs ${
                  conflict.canMakeIt === "unlikely" ? "text-red-700" : "text-amber-700"
                }`}>
                  {conflict.type === "overlap" ? "Schedule Overlap" : "Tight Turnaround"}
                </p>
                <p className="text-xs mt-1 text-[var(--color-text)]">
                  <span style={{ color: aChild?.color || undefined }} className="font-medium">
                    {aChild?.nickname || aChild?.name || "?"}
                  </span>
                  {" "}
                  {aIsGame ? "game" : "practice"} ends, then{" "}
                  <span style={{ color: bChild?.color || undefined }} className="font-medium">
                    {bChild?.nickname || bChild?.name || "?"}
                  </span>
                  {" "}
                  {bIsGame ? "game" : "practice"} starts
                  {conflict.gapMinutes <= 0
                    ? " — times overlap!"
                    : ` in ${conflict.gapMinutes} min`}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-[var(--color-text-secondary)]">
                  <Car className="w-3 h-3" />
                  <span>{conflict.driveEstimate}</span>
                  <span className="mx-1">·</span>
                  <span className={`font-medium ${
                    conflict.canMakeIt === "likely"
                      ? "text-green-600"
                      : conflict.canMakeIt === "tight"
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}>
                    {conflict.canMakeIt === "likely"
                      ? "Can make it"
                      : conflict.canMakeIt === "tight"
                        ? "Cutting it close"
                        : "Probably can't make both"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
