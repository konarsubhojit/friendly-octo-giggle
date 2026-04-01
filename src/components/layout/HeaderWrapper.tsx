"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";

// Renders the site Header on all non-admin pages.
// Placing this in the root layout keeps it mounted across navigations,
// preventing the HeaderSkeleton flash that occurred when Header lived inside
// individual page components (which are replaced by loading.tsx skeletons).
const HeaderWrapper = () => {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <Header />;
};

export default HeaderWrapper;
