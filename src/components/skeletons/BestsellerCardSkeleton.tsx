/**
 * Placeholder for a single bestseller tile.
 *
 * Mirrors the geometry of the real tile in `BestsellersScroller` exactly — same
 * track width, same square media box, same single-line title row — so the
 * streamed bestsellers row swaps in without resizing or shifting the tiles on
 * first page load.
 */
export default function BestsellerCardSkeleton() {
  return (
    <div className="snap-start flex-none w-48 sm:w-52">
      <div className="h-full rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] shadow-warm overflow-hidden">
        <div className="relative aspect-square bg-gradient-to-br from-[var(--accent-peach)] to-[var(--accent-blush)] animate-pulse" />
        <div className="p-3">
          <div className="h-5 w-3/4 rounded bg-[var(--accent-blush)] animate-pulse" />
        </div>
      </div>
    </div>
  )
}
