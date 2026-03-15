'use client';

import { Badge, roleVariant } from '@/components/ui/Badge';

interface RoleBadgeProps {
  readonly role: string;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return <Badge variant={roleVariant(role)}>{role}</Badge>;
}
