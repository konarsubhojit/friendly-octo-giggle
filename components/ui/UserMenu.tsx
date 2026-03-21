'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

interface Session {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

interface UserMenuProps {
  readonly session: Session | null;
  readonly onLoginClick?: () => void;
}

export const UserMenu = ({ session, onLoginClick }: UserMenuProps) => {
  if (!session?.user) {
    if (onLoginClick) {
      return (
        <button
          onClick={onLoginClick}
          className="text-sm text-gray-700 hover:text-gray-900 bg-white px-4 py-2 rounded-md border border-gray-300 hover:border-gray-400 transition"
        >
          Login
        </button>
      );
    }
    return (
      <Link
        href="/auth/signin"
        className="text-sm text-gray-700 hover:text-gray-900 bg-white px-4 py-2 rounded-md border border-gray-300 hover:border-gray-400 transition"
      >
        Login
      </Link>
    );
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900" aria-expanded="true" aria-haspopup="menu">
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || 'User'}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-600 font-medium">
              {session.user.name?.charAt(0) || session.user.email?.charAt(0) || '?'}
            </span>
          </div>
        )}
        <span className="hidden md:block">{session.user.name || session.user.email}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 hidden group-hover:block z-50" role="menu">
        <div className="px-4 py-2 text-sm text-gray-700 border-b">
          <p className="font-medium">{session.user.name}</p>
          <p className="text-xs text-gray-500">{session.user.email}</p>
          {session.user.role === 'ADMIN' && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">
              Admin
            </span>
          )}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
          role="menuitem"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
