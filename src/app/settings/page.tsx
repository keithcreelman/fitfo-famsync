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
  RefreshCw,
  Link,
  Loader2,
  Check,
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
  const [userId, setUserId] = useState("");
  const [icsFeeds, setIcsFeeds] = useState<{ url: string; label: string }[]>([]);
  const [icsUrlInput, setIcsUrlInput] = useState("");
  const [icsLabelInput, setIcsLabelInput] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null); // URL being synced
  const [syncResult, setSyncResult] = useState("");

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

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

      // Load saved ICS feeds from localStorage
      const savedFeeds = localStorage.getItem(`ics_feeds_${membership.household_id}`);
      if (savedFeeds) {
        try { setIcsFeeds(JSON.parse(savedFeeds)); } catch { /* ignore */ }
      }

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

  function saveFeeds(feeds: { url: string; label: string }[]) {
    if (!household) return;
    setIcsFeeds(feeds);
    localStorage.setItem(`ics_feeds_${household.id}`, JSON.stringify(feeds));
  }

  async function handleAddFeed() {
    if (!icsUrlInput.trim() || !household || !userId) return;
    const url = icsUrlInput.trim();

    // Auto-detect label from URL
    let label = icsLabelInput.trim();
    if (!label) {
      if (url.includes("ottosport")) label = "OttoSport";
      else if (url.includes("mojo.sport")) label = "Mojo";
      else if (url.includes("teamsnap")) label = "TeamSnap";
      else label = "Calendar Feed";
    }

    // Avoid duplicates
    if (icsFeeds.some((f) => f.url === url)) {
      setSyncResult("This feed is already added.");
      return;
    }

    const newFeeds = [...icsFeeds, { url, label }];
    saveFeeds(newFeeds);
    setIcsUrlInput("");
    setIcsLabelInput("");

    // Sync immediately
    await handleSyncFeed(url);
  }

  async function handleSyncFeed(url: string) {
    if (!household || !userId) return;
    setSyncing(url);
    setSyncResult("");

    try {
      const res = await fetch("/api/sync-ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ics_url: url,
          household_id: household.id,
          user_id: userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${data.error}`);
      } else {
        setSyncResult(`Synced! ${data.added} new, ${data.updated} updated, ${data.unchanged} unchanged`);
      }
    } catch (err) {
      setSyncResult(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(null);
    }
  }

  async function handleSyncAll() {
    for (const feed of icsFeeds) {
      await handleSyncFeed(feed.url);
    }
  }

  function handleRemoveFeed(url: string) {
    saveFeeds(icsFeeds.filter((f) => f.url !== url));
  }

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

        {/* ICS Calendar Subscriptions */}
        <section className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Calendar Feeds
            </h2>
            {icsFeeds.length > 1 && (
              <button
                onClick={handleSyncAll}
                disabled={!!syncing}
                className="text-xs text-[var(--color-primary)] font-medium flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sync All
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            {/* Existing feeds */}
            {icsFeeds.map((feed) => (
              <div key={feed.url} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{feed.label}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">{feed.url}</p>
                </div>
                <button
                  onClick={() => handleSyncFeed(feed.url)}
                  disabled={!!syncing}
                  className="p-2 text-[var(--color-primary)] hover:bg-blue-50 rounded-lg shrink-0"
                >
                  {syncing === feed.url ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleRemoveFeed(feed.url)}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg shrink-0 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add new feed */}
            <p className="text-sm text-[var(--color-text-secondary)]">
              Add an ICS URL from OttoSport, Mojo, TeamSnap, or any platform.
            </p>
            <div className="space-y-2">
              <input
                type="url"
                value={icsUrlInput}
                onChange={(e) => setIcsUrlInput(e.target.value)}
                placeholder="https://...calendar.ics"
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={icsLabelInput}
                  onChange={(e) => setIcsLabelInput(e.target.value)}
                  placeholder="Label (auto-detected)"
                  className="flex-1 px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  onClick={handleAddFeed}
                  disabled={!!syncing || !icsUrlInput.trim()}
                  className="px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                  Add
                </button>
              </div>
            </div>

            {syncResult && (
              <div className={`text-sm p-2.5 rounded-lg ${syncResult.startsWith("Error") || syncResult.startsWith("Failed") || syncResult.startsWith("This feed") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {syncResult}
              </div>
            )}
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
