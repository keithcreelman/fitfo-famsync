import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const childrenNames = formData.get("children_names") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const mediaType = file.type as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const today = new Date().toISOString().split("T")[0];

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1000,
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
              text: `Extract event details from this image. Today is ${today}.

Children in this household: ${childrenNames || "none specified"}

Return ONLY valid JSON with these fields (omit any you can't determine):
{
  "title": "event title",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "location": "location",
  "category": "one of: school, sports, medical, band, appointment, chore, homework, workout, parenting_discussion, travel, other",
  "child_name": "matched child name if identifiable",
  "notes": "any additional context from the image",
  "confidence": 0.0 to 1.0
}

If the image contains multiple events, return an array of event objects.
Look for dates, times, locations, event names, team names, school names, etc.`,
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
        { error: "Could not extract event details from image" },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Screenshot parse error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to parse screenshot: ${errMsg}` },
      { status: 500 }
    );
  }
}
