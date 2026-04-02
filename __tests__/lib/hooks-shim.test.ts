import { describe, it, expect } from "vitest";

import {
  useFetch,
  useMutation,
  useFormState,
  useDebounce,
  useLocalStorage,
  useModalState,
  useCursorPagination,
  useRecentlyViewed,
} from "@/lib/hooks";

describe("lib/hooks re-export shim", () => {
  it("re-exports useFetch", () => {
    expect(useFetch).toBeDefined();
    expect(typeof useFetch).toBe("function");
  });

  it("re-exports useMutation", () => {
    expect(useMutation).toBeDefined();
    expect(typeof useMutation).toBe("function");
  });

  it("re-exports useFormState", () => {
    expect(useFormState).toBeDefined();
    expect(typeof useFormState).toBe("function");
  });

  it("re-exports useDebounce", () => {
    expect(useDebounce).toBeDefined();
    expect(typeof useDebounce).toBe("function");
  });

  it("re-exports useLocalStorage", () => {
    expect(useLocalStorage).toBeDefined();
    expect(typeof useLocalStorage).toBe("function");
  });

  it("re-exports useModalState", () => {
    expect(useModalState).toBeDefined();
    expect(typeof useModalState).toBe("function");
  });

  it("re-exports useCursorPagination", () => {
    expect(useCursorPagination).toBeDefined();
    expect(typeof useCursorPagination).toBe("function");
  });

  it("re-exports useRecentlyViewed", () => {
    expect(useRecentlyViewed).toBeDefined();
    expect(typeof useRecentlyViewed).toBe("function");
  });
});
