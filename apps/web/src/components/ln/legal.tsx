import type { ReactNode } from "react";

/** Shared shell for static policy pages (Privacy, Terms). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main id="main" style={{ flex: 1 }}>
      <article
        className="ln-legal"
        style={{ maxWidth: 720, margin: "0 auto", padding: "120px 22px 80px", fontFamily: "var(--ln-body)", color: "var(--ln-fg)", lineHeight: 1.6 }}
      >
        <h1 style={{ fontFamily: "var(--ln-display)", fontWeight: 700, fontSize: "clamp(30px,4vw,42px)", letterSpacing: "-0.01em", margin: 0 }}>{title}</h1>
        <p style={{ margin: "8px 0 34px", fontFamily: "var(--ln-mono)", fontSize: 12, letterSpacing: "0.04em", color: "var(--ln-muted)" }}>Last updated {updated}</p>
        {children}
      </article>
      <style>{`
        .ln-legal h2 { font-family: var(--ln-display); font-weight: 600; font-size: 20px; margin: 32px 0 10px; color: var(--ln-fg); }
        .ln-legal p, .ln-legal li { font-size: 15.5px; color: rgba(var(--ln-fg-rgb),0.82); }
        .ln-legal ul { padding-left: 20px; display: flex; flex-direction: column; gap: 7px; margin: 10px 0; }
        .ln-legal a { color: var(--ln-accent); text-decoration: none; }
        .ln-legal a:hover { text-decoration: underline; }
      `}</style>
    </main>
  );
}
