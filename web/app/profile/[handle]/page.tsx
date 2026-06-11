"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ReviewItem } from "@/components/feed";
import { AuthButton } from "@/components/AuthButton";
import type { User, Review } from "@/lib/types";
import Link from "next/link";

export default function ProfilePage() {
  const params = useParams();
  const handle = params.handle as string;

  const [user, setUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Fetch user
        const userResponse = await fetch(`/api/users/${handle}`);
        if (!userResponse.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        const userData = await userResponse.json();
        setUser(userData.user);

        // Fetch reviews
        const reviewsResponse = await fetch(
          `/api/reviews?userId=${userData.user.id}`
        );
        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json();
          setReviews(reviewsData.reviews);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [handle]);

  if (loading) {
    return (
      <div
        className="min-h-screen p-6 flex items-center justify-center"
        style={{ backgroundColor: "var(--ln-bg)" }}
      >
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--ln-accent)" }}
        />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div
        className="min-h-screen p-6 flex items-center justify-center"
        style={{ backgroundColor: "var(--ln-bg)" }}
      >
        <div
          className="p-8 rounded-lg text-center"
          style={{ backgroundColor: "var(--ln-surface)", color: "var(--ln-ink)" }}
        >
          <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
          <p className="mb-4">This user doesn't exist.</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-lg font-medium"
            style={{ backgroundColor: "var(--ln-accent)", color: "white" }}
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Calculate Top 4 (simple: highest rated)
  const topReviews = [...reviews]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  // Calculate stats
  const totalLikes = reviews.reduce((sum, r) => sum + (r.likeCount || 0), 0);
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--ln-bg)" }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-16 h-16 rounded-full"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold" style={{ color: "var(--ln-ink)" }}>
                {user.displayName}
              </h1>
              <p className="text-lg" style={{ color: "var(--ln-ink-soft)" }}>
                @{user.handle}
              </p>
            </div>
          </div>
          <nav className="flex gap-4 items-center">
            <Link
              href="/log"
              className="px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-accent)",
                color: "white",
              }}
            >
              Log Review
            </Link>
            <Link
              href="/feed"
              className="px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-ink)",
              }}
            >
              Feed
            </Link>
            <AuthButton />
          </nav>
        </div>

        {/* Stats */}
        <div
          className="p-4 rounded-lg flex items-center gap-8"
          style={{ backgroundColor: "var(--ln-surface)" }}
        >
          <div>
            <div className="text-2xl font-bold" style={{ color: "var(--ln-accent)" }}>
              {reviews.length}
            </div>
            <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              Reviews
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "var(--ln-accent)" }}>
              {totalLikes}
            </div>
            <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              Likes
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "var(--ln-accent)" }}>
              {avgRating}
            </div>
            <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              Avg Rating
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "var(--ln-accent)" }}>
              {(user as any).friendCount || 0}
            </div>
            <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              Friends
            </div>
          </div>
        </div>

        {/* Top 4 */}
        {topReviews.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold" style={{ color: "var(--ln-ink)" }}>
              Top 4
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {topReviews.map((review) => (
                <Link
                  key={review.id}
                  href={`/card/${review.id}`}
                  className="group relative aspect-square rounded-lg overflow-hidden"
                >
                  <img
                    src={review.track.artworkUrl}
                    alt={review.track.album}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white font-bold text-2xl">
                      {review.rating.toFixed(1)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Reviews */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold" style={{ color: "var(--ln-ink)" }}>
            All Reviews
          </h2>
          {reviews.length === 0 ? (
            <div
              className="p-8 rounded-lg text-center"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-ink-soft)",
              }}
            >
              <p>No reviews yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewItem key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
