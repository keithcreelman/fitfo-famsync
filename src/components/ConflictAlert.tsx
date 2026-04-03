"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Car, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { type CalendarEvent, isGameEvent } from "@/lib/types";
import { getResponsibleParent } from "@/lib/custody";
import { format } from "date-fns";

interface ConflictAlertProps {
  events: CalendarEvent[];
  userId?: string;
}

const PACK_UP_MINUTES = 8; // time to gather stuff, get to car, leave parking lot

interface Conflict {
  eventA: CalendarEvent;
  eventB: CalendarEvent;
  gapMinutes: number;
  driveMinutes: number;
  totalNeeded: number; // pack-up + drive
  arrivalMinutesLate: number; // how late you'd arrive to event B
  canMakeIt: boolean;
  arrivalTime: Date;
}

function estimateDriveMinutes(locA: string | null, locB: string | null): number {
  if (!locA || !locB) return 15;

  const normalizeVenue = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
  if (normalizeVenue(locA) === normalizeVenue(locB)) return 0;

  const townA = extractTown(locA);
  const townB = extractTown(locB);
  if (townA && townB && townA === townB) return 10;

  return 25;
}

function extractTown(location: string): string | null {
  const parts = location.split(",").map((s) => s.trim());
  for (const part of parts) {
    const clean = part.replace(/\d{5}.*/, "").replace(/\b(MA|Massachusetts|USA|CT|Connecticut)\b/gi, "").trim();
    if (clean.length > 2 && clean.length < 30 && !/^\d/.test(clean)) {
      return clean.toLowerCase();
    }
  }
  const firstWord = location.split(/[\s,-]/)[0].toLowerCase();
  return firstWord.length > 2 ? firstWord : null;
}

function detectConflicts(events: CalendarEvent[], skippedEventIds: Set<string>): Conflict[] {
  const conflicts: Conflict[] = [];
  // Filter out events where RSVP is "not_going"
  const active = events.filter((e) => !skippedEventIds.has(e.id));
  if (active.length < 2) return conflicts;

  const sorted = [...active].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      // Skip if same child or any child overlap
      const aChildIds = new Set(a.children?.map((c) => c.id) || []);
      const bChildIds = new Set(b.children?.map((c) => c.id) || []);
      const hasChildOverlap = [...aChildIds].some((id) => bChildIds.has(id));
      if (hasChildOverlap) continue;
      if (aChildIds.size === 0 && bChildIds.size === 0) continue;
      if (aChildIds.size === 0 || bChildIds.size === 0) continue;

      // Only show conflict if the SAME parent is responsible for both events
      // Check assigned_parent override first, then fall back to custody schedule
      const aChildNames = a.children?.map((c) => c.nickname || c.name) || [];
      const bChildNames = b.children?.map((c) => c.nickname || c.name) || [];
      const aParent = a.assigned_parent || getResponsibleParent(new Date(a.start_time), a.title, aChildNames, a.category);
      const bParent = b.assigned_parent || getResponsibleParent(new Date(b.start_time), b.title, bChildNames, b.category);
      if (aParent !== bParent) continue; // Different parents handle these — no conflict

      const aEnd = a.end_time
        ? new Date(a.end_time)
        : new Date(new Date(a.start_time).getTime() + 60 * 60000);
      const bStart = new Date(b.start_time);
      const bEnd = b.end_time
        ? new Date(b.end_time)
        : new Date(bStart.getTime() + 60 * 60000);

      const gapMinutes = Math.round((bStart.getTime() - aEnd.getTime()) / 60000);
      const driveMin = estimateDriveMinutes(a.location, b.location);
      const totalNeeded = PACK_UP_MINUTES + driveMin;

      // Only flag if there's not enough time
      if (gapMinutes >= totalNeeded + 10) continue; // 10 min comfort buffer

      const arrivalTime = new Date(aEnd.getTime() + totalNeeded * 60000);
      const arrivalMinutesLate = Math.max(0, Math.round((arrivalTime.getTime() - bStart.getTime()) / 60000));
      const eventBDuration = (bEnd.getTime() - bStart.getTime()) / 60000;
      const canMakeIt = arrivalMinutesLate < eventBDuration; // can catch at least some of it

      conflicts.push({
        eventA: a,
        eventB: b,
        gapMinutes,
        driveMinutes: driveMin,
        totalNeeded,
        arrivalMinutesLate,
        canMakeIt,
        arrivalTime,
      });
    }
  }

  // Deduplicate: for each pair of children, only keep the tightest conflict
  const seen = new Map<string, Conflict>();
  for (const c of conflicts) {
    const aIds = (c.eventA.children?.map((ch) => ch.id) || []).sort().join(",");
    const bIds = (c.eventB.children?.map((ch) => ch.id) || []).sort().join(",");
    const key = [aIds, bIds].sort().join("|");
    const existing = seen.get(key);
    if (!existing || c.arrivalMinutesLate > existing.arrivalMinutesLate) {
      seen.set(key, c);
    }
  }

  return Array.from(seen.values());
}

