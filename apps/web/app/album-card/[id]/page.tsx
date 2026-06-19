"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AlbumReview } from "@/lib/types";
import { TopBar } from "@/components/ln/nav";
import { ImmersiveReview, ReviewActions } from "@/components/ln/review";
import { toAlbumReviewVM } from "@/lib/view-adapter";

export default function AlbumCardPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [albumReview, setAlbumReview] = useState<AlbumReview | null>(null);
  const [related, setRelated] = useState<AlbumReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadAlbumReview = async () => {
      try {
        const res = await fetch(`/api/album-reviews/${id}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setAlbumReview(data.albumReview);

        const authRes = await fetch("/api/auth/me");
        if (authRes.ok) {
          const authData = await authRes.json();
          setIsOwner(authData.user?.id === data.albumReview.userId);
        }

        fetch("/api/album-reviews")
          .then((r) => (r.ok ? r.json() : { albumReviews: [] }))
          .then((d) => setRelated((d.albumReviews || []).filter((a: AlbumReview) => a.id !== id).slice(0, 4)))
          .catch(() => {});
      } catch (error) {
        console.error("Failed to fetch album review:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadAlbumReview();
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

  const handleDelete = async () => {
    if (!albumReview) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/album-reviews/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete album review");
      }
      router.push("/");
    } catch (error) {
      console.error("Failed to delete album review:", error);
      alert("Failed to delete album review: " + (error as Error).message);
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

  if (!albumReview) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0807", color: "#f1ebe0", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ln-display)", fontSize: 30, fontWeight: 600, margin: 0 }}>Album review not found</h1>
          <p style={{ fontFamily: "var(--ln-body)", opacity: 0.7, marginTop: 8 }}>This review doesn&apos;t exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  const vm = toAlbumReviewVM(albumReview);
  const relatedVms = related.map((a) => toAlbumReviewVM(a));

  return (
    <div style={{ background: "#0a0807", minHeight: "100vh" }}>
      <TopBar transparent />

      <ImmersiveReview
        vm={vm}
        related={relatedVms}
        actions={
          <ReviewActions
            onCopy={handleCopyLink}
            copied={copied}
            onDelete={() => setShowDeleteConfirm(true)}
            isOwner={isOwner}
          />
        }
      />

      {showDeleteConfirm && (
        <div onClick={() => !deleting && setShowDeleteConfirm(false)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(6,4,4,0.66)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", animation: "ln-fade 0.2s ease both" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#1a0a0c", borderRadius: 20, border: "1px solid rgba(255,205,165,0.14)", boxShadow: "0 50px 110px -34px rgba(0,0,0,0.8)", padding: "26px 24px", animation: "ln-pop 0.3s cubic-bezier(.16,1,.3,1) both" }}>
            <h3 style={{ margin: 0, fontFamily: "var(--ln-display)", fontSize: 22, fontWeight: 600, color: "#f1ebe0" }}>Delete this album review?</h3>
            <p style={{ margin: "10px 0 18px", fontFamily: "var(--ln-body)", fontSize: 14.5, color: "rgba(241,235,224,0.7)" }}>This deletes all its track notes too. It can&apos;t be undone.</p>
            <div style={{ display: "flex", gap: 11 }}>
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="ln-press" style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer", background: "rgba(241,235,224,0.08)", color: "#f1ebe0", border: "1px solid rgba(241,235,224,0.16)", fontFamily: "var(--ln-body)", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="ln-press" style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer", background: "#dc2626", color: "white", border: "none", fontFamily: "var(--ln-body)", fontWeight: 600 }}>{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
