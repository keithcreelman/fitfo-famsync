import { NextResponse } from "next/server";

export const maxDuration = 60;

// This endpoint is called by Vercel Cron every hour from 6 AM to 10 PM
// It syncs all ICS feeds for all households
// Feed URLs are stored client-side in localStorage, so this is a placeholder
// that can be enhanced once feeds are stored in the DB

export async function GET(request: Request) {
  // Verify cron secret if configured
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // For now, return a placeholder — feeds are managed client-side
  // When feeds move to DB, this will iterate all households and sync each feed
  return NextResponse.json({
    message: "Cron sync placeholder — feeds currently managed client-side",
    timestamp: new Date().toISOString(),
  });
}
