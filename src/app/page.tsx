"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { format, startOfDay, addDays } from "date-fns";
import { Calendar, MessageSquare, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import QuickAdd from "@/components/QuickAdd";
import EventCard from "@/components/EventCard";
import type { CalendarEvent, Child, Household, Profile } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [debugInfo, setDebugInfo] = useState("");

  const loadData = useCallback(async () => {
    let debug = "";

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    debug += `auth.getUser: ${user?.id || "NULL"} err: ${userErr?.message || "none"}\n`;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    debug += `session: ${session ? "YES" : "NULL"} token: ${session?.access_token ? session.access_token.substring(0, 20) + "..." : "none"}\n`;

    if (!user) {
      debug += "NO USER — stopping\n";
      setDebugInfo(debug);
      setLoading(false);
      return;
    }
    setUser(user);

    // Get profile
    const { data: profileData, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    debug += `profile: ${profileData ? profileData.display_name : "NULL"} err: ${profErr?.message || "none"}\n`;
    setProfile(profileData);

    // Get household membership (use limit(1) in case of duplicates)
    const { data: memberships, error: memErr } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("invite_status", "accepted")
      .limit(1);
    const membership = memberships?.[0] || null;
    debug += `membership: ${membership ? membership.household_id : "NULL"} err: ${memErr?.message || "none"}\n`;

    if (!membership) {
      debug += "NO MEMBERSHIP — would redirect to /onboarding\n";
      setDebugInfo(debug);
      setLoading(false);
      // Temporarily show debug instead of redirecting
      return;
    }

    // Get household
    const { data: householdData } = await supabase
      .from("households")
      .select("*")
      .eq("id", membership.household_id)
      .maybeSingle();
    setHousehold(householdData);

    // Get children
    const { data: childrenData } = await supabase
      .from("children")
      .select("*")
      .eq("household_id", membership.household_id)
      .order("name");
    setChildren(childrenData || []);

    // Get this parent's nicknames for children
    const { data: myNicknames } = await supabase
      .from("child_nicknames")
      .select("child_id, nickname")
      .eq("user_id", user.id);
    const nicknameMap = new Map(
      (myNicknames || []).map((n: any) => [n.child_id, n.nickname])
    );

    // Get upcoming events (next 7 days) with linked children
    const now = startOfDay(new Date());
    const weekOut = addDays(now, 7);
    const { data: eventsData } = await supabase
      .from("events")
      .select("*, event_children(children(id, name))")
      .eq("household_id", membership.household_id)
      .gte("start_time", now.toISOString())
      .lte("start_time", weekOut.toISOString())
      .order("start_time");

    // Flatten children + apply this parent's nicknames
    const eventsWithChildren = (eventsData || []).map((e: any) => ({
      ...e,
      children: e.event_children?.map((ec: any) => {
        const child = ec.children;
        if (!child) return null;
        return {
          ...child,
          nickname: nicknameMap.get(child.id) || null,
        };
      }).filter(Boolean) || [],
    }));
    setUpcomingEvents(eventsWithChildren);

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveEvent(eventData: {
    title: string;
    start_time: string;
    end_time?: string;
    category: string;
    location?: string;
    description?: string;
    child_ids?: string[];
    all_day?: boolean;
  }) {
    if (!household || !user) return;

    const { data: newEvent, error } = await supabase
      .from("events")
      .insert({
        household_id: household.id,
        title: eventData.title,
        start_time: eventData.start_time,
        end_time: eventData.end_time || null,
        category: eventData.category,
        location: eventData.location || null,
        description: eventData.description || null,
        all_day: eventData.all_day || false,
        source_type: "manual",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Link children if provided
    if (eventData.child_ids && eventData.child_ids.length > 0 && newEvent) {
      await supabase.from("event_children").insert(
        eventData.child_ids.map((childId) => ({
          event_id: newEvent.id,
          child_id: childId,
        }))
      );
    }

    loadData();
  }

  async function handleDeleteEvent(eventId: string) {
    await supabase.from("event_children").delete().eq("event_id", eventId);
    await supabase.from("events").delete().eq("id", eventId);
    loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // DEBUG: show auth/db state if no household found
  if (debugInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <h2 className="text-lg font-bold mb-3">Debug Info</h2>
          <pre className="bg-gray-100 p-4 rounded-xl text-xs whitespace-pre-wrap break-all font-mono">{debugInfo}</pre>
          <button onClick={() => { setLoading(true); setDebugInfo(""); loadData(); }} className="mt-4 w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold">Retry</button>
          <button onClick={() => router.push("/onboarding")} className="mt-2 w-full py-3 border border-[var(--color-border)] rounded-xl font-semibold">Go to Onboarding</button>
        </div>
      </div>
    );
  }

  // Group events by date
  const eventsByDate = upcomingEvents.reduce(
    (acc, event) => {
      const dateKey = format(new Date(event.start_time), "yyyy-MM-dd");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(event);
      return acc;
    },
    {} as Record<string, CalendarEvent[]>
  );

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-border)] px-4 py-4 pt-[env(safe-area-inset-top)]">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-primary)]">
              {household?.name || "FamSync"}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {profile?.display_name
                ? `Hi, ${profile.display_name}`
                : "Welcome back"}
            </p>
          </div>
          <span className="text-[10px] text-[var(--color-text-secondary)] bg-gray-100 px-2 py-1 rounded-full">
            by FamSync
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/calendar")}
            className="bg-white border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Calendar</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                View all events
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push("/meeting")}
            className="bg-white border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[var(--color-danger)]" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Meeting</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Prep & agenda
              </p>
            </div>
          </button>
        </div>

        {/* Upcoming events */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              Next 7 Days
            </h2>
            <button
              onClick={() => router.push("/calendar")}
              className="text-sm text-[var(--color-primary)] flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="bg-white border border-[var(--color-border)] rounded-xl p-8 text-center">
              <Calendar className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-2" />
              <p className="text-[var(--color-text-secondary)]">
                No events this week.
              </p>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="mt-3 text-[var(--color-primary)] font-medium text-sm"
              >
                Add your first event
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(eventsByDate).map(([dateKey, events]) => (
                <div key={dateKey}>
                  <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                    {format(new Date(dateKey + "T12:00:00"), "EEEE, MMMM d")}
                  </h3>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <EventCard key={event.id} event={event} onDelete={handleDeleteEvent} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <QuickAdd
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSave={handleSaveEvent}
        children={children}
        householdId={household?.id || ""}
      />

      <BottomNav onQuickAdd={() => setQuickAddOpen(true)} />
    </div>
  );
}
