"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { StarRating } from "@/components/ui/StarRating";
import { GradientButton } from "@/components/ui/GradientButton";

interface ReviewFormProps {
  readonly productId: string;
  readonly orderId?: string | null;
  readonly onSuccess?: () => void;
}

export const ReviewForm = ({
  productId,
  orderId,
  onSuccess,
}: ReviewFormProps) => {
  const { data: session } = useSession();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!session?.user) {
    return (
      <p className="text-sm text-[var(--text-muted)] italic">
        Please sign in to leave a review.
      </p>
    );
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span className="text-sm font-medium">Thank you for your review!</span>
      </div>
    );
  }

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    if (comment.trim().length < 10) {
      setError("Review must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          orderId: orderId ?? null,
          rating,
          comment: comment.trim(),
          isAnonymous,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        onSuccess?.();
      } else {
        setError(data.error ?? "Failed to submit review. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Star rating selector */}
      <div>
        <p className="block text-sm font-semibold text-[var(--foreground)] mb-2">
          Your Rating{" "}
          <span aria-hidden="true" className="text-[var(--accent-rose)]">
            *
          </span>
        </p>
        <StarRating
          rating={rating}
          interactive
          size="lg"
          onChange={setRating}
          label="Select star rating"
        />
      </div>

      {/* Comment */}
      <div>
        <label
          htmlFor="review-comment"
          className="block text-sm font-semibold text-[var(--foreground)] mb-2"
        >
          Your Review{" "}
          <span aria-hidden="true" className="text-[var(--accent-rose)]">
            *
          </span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Share your experience with this product… (min. 10 characters)"
          maxLength={1000}
          required
          className="w-full px-4 py-3 border border-[var(--border-warm)] rounded-xl bg-[var(--surface)] text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]/30 focus:border-[var(--accent-rose)] resize-none transition-all duration-200 text-sm"
        />
        <p className="text-xs text-[var(--text-muted)] text-right mt-1">
          {comment.length}/1000
        </p>
      </div>

      {/* Anonymous option */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="review-anonymous"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="w-4 h-4 rounded border-[var(--border-warm)] text-[var(--accent-rose)] focus:ring-[var(--accent-rose)]/30"
        />
        <label
          htmlFor="review-anonymous"
          className="text-sm text-[var(--text-secondary)] cursor-pointer"
        >
          Submit anonymously
        </label>
      </div>

      {/* Error message */}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <GradientButton
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto"
      >
        {submitting ? "Submitting…" : "Submit Review"}
      </GradientButton>
    </form>
  );
};
