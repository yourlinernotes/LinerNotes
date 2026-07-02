"use client";

/**
 * Follow / Following toggle for the asymmetric follow graph. Self-contained:
 * fetches current state on mount, toggles optimistically, and reports count
 * changes up via onCountChange so the profile's follower stat stays in sync.
 */

import { useEffect, useState } from "react";

export function FollowButton({
  userId,
  onCountChange,
}: {
  userId: string;
  /** Called with +1 / -1 when the viewer follows / unfollows, to nudge the count. */
  onCountChange?: (delta: number) => void;
}) {
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/follow?userId=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setIsFollowing(!!d.isFollowing); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const toggle = async () => {
    if (busy || isFollowing == null) return;
    const next = !isFollowing;
    setBusy(true);
    setIsFollowing(next); // optimistic
    onCountChange?.(next ? 1 : -1);
    try {
      const r = await fetch("/api/follow", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setIsFollowing(!next); // revert on failure
      onCountChange?.(next ? -1 : 1);
    } finally {
      setBusy(false);
    }
  };

  if (isFollowing == null) {
    return <div style={{ ...base, opacity: 0.5, minWidth: 120 }} aria-hidden />;
  }

  const following = isFollowing;
  return (
    <button
      onClick={toggle}
      disabled={busy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="ln-press"
      style={{
        ...base,
        background: following ? "rgba(var(--ln-fg-rgb),0.04)" : "var(--ln-accent)",
        color: following ? "var(--ln-fg)" : "var(--ln-bg, #0a0908)",
        border: following ? "1px solid rgba(var(--ln-fg-rgb),0.18)" : "1px solid var(--ln-accent)",
      }}
    >
      {following ? (hover ? "Unfollow" : "Following") : "Follow"}
    </button>
  );
}

const base: React.CSSProperties = {
  padding: "11px 26px",
  borderRadius: 999,
  cursor: "pointer",
  fontFamily: "var(--ln-body)",
  fontSize: 14,
  fontWeight: 600,
  textAlign: "center",
};
