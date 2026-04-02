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

    // Detect media type, default to jpeg
    let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
    if (file.type === "image/png") mediaType = "image/png";
    else if (file.type === "image/gif") mediaType = "image/gif";
    else if (file.type === "image/webp") mediaType = "image/webp";

    const today = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
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
- "category": one of: school, sports, medical, band, appointment, other
- "notes": any extra context (team names, opponent, type like game/training)

Example: [{"title":"Game vs Blue","date":"2026-04-12","start_time":"09:00","end_time":"09:55","location":"Tantasqua HS","category":"sports","notes":"HOME game"}]

Extract EVERY event visible. Return the JSON array only, no other text.`,
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
