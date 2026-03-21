/**
 * Shared header skeleton component
 * Used across all loading states for consistency
 */
const HeaderSkeleton = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-lg border-b border-[var(--border-warm)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="h-8 w-32 bg-[var(--accent-peach)] rounded animate-pulse" />
        <div className="flex items-center gap-4">
          <div className="h-8 w-20 bg-[var(--accent-peach)] rounded animate-pulse" />
          <div className="h-8 w-8 bg-[var(--accent-peach)] rounded-full animate-pulse" />
        </div>
      </div>
    </header>
  );
}
export default HeaderSkeleton;
