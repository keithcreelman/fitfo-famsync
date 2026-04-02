import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 60;

interface ParsedEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  location: string;
  sequence: number;
}

function parseICS(icsText: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const veventBlocks = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  for (const block of veventBlocks) {
    // Handle multi-line folded values (lines starting with space are continuations)
    const unfolded = block.replace(/\r?\n[ \t]/g, "");

    const getField = (field: string): string => {
      const match = unfolded.match(new RegExp(`^${field}[^:]*:(.*)$`, "m"));
      return match ? match[1].trim() : "";
    };

    const uid = getField("UID");
    const summary = getField("SUMMARY");
    const dtstart = getField("DTSTART");
    const dtend = getField("DTEND");
    const location = getField("LOCATION").replace(/\\,/g, ",").replace(/\\n/g, "\n");
    const sequence = parseInt(getField("SEQUENCE") || "0", 10);

    if (uid && summary && dtstart) {
      events.push({ uid, summary, dtstart, dtend, location, sequence });
    }
  }

  return events;
}

function icsDateToISO(icsDate: string): string {
  // ICS dates: 20260412T130000Z or 20260412T130000
  const clean = icsDate.replace(/[^0-9TZ]/g, "");
  if (clean.length >= 15) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    const h = clean.slice(9, 11);
    const min = clean.slice(11, 13);
    const s = clean.slice(13, 15);
    const isUTC = clean.endsWith("Z");
    return `${y}-${m}-${d}T${h}:${min}:${s}${isUTC ? "Z" : ""}`;
  }
  // Date only
  if (clean.length >= 8) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00Z`;
  }
  return icsDate;
}

export async function POST(request: Request) {
  try {
    const { ics_url, household_id, user_id } = await request.json();

    if (!ics_url || !household_id || !user_id) {
      return NextResponse.json(
        { error: "Missing ics_url, household_id, or user_id" },
        { status: 400 }
      );
    }

    // Fetch the ICS feed
    const res = await fetch(ics_url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch ICS feed: ${res.status} ${res.statusText}` },
        { status: 500 }
      );
    }
    const icsText = await res.text();
    const parsed = parseICS(icsText);

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No events found in ICS feed" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get existing events from this source to detect changes
    const { data: existing } = await supabase
      .from("events")
      .select("id, title, start_time, end_time, location, description")
      .eq("household_id", household_id)
      .eq("source_type", "ics_import")
      .in("description", parsed.map((e) => `ics_uid:${e.uid}`));

    const existingByUid = new Map(
      (existing || []).map((e) => {
        const uidMatch = e.description?.match(/ics_uid:(.+)/);
        return [uidMatch?.[1] || "", e];
      })
    );

    let added = 0;
    let updated = 0;
    let unchanged = 0;

    for (const event of parsed) {
      const startISO = icsDateToISO(event.dtstart);
      const endISO = event.dtend ? icsDateToISO(event.dtend) : null;
      const existingEvent = existingByUid.get(event.uid);

      if (existingEvent) {
        // Check if anything changed
        const changed =
          existingEvent.title !== event.summary ||
          existingEvent.start_time !== startISO ||
          existingEvent.end_time !== endISO ||
          existingEvent.location !== event.location;

        if (changed) {
          await supabase
            .from("events")
            .update({
              title: event.summary,
              start_time: startISO,
              end_time: endISO,
              location: event.location || null,
            })
            .eq("id", existingEvent.id);
          updated++;
        } else {
          unchanged++;
        }
      } else {
        // New event
        await supabase.from("events").insert({
          household_id,
          title: event.summary,
          start_time: startISO,
          end_time: endISO,
          location: event.location || null,
          category: "sports",
          all_day: false,
          source_type: "ics_import",
          description: `ics_uid:${event.uid}`,
          created_by: user_id,
        });
        added++;
      }
    }

    return NextResponse.json({
      total: parsed.length,
      added,
      updated,
      unchanged,
    });
  } catch (error: unknown) {
    console.error("ICS sync error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Sync failed: ${errMsg}` }, { status: 500 });
  }
}
