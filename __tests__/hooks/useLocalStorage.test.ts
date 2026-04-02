import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { useLocalStorage } from "@/hooks/useLocalStorage";
import { logError } from "@/lib/logger";

describe("useLocalStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("returns the initial value when localStorage is empty", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("reads existing value from localStorage", () => {
    localStorage.setItem("test-key", JSON.stringify("stored-value"));

    const { result } = renderHook(() => useLocalStorage("test-key", "default"));
    expect(result.current[0]).toBe("stored-value");
  });

  it("updates value and writes to localStorage", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "initial"));

    act(() => {
      result.current[1]("updated");
    });

    expect(result.current[0]).toBe("updated");
    expect(JSON.parse(localStorage.getItem("test-key")!)).toBe("updated");
  });

  it("supports functional updates", () => {
    const { result } = renderHook(() => useLocalStorage("counter", 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
    expect(JSON.parse(localStorage.getItem("counter")!)).toBe(1);
  });

  it("works with object values", () => {
    const initial = { name: "Alice", age: 30 };
    const { result } = renderHook(() => useLocalStorage("user", initial));

    act(() => {
      result.current[1]({ name: "Bob", age: 25 });
    });

    expect(result.current[0]).toEqual({ name: "Bob", age: 25 });
  });

  it("works with array values", () => {
    const { result } = renderHook(() => useLocalStorage<string[]>("items", []));

    act(() => {
      result.current[1](["a", "b"]);
    });

    expect(result.current[0]).toEqual(["a", "b"]);
  });

  it("logs error on read failure and returns initial value", () => {
    localStorage.setItem("bad-key", "not-json{{{");

    const { result } = renderHook(() => useLocalStorage("bad-key", "fallback"));

    expect(result.current[0]).toBe("fallback");
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: "useLocalStorage:read" }),
    );
  });

  it("logs error on write failure", () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("Storage full");
    };

    const { result } = renderHook(() => useLocalStorage("test-key", "initial"));

    act(() => {
      result.current[1]("new-value");
    });

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: "useLocalStorage:write" }),
    );

    Storage.prototype.setItem = originalSetItem;
  });
});
