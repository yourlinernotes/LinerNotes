import { ReviewCard } from "@/components/card";
import { mockReviews } from "@/lib/mocks";
import { notFound } from "next/navigation";

interface CardPageProps {
  params: Promise<{ id: string }>;
}

// This would eventually call GET /api/reviews/:id
async function getReview(id: string) {
  // TODO: Replace with actual API call when Abia pushes backend
  // const res = await fetch(`/api/reviews/${id}`);
  // if (!res.ok) return null;
  // return res.json();

  // For now, use mocks
  const review = mockReviews.find((r) => r.id === id);
  return review || null;
}

export default async function CardPage({ params }: CardPageProps) {
  const { id } = await params;
  const review = await getReview(id);

  if (!review) {
    notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <ReviewCard review={review} />
    </div>
  );
}

export async function generateMetadata({ params }: CardPageProps) {
  const { id } = await params;
  const review = await getReview(id);

  if (!review) {
    return {
      title: "Review Not Found",
    };
  }

  return {
    title: `${review.track.name} by ${review.track.artist} - ${review.user?.handle}'s review on LinerNotes`,
    description: review.take || `${review.user?.handle} rated ${review.track.name} ${review.rating}/5`,
    openGraph: {
      title: `${review.track.name} by ${review.track.artist}`,
      description: review.take || `${review.user?.handle}'s review`,
      images: [review.track.artworkUrl],
    },
    twitter: {
      card: "summary_large_image",
      title: `${review.track.name} by ${review.track.artist}`,
      description: review.take || `${review.user?.handle}'s review`,
      images: [review.track.artworkUrl],
    },
  };
}
