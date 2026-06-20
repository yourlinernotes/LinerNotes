"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Track } from "@/lib/types";
import { TrackSearch } from "./TrackSearch";
import { searchTracks } from "@/lib/api";
import { LNArt } from "@/components/ln/atoms";
import { paletteFromString } from "@/lib/palette";
import { ModeTabs } from "./composer-ui";

interface PlaylistTrack extends Track {
  note?: string;
}

const cmpInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(var(--ln-fg-rgb),0.06)",
  color: "var(--ln-fg)",
  border: "1px solid rgba(var(--ln-line-rgb),0.16)",
  borderRadius: 13,
  padding: "13px 15px",
  fontFamily: "var(--ln-body)",
  fontSize: 15,
  outline: "none",
  resize: "vertical",
};

export function PlaylistComposer() {
  const { data: session } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const gold = "var(--ln-accent)";
  const canPost = title.trim() && tracks.length > 0;

  const handleAddTrack = (track: Track) => {
    // Check if track already exists
    if (tracks.some((t) => t.trackId === track.trackId)) {
      alert("This track is already in your playlist");
      return;
    }
    setTracks([...tracks, { ...track, note: undefined }]);
  };

  const handleRemoveTrack = (index: number) => {
    setTracks(tracks.filter((_, i) => i !== index));
  };

  const handleMoveTrack = (index: number, direction: "up" | "down") => {
    const newTracks = [...tracks];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tracks.length) return;
    [newTracks[index], newTracks[newIndex]] = [newTracks[newIndex], newTracks[index]];
    setTracks(newTracks);
  };

  const handleSaveNote = () => {
    if (editingNoteIndex === null) return;
    const newTracks = [...tracks];
    newTracks[editingNoteIndex].note = noteText.trim() || undefined;
    setTracks(newTracks);
    setEditingNoteIndex(null);
    setNoteText("");
  };

  const handleEditNote = (index: number) => {
    setEditingNoteIndex(index);
    setNoteText(tracks[index].note || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;

    setSubmitting(true);
    try {
      const playlistData = {
        title: title.trim(),
        description: description.trim() || undefined,
        tracks: tracks.map((t) => ({
          trackId: String(t.trackId),
          name: t.name,
          artist: t.artist,
          album: t.album || "",
          artworkUrl: t.artworkUrl || null,
          note: t.note,
        })),
      };

      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playlistData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create playlist");
      }

      const { playlist } = await res.json();

      // Navigate to the playlist page
      router.push(`/playlist/${playlist.id}`);
    } catch (error) {
      console.error("Failed to create playlist:", error);
      const msg = error instanceof Error ? error.message : "Failed to create playlist";
      alert(msg === "Unauthorized" ? "Please log in to create a playlist." : `Couldn't create playlist: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <ModeTabs active="playlist" />

      <form onSubmit={handleSubmit} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Playlist Info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 22px", borderRadius: 16, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
        <div>
          <label style={{ display: "block", fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.08em", color: gold, textTransform: "uppercase", marginBottom: 8 }}>
            Playlist Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My favorite tracks"
            required
            maxLength={100}
            style={cmpInput}
          />
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.08em", color: gold, textTransform: "uppercase", marginBottom: 8 }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Songs that defined this moment..."
            maxLength={500}
            rows={3}
            style={cmpInput}
          />
          <div style={{ textAlign: "right", fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(var(--ln-fg-rgb),0.4)", marginTop: 6 }}>
            {description.length}/500
          </div>
        </div>
      </div>

      {/* Track Search */}
      <div>
        <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.08em", color: gold, textTransform: "uppercase", marginBottom: 10 }}>
          Add tracks ({tracks.length})
        </div>
        <TrackSearch onTrackSelect={handleAddTrack} searchAPI={searchTracks} placeholder="Search for a track to add..." />
      </div>

      {/* Track List */}
      {tracks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.08em", color: gold, textTransform: "uppercase" }}>
            Your playlist
          </div>
          {tracks.map((track, index) => (
            <div key={`${track.trackId}-${index}`} style={{ display: "flex", gap: 12, padding: 12, borderRadius: 12, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
              {/* Order Number */}
              <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: gold, color: "#1a0a04", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ln-mono)", fontSize: 14, fontWeight: 700 }}>
                {index + 1}
              </div>

              {/* Album Art */}
              <div style={{ width: 60, height: 60, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                <LNArt palette={paletteFromString(track.name)} src={track.artworkUrl} label="" radius={8} noTag />
              </div>

              {/* Track Info */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 15, color: "var(--ln-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {track.name}
                </div>
                <div style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {track.artist} · {track.album}
                </div>
                {track.note && editingNoteIndex !== index && (
                  <div style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: "rgba(var(--ln-fg-rgb),0.7)", fontStyle: "italic", marginTop: 4 }}>
                    "{track.note}"
                  </div>
                )}
                {editingNoteIndex === index && (
                  <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a note about this track..."
                      maxLength={200}
                      style={{ ...cmpInput, fontSize: 12, padding: "8px 10px" }}
                      autoFocus
                    />
                    <button type="button" onClick={handleSaveNote} style={{ padding: "8px 12px", borderRadius: 8, background: gold, color: "#1a0a04", border: "none", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 12, fontWeight: 600 }}>
                      Save
                    </button>
                    <button type="button" onClick={() => { setEditingNoteIndex(null); setNoteText(""); }} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(var(--ln-fg-rgb),0.1)", color: "var(--ln-fg)", border: "none", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 12, fontWeight: 600 }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={() => handleMoveTrack(index, "up")} disabled={index === 0} style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(var(--ln-fg-rgb),0.06)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-fg-rgb),0.12)", cursor: index === 0 ? "default" : "pointer", opacity: index === 0 ? 0.3 : 1, fontSize: 18 }} title="Move up">
                  ↑
                </button>
                <button type="button" onClick={() => handleMoveTrack(index, "down")} disabled={index === tracks.length - 1} style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(var(--ln-fg-rgb),0.06)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-fg-rgb),0.12)", cursor: index === tracks.length - 1 ? "default" : "pointer", opacity: index === tracks.length - 1 ? 0.3 : 1, fontSize: 18 }} title="Move down">
                  ↓
                </button>
                <button type="button" onClick={() => editingNoteIndex === index ? handleSaveNote() : handleEditNote(index)} style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(var(--ln-fg-rgb),0.06)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-fg-rgb),0.12)", cursor: "pointer", fontSize: 12 }} title="Add note">
                  📝
                </button>
                <button type="button" onClick={() => handleRemoveTrack(index)} style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(220,38,38,0.1)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontSize: 16 }} title="Remove">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Button */}
      <button type="submit" disabled={!canPost || submitting} className="ln-press" style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", cursor: canPost && !submitting ? "pointer" : "default", fontFamily: "var(--ln-body)", fontSize: 16, fontWeight: 700, background: canPost ? gold : "rgba(var(--ln-fg-rgb),0.1)", color: canPost ? "#1a0a04" : "rgba(var(--ln-fg-rgb),0.4)", transition: "background 0.2s" }}>
        {submitting ? "Creating playlist..." : !title.trim() ? "Add a title" : tracks.length === 0 ? "Add at least one track" : `Create playlist with ${tracks.length} track${tracks.length !== 1 ? "s" : ""}`}
      </button>
      </form>
    </div>
  );
}
