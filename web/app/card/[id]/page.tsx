import { ReviewCard } from "@/components/card";
import { notFound } from "next/navigation";

interface CardPageProps {
  params: Promise<{ id: string }>;
}

async function getReview(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/reviews/${id}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.review;
  } catch (error) {
    console.error("Failed to fetch review:", error);
    return null;
  }
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
