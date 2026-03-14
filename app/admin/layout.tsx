import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CurrencySelector from '@/components/ui/CurrencySelector';

interface AdminLayoutProps {
  readonly children: React.ReactNode;
}

function AdminHeaderNav({ userName }: { readonly userName: string }) {
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

function AdminNavLinks() {
  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/products', label: 'Products' },
    { href: '/admin/orders', label: 'Orders' },
    { href: '/admin/users', label: 'Users' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 overflow-x-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 py-3 whitespace-nowrap">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="text-sm font-medium text-gray-600 hover:text-blue-600 transition">{label}</Link>
          ))}
        </div>
      </div>
    </nav>
  );
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/admin" className="text-2xl font-bold text-gray-900 hover:text-blue-700 transition">Admin Panel</Link>
          <AdminHeaderNav userName={session.user.name || session.user.email || ''} />
        </div>
      </header>
      <AdminNavLinks />
      {children}
    </div>
  );
}
