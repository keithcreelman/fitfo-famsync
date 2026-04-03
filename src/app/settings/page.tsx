"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  ArrowLeft,
  User,
  Home,
  Users,
  Calendar,
  LogOut,
  ChevronRight,
  Bell,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import CalendarPrivacyPopup from "@/components/CalendarPrivacyPopup";
import type { Profile, Household, Child } from "@/lib/types";
import { CHILD_COLOR_OPTIONS } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarPopupOpen, setCalendarPopupOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<"link" | "code" | null>(null);
  const [dailyDigest, setDailyDigest] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(profileData);

    const { data: memberships } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("invite_status", "accepted")
      .limit(1);
    const membership = memberships?.[0] || null;

    if (membership) {
      const { data: householdData } = await supabase
        .from("households")
        .select("*")
        .eq("id", membership.household_id)
        .maybeSingle();
      setHousehold(householdData);



      const { data: childrenData } = await supabase
        .from("children")
        .select("*")
        .eq("household_id", membership.household_id)
        .order("name");
      setChildren(childrenData || []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
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
      <header className="bg-white border-b border-[var(--color-border)] px-4 py-4 pt-[env(safe-area-inset-top)]">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Profile */}
        <section className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Profile
            </h2>
          </div>
          <div className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white text-lg font-bold">
              {profile?.display_name?.charAt(0) || "?"}
            </div>
            <div>
              <p className="font-semibold">{profile?.display_name}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {profile?.email}
              </p>
            </div>
          </div>
        </section>

        {/* Household */}
        <section className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Household
            </h2>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Home className="w-5 h-5 text-[var(--color-text-secondary)]" />
              <span className="font-medium">{household?.name}</span>
            </div>
            <div className="space-y-3">
              {children.map((child) => {
                const takenColors = children.filter((c) => c.id !== child.id).map((c) => c.color);
                return (
                  <div key={child.id} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0 border border-gray-200"
                      style={{ backgroundColor: child.color || "#6b7280" }}
                    />
                    <span className="text-sm font-medium flex-1">{child.nickname || child.name}</span>
                    <select
                      value={child.color || ""}
                      onChange={async (e) => {
                        const newColor = e.target.value;
                        await supabase.from("children").update({ color: newColor }).eq("id", child.id);
                        setChildren(children.map((c) => c.id === child.id ? { ...c, color: newColor } : c));
                      }}
                      className="px-2 py-1 border border-[var(--color-border)] rounded-lg text-xs bg-white"
                    >
                      <option value="">No color</option>
                      {CHILD_COLOR_OPTIONS.map((opt) => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          disabled={takenColors.includes(opt.value)}
                        >
                          {opt.label}{takenColors.includes(opt.value) ? " (taken)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Invite co-parent */}
        {household?.invite_code && (
          <section className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                Invite Co-Parent
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">Invite Code</p>
                <p className="text-xl font-mono font-bold tracking-[0.3em]">
                  {household.invite_code}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(household.invite_code!);
                    setCopiedInvite("code");
                    setTimeout(() => setCopiedInvite(null), 2000);
                  }}
                  className="mt-1 text-xs text-[var(--color-primary)] font-medium"
                >
                  {copiedInvite === "code" ? "✓ Copied!" : "Copy code"}
                </button>
              </div>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/invite?code=${household.invite_code}`;
                  navigator.clipboard.writeText(url);
                  setCopiedInvite("link");
                  setTimeout(() => setCopiedInvite(null), 2000);
                }}
                className="w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text)] hover:bg-gray-50"
              >
                {copiedInvite === "link" ? "✓ Link Copied!" : "Copy Invite Link"}
              </button>
            </div>
          </section>
        )}

        {/* Calendar connections */}
        <section className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Calendar Connections
            </h2>
          </div>
          <button
            onClick={() => setCalendarPopupOpen(true)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[var(--color-text-secondary)]" />
              <span className="font-medium">Google Calendar</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
              Not connected
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </section>

        {/* Notification Preferences */}
        <section className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Notifications
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-[var(--color-text-secondary)]" />
                <div>
                  <p className="text-sm font-medium">Daily Digest</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Every morning at 7 AM</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setDailyDigest(!dailyDigest);
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) {
                    await supabase.from("notification_preferences").upsert({
                      user_id: user.id,
                      daily_digest: !dailyDigest,
                      updated_at: new Date().toISOString(),
                    }, { onConflict: "user_id" });
                  }
                }}
                className={`w-11 h-6 rounded-full transition-colors relative ${dailyDigest ? "bg-[var(--color-primary)]" : "bg-gray-300"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${dailyDigest ? "translate-x-5.5 left-[1px]" : "left-[2px]"}`} style={{ transform: dailyDigest ? "translateX(22px)" : "translateX(0)" }} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-[var(--color-text-secondary)]" />
                <div>
                  <p className="text-sm font-medium">Weekly Summary</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Sunday evenings at 8 PM</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setWeeklyDigest(!weeklyDigest);
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) {
                    await supabase.from("notification_preferences").upsert({
                      user_id: user.id,
                      weekly_digest: !weeklyDigest,
                      updated_at: new Date().toISOString(),
                    }, { onConflict: "user_id" });
                  }
                }}
                className={`w-11 h-6 rounded-full transition-colors relative ${weeklyDigest ? "bg-[var(--color-primary)]" : "bg-gray-300"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform`} style={{ transform: weeklyDigest ? "translateX(22px)" : "translateX(0)" }} />
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Email delivery coming soon. Digest data is ready — add Resend API key to enable.
            </p>
          </div>
        </section>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full bg-white border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </main>

      <CalendarPrivacyPopup
        isOpen={calendarPopupOpen}
        onConnect={() => {
          // TODO: Google Calendar OAuth
          setCalendarPopupOpen(false);
        }}
        onSkip={() => setCalendarPopupOpen(false)}
      />

      <BottomNav />
    </div>
  );
}
