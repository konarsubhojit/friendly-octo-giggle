import Link from 'next/link';
import CurrencySelector from '@/components/ui/CurrencySelector';

interface AdminHeaderNavProps {
  readonly userName: string;
}

export function AdminHeaderNav({ userName }: AdminHeaderNavProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <CurrencySelector />
      <span className="text-sm text-gray-600 truncate max-w-[120px] sm:max-w-none" title={userName}>{userName}</span>
      <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap">View Store</Link>
      <form action="/api/auth/signout" method="POST">
        <button type="submit" className="text-sm text-red-600 hover:text-red-900 whitespace-nowrap">Sign Out</button>
      </form>
    </div>
  );
}
