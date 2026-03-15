'use client';

import { UserRow } from '@/components/admin/UserRow';

interface AdminUser {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
  readonly image: string | null;
  readonly role: string;
  readonly orderCount?: number;
  readonly createdAt: string;
}

interface UsersTableProps {
  readonly users: readonly AdminUser[];
  readonly updatingUserId: string | null;
  readonly onRoleChange: (userId: string, newRole: 'ADMIN' | 'CUSTOMER') => void;
}

const TABLE_HEADERS = ['User', 'Email', 'Role', 'Orders', 'Joined', 'Actions'];

export function UsersTable({ users, updatingUserId, onRoleChange }: UsersTableProps) {
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
