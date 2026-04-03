import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isGameEvent } from "@/lib/types";

export const maxDuration = 30;

// Generate digest data for a household
// Can be called with ?type=daily or ?type=weekly
// When Resend is configured, this will also send emails
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "weekly";
  const householdId = searchParams.get("household_id");

  if (!householdId) {
    return NextResponse.json({ error: "Missing household_id" }, { status: 400 });
  }

  const supabase = await createClient();

  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (type === "daily") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(startDate.getTime() + 24 * 60 * 60000);
  } else {
    // Weekly: next 7 days
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60000);
  }

  // Get events
  const { data: events } = await supabase
    .from("events")
    .select("*, event_children(children(id, name, color))")
    .eq("household_id", householdId)
    .gte("start_time", startDate.toISOString())
    .lt("start_time", endDate.toISOString())
    .order("start_time");

  if (!events || events.length === 0) {
    return NextResponse.json({
      type,
      period: { start: startDate.toISOString(), end: endDate.toISOString() },
      summary: type === "daily" ? "No events today." : "Clear week ahead — nothing scheduled.",
      events: [],
      conflicts: [],
      gameCount: 0,
      practiceCount: 0,
    });
  }

  // Process events
  const processed = events.map((e: any) => ({
    ...e,
    children: e.event_children?.map((ec: any) => ec.children).filter(Boolean) || [],
    isGame: isGameEvent(e.title),
  }));

  const gameCount = processed.filter((e: any) => e.isGame).length;
  const practiceCount = processed.length - gameCount;

  // Group by day
  const byDay: Record<string, any[]> = {};
  for (const e of processed) {
    const dayKey = new Date(e.start_time).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!byDay[dayKey]) byDay[dayKey] = [];
    byDay[dayKey].push(e);
  }

  // Detect challenging days (multiple events close together for different kids)
  const challengingDays: string[] = [];
  for (const [day, dayEvents] of Object.entries(byDay)) {
    if (dayEvents.length >= 3) {
      challengingDays.push(day);
      continue;
    }
    // Check for time conflicts between different children
    if (dayEvents.length >= 2) {
      const sorted = dayEvents.sort(
        (a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        const aEnd = sorted[i].end_time
          ? new Date(sorted[i].end_time)
          : new Date(new Date(sorted[i].start_time).getTime() + 3600000);
        const bStart = new Date(sorted[i + 1].start_time);
        const gap = (bStart.getTime() - aEnd.getTime()) / 60000;
        if (gap < 40) {
          challengingDays.push(day);
          break;
        }
      }
    }
  }

  // Build summary
  let summary = "";
  if (type === "daily") {
    summary = `${processed.length} event${processed.length !== 1 ? "s" : ""} today`;
    if (gameCount > 0) summary += ` (${gameCount} game${gameCount > 1 ? "s" : ""})`;
  } else {
    summary = `${processed.length} event${processed.length !== 1 ? "s" : ""} this week`;
    if (gameCount > 0) summary += ` — ${gameCount} game${gameCount > 1 ? "s" : ""}`;
    if (challengingDays.length > 0) {
      summary += `. Busy day${challengingDays.length > 1 ? "s" : ""}: ${challengingDays.join(", ")}`;
    }
  }

  // Get unique children involved
  const childrenInvolved = new Map<string, { name: string; color: string; eventCount: number }>();
  for (const e of processed) {
    for (const c of e.children) {
      const existing = childrenInvolved.get(c.id);
      if (existing) {
        existing.eventCount++;
      } else {
        childrenInvolved.set(c.id, { name: c.name, color: c.color, eventCount: 1 });
      }
    }
  }

  return NextResponse.json({
    type,
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    summary,
    eventCount: processed.length,
    gameCount,
    practiceCount,
    challengingDays,
    childrenSummary: Object.fromEntries(childrenInvolved),
    byDay: Object.entries(byDay).map(([day, evts]) => ({
      day,
      events: evts.map((e: any) => ({
        title: e.title,
        time: new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        location: e.location,
        isGame: e.isGame,
        children: e.children.map((c: any) => c.name),
      })),
    })),
  });
}
