// Backward-compat re-exports — import from feature or hooks paths directly in new code
export { useFetch } from "@/hooks/useFetch";
export { useMutation } from "@/hooks/useMutation";
export { useFormState } from "@/hooks/useFormState";
export { useDebounce } from "@/hooks/useDebounce";
export { useLocalStorage } from "@/hooks/useLocalStorage";
export { useModalState } from "@/hooks/useModalState";
export { useCursorPagination } from "@/hooks/useCursorPagination";
export type {
  UseCursorPaginationOptions,
  UseCursorPaginationResult,
} from "@/hooks/useCursorPagination";
export { useRecentlyViewed } from "@/features/product/hooks/useRecentlyViewed";
export type { RecentlyViewedProduct } from "@/features/product/hooks/useRecentlyViewed";
