import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text, children_names } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("en-US", {
      weekday: "long",
    });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Parse this into event details. Today is ${dayOfWeek}, ${today}.

Children in this household: ${children_names?.join(", ") || "none specified"}

Input: "${text}"

Return ONLY valid JSON with these fields (omit any you can't determine):
{
  "title": "event title",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "location": "location",
  "category": "one of: school, sports, medical, band, appointment, chore, homework, workout, parenting_discussion, travel, other",
  "child_name": "matched child name from household list",
  "notes": "any additional details",
  "confidence": 0.0 to 1.0
}

Rules:
- If "Tuesday" is mentioned and today is after Tuesday this week, use next Tuesday
- Match child names case-insensitively to the household list
- Infer category from context (dentist = medical, basketball = sports, etc.)
- For ambiguous times, assume PM for afternoon activities`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response — handle markdown code blocks and raw JSON
    let jsonStr = responseText;
    // Strip markdown code fences if present
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const jsonMatch = responseText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return NextResponse.json({ parsed });
    } catch {
      // Last resort: try to find any JSON object
      const fallback = responseText.match(/\{[\s\S]*\}/);
      if (fallback) {
        const parsed = JSON.parse(fallback[0]);
        return NextResponse.json({ parsed });
      }
      return NextResponse.json(
        { error: "Could not parse response", raw: responseText },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("NLP parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse text" },
      { status: 500 }
    );
  }
}
