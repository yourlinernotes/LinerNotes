"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
const CDCaseViewer = dynamic(() => import("@/components/CDCaseViewer"), { ssr: false });

type Tab = "feed" | "card" | "player";

// palette lifted from design/feed.html + direction-y2k.html — the Y2K product-shoot direction
const HOLO = "linear-gradient(90deg,#ffcfe8,#d4c6ff,#c2eeff,#c6f4e8,#ffe6bd,#ffcfe8)";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const DISP = "'Space Grotesk', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

export default function CDMockupsPage() {
  const [tab, setTab] = useState<Tab>("feed");
  const [dark, setDark] = useState(false); // the design direction is light-first
  const [beat, setBeat] = useState(0);

  const pal = {
    bg: dark ? "#101014" : "#fbfcfe",
    card: dark ? "#1a1a20" : "#ffffff",
    ink: dark ? "#ececf0" : "#191c22",
    sub: dark ? "#8f8f9a" : "#9aa0a8",
    line: dark ? "#2a2a32" : "#e7e9ee",
  };
  const mono: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: pal.sub };
  const btn = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontFamily: MONO,
    border: `1px solid ${active ? pal.ink : pal.line}`,
    background: active ? pal.ink : pal.card, color: active ? pal.bg : pal.ink,
  });
  // holo hairline: the gradient edge from the feed design
  const holoCard: React.CSSProperties = {
    background: HOLO, padding: 1.5, borderRadius: 18,
  };
  const inner: React.CSSProperties = {
    background: pal.card, borderRadius: 16.5, overflow: "hidden",
  };

  return (
    <div style={{ minHeight: "100vh", background: pal.bg, color: pal.ink, fontFamily: BODY, padding: 28 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 28, alignItems: "center", maxWidth: 1000, marginInline: "auto" }}>
        <span style={{ fontFamily: DISP, fontWeight: 700, fontSize: 18, marginRight: 8 }}>
          Liner<span style={{ color: "#e6b450" }}>Notes</span>
        </span>
        <span style={{ ...mono, marginRight: 12 }}>cd viz mockups</span>
        <button style={btn(tab === "feed")} onClick={() => setTab("feed")}>feed</button>
        <button style={btn(tab === "card")} onClick={() => setTab("card")}>share card</button>
        <button style={btn(tab === "player")} onClick={() => setTab("player")}>playing</button>
        <div style={{ flex: 1 }} />
        <button style={btn(false)} onClick={() => setDark(d => !d)}>{dark ? "◑ dark" : "◐ light"}</button>
      </div>

      {tab === "feed" && (
        <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 20 }}>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 17, background: "#e6b450", color: "#5c1f00", display: "grid", placeItems: "center", fontFamily: DISP, fontWeight: 700 }}>A</div>
              <div>
                <div style={{ fontFamily: DISP, fontWeight: 600, fontSize: 14 }}>Anusha</div>
                <div style={{ ...mono }}>@anusha · 2h</div>
              </div>
            </div>
            <div style={holoCard}>
              <div style={{ ...inner, display: "grid", gridTemplateColumns: "300px 1fr" }}>
                <div style={{ height: 300, cursor: "pointer" }} onClick={() => setBeat(b => b + 1)}>
                  <CDCaseViewer coverMode="disc" reviewBeat={beat} background={pal.card} />
                </div>
                <div style={{ padding: "18px 20px" }}>
                  <div style={mono}>album review</div>
                  <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 24, marginTop: 4 }}>i love my computer</div>
                  <div style={{ color: pal.sub, fontSize: 14 }}>ninajirachi · 2024</div>
                  <div style={{ color: "#e6b450", margin: "8px 0", letterSpacing: 2 }}>★★★★☆ <span style={{ color: pal.sub, fontSize: 12 }}>4.5</span></div>
                  <div style={{ fontSize: 15, lineHeight: 1.5 }}>
                    the ARP on ilmc at 1:04 rewired my brain — everything just lands at once.
                  </div>
                  <div style={{ borderLeft: `3px solid #e6b450`, paddingLeft: 10, marginTop: 10, fontSize: 13, color: pal.sub }}>
                    <span style={{ fontFamily: MONO }}>1:04 · ilmc</span><br />
                    “the way it detunes here — i always wait for it”
                  </div>
                  <div style={{ ...mono, marginTop: 12 }}>read the full review →</div>
                </div>
              </div>
            </div>
            <div style={{ ...mono, textAlign: "center", marginTop: 10 }}>tap the case → review beat</div>
          </div>
        </div>
      )}

      {tab === "card" && (
        <div style={{ maxWidth: 380, margin: "0 auto" }}>
          <div style={holoCard}>
            <div style={{ ...inner, padding: "18px 0 0" }}>
              <div style={{ ...mono, textAlign: "center" }}>liner notes · ln-0417 · fri 02:14</div>
              <div style={{ height: 330, marginTop: 14 }}>
                <CDCaseViewer coverMode="pane" background={pal.card} />
              </div>
              <div style={{ padding: "18px 24px 22px", textAlign: "center" }}>
                <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 22 }}>i love my computer</div>
                <div style={{ color: pal.sub, fontSize: 14 }}>ninajirachi</div>
                <div style={{ color: "#e6b450", margin: "6px 0", letterSpacing: 2 }}>★★★★☆</div>
                <div style={{ fontStyle: "italic", fontSize: 14, color: pal.sub }}>
                  “the ARP at 1:04 rewired my brain”
                </div>
                <div style={{ ...mono, marginTop: 14 }}>made on linernotes · @anusha</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "player" && (
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={holoCard}>
            <div style={{ ...inner, display: "grid", gridTemplateColumns: "1.5fr 1fr" }}>
              <div style={{ height: 470 }}>
                <CDCaseViewer coverMode="pane" playerOpen background={pal.card} />
              </div>
              <div style={{ padding: 24, borderLeft: `1px solid ${pal.line}` }}>
                <div style={mono}>now playing</div>
                <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 20, marginTop: 4 }}>i love my computer</div>
                <div style={{ color: pal.sub, fontSize: 13, marginBottom: 14 }}>ninajirachi · 2024</div>
                {["ilmc", "fant4sy", "london", "sick girl"].map((t, i) => (
                  <div key={t} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${pal.line}`, fontSize: 14, color: i === 0 ? "#e6b450" : pal.ink }}>
                    <span><span style={{ fontFamily: MONO, color: pal.sub, fontSize: 11, marginRight: 8 }}>{String(i + 1).padStart(2, "0")}</span>{t}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: pal.sub }}>{i === 0 ? "▶ 1:04" : `3:1${i}`}</span>
                  </div>
                ))}
                <div style={{ marginTop: 22 }}>
                  <div style={{ height: 3, borderRadius: 2, background: pal.line }}>
                    <div style={{ width: "34%", height: 3, borderRadius: 2, background: HOLO }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, ...mono }}>
                    <span>1:04</span><span>3:07</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
