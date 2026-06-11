"use client";

import { useEffect, useState } from "react";

export default function DebugPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/debug")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto" style={{ backgroundColor: "var(--ln-bg)", color: "var(--ln-ink)" }}>
      <h1 className="text-3xl font-bold mb-6">Database Debug</h1>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-bold mb-4">Users</h2>
          {data?.users?.map((user: any) => (
            <div key={user.id} className="mb-4 p-4 rounded-lg" style={{ backgroundColor: "var(--ln-surface)" }}>
              <div className="font-bold">{user.displayName} (@{user.handle})</div>
              <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
                {user._count.reviews} reviews
              </div>
              <a
                href={`/profile/${user.handle}`}
                className="text-sm underline"
                style={{ color: "var(--ln-accent)" }}
              >
                View Profile: /profile/{user.handle}
              </a>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Reviews</h2>
          {data?.reviews?.map((review: any) => (
            <div key={review.id} className="mb-4 p-4 rounded-lg" style={{ backgroundColor: "var(--ln-surface)" }}>
              <div className="font-bold">{review.trackName} - {review.trackArtist}</div>
              <div>Rating: {review.rating}⭐</div>
              <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
                By: {review.user.displayName} (@{review.user.handle})
              </div>
              {review.take && (
                <div className="mt-2 text-sm">Take: {review.take}</div>
              )}
              <div className="text-xs mt-2" style={{ color: "var(--ln-ink-soft)" }}>
                {new Date(review.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </section>
      </div>

      <pre className="mt-8 p-4 rounded-lg overflow-auto text-xs" style={{ backgroundColor: "var(--ln-surface)" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
