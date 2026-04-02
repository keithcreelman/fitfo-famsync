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
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import CalendarPrivacyPopup from "@/components/CalendarPrivacyPopup";
import type { Profile, Household, Child } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarPopupOpen, setCalendarPopupOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<"link" | "code" | null>(null);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(profileData);

    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("invite_status", "accepted")
      .single();

    if (membership) {
      const { data: householdData } = await supabase
        .from("households")
        .select("*")
        .eq("id", membership.household_id)
        .single();
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
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">
                {children.length} child{children.length !== 1 ? "ren" : ""}:{" "}
                {children.map((c) => c.nickname || c.name).join(", ")}
              </span>
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
