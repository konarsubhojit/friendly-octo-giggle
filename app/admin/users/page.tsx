"use client";

import { useState, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import { updateAdminUserRole } from "@/lib/features/admin/adminSlice";
import type { AppDispatch } from "@/lib/store";
import { logError } from "@/lib/logger";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { UsersTable } from "@/components/admin/UsersTable";

interface AdminUser {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
  readonly image: string | null;
  readonly role: string;
  readonly orderCount?: number;
  readonly createdAt: string;
  readonly _count?: { orders: number };
}

const PAGE_SIZE = 20;

export default function UsersManagement() {
  const dispatch = useDispatch<AppDispatch>();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const fetchUsers = useCallback(
    async (cursorParam: string | null, searchQuery: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursorParam) params.set("cursor", cursorParam);
        if (searchQuery) params.set("search", searchQuery);

        const res = await fetch(`/api/admin/users?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load users");
        }
        const data = await res.json();
        const rawItems: AdminUser[] = data.data?.users ?? data.users ?? [];
        const items = rawItems.map((user) => ({
          ...user,
          orderCount: user._count?.orders ?? user.orderCount ?? 0,
        }));
        setUsers(items);
        setNextCursor(data.data?.nextCursor ?? null);
        setHasMore(data.data?.hasMore ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchUsers(cursor, search);
  }, [fetchUsers, cursor, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCursor(null);
    setCursorHistory([]);
    setSearch(searchInput.trim());
  };

  const handleNext = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor ?? ""]);
    setCursor(nextCursor);
  };

  const handlePrev = () => {
    if (cursorHistory.length === 0) return;
    const prev = [...cursorHistory];
    const prevCursor = prev.pop() ?? null;
    setCursorHistory(prev);
    setCursor(prevCursor);
  };

  const handleRefresh = () => {
    setCursor(null);
    setCursorHistory([]);
    setSearch("");
    setSearchInput("");
  };

  const handleRoleChange = async (
    userId: string,
    newRole: "ADMIN" | "CUSTOMER",
  ) => {
    setUpdatingUserId(userId);
    try {
      await dispatch(
        updateAdminUserRole({ id: userId, role: newRole }),
      ).unwrap();
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user,
        ),
      );
    } catch (err) {
      logError({ error: err, context: "handleRoleChange" });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const currentPage = cursorHistory.length + 1;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            User Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage user roles and permissions
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition text-sm"
        >
          Refresh
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2 max-w-md">
          <div className="relative flex-1">
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
              placeholder="Search by name or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search users"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Clear
            </button>
          )}
        </div>
        {search && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Showing results for &ldquo;<strong>{search}</strong>&rdquo;
          </p>
        )}
      </form>

      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title={search ? "No users found" : "No items found"}
          message={search ? "Try a different search term." : undefined}
        />
      ) : (
        <>
          <UsersTable
            users={users}
            updatingUserId={updatingUserId}
            onRoleChange={handleRoleChange}
          />

          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={cursorHistory.length === 0 || loading}
                className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ← Previous
              </button>
              <button
                onClick={handleNext}
                disabled={!hasMore || loading}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
