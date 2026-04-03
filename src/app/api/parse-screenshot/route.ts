import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Extend timeout to max allowed (60s Pro, 10s Free)
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured on server" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const childrenNames = formData.get("children_names") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    const today = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();

    // Build content based on file type
    const documentContent: Anthropic.Messages.ContentBlockParam = isPdf
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        } as any
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: (file.type === "image/png" ? "image/png"
              : file.type === "image/gif" ? "image/gif"
              : file.type === "image/webp" ? "image/webp"
              : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64,
          },
        };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            documentContent,
            {
              type: "text",
              text: `Extract ALL event details from this image. Today is ${today}. The current year is ${currentYear}.

Children in this household: ${childrenNames || "none specified"}

Return ONLY a JSON array (no markdown, no explanation) with objects containing:
- "title": event title/name
- "date": "YYYY-MM-DD" format (use ${currentYear} if year not shown)
- "start_time": "HH:MM" in 24-hour format
- "end_time": "HH:MM" in 24-hour format
- "location": venue/location
- "category": one of: no_school (days off, professional development, no students), half_day (early release, delayed opening), vacation (spring break, winter break, summer), school_misc (open house, conferences, picture day), school (general school events), sports, lacrosse, soccer, basketball, medical, band, appointment, travel, other
- "notes": any extra context
- "all_day": true if no specific time (most school calendar events are all-day)

For school calendars: use no_school for any day students don't attend, half_day for early release or late start, vacation for multi-day breaks.

Extract EVERY event/date visible. Return the JSON array only, no other text.`,
            },
          ],
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON — handle markdown code blocks
    let jsonStr = responseText;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const jsonMatch = responseText.match(/[\[{][\s\S]*[\]}]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const events = Array.isArray(parsed) ? parsed : [parsed];
      return NextResponse.json({ events });
    } catch {
      return NextResponse.json(
        { error: `Could not parse Claude response as JSON. Raw: ${responseText.substring(0, 200)}` },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Screenshot parse error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `API error: ${errMsg}` },
      { status: 500 }
    );
  }
}
