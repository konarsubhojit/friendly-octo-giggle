import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "@/hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 500));
    expect(result.current).toBe("hello");
  });

  it("does not update value before delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } },
    );

    rerender({ value: "updated", delay: 500 });
    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(result.current).toBe("initial");
  });

  it("updates value after delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } },
    );

    rerender({ value: "updated", delay: 500 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("updated");
  });

  it("resets timer when value changes within delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "first", delay: 300 } },
    );

    rerender({ value: "second", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: "third", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe("first");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe("third");
  });

  it("works with numeric values", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 100 } },
    );

    rerender({ value: 42, delay: 100 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe(42);
  });

  it("works with object values", () => {
    const obj1 = { key: "a" };
    const obj2 = { key: "b" };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: obj1, delay: 200 } },
    );

    rerender({ value: obj2, delay: 200 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toEqual({ key: "b" });
  });

  it("cleans up timeout on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = renderHook(() => useDebounce("test", 500));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
