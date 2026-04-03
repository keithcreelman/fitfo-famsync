"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Clock, Navigation, Car } from "lucide-react";
import { type CalendarEvent, CATEGORY_LABELS, CATEGORY_COLORS, isGameEvent, PARENT_HOMES, estimateDriveFromHome } from "@/lib/types";

export default function SpectatorPage() {
  const params = useParams();
  const code = params.code as string;
  const supabase = createClient();

  const [householdName, setHouseholdName] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    // Look up household by invite code
    const { data: household } = await supabase
      .from("households")
      .select("id, name")
      .eq("invite_code", code)
      .maybeSingle();

    if (!household) {
      setError("Invalid link. Check with the family for the correct URL.");
      setLoading(false);
      return;
    }

    setHouseholdName(household.name);

    // Get public events only
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const { data: eventsData } = await supabase
      .from("events")
      .select("*, event_children(children(id, name, color))")
      .eq("household_id", household.id)
      .eq("visibility", "public")
      .gte("start_time", monthStart.toISOString())
      .lte("start_time", monthEnd.toISOString())
      .order("start_time");

    const processed = (eventsData || []).map((e: any) => ({
      ...e,
      children: e.event_children?.map((ec: any) => ec.children).filter(Boolean) || [],
    }));

    setEvents(processed);
    setLoading(false);
  }, [supabase, code, currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  });

  const selectedEvents = events
    .filter((e) => isSameDay(new Date(e.start_time), selectedDate))
    .sort((a, b) => {
      const aGame = isGameEvent(a.title) ? 0 : 1;
      const bGame = isGameEvent(b.title) ? 0 : 1;
      if (aGame !== bGame) return aGame - bGame;
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.start_time), day));
  }

  return (
    <div className="min-h-screen pb-8 bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Spectator View</p>
          <h1 className="text-xl font-bold">{householdName}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* Month nav */}
        <div className="bg-white px-4 py-3 flex items-center justify-between">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-bold">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="bg-white px-2 py-3">
          <div className="grid grid-cols-7 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-2 rounded-xl ${
                    isSelected ? "bg-blue-500 text-white" : isCurrentMonth ? "" : "opacity-30"
                  }`}
                >
                  <span className="text-sm font-medium">{format(day, "d")}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const dotColor = ev.children?.[0]?.color || CATEGORY_COLORS[ev.category] || "#6b7280";
                        return (
                          <div
                            key={ev.id}
                            className={`rounded-full ${isGameEvent(ev.title) ? "w-2 h-2" : "w-1.5 h-1.5"}`}
                            style={{ backgroundColor: isSelected ? "white" : dotColor }}
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

        {/* Events */}
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            {format(selectedDate, "EEEE, MMMM d")}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-center py-8 text-gray-400">No public events this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event) => {
                const startDate = new Date(event.start_time);
                const endDate = event.end_time ? new Date(event.end_time) : null;
                const childColor = event.children?.[0]?.color || CATEGORY_COLORS[event.category];
                const isGame = isGameEvent(event.title);

                return (
                  <div
                    key={event.id}
                    className={`rounded-xl p-4 flex gap-3 ${
                      isGame ? "bg-white border-2 shadow-sm" : "bg-white border border-gray-200"
                    }`}
                    style={isGame ? { borderColor: childColor } : {}}
                  >
                    <div className={`${isGame ? "w-2" : "w-1.5"} rounded-full shrink-0`} style={{ backgroundColor: childColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`${isGame ? "font-bold" : "font-semibold"} truncate`}>{event.title}</h4>
                        {isGame && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">GAME</span>
                        )}
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${childColor}15`, color: childColor }}>
                          {CATEGORY_LABELS[event.category]}
                        </span>
                      </div>
                      {event.children && event.children.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {event.children.map((c) => (
                            <span key={c.id} className="text-sm font-medium" style={{ color: c.color || "#3b82f6" }}>
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        {event.all_day ? "All day" : endDate
                          ? `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`
                          : format(startDate, "h:mm a")}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1 mt-1 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline truncate flex items-center gap-1"
                          >
                            <span className="truncate">{event.location}</span>
                            <Navigation className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-gray-400">
        Powered by FamSync
      </footer>
    </div>
  );
}
