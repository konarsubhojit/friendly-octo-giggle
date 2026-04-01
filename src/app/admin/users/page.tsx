"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import { updateAdminUserRole } from "@/features/admin/store/adminSlice";
import type { AppDispatch } from "@/lib/store";
import { logError } from "@/lib/logger";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AdminPageShell,
  AdminPanel,
} from "@/features/admin/components/AdminPageShell";
import { UsersTable } from "@/features/admin/components/UsersTable";
import { CursorPaginationBar } from "@/components/ui/CursorPaginationBar";
import { AdminSearchForm } from "@/features/admin/components/AdminSearchForm";
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
          pageSize={10}
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

  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const customerCount = users.filter((user) => user.role === "CUSTOMER").length;

  return (
    <AdminPageShell
      breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users" }]}
      eyebrow="Access control"
      title="User Management"
      description="Search accounts and manage user roles and permissions."
      actions={
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Refresh
        </button>
      }
      metrics={[
        {
          label: "Total users",
          value: String(totalCount),
          hint: "Total registered accounts.",
          tone: "sky",
        },
        {
          label: "Admins shown",
          value: String(adminCount),
          hint: "Admins on current page.",
          tone: "amber",
        },
        {
          label: "Customers shown",
          value: String(customerCount),
          hint: "Customers on current page.",
          tone: "emerald",
        },
      ]}
    >
      <AdminPanel title="Search" description="Filter by name or email.">
        <AdminSearchForm
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          search={search}
          onSearch={handleSearch}
          onClear={handleRefresh}
          placeholder="Search by name or email…"
          ariaLabel="Search users"
        />
      </AdminPanel>

      {error ? (
        <AlertBanner message={error} variant="error" className="mb-0" />
      ) : null}

      <AdminPanel title="Users" description="">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          usersContent
        )}
      </AdminPanel>
    </AdminPageShell>
  );
}
