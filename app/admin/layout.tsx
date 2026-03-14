import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CurrencySelector from '@/components/ui/CurrencySelector';

interface AdminLayoutProps {
  readonly children: React.ReactNode;
}

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/admin');
  }

  if (session.user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to access the admin panel</p>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <Link href="/admin" className="text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400 transition">Admin Panel</Link>
            <div className="flex flex-wrap gap-3 items-center">
              <CurrencySelector />
              <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300 max-w-[120px] truncate">
                {session.user.name || session.user.email}
              </span>
              <Link href="/" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition">
                View Store
              </Link>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4 sm:gap-6 py-3 overflow-x-auto">
            <Link href="/admin" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition whitespace-nowrap">Dashboard</Link>
            <Link href="/admin/products" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition whitespace-nowrap">Products</Link>
            <Link href="/admin/orders" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition whitespace-nowrap">Orders</Link>
            <Link href="/admin/users" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition whitespace-nowrap">Users</Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
