import Link from 'next/link';

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
];

export function AdminNavLinks() {
  return (
    <nav className="bg-white border-b border-gray-200 overflow-x-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 py-3 whitespace-nowrap">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="text-sm font-medium text-gray-600 hover:text-blue-600 transition">{label}</Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
