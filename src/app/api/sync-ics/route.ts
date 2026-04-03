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

// Clean up messy ICS titles
// "Tantasqua.B.78.Black vs AubWorc.B.78.Blue - Home Game"
// → "Tantasqua vs AubWorc - Home Game"
function cleanTitle(raw: string): string {
  let title = raw;

  // Remove common team code patterns: .B.78.Black, .B.7/8.Blue, .G.56.Red etc.
  // Pattern: dot + letter(s) + dot + number(s) + optional slash + number(s) + dot + word
  title = title.replace(/\.[A-Z]\.\d+\/?\.?\d*\.?[A-Za-z]*/g, "");

  // Clean up double spaces and trim
  title = title.replace(/\s{2,}/g, " ").trim();

  // Remove leading/trailing dashes or hyphens from cleanup
  title = title.replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "").trim();

  // If title is now empty or too short, return original
  if (title.length < 3) return raw;

  return title;
}

// Simplify location: "Fiskdale - Tantasqua HS - Stadium Field, 319 Brookfield Road, Sturbridge, Massachusetts 01518"
// Keep it all for directions but show a cleaner version as the title
function cleanLocation(raw: string): string {
  // Remove newlines from Mojo format
  return raw.replace(/\n/g, ", ").trim();
}

function icsDateToISO(icsDate: string): string {
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
  if (clean.length >= 8) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00Z`;
  }
  return icsDate;
}

// Auto-detect sport category from title or feed URL
function detectSportCategory(title: string, feedUrl: string, feedLabel: string): string {
  const combined = `${title} ${feedUrl} ${feedLabel}`.toLowerCase();
  if (combined.includes("lacrosse") || combined.includes("lax")) return "lacrosse";
  if (combined.includes("soccer") || combined.includes("futbol") || combined.includes("necon")) return "soccer";
  if (combined.includes("basketball") || combined.includes("hoops") || combined.includes("breaker")) return "basketball";
  if (combined.includes("flag football") || combined.includes("flag_football")) return "flag_football";
  return "sports";
}

export async function POST(request: Request) {
  try {
    const { ics_url, household_id, user_id, child_id, feed_label } = await request.json();

    if (!ics_url || !household_id || !user_id) {
      return NextResponse.json(
        { error: "Missing ics_url, household_id, or user_id" },
        { status: 400 }
      );
    }

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

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let childTagged = 0;
    let dupesCleaned = 0;

    for (const event of parsed) {
      const uidDesc = `ics_uid:${event.uid}`;
      const startISO = icsDateToISO(event.dtstart);
      const endISO = event.dtend ? icsDateToISO(event.dtend) : null;
      const cleanedTitle = cleanTitle(event.summary);
      const cleanedLocation = event.location ? cleanLocation(event.location) : null;
      const sportCategory = detectSportCategory(event.summary, ics_url, feed_label || "");

      // Find ALL existing events with this UID (catches dupes)
      const { data: matches } = await supabase
        .from("events")
        .select("id, title, start_time, end_time, location")
        .eq("household_id", household_id)
        .eq("description", uidDesc);

      if (matches && matches.length > 1) {
        // Clean up duplicates — keep the first, delete the rest
        const dupeIds = matches.slice(1).map((m) => m.id);
        for (const dupeId of dupeIds) {
          await supabase.from("event_children").delete().eq("event_id", dupeId);
          await supabase.from("event_rsvps").delete().eq("event_id", dupeId);
          await supabase.from("events").delete().eq("id", dupeId);
          dupesCleaned++;
        }
      }

      const existingEvent = matches?.[0] || null;

      if (existingEvent) {
        // Check if anything changed
        const changed =
          existingEvent.title !== cleanedTitle ||
          existingEvent.start_time !== startISO ||
          existingEvent.end_time !== endISO ||
          existingEvent.location !== cleanedLocation;

        // Always update category + title (in case feed label changed or title was messy before)
        await supabase
          .from("events")
          .update({
            title: cleanedTitle,
            start_time: startISO,
            end_time: endISO,
            location: cleanedLocation,
            category: sportCategory,
          })
          .eq("id", existingEvent.id);

        if (changed) {
          updated++;
        } else {
          unchanged++;
        }

        // Tag child if not already tagged
        if (child_id) {
          const { data: childLink } = await supabase
            .from("event_children")
            .select("event_id")
            .eq("event_id", existingEvent.id)
            .eq("child_id", child_id)
            .maybeSingle();

          if (!childLink) {
            await supabase.from("event_children").insert({
              event_id: existingEvent.id,
              child_id,
            });
            childTagged++;
          }
        }
      } else {
        // New event — insert
        const { data: newEvent } = await supabase.from("events").insert({
          household_id,
          title: cleanedTitle,
          start_time: startISO,
          end_time: endISO,
          location: cleanedLocation,
          category: sportCategory,
          all_day: false,
          source_type: "ics_import",
          description: uidDesc,
          created_by: user_id,
        }).select("id").single();

        if (child_id && newEvent) {
          await supabase.from("event_children").insert({
            event_id: newEvent.id,
            child_id,
          });
        }
        added++;
      }
    }

    return NextResponse.json({
      total: parsed.length,
      added,
      updated,
      unchanged,
      childTagged,
      dupesCleaned,
    });
  } catch (error: unknown) {
    console.error("ICS sync error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Sync failed: ${errMsg}` }, { status: 500 });
  }
}
