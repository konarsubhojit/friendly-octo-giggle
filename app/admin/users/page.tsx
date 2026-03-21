"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import { updateAdminUserRole } from "@/lib/features/admin/adminSlice";
import type { AppDispatch } from "@/lib/store";
import { logError } from "@/lib/logger";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import { UsersTable } from "@/components/admin/UsersTable";
import { CursorPaginationBar } from "@/components/ui/CursorPaginationBar";
import { AdminSearchForm } from "@/components/admin/AdminSearchForm";
import { useCursorPagination } from "@/lib/hooks";

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

const normalizeUser = (user: AdminUser): AdminUser => ({
  ...user,
  orderCount: user._count?.orders ?? user.orderCount ?? 0,
});

export default function UsersManagement() {
  const dispatch = useDispatch<AppDispatch>();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const {
    items: users,
    loading,
    error,
    search,
    searchInput,
    hasMore,
    currentPage,
    totalCount,
    totalPages,
    setSearchInput,
    handleSearch,
    handleFirst,
    handleNext,
    handlePrev,
    handleLast,
    handlePageSelect,
    handleRefresh,
  } = useCursorPagination<AdminUser>({
    url: "/api/admin/users",
    dataKey: "users",
    transform: normalizeUser,
  });

  const handleRoleChange = async (
    userId: string,
    newRole: "ADMIN" | "CUSTOMER",
  ) => {
    setUpdatingUserId(userId);
    try {
      await dispatch(
        updateAdminUserRole({ id: userId, role: newRole }),
      ).unwrap();
      handleRefresh();
    } catch (err) {
      logError({ error: err, context: "handleRoleChange" });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const usersContent =
    users.length === 0 ? (
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
        <CursorPaginationBar
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={20}
          hasMore={hasMore}
          loading={loading}
          totalPages={totalPages}
          onFirst={handleFirst}
          onPrev={handlePrev}
          onNext={handleNext}
          onLast={handleLast}
          onPageSelect={handlePageSelect}
        />
      </>
    );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Users" }]}
      />
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

      <AdminSearchForm
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        search={search}
        onSearch={handleSearch}
        onClear={handleRefresh}
        placeholder="Search by name or email\u2026"
        ariaLabel="Search users"
      />

      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        usersContent
      )}
    </main>
  );
}