export default function ConflictAlert({ events, userId }: ConflictAlertProps) {
  const supabase = createClient();
  const [skippedEventIds, setSkippedEventIds] = useState<Set<string>>(new Set());

  // Load RSVPs to know which events are marked "not_going"
  useEffect(() => {
    if (!userId || events.length === 0) return;

    supabase
      .from("event_rsvps")
      .select("event_id, status")
      .eq("user_id", userId)
      .eq("status", "not_going")
      .in("event_id", events.map((e) => e.id))
      .then(({ data }) => {
        setSkippedEventIds(new Set((data || []).map((r) => r.event_id)));
      });
  }, [events, userId, supabase]);

  const conflicts = detectConflicts(events, skippedEventIds);
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      {conflicts.map((conflict, i) => {
        const aChild = conflict.eventA.children?.[0];
        const bChild = conflict.eventB.children?.[0];
        const aIsGame = isGameEvent(conflict.eventA.title);
        const bIsGame = isGameEvent(conflict.eventB.title);
        const aEndTime = conflict.eventA.end_time
          ? format(new Date(conflict.eventA.end_time), "h:mm a")
          : null;

        const isOverlap = conflict.gapMinutes < 0;
        const severity = isOverlap
          ? "red"
          : conflict.arrivalMinutesLate > 0
            ? conflict.canMakeIt ? "amber" : "red"
            : "amber";

        return (
          <div
            key={i}
            className={`rounded-xl p-3 text-sm ${
              severity === "red"
                ? "bg-red-50 border border-red-200"
                : "bg-amber-50 border border-amber-200"
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  severity === "red" ? "text-red-500" : "text-amber-500"
                }`}
              />
              <div className="flex-1 min-w-0 space-y-1">
                <p className={`font-semibold text-xs ${
                  severity === "red" ? "text-red-700" : "text-amber-700"
                }`}>
                  {isOverlap ? "Schedule Overlap" : "Tight Turnaround"}
                </p>

                {/* What's happening */}
                <p className="text-xs text-[var(--color-text)]">
                  <span style={{ color: aChild?.color || undefined }} className="font-medium">
                    {aChild?.nickname || aChild?.name || "?"}&apos;s
                  </span>
                  {" "}{aIsGame ? "game" : "practice"}
                  {aEndTime ? ` ends at ${aEndTime}` : " ends"}
                  {" → "}
                  <span style={{ color: bChild?.color || undefined }} className="font-medium">
                    {bChild?.nickname || bChild?.name || "?"}&apos;s
                  </span>
                  {" "}{bIsGame ? "game" : "practice"} starts at{" "}
                  {format(new Date(conflict.eventB.start_time), "h:mm a")}
                </p>

                {/* Timeline breakdown */}
                <div className="text-xs text-[var(--color-text-secondary)] space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>~{PACK_UP_MINUTES} min to pack up and get to car</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    <span>
                      {conflict.driveMinutes === 0
                        ? "Same venue — no drive"
                        : `~${conflict.driveMinutes} min drive`}
                    </span>
                  </div>
                </div>

                {/* Verdict */}
                <p className={`text-xs font-semibold ${
                  isOverlap
                    ? "text-red-600"
                    : conflict.arrivalMinutesLate === 0
                      ? "text-green-600"
                      : conflict.canMakeIt
                        ? "text-amber-600"
                        : "text-red-600"
                }`}>
                  {isOverlap
                    ? `Events overlap by ${Math.abs(conflict.gapMinutes)} min — can't be at both`
                    : conflict.arrivalMinutesLate === 0
                      ? "Should make it on time"
                      : conflict.canMakeIt
                        ? `Arrive ~${conflict.arrivalMinutesLate} min late (${format(conflict.arrivalTime, "h:mm a")}) but can catch most of it`
                        : `Would arrive ${conflict.arrivalMinutesLate} min late — likely miss it`}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
