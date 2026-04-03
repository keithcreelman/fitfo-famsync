"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Camera, Download, Trash2, X, Loader2, Image, Film } from "lucide-react";

interface EventMediaProps {
  eventId: string;
  userId?: string;
  readOnly?: boolean; // for spectators
}

interface MediaItem {
  id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  caption: string | null;
  created_at: string;
  uploaded_by: string;
  url?: string;
}

export default function EventMedia({ eventId, userId, readOnly }: EventMediaProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewItem, setViewItem] = useState<MediaItem | null>(null);
  const [mediaCount, setMediaCount] = useState(0);

  // Load count on mount
  useEffect(() => {
    supabase
      .from("event_media")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .then(({ count }) => setMediaCount(count || 0));
  }, [eventId, supabase]);

  async function loadMedia() {
    setLoading(true);
    const { data } = await supabase
      .from("event_media")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (data) {
      // Get signed URLs for each file
      const withUrls = await Promise.all(
        data.map(async (item) => {
          const { data: urlData } = await supabase.storage
            .from("event-media")
            .createSignedUrl(item.file_path, 3600); // 1 hour
          return { ...item, url: urlData?.signedUrl || "" };
        })
      );
      setMedia(withUrls);
    }
    setLoading(false);
  }

  async function handleUpload(files: FileList) {
    if (!userId || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${eventId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("event-media")
        .upload(path, file);

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        continue;
      }

      await supabase.from("event_media").insert({
        event_id: eventId,
        uploaded_by: userId,
        file_path: path,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });
    }

    setMediaCount((c) => c + files.length);
    await loadMedia();
    setUploading(false);
  }

  async function handleDelete(item: MediaItem) {
    await supabase.storage.from("event-media").remove([item.file_path]);
    await supabase.from("event_media").delete().eq("id", item.id);
    setMedia(media.filter((m) => m.id !== item.id));
    setMediaCount((c) => c - 1);
    setViewItem(null);
  }

  async function handleDownload(item: MediaItem) {
    if (!item.url) return;
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.file_name;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function toggleGallery() {
    if (!expanded) loadMedia();
    setExpanded(!expanded);
  }

  const isImage = (type: string) => type.startsWith("image/");
  const isVideo = (type: string) => type.startsWith("video/");

  return (
    <>
      {/* Trigger button */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleGallery}
          className={`flex items-center gap-1 text-xs transition-colors ${
            mediaCount > 0
              ? "text-[var(--color-primary)] font-medium"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Camera className="w-3 h-3" />
          {mediaCount > 0 ? `${mediaCount} photo${mediaCount > 1 ? "s" : ""}` : "Photos"}
        </button>
        {!readOnly && userId && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-gray-400 hover:text-[var(--color-primary)] transition-colors"
          >
            + Add
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Uploading indicator */}
      {uploading && (
        <div className="flex items-center gap-1 mt-1 text-xs text-[var(--color-primary)]">
          <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
        </div>
      )}

      {/* Gallery grid */}
      {expanded && (
        <div className="mt-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : media.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">No photos yet</p>
          ) : (
            <div className="grid grid-cols-4 gap-1 rounded-lg overflow-hidden">
              {media.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setViewItem(item)}
                  className="aspect-square bg-gray-100 relative overflow-hidden"
                >
                  {isImage(item.file_type) && item.url ? (
                    <img src={item.url} alt={item.file_name} className="w-full h-full object-cover" />
                  ) : isVideo(item.file_type) ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <Film className="w-5 h-5 text-gray-500" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <Image className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full-screen viewer */}
      {viewItem && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setViewItem(null)} className="text-white p-1">
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => handleDownload(viewItem)} className="text-white p-1">
                <Download className="w-5 h-5" />
              </button>
              {!readOnly && userId === viewItem.uploaded_by && (
                <button onClick={() => handleDelete(viewItem)} className="text-red-400 p-1">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-4">
            {isImage(viewItem.file_type) && viewItem.url ? (
              <img src={viewItem.url} alt={viewItem.file_name} className="max-w-full max-h-full object-contain" />
            ) : isVideo(viewItem.file_type) && viewItem.url ? (
              <video src={viewItem.url} controls className="max-w-full max-h-full" />
            ) : null}
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-white text-xs">{viewItem.file_name}</p>
            {viewItem.file_size && (
              <p className="text-gray-400 text-[10px]">{(viewItem.file_size / 1024 / 1024).toFixed(1)} MB</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
