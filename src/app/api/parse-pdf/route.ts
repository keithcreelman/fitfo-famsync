import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const childrenNames = formData.get("children_names") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const today = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();

    // Use PDF support in Claude
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Extract ALL events/dates from this school calendar PDF. Today is ${today}, current year is ${currentYear}.

For each event found, return a JSON object with:
- "title": event name (e.g. "No School - Teacher Professional Day", "Early Release", "Spring Break Begins")
- "date": "YYYY-MM-DD" format. Use ${currentYear} or ${currentYear + 1} based on the school year.
- "start_time": "HH:MM" if a specific time is mentioned, otherwise omit
- "end_time": "HH:MM" if mentioned, otherwise omit
- "category": "school" for most, "travel" for breaks/vacations
- "all_day": true if no specific time (most school calendar events)
- "notes": any extra detail

Return ONLY a JSON array, no other text. Extract every single date/event on the calendar.`,
            },
          ],
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    let jsonStr = responseText;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const jsonMatch = responseText.match(/[\[{][\s\S]*[\]}]/);
      if (jsonMatch) jsonStr = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const events = Array.isArray(parsed) ? parsed : [parsed];
      return NextResponse.json({ events, total: events.length });
    } catch {
      return NextResponse.json(
        { error: `Could not parse response as JSON. Raw: ${responseText.substring(0, 300)}` },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `PDF parse failed: ${errMsg}` }, { status: 500 });
  }
}
