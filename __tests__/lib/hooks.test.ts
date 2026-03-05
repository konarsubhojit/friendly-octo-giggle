import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useFetch,
  useMutation,
  useFormState,
  useDebounce,
  useLocalStorage,
} from "@/lib/hooks";

// ---------------------------------------------------------------------------
// useFetch
// ---------------------------------------------------------------------------
describe("useFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with loading=true and data=null", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    );
    const { result } = renderHook(() => useFetch("/api/test"));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets data on successful fetch with .data wrapper", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: 1 } }),
      }),
    );
    const { result } = renderHook(() => useFetch<{ id: number }>("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ id: 1 });
    expect(result.current.error).toBeNull();
  });

  it("sets data on successful fetch without .data wrapper", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 2 }),
      }),
    );
    const { result } = renderHook(() => useFetch<{ id: number }>("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ id: 2 });
  });

  it("sets error on failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      }),
    );
    const { result } = renderHook(() => useFetch("/api/missing"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Not found");
    expect(result.current.data).toBeNull();
  });

  it("sets error on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    const { result } = renderHook(() => useFetch("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network error");
  });

  it("sets generic error on non-Error throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("unknown"));
    const { result } = renderHook(() => useFetch("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("An error occurred");
  });

  it("refetch triggers another fetch call", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: 3 } }),
      });
    vi.stubGlobal("fetch", mockFetch);
    const { result } = renderHook(() => useFetch("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});

// ---------------------------------------------------------------------------
// useMutation
// ---------------------------------------------------------------------------
describe("useMutation", () => {
  it("starts with loading=false, data=null, error=null", () => {
    const { result } = renderHook(() =>
      useMutation(async (v: string) => v.toUpperCase()),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets loading during mutation", async () => {
    let resolvePromise!: (v: string) => void;
    const mutationFn = vi.fn(
      () => new Promise<string>((r) => (resolvePromise = r)),
    );
    const { result } = renderHook(() => useMutation(mutationFn));
    act(() => {
      result.current.mutate("hello").catch(() => {});
    });
    expect(result.current.loading).toBe(true);
    await act(async () => resolvePromise("HELLO"));
    expect(result.current.loading).toBe(false);
  });

  it("sets data on success", async () => {
    const { result } = renderHook(() =>
      useMutation(async (v: string) => v.toUpperCase()),
    );
    await act(async () => {
      await result.current.mutate("hello");
    });
    expect(result.current.data).toBe("HELLO");
    expect(result.current.error).toBeNull();
  });

  it("sets error and rethrows on failure", async () => {
    const { result } = renderHook(() =>
      useMutation(async (_: string) => {
        throw new Error("mutation failed");
      }),
    );
    await act(async () => {
      await result.current.mutate("test").catch(() => {});
    });
    expect(result.current.error).toBe("mutation failed");
    expect(result.current.loading).toBe(false);
  });

  it("sets generic error on non-Error throw", async () => {
    const { result } = renderHook(() =>
      useMutation(async (_: string) => {
        throw "not an error";
      }),
    );
    await act(async () => {
      await result.current.mutate("test").catch(() => {});
    });
    expect(result.current.error).toBe("Mutation failed");
  });

  it("reset clears state", async () => {
    const { result } = renderHook(() =>
      useMutation(async (v: string) => v.toUpperCase()),
    );
    await act(async () => {
      await result.current.mutate("hello");
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useFormState
// ---------------------------------------------------------------------------
describe("useFormState", () => {
  it("initialises with provided state", () => {
    const { result } = renderHook(() =>
      useFormState({ name: "", age: 0 }),
    );
    expect(result.current.values).toEqual({ name: "", age: 0 });
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  it("handleChange updates values and clears field error", () => {
    const { result } = renderHook(() => useFormState({ name: "" }));
    act(() => {
      result.current.setError("name", "required");
    });
    expect(result.current.errors.name).toBe("required");
    act(() => {
      result.current.handleChange("name", "Alice");
    });
    expect(result.current.values.name).toBe("Alice");
    expect(result.current.errors.name).toBeUndefined();
  });

  it("setError marks field invalid", () => {
    const { result } = renderHook(() => useFormState({ name: "" }));
    act(() => {
      result.current.setError("name", "required");
    });
    expect(result.current.isValid).toBe(false);
  });

  it("handleSubmit calls onSubmit with values", async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useFormState({ name: "Alice" }));
    const mockSubmitEvent = { preventDefault: vi.fn() } as unknown as React.SyntheticEvent<HTMLFormElement>;
    await act(async () => {
      await result.current.handleSubmit(onSubmit)(mockSubmitEvent);
    });
    expect(mockSubmitEvent.preventDefault).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledWith({ name: "Alice" });
  });

  it("reset restores initial state", () => {
    const { result } = renderHook(() => useFormState({ name: "" }));
    act(() => {
      result.current.handleChange("name", "Bob");
      result.current.setError("name", "err");
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.values).toEqual({ name: "" });
    expect(result.current.errors).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// useDebounce
// ---------------------------------------------------------------------------
describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update before delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "hello", delay: 300 } },
    );
    rerender({ value: "world", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("hello");
  });

  it("updates after delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "hello", delay: 300 } },
    );
    rerender({ value: "world", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("world");
  });
});

// ---------------------------------------------------------------------------
// useLocalStorage
// ---------------------------------------------------------------------------
describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns initial value when nothing in localStorage", () => {
    const { result } = renderHook(() => useLocalStorage("key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("reads existing value from localStorage", () => {
    localStorage.setItem("key", JSON.stringify("stored"));
    const { result } = renderHook(() => useLocalStorage("key", "default"));
    expect(result.current[0]).toBe("stored");
  });

  it("sets value in localStorage", () => {
    const { result } = renderHook(() => useLocalStorage("key", "default"));
    act(() => {
      result.current[1]("updated");
    });
    expect(result.current[0]).toBe("updated");
    expect(localStorage.getItem("key")).toBe(JSON.stringify("updated"));
  });

  it("supports updater function", () => {
    const { result } = renderHook(() => useLocalStorage("count", 0));
    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    expect(result.current[0]).toBe(1);
  });

  it("returns initial value when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage error");
    });
    const { result } = renderHook(() => useLocalStorage("key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("handles localStorage.setItem throwing gracefully", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage full");
    });
    const { result } = renderHook(() => useLocalStorage("key", "default"));
    expect(() =>
      act(() => {
        result.current[1]("new value");
      }),
    ).not.toThrow();
  });
});
