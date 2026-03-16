'use client';

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchAdminUsers,
  updateAdminUserRole,
  selectAdminUsers,
  selectAdminUsersLoading,
  selectAdminError,
} from '@/lib/features/admin/adminSlice';
import type { AppDispatch } from '@/lib/store';
import { logError } from '@/lib/logger';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { UsersTable } from '@/components/admin/UsersTable';

export default function UsersManagement() {
  const dispatch = useDispatch<AppDispatch>();
  const users = useSelector(selectAdminUsers);
  const loading = useSelector(selectAdminUsersLoading);
  const error = useSelector(selectAdminError);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchAdminUsers());
  }, [dispatch]);

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'CUSTOMER') => {
    setUpdatingUserId(userId);
    try {
      await dispatch(updateAdminUserRole({ id: userId, role: newRole })).unwrap();
    } catch (err) {
      logError({ error: err, context: 'handleRoleChange' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage user roles and permissions</p>
      </div>

      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}

      {users.length === 0 ? (
        <EmptyState title="No items found" />
      ) : (
        <UsersTable users={users} updatingUserId={updatingUserId} onRoleChange={handleRoleChange} />
      )}
    </main>
  );
}
