"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Link,
  Loader2,
  ChevronDown,
  ChevronUp,
  Rss,
} from "lucide-react";
import type { Child } from "@/lib/types";

interface Feed {
  url: string;
  label: string;
  child_id?: string;
}

interface CalendarFeedsProps {
  householdId: string;
  userId: string;
  children: Child[];
  onSyncComplete?: () => void;
}

export default function CalendarFeeds({
  householdId,
  userId,
  children,
  onSyncComplete,
}: CalendarFeedsProps) {
  const [expanded, setExpanded] = useState(false);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [childId, setChildId] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(`ics_feeds_${householdId}`);
    if (saved) {
      try {
        setFeeds(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
  }, [householdId]);

  function saveFeeds(newFeeds: Feed[]) {
    setFeeds(newFeeds);
    localStorage.setItem(`ics_feeds_${householdId}`, JSON.stringify(newFeeds));
  }

  async function handleAddFeed() {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();

    let label = labelInput.trim();
    if (!label) {
      if (url.includes("ottosport")) label = "OttoSport";
      else if (url.includes("mojo.sport")) label = "Mojo";
      else if (url.includes("teamsnap")) label = "TeamSnap";
      else label = "Calendar Feed";
    }

    if (feeds.some((f) => f.url === url)) {
      setSyncResult("This feed is already added.");
      return;
    }

    const newFeeds = [...feeds, { url, label, child_id: childId || undefined }];
    saveFeeds(newFeeds);
    setUrlInput("");
    setLabelInput("");
    setChildId("");

    await handleSyncFeed(url, childId || undefined);
  }

  async function handleSyncFeed(url: string, feedChildId?: string) {
    setSyncing(url);
    setSyncResult("");

    const feed = feeds.find((f) => f.url === url);
    const cid = feedChildId ?? feed?.child_id;

    try {
      const res = await fetch("/api/sync-ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ics_url: url,
          household_id: householdId,
          user_id: userId,
          child_id: cid || null,
          feed_label: feed?.label || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${data.error}`);
      } else {
        setSyncResult(
          `Synced! ${data.added} new, ${data.updated} updated, ${data.unchanged} unchanged`
        );
        onSyncComplete?.();
      }
    } catch (err) {
      setSyncResult(
        `Failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSyncing(null);
    }
  }

  async function handleSyncAll() {
    for (const feed of feeds) {
      await handleSyncFeed(feed.url);
    }
  }

  function handleRemoveFeed(url: string) {
    saveFeeds(feeds.filter((f) => f.url !== url));
  }

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Rss className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <span className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            Calendar Feeds
          </span>
          {feeds.length > 0 && (
            <span className="text-xs bg-gray-100 text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded-full">
              {feeds.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {feeds.length > 1 && !expanded && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleSyncAll();
              }}
              className="text-xs text-[var(--color-primary)] font-medium flex items-center gap-1 px-2 py-1 hover:bg-blue-50 rounded"
            >
              <RefreshCw className="w-3 h-3" /> Sync All
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border)]">
          {/* Existing feeds */}
          {feeds.map((feed) => {
            const childName = children.find((c) => c.id === feed.child_id)?.name;
            return (
              <div
                key={feed.url}
                className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 mt-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{feed.label}</p>
                  {childName && (
                    <p className="text-xs text-[var(--color-primary)] font-medium">
                      {childName}
                    </p>
                  )}
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">
                    {feed.url}
                  </p>
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
            );
          })}

          {/* Add new feed */}
          <div className="space-y-2 pt-2">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Add an ICS URL from OttoSport, Mojo, TeamSnap, or any platform.
            </p>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://...calendar.ics"
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Label (e.g. Parker Lacrosse)"
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <div className="flex gap-2">
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">Assign to child</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname || c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddFeed}
                disabled={!!syncing || !urlInput.trim()}
                className="px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
                Add Feed
              </button>
            </div>
          </div>

          {syncResult && (
            <div
              className={`text-sm p-2.5 rounded-lg ${
                syncResult.startsWith("Error") ||
                syncResult.startsWith("Failed") ||
                syncResult.startsWith("This feed")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {syncResult}
            </div>
          )}

          {feeds.length > 1 && (
            <button
              onClick={handleSyncAll}
              disabled={!!syncing}
              className="w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-gray-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync All Feeds
            </button>
          )}
        </div>
      )}
    </div>
  );
}
