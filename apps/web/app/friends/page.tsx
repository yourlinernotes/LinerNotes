"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getFriends, sendFriendRequest, updateFriendRequest } from "@/lib/api";
import type { User } from "@/lib/types";
import { TopBar, Footer } from "@/components/ln/nav";
import { LNAvatar, LNIcon } from "@/components/ln/atoms";
import { tintFromString } from "@/lib/palette";

type Incoming = { id: string; requester: User };
type Sent = { id: string; addressee: User };

const gold = "var(--ln-accent)";

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  boxSizing: "border-box",
  background: "rgba(var(--ln-fg-rgb),0.06)",
  color: "var(--ln-fg)",
  border: "1px solid rgba(var(--ln-line-rgb),0.16)",
  borderRadius: 12,
  padding: "12px 14px",
  fontFamily: "var(--ln-body)",
  fontSize: 15,
  outline: "none",
};

function avatarUser(u: User) {
  return { name: u.displayName || u.handle, tint: tintFromString(u.id || u.handle), avatarUrl: u.avatarUrl };
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}>
      <span style={{ fontFamily: "var(--ln-label)", fontSize: 11.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: gold }}>{children}</span>
      {typeof count === "number" && <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(var(--ln-fg-rgb),0.4)" }}>{count}</span>}
      <span style={{ flex: 1, height: 1, background: "rgba(var(--ln-fg-rgb),0.1)", alignSelf: "center" }} />
    </div>
  );
}

