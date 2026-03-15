'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
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
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface AdminUser {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
  readonly image: string | null;
  readonly role: string;
  readonly orderCount?: number;
  readonly createdAt: string;
}

function UserAvatar({ name, email, image }: { readonly name: string | null; readonly email: string; readonly image: string | null }) {
  if (image) {
    return (
      <Image src={image} alt={name || 'User'} width={40} height={40} className="rounded-full" />
    );
  }

  const initial = name?.charAt(0) || email.charAt(0).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
      <span className="text-gray-600 font-medium">{initial}</span>
    </div>
  );
}

function RoleBadge({ role }: { readonly role: string }) {
  const colorClass = role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800';
  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}`}>
      {role}
    </span>
  );
}

function RoleAction({
  user,
  isUpdating,
  onRoleChange,
}: {
  readonly user: AdminUser;
  readonly isUpdating: boolean;
  readonly onRoleChange: (userId: string, newRole: 'ADMIN' | 'CUSTOMER') => void;
}) {
  const [pendingRole, setPendingRole] = useState<'ADMIN' | 'CUSTOMER' | null>(null);

  if (isUpdating) {
    return <div className="inline-block w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />;
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as 'ADMIN' | 'CUSTOMER';
    if (newRole !== user.role) {
      setPendingRole(newRole);
    }
  };

  const handleConfirm = () => {
    if (pendingRole) {
      onRoleChange(user.id, pendingRole);
      setPendingRole(null);
    }
  };

  return (
    <>
      <ConfirmDialog
        isOpen={pendingRole !== null}
        title="Change User Role"
        message={`Change ${user.name || user.email}'s role from "${user.role}" to "${pendingRole ?? ''}"?`}
        confirmLabel="Yes, change role"
        variant="warning"
        loading={isUpdating}
        onConfirm={handleConfirm}
        onCancel={() => setPendingRole(null)}
      />
      <select
        value={user.role}
        onChange={handleSelectChange}
        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Change role for ${user.name || user.email}`}
      >
        <option value="CUSTOMER">Customer</option>
        <option value="ADMIN">Admin</option>
      </select>
    </>
  );
}

function UserRow({
  user,
  updatingUserId,
  onRoleChange,
}: {
  readonly user: AdminUser;
  readonly updatingUserId: string | null;
  readonly onRoleChange: (userId: string, newRole: 'ADMIN' | 'CUSTOMER') => void;
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <UserAvatar name={user.name} email={user.email} image={user.image} />
          <span className="ml-4 text-sm font-medium text-gray-900">{user.name || 'No name'}</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
      <td className="px-6 py-4 whitespace-nowrap"><RoleBadge role={user.role} /></td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.orderCount || 0}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <RoleAction user={user} isUpdating={updatingUserId === user.id} onRoleChange={onRoleChange} />
      </td>
    </tr>
  );
}

const TABLE_HEADERS = ['User', 'Email', 'Role', 'Orders', 'Joined', 'Actions'];

function UsersTable({
  users,
  updatingUserId,
  onRoleChange,
}: {
  readonly users: readonly AdminUser[];
  readonly updatingUserId: string | null;
  readonly onRoleChange: (userId: string, newRole: 'ADMIN' | 'CUSTOMER') => void;
}) {
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {TABLE_HEADERS.map((header) => (
              <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <UserRow key={user.id} user={user} updatingUserId={updatingUserId} onRoleChange={onRoleChange} />
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

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
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <p className="text-gray-600 mt-2">Manage user roles and permissions</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {users.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-600">No items found</p>
        </div>
      ) : (
        <UsersTable users={users} updatingUserId={updatingUserId} onRoleChange={handleRoleChange} />
      )}
    </main>
  );
}
