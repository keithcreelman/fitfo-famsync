"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Clock, Navigation } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS, isGameEvent } from "@/lib/types";
// EventMedia removed from MVP

interface SpectatorEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  category: string;
  all_day: boolean;
  status: string;
  children: { name: string; color: string | null }[];
  notGoing: boolean; // true if any parent marked "can't go"
}

export default function SpectatorPage() {
  const params = useParams();
  const code = params.code as string;
  const supabase = createClient();

  const [householdName, setHouseholdName] = useState("");
  const [events, setEvents] = useState<SpectatorEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gamesOnly, setGamesOnly] = useState(false);

  const loadData = useCallback(async () => {
    const { data: household } = await supabase
      .from("households")
      .select("id, name")
      .eq("invite_code", code)
      .maybeSingle();

    if (!household) {
      setError("Invalid link.");
      setLoading(false);
      return;
    }

    setHouseholdName(household.name);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const { data: eventsData } = await supabase
      .from("events")
      .select("id, title, start_time, end_time, location, category, all_day, status, event_children(children(name, color))")
      .eq("household_id", household.id)
      .eq("visibility", "public")
      .gte("start_time", monthStart.toISOString())
      .lte("start_time", monthEnd.toISOString())
      .order("start_time");

    // Check which events have "not_going" RSVPs
    const eventIds = (eventsData || []).map((e: any) => e.id);
    const { data: notGoingRsvps } = eventIds.length > 0
      ? await supabase.from("event_rsvps").select("event_id").eq("status", "not_going").in("event_id", eventIds)
      : { data: [] };
    const notGoingSet = new Set((notGoingRsvps || []).map((r: any) => r.event_id));

    setEvents((eventsData || []).map((e: any) => ({
      ...e,
      children: e.event_children?.map((ec: any) => ec.children).filter(Boolean) || [],
      status: e.status || "active",
      notGoing: notGoingSet.has(e.id),
    })));
    setLoading(false);
  }, [supabase, code, currentMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center px-6"><p className="text-red-600 font-semibold">{error}</p></div>;

  const calendarDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth)), end: endOfWeek(endOfMonth(currentMonth)) });
  const displayEvents = gamesOnly ? events.filter((e) => isGameEvent(e.title)) : events;
  const selectedEvents = displayEvents.filter((e) => isSameDay(new Date(e.start_time), selectedDate)).sort((a, b) => {
    if (isGameEvent(a.title) !== isGameEvent(b.title)) return isGameEvent(a.title) ? -1 : 1;
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-md mx-auto">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Family Calendar</p>
          <h1 className="text-lg font-bold">{householdName}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto">
        {/* Month nav */}
        <div className="bg-white flex items-center justify-between px-4 py-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="w-5 h-5" /></button>
          <span className="font-bold">{format(currentMonth, "MMMM yyyy")}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="w-5 h-5" /></button>
        </div>

        {/* Mini calendar */}
        <div className="bg-white px-2 py-2">
          <div className="grid grid-cols-7 mb-1">
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-medium text-gray-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {calendarDays.map((day) => {
              const dayEvents = displayEvents.filter((e) => isSameDay(new Date(e.start_time), day));
              const isSelected = isSameDay(day, selectedDate);
              return (
                <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-1.5 rounded-lg ${isSelected ? "bg-blue-500 text-white" : !isSameMonth(day, currentMonth) ? "opacity-20" : ""}`}>
                  <span className="text-xs">{format(day, "d")}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-px mt-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div key={ev.id} className="w-1 h-1 rounded-full" style={{ backgroundColor: isSelected ? "white" : ev.children[0]?.color || "#6b7280" }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter */}
        <div className="px-4 pt-2 flex gap-2">
          <button
            onClick={() => setGamesOnly(false)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${!gamesOnly ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"}`}
          >All</button>
          <button
            onClick={() => setGamesOnly(true)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${gamesOnly ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}
          >Games Only</button>
        </div>

        {/* Events list */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 mb-2">{format(selectedDate, "EEEE, MMMM d")}</p>
          {selectedEvents.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-400">Nothing scheduled</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => {
                const s = new Date(ev.start_time);
                const e = ev.end_time ? new Date(ev.end_time) : null;
                const color = ev.children[0]?.color || CATEGORY_COLORS[ev.category as keyof typeof CATEGORY_COLORS] || "#6b7280";
                const game = isGameEvent(ev.title);
                const cancelled = ev.status === "cancelled" || ev.status === "postponed";
                return (
                  <div key={ev.id} className={`rounded-lg p-3 flex gap-2.5 ${cancelled ? "bg-gray-100 opacity-60" : "bg-white"} ${game && !cancelled ? "border-l-4" : "border-l-2"}`} style={{ borderLeftColor: cancelled ? "#d1d5db" : color }}>
                    <div className="flex-1 min-w-0">
                      {/* WHO */}
                      {ev.children.length > 0 && (
                        <p className="text-xs font-semibold" style={{ color }}>{ev.children.map((c) => c.name).join(", ")}</p>
                      )}
                      {/* WHAT + SPORT */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm ${cancelled ? "line-through text-gray-400" : game ? "font-bold" : "font-medium"}`}>
                          {ev.title}
                        </p>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}15`, color }}>
                          {CATEGORY_LABELS[ev.category as keyof typeof CATEGORY_LABELS] || ev.category}
                        </span>
                        {game && !cancelled && <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">GAME</span>}
                        {cancelled && <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${ev.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>{ev.status === "cancelled" ? "CANCELLED" : "POSTPONED"}</span>}
                      </div>
                      {/* WHEN */}
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {ev.all_day ? "All day" : e ? `${format(s, "h:mm a")} - ${format(e, "h:mm a")}` : format(s, "h:mm a")}
                      </p>
                      {/* WHERE */}
                      {ev.location && (
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ev.location)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                          <Navigation className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      )}
                      {/* Kid attendance */}
                      {ev.children.length > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          {ev.children.map((c, i) => (
                            <span key={i} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              ev.notGoing || cancelled
                                ? "bg-red-50 text-red-500"
                                : "bg-green-50 text-green-600"
                            }`}>
                              {c.name}: {ev.notGoing || cancelled ? "Not attending" : "Playing"}
                            </span>
                          ))}
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

      <footer className="text-center py-4 text-[10px] text-gray-300">Powered by FamSync</footer>
    </div>
  );
}
