"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import QuickAdd from "@/components/QuickAdd";
import EventCard from "@/components/EventCard";
import CalendarFeeds from "@/components/CalendarFeeds";
import { type CalendarEvent, type Child, CATEGORY_COLORS } from "@/lib/types";

export default function CalendarPage() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [householdId, setHouseholdId] = useState("");
  const [userId, setUserId] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterChildId, setFilterChildId] = useState<string | "all">("all");

  const loadEvents = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: memberships } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("invite_status", "accepted")
      .limit(1);
    const membership = memberships?.[0] || null;

    if (!membership) return;
    setHouseholdId(membership.household_id);

    const { data: childrenData } = await supabase
      .from("children")
      .select("*")
      .eq("household_id", membership.household_id);
    setChildren(childrenData || []);

    // Get this parent's nicknames
    const { data: myNicknames } = await supabase
      .from("child_nicknames")
      .select("child_id, nickname")
      .eq("user_id", user.id);
    const nicknameMap = new Map(
      (myNicknames || []).map((n: any) => [n.child_id, n.nickname])
    );

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const { data: eventsData } = await supabase
      .from("events")
      .select("*, event_children(children(id, name, color))")
      .eq("household_id", membership.household_id)
      .gte("start_time", monthStart.toISOString())
      .lte("start_time", monthEnd.toISOString())
      .order("start_time");

    const eventsWithChildren = (eventsData || []).map((e: any) => ({
      ...e,
      children: e.event_children?.map((ec: any) => {
        const child = ec.children;
        if (!child) return null;
        return { ...child, nickname: nicknameMap.get(child.id) || null };
      }).filter(Boolean) || [],
    }));
    setEvents(eventsWithChildren);
    setLoading(false);
  }, [supabase, currentMonth]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Apply child filter
  const filteredEvents = filterChildId === "all"
    ? events
    : events.filter((e) => e.children?.some((c) => c.id === filterChildId));

  // Events for selected date
  const selectedEvents = filteredEvents.filter((e) =>
    isSameDay(new Date(e.start_time), selectedDate)
  );

  // Events per day (for dots)
  function getEventsForDay(day: Date) {
    return filteredEvents.filter((e) => isSameDay(new Date(e.start_time), day));
  }

  async function handleUpdateEvent(eventId: string, updates: Record<string, unknown>, childIds?: string[]) {
    await supabase.from("events").update(updates).eq("id", eventId);

    if (childIds !== undefined) {
      // Replace children
      await supabase.from("event_children").delete().eq("event_id", eventId);
      if (childIds.length > 0) {
        await supabase.from("event_children").insert(
          childIds.map((childId) => ({ event_id: eventId, child_id: childId }))
        );
      }
    }

    loadEvents();
  }

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
    const { data: newEvent, error } = await supabase
      .from("events")
      .insert({
        household_id: householdId,
        title: eventData.title,
        start_time: eventData.start_time,
        end_time: eventData.end_time || null,
        category: eventData.category,
        location: eventData.location || null,
        description: eventData.description || null,
        all_day: eventData.all_day || false,
        source_type: "manual",
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    if (eventData.child_ids && eventData.child_ids.length > 0 && newEvent) {
      await supabase.from("event_children").insert(
        eventData.child_ids.map((childId) => ({
          event_id: newEvent.id,
          child_id: childId,
        }))
      );
    }

    loadEvents();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Month header */}
      <header className="bg-white border-b border-[var(--color-border)] px-4 py-3 pt-[env(safe-area-inset-top)]">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-6 h-6 text-[var(--color-text)]" />
          </button>
          <h1 className="text-lg font-bold">
            {format(currentMonth, "MMMM yyyy")}
          </h1>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-6 h-6 text-[var(--color-text)]" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* Calendar Feeds */}
        {householdId && userId && (
          <div className="px-4 pt-3">
            <CalendarFeeds
              householdId={householdId}
              userId={userId}
              children={children}
              onSyncComplete={() => loadEvents()}
            />
          </div>
        )}

        {/* Calendar grid */}
        <div className="bg-white px-2 py-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-[var(--color-text-secondary)]"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-2 rounded-xl transition-colors ${
                    isSelected
                      ? "bg-[var(--color-primary)] text-white"
                      : isToday
                        ? "bg-blue-50"
                        : ""
                  } ${!isCurrentMonth ? "opacity-30" : ""}`}
                >
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? "text-white" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {/* Event dots */}
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const dotColor = ev.children?.[0]?.color || CATEGORY_COLORS[ev.category] || "#6b7280";
                        return (
                        <div
                          key={ev.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: isSelected ? "white" : dotColor,
                          }}
                        />
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Child filter */}
        {children.length > 0 && (
          <div className="px-4 pt-3 flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterChildId("all")}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filterChildId === "all"
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-gray-100 text-[var(--color-text-secondary)]"
              }`}
            >
              All
            </button>
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setFilterChildId(filterChildId === child.id ? "all" : child.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                  filterChildId === child.id
                    ? "text-white border-transparent"
                    : "bg-white border-[var(--color-border)] text-[var(--color-text-secondary)]"
                }`}
                style={filterChildId === child.id ? { backgroundColor: child.color || "var(--color-primary)" } : {}}
              >
                {child.nickname || child.name}
              </button>
            ))}
          </div>
        )}

        {/* Selected date events */}
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
            {format(selectedDate, "EEEE, MMMM d")}
          </h2>

          {selectedEvents.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
              <p>No events on this day.</p>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="mt-2 text-[var(--color-primary)] font-medium text-sm"
              >
                Add an event
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event) => (
                <EventCard key={event.id} event={event} allChildren={children} onUpdate={handleUpdateEvent} onDelete={async (id) => {
                  await supabase.from("event_children").delete().eq("event_id", id);
                  await supabase.from("events").delete().eq("id", id);
                  loadEvents();
                }} />
              ))}
            </div>
          )}
        </div>
      </main>

      <QuickAdd
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSave={handleSaveEvent}
        children={children}
        householdId={householdId}
      />

      <BottomNav onQuickAdd={() => setQuickAddOpen(true)} />
    </div>
  );
}