function PersonRow({ user, right }: { user: User; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 2px" }}>
      <LNAvatar user={avatarUser(user)} size={42} />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600, color: "var(--ln-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName || user.handle}</div>
        <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.5)" }}>@{user.handle}</div>
      </div>
      {right}
    </div>
  );
}

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const myHandle = session?.user?.handle;

  const [friends, setFriends] = useState<User[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [loading, setLoading] = useState(true);

  const [addHandle, setAddHandle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [f, reqs, snt] = await Promise.all([
          getFriends(),
          getFriends("requests"),
          getFriends("sent"),
        ]);
        setFriends(f.friends || []);
        setIncoming(reqs.requests || []);
        setSent(snt.requests || []);
      } catch (error) {
        console.error("Failed to load friends:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [session, status]);

  const handleAccept = async (userId: string) => {
    try {
      await updateFriendRequest(userId, "accept");
      const req = incoming.find((r) => r.requester.id === userId);
      setIncoming((arr) => arr.filter((r) => r.requester.id !== userId));
      if (req) setFriends((arr) => [...arr, req.requester]);
    } catch (error) {
      console.error("Failed to accept:", error);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await updateFriendRequest(userId, "reject");
      setIncoming((arr) => arr.filter((r) => r.requester.id !== userId));
    } catch (error) {
      console.error("Failed to reject:", error);
    }
  };

  const addByHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = addHandle.trim().replace(/^@/, "").toLowerCase();
    if (h.length < 2) {
      setAddMsg({ text: "Enter a handle", ok: false });
      return;
    }
    if (h === myHandle) {
      setAddMsg({ text: "That's you.", ok: false });
      return;
    }
    setAdding(true);
    setAddMsg(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(h)}`);
      if (!res.ok) {
        setAddMsg({ text: `No one found with @${h}`, ok: false });
        return;
      }
      const data = await res.json();
      const target: User = data.user;
      if (friends.some((f) => f.id === target.id)) {
        setAddMsg({ text: `You're already friends with @${target.handle}`, ok: false });
        return;
      }
      await sendFriendRequest(target.id);
      setSent((s) => [...s.filter((x) => x.addressee.id !== target.id), { id: `local-${target.id}`, addressee: target }]);
      setAddHandle("");
      setAddMsg({ text: `Request sent to @${target.handle}`, ok: true });
    } catch (error) {
      setAddMsg({ text: error instanceof Error ? error.message : "Couldn't send request", ok: false });
    } finally {
      setAdding(false);
    }
  };

  const shareProfile = async () => {
    if (!myHandle) return;
    const url = `${window.location.origin}/profile/${myHandle}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My LinerNotes profile", text: `Find me on LinerNotes — @${myHandle}`, url });
        return;
      }
    } catch {
      /* user dismissed share — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Profile link copied");
      setTimeout(() => setShareMsg(""), 2200);
    } catch {
      setShareMsg(url);
    }
  };

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main id="main" style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 620, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: "0 0 26px", fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Friends</h1>

          {!loading && !session && (
            <div style={{ textAlign: "center", padding: "60px 24px", borderRadius: 18, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
              <p style={{ margin: "0 0 18px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 20, color: "var(--ln-fg)" }}>Log in to find your people.</p>
              <Link href="/login" className="ln-press" style={{ display: "inline-block", padding: "13px 26px", borderRadius: 999, textDecoration: "none", background: gold, color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 700 }}>Log in</Link>
            </div>
          )}

          {loading && session && (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: gold, animation: "ln-spin 0.8s linear infinite" }} />
            </div>
          )}

          {!loading && session && (
            <>
              {/* Add a friend by handle */}
              <div style={{ padding: "18px 18px 20px", borderRadius: 16, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
                <div style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.06em", color: gold, textTransform: "uppercase", marginBottom: 10 }}>add a friend</div>
                <form onSubmit={addByHandle} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={addHandle}
                    onChange={(e) => { setAddHandle(e.target.value); setAddMsg(null); }}
                    placeholder="@handle"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={inputStyle}
                  />
                  <button type="submit" disabled={adding} className="ln-press" style={{ flexShrink: 0, padding: "12px 18px", borderRadius: 12, border: "none", cursor: adding ? "default" : "pointer", background: gold, color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 700, opacity: adding ? 0.6 : 1 }}>
                    {adding ? "Sending…" : "Send request"}
                  </button>
                </form>
                {addMsg && (
                  <div style={{ marginTop: 10, fontFamily: "var(--ln-body)", fontSize: 13, color: addMsg.ok ? "#7fcf9b" : "rgba(var(--ln-fg-rgb),0.6)" }}>{addMsg.text}</div>
                )}

                {/* Share your profile */}
                <button onClick={shareProfile} disabled={!myHandle} className="ln-press" style={{ width: "100%", marginTop: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 12, cursor: myHandle ? "pointer" : "default", background: "rgba(var(--ln-fg-rgb),0.05)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-fg-rgb),0.18)", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600 }}>
                  <LNIcon name="share" size={16} color="var(--ln-fg)" />
                  {shareMsg || "Share your profile"}
                </button>
              </div>

              {/* Pending requests */}
              <div style={{ marginTop: 34 }}>
                <SectionLabel count={incoming.length}>pending requests</SectionLabel>
                {incoming.length === 0 && sent.length === 0 ? (
                  <div style={{ padding: "14px 2px", fontFamily: "var(--ln-body)", fontSize: 13.5, color: "rgba(var(--ln-fg-rgb),0.45)" }}>No pending requests.</div>
                ) : (
                  <div>
                    {incoming.map((r) => (
                      <PersonRow
                        key={r.id}
                        user={r.requester}
                        right={
                          <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                            <button onClick={() => handleAccept(r.requester.id)} className="ln-press" style={{ padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer", background: gold, color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 700 }}>Accept</button>
                            <button onClick={() => handleReject(r.requester.id)} className="ln-press" title="Decline" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(var(--ln-line-rgb),0.18)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                              <LNIcon name="close" size={14} color="rgba(var(--ln-fg-rgb),0.5)" />
                            </button>
                          </div>
                        }
                      />
                    ))}
                    {sent.map((s) => (
                      <PersonRow
                        key={s.id}
                        user={s.addressee}
                        right={<span style={{ flexShrink: 0, fontFamily: "var(--ln-mono)", fontSize: 11, color: "rgba(var(--ln-fg-rgb),0.45)", padding: "0 6px" }}>requested</span>}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmed friends */}
              <div style={{ marginTop: 34 }}>
                <SectionLabel count={friends.length}>your friends</SectionLabel>
                {friends.length === 0 ? (
                  <div style={{ padding: "14px 2px", fontFamily: "var(--ln-body)", fontSize: 13.5, color: "rgba(var(--ln-fg-rgb),0.45)" }}>
                    No friends yet — add someone by their @handle, or share your profile.
                  </div>
                ) : (
                  <div>
                    {friends.map((f) => (
                      <Link key={f.id} href={`/profile/${f.handle}`} style={{ display: "block", textDecoration: "none" }} className="ln-card-hover">
                        <PersonRow
                          user={f}
                          right={<span style={{ flexShrink: 0, fontSize: 16, lineHeight: 1, color: "rgba(var(--ln-fg-rgb),0.3)" }}>→</span>}
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ textAlign: "center", marginTop: 30, fontFamily: "var(--ln-mono)", fontSize: 10, lineHeight: 1.5, color: "rgba(var(--ln-fg-rgb),0.32)", letterSpacing: "0.02em" }}>
                your feed is built from the people you keep here.
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
