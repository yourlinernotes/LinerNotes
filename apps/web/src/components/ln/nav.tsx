"use client";

// Editorial top bar + footer. The bar is the funnel: browsing is open; signed-out
// users get "Log in" (quiet) + "Join the beta" (gold); signed-in users get a compose
// button + their profile. On immersive review pages the bar rides over the flood.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LNIcon } from "./atoms";

export function TopBar({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const handle = session?.user?.handle;

  // Close the mobile menu on route change.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const accent = "var(--ln-accent)";
  const onFlood = transparent && !scrolled;
  const ink = transparent ? "#f1ebe0" : "var(--ln-fg)";
  const muted = transparent ? "rgba(241,235,224,0.62)" : "rgba(var(--ln-fg-rgb),0.6)";

  const bg = onFlood
    ? "linear-gradient(180deg, rgba(6,5,5,0.5) 0%, rgba(6,5,5,0) 100%)"
    : transparent
      ? "rgba(10,8,7,0.72)"
      : "rgba(var(--ln-surface-rgb),0.72)";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backdropFilter: onFlood ? "none" : "blur(18px) saturate(140%)",
        WebkitBackdropFilter: onFlood ? "none" : "blur(18px) saturate(140%)",
        background: bg,
        borderBottom: onFlood
          ? "1px solid transparent"
          : `1px solid rgba(${transparent ? "255,255,255" : "var(--ln-line-rgb)"},0.09)`,
        transition: "background 0.3s, border-color 0.3s, backdrop-filter 0.3s",
      }}
    >
      <div
        style={{ maxWidth: 1180, margin: "0 auto", height: 64, padding: "0 24px", display: "flex", alignItems: "center", gap: 26 }}
        className="lnw-nav-inner"
      >
        <Link href="/" className="ln-press" style={{ display: "inline-flex", alignItems: "baseline", gap: 7, textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 21, color: ink, letterSpacing: "-0.02em", lineHeight: 1 }}>LinerNotes</span>
          <span style={{ fontFamily: "var(--ln-body)", fontSize: 8.5, letterSpacing: "0.14em", color: accent, textTransform: "uppercase", fontWeight: 700, border: `1px solid ${accent}66`, borderRadius: 999, padding: "2px 6px", position: "relative", top: -3 }}>beta</span>
        </Link>

        <nav className="lnw-nav-links" style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <NavLink label="Home" href="/" active={pathname === "/"} ink={ink} muted={muted} accent={accent} />
          <NavLink label="Feed" href="/feed" active={pathname === "/feed"} ink={ink} muted={muted} accent={accent} />
        </nav>

        <div style={{ flex: 1 }} />

        <Link
          href="/log"
          className="ln-press lnw-nav-compose"
          title="Log a note"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 13px",
            borderRadius: 999,
            textDecoration: "none",
            border: `1px solid ${transparent ? "rgba(241,235,224,0.22)" : "rgba(var(--ln-fg-rgb),0.18)"}`,
            background: transparent ? "rgba(241,235,224,0.06)" : "rgba(var(--ln-fg-rgb),0.04)",
            color: ink,
            fontFamily: "var(--ln-body)",
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <LNIcon name="edit" size={15} color={ink} />
          Log a note
        </Link>

        {session ? (
          <>
            <Link
              href="/friends"
              className="ln-press lnw-nav-login"
              style={{ color: pathname === "/friends" ? ink : muted, textDecoration: "none", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600, padding: "6px 4px", whiteSpace: "nowrap" }}
            >
              Friends
            </Link>
            {handle && (
              <Link
                href={`/profile/${handle}`}
                className="ln-press lnw-nav-login"
                style={{ color: muted, textDecoration: "none", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600, padding: "6px 4px", whiteSpace: "nowrap" }}
              >
                Profile
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="ln-press"
              style={{
                padding: "9px 17px",
                borderRadius: 999,
                border: `1px solid rgba(${transparent ? "241,235,224" : "var(--ln-fg-rgb)"},0.2)`,
                cursor: "pointer",
                background: "transparent",
                color: ink,
                fontFamily: "var(--ln-body)",
                fontSize: 13.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="ln-press lnw-nav-login"
              style={{ color: muted, textDecoration: "none", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600, padding: "6px 4px", whiteSpace: "nowrap" }}
            >
              Log in
            </Link>
            <Link
              href="/login?mode=signup"
              className="ln-press"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                boxSizing: "border-box",
                padding: "9px 17px",
                borderRadius: 999,
                border: "none",
                textDecoration: "none",
                background: accent,
                color: "#1a0a04",
                fontFamily: "var(--ln-body)",
                fontSize: 13.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                boxShadow: `0 8px 22px -10px ${accent}`,
              }}
            >
              Join the beta
            </Link>
          </>
        )}

        {/* Mobile hamburger — the desktop links are hidden on small screens, so
            this is the only way to reach Feed / Friends / Profile / compose. */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="ln-press lnw-nav-menu-btn"
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 10,
            border: `1px solid rgba(${transparent ? "241,235,224" : "var(--ln-fg-rgb)"},0.18)`,
            background: "transparent",
            color: ink,
            cursor: "pointer",
            fontSize: 17,
            lineHeight: 1,
          }}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          className="lnw-nav-drawer"
          style={{
            position: "absolute",
            top: 64,
            left: 0,
            right: 0,
            background: transparent ? "rgba(10,8,7,0.96)" : "rgba(var(--ln-surface-rgb),0.98)",
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter: "blur(18px) saturate(140%)",
            borderBottom: `1px solid rgba(var(--ln-line-rgb),0.12)`,
            padding: "8px 16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <MobileItem href="/" label="Home" onNav={() => setMenuOpen(false)} ink={ink} />
          <MobileItem href="/feed" label="Feed" onNav={() => setMenuOpen(false)} ink={ink} />
          <MobileItem href="/log" label="Log a note" onNav={() => setMenuOpen(false)} ink={ink} />
          {session ? (
            <>
              <MobileItem href="/friends" label="Friends" onNav={() => setMenuOpen(false)} ink={ink} />
              {handle && <MobileItem href={`/profile/${handle}`} label="Profile" onNav={() => setMenuOpen(false)} ink={ink} />}
              <button
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                className="ln-press"
                style={{ textAlign: "left", padding: "12px 6px", background: "none", border: "none", cursor: "pointer", color: "rgba(var(--ln-fg-rgb),0.7)", fontFamily: "var(--ln-body)", fontSize: 15.5, fontWeight: 600 }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <MobileItem href="/login" label="Log in" onNav={() => setMenuOpen(false)} ink={ink} />
              <MobileItem href="/login?mode=signup" label="Join the beta" onNav={() => setMenuOpen(false)} ink={ink} accent />
            </>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 760px) {
          .lnw-nav-inner { gap: 14px !important; }
          .lnw-nav-links { display: none !important; }
          .lnw-nav-compose { display: none !important; }
          .lnw-nav-menu-btn { display: inline-flex !important; }
        }
        @media (max-width: 460px) {
          .lnw-nav-inner { padding: 0 16px !important; }
          .lnw-nav-login { display: none !important; }
        }
      `}</style>
    </header>
  );
}

function MobileItem({
  href,
  label,
  onNav,
  ink,
  accent = false,
}: {
  href: string;
  label: string;
  onNav: () => void;
  ink: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNav}
      className="ln-press"
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: 44,
        boxSizing: "border-box",
        padding: "11px 6px",
        textDecoration: "none",
        color: accent ? "var(--ln-accent)" : ink,
        fontFamily: "var(--ln-body)",
        fontSize: 15.5,
        fontWeight: accent ? 700 : 600,
        borderBottom: "1px solid rgba(var(--ln-line-rgb),0.06)",
      }}
    >
      {label}
    </Link>
  );
}

function NavLink({
  label,
  href,
  active,
  ink,
  muted,
  accent,
}: {
  label: string;
  href: string;
  active: boolean;
  ink: string;
  muted: string;
  accent: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        textDecoration: "none",
        padding: "6px 0",
        fontFamily: "var(--ln-label)",
        fontSize: 13.5,
        fontWeight: 600,
        letterSpacing: "0.01em",
        color: active ? ink : hover ? ink : muted,
        transition: "color 0.16s",
      }}
    >
      {label}
      <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, borderRadius: 2, background: accent, transform: `scaleX(${active ? 1 : 0})`, transformOrigin: "left", transition: "transform 0.2s" }} />
    </Link>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────
export function Footer({ dark = true }: { dark?: boolean }) {
  const accent = "var(--ln-accent)";
  const fg = dark ? "#f1ebe0" : "var(--ln-fg)";
  const muted = dark ? "rgba(241,235,224,0.5)" : "rgba(var(--ln-fg-rgb),0.55)";
  const line = dark ? "rgba(241,235,224,0.12)" : "rgba(var(--ln-fg-rgb),0.12)";
  return (
    <footer style={{ position: "relative", zIndex: 0, borderTop: `1px solid ${line}`, marginTop: "auto", background: "rgba(0,0,0,0.12)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 24px 52px", display: "flex", flexWrap: "wrap", gap: 30, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ maxWidth: 360 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "baseline", gap: 7, textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 20, color: fg, letterSpacing: "-0.02em" }}>LinerNotes</span>
          </Link>
          <p style={{ margin: "12px 0 0", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 16, lineHeight: 1.45, color: muted }}>
            The moment a song hits you, kept while you&apos;re still in it.
          </p>
          <div style={{ marginTop: 16, fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.04em", color: muted }}>© 2026 LinerNotes · made for listeners</div>
        </div>

        <div style={{ display: "flex", gap: 54, flexWrap: "wrap" }}>
          <FootCol head="Product" links={[["The feed", "/feed"], ["Log a note", "/log"]]} fg={fg} muted={muted} />
          <FootCol head="You" links={[["Friends", "/friends"], ["Log in", "/login"]]} fg={fg} muted={muted} />
          <FootCol head="Legal" links={[["Privacy", "/privacy"], ["Terms", "/terms"]]} fg={fg} muted={muted} />
        </div>

        <div style={{ minWidth: 220 }}>
          <div style={{ fontFamily: "var(--ln-label)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: accent, marginBottom: 12 }}>get early access</div>
          <Link href="/login?mode=signup" className="ln-press" style={{ display: "block", textAlign: "center", textDecoration: "none", width: "100%", boxSizing: "border-box", padding: "13px", borderRadius: 12, background: accent, color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 700, boxShadow: `0 10px 26px -12px ${accent}` }}>
            Join the beta
          </Link>
          <p style={{ margin: "10px 0 0", fontFamily: "var(--ln-mono)", fontSize: 10, lineHeight: 1.5, color: muted, letterSpacing: "0.02em" }}>iOS &amp; Android · invites roll out weekly</p>
        </div>
      </div>
    </footer>
  );
}

function FootCol({
  head,
  links,
  fg,
  muted,
}: {
  head: string;
  links: [string, string][];
  fg: string;
  muted: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontFamily: "var(--ln-label)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: muted }}>{head}</div>
      {links.map(([label, href]) => (
        <Link key={label} href={href} style={{ fontFamily: "var(--ln-body)", fontSize: 13.5, color: fg, opacity: 0.82, textDecoration: "none" }}>{label}</Link>
      ))}
    </div>
  );
}
