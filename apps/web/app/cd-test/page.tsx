"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
const CDCaseViewer = dynamic(() => import("@/components/CDCaseViewer"), { ssr: false });

const btn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid #444",
  background: "#26262e", color: "#eee", cursor: "pointer", fontSize: 14,
};

export default function CDTestPage() {
  const [coverMode, setCoverMode] = useState<"disc" | "pane">("disc");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [reviewBeat, setReviewBeat] = useState(0);
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#15151a", position: "relative" }}>
      <CDCaseViewer coverMode={coverMode} playerOpen={playerOpen} reviewBeat={reviewBeat} debug walls />
      <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8, zIndex: 10 }}>
        <button style={{ ...btn, outline: coverMode === "disc" ? "2px solid #7c7cf5" : "none" }}
          onClick={() => setCoverMode("disc")}>Option A: art on disc</button>
        <button style={{ ...btn, outline: coverMode === "pane" ? "2px solid #7c7cf5" : "none" }}
          onClick={() => setCoverMode("pane")}>Option B: art on pane</button>
        <button style={btn} onClick={() => setReviewBeat(b => b + 1)}>▶ click-into-review</button>
        <button style={{ ...btn, outline: playerOpen ? "2px solid #7c7cf5" : "none" }}
          onClick={() => setPlayerOpen(o => !o)}>{playerOpen ? "Close player" : "Open player"}</button>
      </div>
    </div>
  );
}
