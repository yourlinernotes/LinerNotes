"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getFriends, updateFriendRequest } from "@/lib/api";
import type { User } from "@/lib/types";
import { TopBar, Footer } from "@/components/ln/nav";
import { LNAvatar } from "@/components/ln/atoms";
import { tintFromString } from "@/lib/palette";

type FriendRequest = { id: string; requester: User };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <span style={{ fontFamily: "var(--ln-label)", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "var(--ln-accent)" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "rgba(var(--ln-fg-rgb),0.1)" }} />
    </div>
  );
}

function Row({ user, children }: { user: User; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 14, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
      <LNAvatar user={{ name: user.displayName || user.handle, tint: tintFromString(user.id || user.handle), avatarUrl: user.avatarUrl }} size={44} />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 600, color: "var(--ln-fg)" }}>{user.displayName || user.handle}</div>
        <div style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: "rgba(var(--ln-fg-rgb),0.45)" }}>@{user.handle}</div>
      </div>
      {children}
    </div>
  );
}

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    const loadFriends = async () => {
      try {
        if (!session) {
          setLoading(false);
          return;
        }
        const [friendsData, requestsData] = await Promise.all([getFriends(), getFriends("requests")]);
        setFriends(friendsData.friends || []);
        setRequests(requestsData.requests || []);
      } catch (error) {
        console.error("Failed to load friends:", error);
      } finally {
        setLoading(false);
      }
    };
    loadFriends();
  }, [session, status]);

  const handleAccept = async (userId: string) => {
    try {
      await updateFriendRequest(userId, "accept");
      const request = requests.find((r) => r.requester.id === userId);
      if (request) {
        setRequests(requests.filter((r) => r.requester.id !== userId));
        setFriends([...friends, request.requester]);
      }
    } catch (error) {
      console.error("Failed to accept request:", error);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await updateFriendRequest(userId, "reject");
      setRequests(requests.filter((r) => r.requester.id !== userId));
    } catch (error) {
      console.error("Failed to reject request:", error);
    }
  };

  const gold = "var(--ln-accent)";

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 680, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: "0 0 26px", fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em", color: "var(--ln-fg)" }}>Friends</h1>

          {!loading && !session && (
            <div style={{ textAlign: "center", padding: "60px 24px", borderRadius: 18, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
              <p style={{ margin: "0 0 18px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 20, color: "var(--ln-fg)" }}>Log in to manage friends.</p>
              <Link href="/login" className="ln-press" style={{ display: "inline-block", padding: "13px 26px", borderRadius: 999, textDecoration: "none", background: gold, color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 700 }}>Log in</Link>
            </div>
          )}

          {loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: gold, animation: "ln-spin 0.8s linear infinite" }} />
            </div>
          )}

          {!loading && session && requests.length > 0 && (
            <div style={{ marginBottom: 34 }}>
              <SectionLabel>friend requests</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {requests.map((request) => (
                  <Row key={request.id} user={request.requester}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleAccept(request.requester.id)} className="ln-press" style={{ padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer", background: gold, color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 13, fontWeight: 700 }}>Accept</button>
                      <button onClick={() => handleReject(request.requester.id)} className="ln-press" style={{ padding: "8px 16px", borderRadius: 999, cursor: "pointer", background: "transparent", color: "rgba(var(--ln-fg-rgb),0.7)", border: "1px solid rgba(var(--ln-fg-rgb),0.2)", fontFamily: "var(--ln-body)", fontSize: 13, fontWeight: 600 }}>Decline</button>
                    </div>
                  </Row>
                ))}
              </div>
            </div>
          )}

          {!loading && session && (
            <div>
              <SectionLabel>your friends · {friends.length}</SectionLabel>
              {friends.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 18, color: "var(--ln-muted)" }}>
                  No friends yet. Find listeners you&apos;d trust.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {friends.map((friend) => (
                    <Link key={friend.id} href={`/profile/${friend.handle}`} style={{ textDecoration: "none" }} className="ln-card-hover">
                      <Row user={friend} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
