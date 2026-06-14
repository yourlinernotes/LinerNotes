"use client";

interface RatingSelectorProps {
  rating: number;
  onChange: (rating: number) => void;
}

export function RatingSelector({ rating, onChange }: RatingSelectorProps) {
  const ratings = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
        Rating
      </label>
      <div className="flex flex-wrap gap-2">
        {ratings.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor:
                rating === value ? "var(--ln-accent)" : "var(--ln-surface)",
              color: rating === value ? "white" : "var(--ln-ink)",
            }}
          >
            {value === Math.floor(value) ? `${value}.0` : value}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2">
        <StarDisplay rating={rating} />
        <span className="text-xl font-bold" style={{ color: "var(--ln-accent)" }}>
          {rating.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      // Full star
      stars.push(
        <svg
          key={i}
          className="w-6 h-6"
          fill="var(--ln-accent)"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    } else if (i === fullStars && hasHalfStar) {
      // Half star
      stars.push(
        <svg key={i} className="w-6 h-6" viewBox="0 0 20 20">
          <defs>
            <linearGradient id={`half-rating`}>
              <stop offset="50%" stopColor="var(--ln-accent)" />
              <stop offset="50%" stopColor="var(--ln-line)" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#half-rating)`}
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
          />
        </svg>
      );
    } else {
      // Empty star
      stars.push(
        <svg
          key={i}
          className="w-6 h-6"
          fill="var(--ln-line)"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }
  }

  return <div className="flex gap-1">{stars}</div>;
}
