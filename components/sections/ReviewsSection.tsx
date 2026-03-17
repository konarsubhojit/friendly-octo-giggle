"use client";

import { useState, useEffect } from "react";
import { StarRating } from "@/components/ui/StarRating";
import { ReviewForm } from "@/components/ui/ReviewForm";
import { Card } from "@/components/ui/Card";
import Image from "next/image";

interface ReviewUser {
  name: string | null;
  image: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  isAnonymous: boolean;
  createdAt: string;
  user: ReviewUser | null;
}

interface ReviewsSectionProps {
  readonly productId: string;
}

const ReviewCard = ({ review }: { readonly review: Review }) => {
  const displayName = review.isAnonymous || !review.user
    ? "Anonymous"
    : (review.user.name ?? "Customer");

  return (
    <div className="flex gap-4 py-5 border-b border-[var(--border-warm)] last:border-0">
      {/* Avatar */}
      <div className="shrink-0">
        {!review.isAnonymous && review.user?.image ? (
          <Image
            src={review.user.image}
            alt={displayName}
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[var(--accent-blush)] flex items-center justify-center">
            <span className="text-sm font-bold text-[var(--accent-rose)]" aria-hidden="true">
              {displayName[0]?.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {displayName}
          </span>
          <StarRating rating={review.rating} size="sm" />
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {review.comment}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          {new Date(review.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </div>
  );
};

const RatingSummary = ({ reviews }: { readonly reviews: Review[] }) => {
  if (reviews.length === 0) return null;

  const avg =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="flex gap-6 items-start mb-6 pb-6 border-b border-[var(--border-warm)]">
      {/* Average */}
      <div className="text-center shrink-0">
        <p className="text-5xl font-bold text-[var(--foreground)]">
          {avg.toFixed(1)}
        </p>
        <StarRating rating={Math.round(avg)} size="md" />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
        </p>
      </div>

      {/* Distribution bars */}
      <div className="flex-1 space-y-1.5">
        {counts.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-6 shrink-0">
              {star}★
            </span>
            <div className="flex-1 h-2 bg-[var(--border-warm)] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{
                  width: reviews.length ? `${(count / reviews.length) * 100}%` : "0%",
                }}
              />
            </div>
            <span className="text-xs text-[var(--text-muted)] w-4 shrink-0 text-right">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ReviewsSection = ({ productId }: ReviewsSectionProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.data?.reviews ?? data.reviews ?? []);
      }
    } catch {
      // Reviews are non-critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReviewSuccess = () => {
    setShowForm(false);
    fetchReviews();
  };

  return (
    <section aria-labelledby="reviews-heading" className="mt-12">
      <Card className="p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2
            id="reviews-heading"
            className="text-xl font-bold text-[var(--foreground)]"
          >
            Customer Reviews
          </h2>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-sm font-medium text-[var(--accent-rose)] hover:text-[var(--accent-pink)] transition-colors focus-warm"
            >
              Write a review
            </button>
          )}
        </div>

        {/* Write Review Form */}
        {showForm && (
          <div className="mb-8 pb-8 border-b border-[var(--border-warm)]">
            <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">
              Share Your Experience
            </h3>
            <ReviewForm
              productId={productId}
              onSuccess={handleReviewSuccess}
            />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="mt-3 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--accent-rose)] border-t-transparent" aria-label="Loading reviews" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--text-muted)] text-sm">
              No reviews yet. Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <>
            <RatingSummary reviews={reviews} />
            <div>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </>
        )}
      </Card>
    </section>
  );
};
