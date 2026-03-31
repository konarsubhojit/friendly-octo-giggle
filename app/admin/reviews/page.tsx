"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPageShell, AdminPanel } from "@/components/admin/AdminPageShell";
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

const ReviewRow = ({ review }: { readonly review: AdminReview }) => {
  const displayName =
    review.isAnonymous || !review.user
      ? "Anonymous"
      : (review.user.name ?? review.user.email);

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.4)]">
      <div className="flex items-start gap-4">
        {review.product && (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
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
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StarRating rating={review.rating} size="sm" />
            {review.product && (
              <span className="truncate text-sm font-semibold text-slate-950">
                {review.product.name}
              </span>
            )}
            {review.isAnonymous && (
              <Badge variant="neutral" size="sm">
                Anonymous
              </Badge>
            )}
          </div>
          <p className="mb-3 text-sm leading-relaxed text-slate-700">
            {review.comment}
          </p>
          <ReviewMeta review={review} displayName={displayName} />
        </div>
      </div>
    </div>
  );
};

const ReviewMeta = ({
  review,
  displayName,
}: {
  readonly review: AdminReview;
  readonly displayName: string;
}) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
    <span>
      By: <strong className="text-slate-700">{displayName}</strong>
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
    <AdminPageShell
      breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Reviews" }]}
      eyebrow="Customer feedback"
      title="Review Management"
      description="View, search, and moderate customer product reviews."
      actions={
        <button
          onClick={fetchReviews}
          disabled={loading}
          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Refresh
        </button>
      }
      metrics={[
        {
          label: "Total reviews",
          value: String(total),
          hint: "Total reviews submitted.",
          tone: "sky",
        },
        {
          label: "Average rating",
          value: avgRating > 0 ? `${avgRating.toFixed(1)} / 5` : "No data",
          hint: "Average across visible results.",
          tone: "amber",
        },
        {
          label: "Visible results",
          value: String(filtered.length),
          hint: "Matching current filters.",
          tone: "emerald",
        },
      ]}
    >
      {error ? (
        <AlertBanner message={error} variant="error" className="mb-0" />
      ) : null}

      <AdminPanel title="Filter" description="">
        <ReviewsFilters
          search={search}
          onSearchChange={setSearch}
          ratingFilter={ratingFilter}
          onRatingChange={setRatingFilter}
        />
      </AdminPanel>

      <AdminPanel title="Reviews" description="">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          filteredContent
        )}
      </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminReviewsPage;

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
  <div className="flex flex-col gap-3 sm:flex-row">
    <div className="relative max-w-2xl flex-1">
      <svg
        className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3 pl-11 pr-4 text-sm text-slate-950 shadow-inner shadow-white/40 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
        aria-label="Search reviews"
      />
    </div>
    <div className="flex flex-wrap gap-2">
      {RATING_FILTERS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => onRatingChange(value)}
          className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
            ratingFilter === value
              ? "bg-slate-950 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
          }`}
          aria-pressed={ratingFilter === value}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
);
