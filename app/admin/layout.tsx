import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminHeaderNav } from "@/components/admin/AdminHeaderNav";
import { AdminNavLinks } from "@/components/admin/AdminNavLinks";

interface AdminLayoutProps {
  readonly children: React.ReactNode;
}

const AdminLayout = async ({ children }: AdminLayoutProps) => {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You don&apos;t have permission to access the admin panel
          </p>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/admin"
            className="text-2xl font-bold text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 transition"
          >
            Admin Panel
          </Link>
          <AdminHeaderNav
            userName={session.user.name || session.user.email || ""}
          />
        </div>
      </header>
      <AdminNavLinks />
      {children}
    </div>
  );
};
export default AdminLayout;
