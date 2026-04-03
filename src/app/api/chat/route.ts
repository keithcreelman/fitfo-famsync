import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { message, household_id, user_id } = await request.json();

    if (!message || !household_id) {
      return NextResponse.json({ error: "Missing message or household_id" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = await createClient();

    // Gather context about the household
    const { data: children } = await supabase
      .from("children")
      .select("name, color")
      .eq("household_id", household_id);

    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("title, start_time, end_time, location, category, event_children(children(name))")
      .eq("household_id", household_id)
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(30);

    const eventsContext = (upcomingEvents || []).map((e: any) => {
      const kids = e.event_children?.map((ec: any) => ec.children?.name).filter(Boolean).join(", ") || "unassigned";
      const date = new Date(e.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const time = new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `- ${date} ${time}: ${e.title} (${kids}) @ ${e.location || "no location"}`;
    }).join("\n");

    const childrenList = (children || []).map((c: any) => c.name).join(", ");

    const systemPrompt = `You are CreelSync Assistant, the AI helper for a co-parenting family coordination app called FamSync (this family's instance is called CreelSync).

FAMILY CONTEXT:
- Children: ${childrenList}
- Custody schedule: Mon/Tue = Mom (Jen), Wed/Thu = Dad (Keith), alternating weekends
- Jen coaches Annabelle's basketball (Lady Breakers) — she's always responsible for those events
- Dad's address: 341 The Trail, Fiskdale, MA
- Mom's address: 176 Arvidson Rd, Woodstock, CT

UPCOMING EVENTS (next 30):
${eventsContext || "No upcoming events"}

APP FEATURES YOU CAN HELP WITH:
- Calendar: view events by day/month, filter by child, color-coded by child
- Calendar Feeds: sync ICS feeds from OttoSport, Mojo, TeamSnap (add on Calendar page)
- Import: upload screenshots of schedules (uses AI to extract events), upload ICS files, CSV/Excel
- Quick Add: type natural language like "Parker dentist Tuesday 3pm"
- Event editing: tap the pencil icon on any event to edit
- RSVP: mark Going/Maybe/Can't go on each event
- Comments: add coordination comments on events
- Conflict detection: shows warnings when events overlap or are close together
- Driving directions: tap any location to open Google Maps
- Depart-by times: shows when to leave based on which parent's home
- Settings: child colors, invite co-parent, notification preferences

INSTRUCTIONS:
- Be concise and helpful
- Answer questions about the schedule, the app, or family logistics
- When asked about schedule conflicts, reference the actual events above
- Use the children's names naturally
- If asked about features that don't exist yet, say it's on the roadmap
- Keep responses short — this is a mobile app chat`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error("Chat error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Chat failed: ${errMsg}` }, { status: 500 });
  }
}
