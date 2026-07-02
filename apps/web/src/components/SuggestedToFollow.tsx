"use client";

/**
 * "People to follow" rail — the cold-start fix. Shows active reviewers (from
 * /api/users/suggestions, excluding those you already follow) so a sparse feed
 * always has a way to fill itself. Recedes as you follow people.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { FollowButton } from "@/components/FollowButton";

type Suggestion = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  reviewCount: number;
};

export function SuggestedToFollow({ limit = 8 }: { limit?: number }) {
  const [users, setUsers] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/suggestions?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setUsers(d?.users || []); })
      .catch(() => { if (!cancelled) setUsers([]); });
    return () => { cancelled = true; };
  }, [limit]);

  if (!users || users.length === 0) return null;

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(var(--ln-fg-rgb),0.5)", marginBottom: 12 }}>
        People to follow
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
        {users.map((u) => (
          <div key={u.id} style={{ flex: "0 0 auto", width: 200, padding: 16, borderRadius: 16, background: "rgba(var(--ln-fg-rgb),0.03)", border: "1px solid rgba(var(--ln-line-rgb),0.1)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Link href={`/profile/${u.handle}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt={u.displayName} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(var(--ln-fg-rgb),0.08)", color: "var(--ln-fg)", fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 24 }}>
                  {(u.displayName || u.handle || "?")[0].toUpperCase()}
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600, color: "var(--ln-fg)", maxWidth: 168, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.displayName}</div>
                <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.45)", marginTop: 2 }}>{u.reviewCount} notes</div>
              </div>
            </Link>
            <FollowButton userId={u.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
