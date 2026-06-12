"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ReviewItem } from "@/components/feed";
import { ReviewCard } from "@/components/card";
import { UserNav } from "@/components/UserNav";
import type { User, Review } from "@/lib/types";
import Link from "next/link";
import { checkAuth } from "@/lib/api";

export default function ProfilePage() {
  const params = useParams();
  const handle = params.handle as string;

  const [user, setUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        console.log("Loading profile for handle:", handle);

        // Check if this is the current user's profile
        const authStatus = await checkAuth();
        setIsOwnProfile(authStatus.userHandle === handle);

        // Fetch user
        const userResponse = await fetch(`/api/users/${handle}`);
        console.log("User response status:", userResponse.status);

        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          console.error("Failed to fetch user:", errorText);
          setError(true);
          setLoading(false);
          return;
        }

        const userData = await userResponse.json();
        console.log("User data:", userData);
        setUser(userData.user);

        // Fetch reviews
        const reviewsResponse = await fetch(
          `/api/reviews?userId=${userData.user.id}`
        );
        console.log("Reviews response status:", reviewsResponse.status);

        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json();
          console.log("Reviews data:", reviewsData);
          setReviews(reviewsData.reviews);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (handle) {
      loadProfile();
    }
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

  if (error || (!loading && !user)) {
    return (
      <div
        className="min-h-screen p-6 flex items-center justify-center"
        style={{ backgroundColor: "var(--ln-bg)" }}
      >
        <div
          className="p-8 rounded-lg text-center max-w-md"
          style={{ backgroundColor: "var(--ln-surface)", color: "var(--ln-ink)" }}
        >
          <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
          <p className="mb-4" style={{ color: "var(--ln-ink-soft)" }}>
            We couldn't load the profile for @{handle}.
            <br />
            Check the browser console for error details.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-lg font-medium"
              style={{ backgroundColor: "var(--ln-accent)", color: "white" }}
            >
              Go Home
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-lg font-medium"
              style={{ backgroundColor: "var(--ln-surface)", color: "var(--ln-ink)", border: "1px solid var(--ln-line)" }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
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
          <div className="flex items-center gap-4 flex-1">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-20 h-20 rounded-full object-cover"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold" style={{ color: "var(--ln-ink)" }}>
                  {user.displayName}
                </h1>
                {isOwnProfile && (
                  <Link
                    href="/profile/edit"
                    className="px-3 py-1 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: "var(--ln-line)",
                      color: "var(--ln-ink)",
                    }}
                  >
                    Edit Profile
                  </Link>
                )}
              </div>
              <p className="text-lg" style={{ color: "var(--ln-ink-soft)" }}>
                @{user.handle}
              </p>
              {(user as any).bio && (
                <p className="mt-2 text-sm" style={{ color: "var(--ln-ink)" }}>
                  {(user as any).bio}
                </p>
              )}
            </div>
          </div>
          <UserNav />
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {topReviews.map((review) => (
                <Link
                  key={review.id}
                  href={`/card/${review.id}`}
                  className="block hover:opacity-90 transition-opacity"
                >
                  <ReviewCard review={review} className="w-full" />
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
