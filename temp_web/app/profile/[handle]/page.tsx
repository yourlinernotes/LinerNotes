import { mockUsers, mockReviews } from "@/lib/mocks";
import { ReviewItem } from "@/components/feed";
import { notFound } from "next/navigation";
import Link from "next/link";

interface ProfilePageProps {
  params: Promise<{ handle: string }>;
}

async function getUserByHandle(handle: string) {
  // TODO: Replace with API call GET /api/users/:handle
  const user = mockUsers.find((u) => u.handle === handle);
  return user || null;
}

async function getUserReviews(userId: string) {
  // TODO: Replace with GET /api/reviews?userId=:userId
  return mockReviews.filter((r) => r.userId === userId);
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const user = await getUserByHandle(handle);

  if (!user) {
    notFound();
  }

  const reviews = await getUserReviews(user.id);

  // Calculate Top 4 (simple: highest rated)
  const topReviews = [...reviews]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

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
          <nav className="flex gap-4">
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
              {reviews.reduce((sum, r) => sum + r.likeCount, 0)}
            </div>
            <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              Likes
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "var(--ln-accent)" }}>
              {(
                reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
              ).toFixed(1)}
            </div>
            <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              Avg Rating
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

export async function generateMetadata({ params }: ProfilePageProps) {
  const { handle } = await params;
  const user = await getUserByHandle(handle);

  if (!user) {
    return {
      title: "User Not Found",
    };
  }

  return {
    title: `${user.displayName} (@${user.handle}) - LinerNotes`,
    description: `Check out ${user.displayName}'s music reviews on LinerNotes`,
  };
}
