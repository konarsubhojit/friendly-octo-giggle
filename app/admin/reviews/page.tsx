"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";

interface ReviewProduct {
  id: string;
  name: string;
  image: string;
}

interface ReviewUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface AdminReview {
  id: string;
  productId: string;
  rating: number;
  comment: string;
  isAnonymous: boolean;
  createdAt: string;
  product: ReviewProduct | null;
  user: ReviewUser | null;
}

const RATING_FILTERS = [
  { label: "All", value: "" },
  { label: "5 ★", value: "5" },
  { label: "4 ★", value: "4" },
  { label: "3 ★", value: "3" },
  { label: "2 ★", value: "2" },
  { label: "1 ★", value: "1" },
];

// ─── ReviewRow component (defined before use) ────────────

const ReviewRow = ({ review }: { readonly review: AdminReview }) => {
  const displayName =
    review.isAnonymous || !review.user
      ? "Anonymous"
      : (review.user.name ?? review.user.email);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start gap-4">
        {review.product && (
          <div className="relative w-14 h-14 shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700">
            <Image
              src={review.product.image}
              alt={review.product.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
            <StarRating rating={review.rating} size="sm" />
            {review.product && (
              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {review.product.name}
              </span>
            )}
            {review.isAnonymous && (
              <Badge variant="neutral" size="sm">
                Anonymous
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
            {review.comment}
          </p>
          <ReviewMeta review={review} displayName={displayName} />
        </div>
      </div>
    </div>
  );
};

// ─── ReviewMeta subcomponent (extracted to reduce nesting) ─

const ReviewMeta = ({
  review,
  displayName,
}: {
  readonly review: AdminReview;
  readonly displayName: string;
}) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
    <span>
      By:{" "}
      <strong className="text-gray-700 dark:text-gray-300">
        {displayName}
      </strong>
    </span>
    {!review.isAnonymous && review.user?.email && (
      <span>{review.user.email}</span>
    )}
    <span>
      {new Date(review.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}
    </span>
  </div>
);

// ─── Main page component ─────────────────────────────────

const AdminReviewsPage = () => {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [total, setTotal] = useState(0);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (ratingFilter) params.set("rating", ratingFilter);
      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load reviews");
      }
      const data = await res.json();
      const allReviews: AdminReview[] =
        data.data?.reviews ?? data.reviews ?? [];
      setReviews(allReviews);
      setTotal(data.data?.total ?? allReviews.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [ratingFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const filtered = search.trim()
    ? reviews.filter((review) => {
        const query = search.toLowerCase();
        return (
          review.product?.name?.toLowerCase().includes(query) ||
          review.user?.name?.toLowerCase()?.includes(query) ||
          review.user?.email?.toLowerCase().includes(query) ||
          review.comment.toLowerCase().includes(query)
        );
      })
    : reviews;

  const avgRating =
    filtered.length > 0
      ? filtered.reduce((sum, review) => sum + review.rating, 0) /
        filtered.length
      : 0;

  const filteredContent =
    filtered.length === 0 ? (
      <EmptyState
        title="No reviews found"
        message="No reviews match your current filters."
      />
    ) : (
      <div className="space-y-4">
        {filtered.map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}
      </div>
    );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Reviews" }]}
      />
      <ReviewsHeader
        total={total}
        avgRating={avgRating}
        loading={loading}
        onRefresh={fetchReviews}
      />

      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}

      <ReviewsFilters
        search={search}
        onSearchChange={setSearch}
        ratingFilter={ratingFilter}
        onRatingChange={setRatingFilter}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        filteredContent
      )}
    </main>
  );
};

export default AdminReviewsPage;

// ─── Extracted subcomponents ──────────────────────────────

const ReviewsHeader = ({
  total,
  avgRating,
  loading,
  onRefresh,
}: {
  readonly total: number;
  readonly avgRating: number;
  readonly loading: boolean;
  readonly onRefresh: () => void;
}) => (
  <div className="mb-6 flex flex-wrap justify-between items-start gap-4">
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Reviews &amp; Feedback
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mt-1">
        {total} total reviews
        {avgRating > 0 && (
          <span className="ml-3 inline-flex items-center gap-1 text-amber-500 font-semibold">
            {avgRating.toFixed(1)} ★ avg
          </span>
        )}
      </p>
    </div>
    <button
      onClick={onRefresh}
      disabled={loading}
      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition text-sm"
    >
      Refresh
    </button>
  </div>
);

const ReviewsFilters = ({
  search,
  onSearchChange,
  ratingFilter,
  onRatingChange,
}: {
  readonly search: string;
  readonly onSearchChange: (val: string) => void;
  readonly ratingFilter: string;
  readonly onRatingChange: (val: string) => void;
}) => (
  <div className="mb-6 flex flex-col sm:flex-row gap-3">
    <div className="relative flex-1 max-w-md">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="search"
        placeholder="Search by product, user, or comment…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Search reviews"
      />
    </div>
    <div className="flex gap-2 flex-wrap">
      {RATING_FILTERS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => onRatingChange(value)}
          className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition ${
            ratingFilter === value
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
          }`}
          aria-pressed={ratingFilter === value}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
);
