'use client';

import { UserAvatar } from '@/components/admin/UserAvatar';
import { RoleBadge } from '@/components/admin/RoleBadge';
import { RoleAction } from '@/components/admin/RoleAction';

interface AdminUser {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
  readonly image: string | null;
  readonly role: string;
  readonly orderCount?: number;
  readonly createdAt: string;
}

interface UserRowProps {
  readonly user: AdminUser;
  readonly updatingUserId: string | null;
  readonly onRoleChange: (userId: string, newRole: 'ADMIN' | 'CUSTOMER') => void;
}

export function UserRow({ user, updatingUserId, onRoleChange }: UserRowProps) {
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
