"use client";

import { ReviewCard } from "@/components/card";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Review } from "@/lib/types";
import { TopBar } from "@/components/ln/nav";
import { ImmersiveReview, ReviewActions } from "@/components/ln/review";
import { toReviewVM } from "@/lib/view-adapter";
import { lnFmt, LNIcon } from "@/components/ln/atoms";
import { getReviews } from "@/lib/api";

export default function CardPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [review, setReview] = useState<Review | null>(null);
  const [related, setRelated] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadReview = async () => {
      try {
        const res = await fetch(`/api/reviews/${id}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setReview(data.review);

        const authRes = await fetch("/api/auth/me");
        if (authRes.ok) {
          const authData = await authRes.json();
          setIsOwner(authData.user?.id === data.review.userId);
        }

        getReviews()
          .then((rs) => setRelated(rs.filter((r) => r.id !== id).slice(0, 4)))
          .catch(() => {});
      } catch (error) {
        console.error("Failed to fetch review:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadReview();
  }, [id]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy link");
    }
  };

  const handleSetFeaturedNote = async (noteId: string) => {
    if (!review) return;
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featuredNoteId: noteId }),
      });
      if (!res.ok) {
        alert("Failed to update featured note");
        return;
      }
      const data = await res.json();
      setReview(data.review);
      setShowNotePicker(false);
    } catch (error) {
      console.error("Failed to update featured note:", error);
      alert("Failed to update featured note");
    }
  };

  const handleShareToStory = async () => {
    if (!review) return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      const cardElement = document.querySelector("#export-card .review-card");
      if (!cardElement) {
        alert("Card not found. Try again in a moment.");
        return;
      }
      const { toPng } = await import("html-to-image");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const dataUrl = await toPng(cardElement as HTMLElement, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "transparent",
        cacheBust: true,
        skipFonts: false,
        filter: () => true,
      });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (navigator.share && isMobile) {
        try {
          const shareFile = new File([blob], "linernotes-review.png", { type: "image/png" });
          const shareData = {
            files: [shareFile],
            title: `${review.track.name} review`,
            text: `Check out my review on LinerNotes: ${url}`,
          };
          if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
            if (isIOS) {
              alert("✅ Link copied!\n\n💡 Tip: Select 'Save Image' to add to Photos, then open Instagram to add it to your story!");
            }
            return;
          }
        } catch (shareError) {
          console.log("Share API not fully supported, falling back:", shareError);
        }
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "linernotes-review.png";
      link.click();
      alert(
        "✅ Link copied! Image downloaded.\n\n📸 To share to Instagram Story:\n1. Open Instagram\n2. Create a new story with any background\n3. Tap the sticker icon → Camera Roll/Photos\n4. Select the downloaded review card\n5. Add a link sticker → paste the copied link\n6. Position the review card over the link to hide it"
      );
    } catch (error) {
      console.error("Failed to share:", error);
      alert("Failed to prepare story. Try the 'Copy Link' button instead.\n\nError: " + (error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!review) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete review");
      }
      router.push("/");
    } catch (error) {
      console.error("Failed to delete review:", error);
      alert("Failed to delete review: " + (error as Error).message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0807" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", border: "3px solid rgba(241,235,224,0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!review) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0807", color: "#f1ebe0", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ln-display)", fontSize: 30, fontWeight: 600, margin: 0 }}>Note not found</h1>
          <p style={{ fontFamily: "var(--ln-body)", opacity: 0.7, marginTop: 8 }}>This review doesn&apos;t exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  const vm = toReviewVM(review);
  const relatedVms = related.map((r) => toReviewVM(r));

  return (
    <div style={{ background: "#0a0807", minHeight: "100vh" }}>
      <TopBar transparent />

      <ImmersiveReview
        vm={vm}
        related={relatedVms}
        isSelf={isOwner}
        actions={
          <ReviewActions
            onCopy={handleCopyLink}
            copied={copied}
            onShare={handleShareToStory}
            onPickNote={() => setShowNotePicker(true)}
            onDelete={() => setShowDeleteConfirm(true)}
            isOwner={isOwner}
            canPickNote={isOwner && !!review.notes && review.notes.length > 1}
          />
        }
      />

      {/* Note picker */}
      {showNotePicker && review.notes && review.notes.length > 0 && (
        <Overlay onClose={() => setShowNotePicker(false)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--ln-display)", fontSize: 20, fontWeight: 600, color: "#f1ebe0" }}>Featured note</h3>
            <button onClick={() => setShowNotePicker(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <LNIcon name="close" size={18} color="#f1ebe0" />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {review.notes.map((note) => {
              const active = review.featuredNoteId === note.id;
              return (
                <button
                  key={note.id}
                  onClick={() => handleSetFeaturedNote(note.id)}
                  className="ln-press"
                  style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: active ? "var(--ln-accent)" : "rgba(241,235,224,0.06)", color: active ? "#1a0a04" : "#f1ebe0", border: active ? "1px solid transparent" : "1px solid rgba(241,235,224,0.14)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--ln-mono)", fontSize: 13, fontWeight: 600 }}>
                    {active && <span>★</span>}
                    {lnFmt(note.seconds)} · {note.label}
                  </div>
                  {note.note && <p style={{ margin: "5px 0 0", fontFamily: "var(--ln-body)", fontSize: 13.5, opacity: active ? 0.85 : 0.7 }}>{note.note}</p>}
                </button>
              );
            })}
          </div>
        </Overlay>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <Overlay onClose={() => !deleting && setShowDeleteConfirm(false)}>
          <h3 style={{ margin: 0, fontFamily: "var(--ln-display)", fontSize: 22, fontWeight: 600, color: "#f1ebe0" }}>Delete this note?</h3>
          <p style={{ margin: "10px 0 18px", fontFamily: "var(--ln-body)", fontSize: 14.5, color: "rgba(241,235,224,0.7)" }}>This can&apos;t be undone.</p>
          <div style={{ display: "flex", gap: 11 }}>
            <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="ln-press" style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer", background: "rgba(241,235,224,0.08)", color: "#f1ebe0", border: "1px solid rgba(241,235,224,0.16)", fontFamily: "var(--ln-body)", fontWeight: 600 }}>Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="ln-press" style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer", background: "#dc2626", color: "white", border: "none", fontFamily: "var(--ln-body)", fontWeight: 600 }}>{deleting ? "Deleting…" : "Delete"}</button>
          </div>
        </Overlay>
      )}

      {/* Off-screen export card for the IG-story sticker */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }} id="export-card">
        <ReviewCard review={review} hideLinks={true} />
      </div>
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(6,4,4,0.66)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", animation: "ln-fade 0.2s ease both" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#1a0a0c", borderRadius: 20, border: "1px solid rgba(255,205,165,0.14)", boxShadow: "0 50px 110px -34px rgba(0,0,0,0.8)", padding: "26px 24px", animation: "ln-pop 0.3s cubic-bezier(.16,1,.3,1) both" }}>
        {children}
      </div>
    </div>
  );
}
