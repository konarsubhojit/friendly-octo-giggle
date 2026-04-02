import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useModalState } from "@/hooks/useModalState";

describe("useModalState", () => {
  it("starts closed with null data", () => {
    const { result } = renderHook(() => useModalState());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("opens without data", () => {
    const { result } = renderHook(() => useModalState());

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("opens with data payload", () => {
    const { result } = renderHook(() =>
      useModalState<{ id: number; name: string }>(),
    );

    act(() => {
      result.current.open({ id: 1, name: "Test" });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual({ id: 1, name: "Test" });
  });

  it("closes and clears data", () => {
    const { result } = renderHook(() => useModalState<string>());

    act(() => {
      result.current.open("some data");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBe("some data");

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("can reopen with different data", () => {
    const { result } = renderHook(() => useModalState<number>());

    act(() => {
      result.current.open(1);
    });
    expect(result.current.data).toBe(1);

    act(() => {
      result.current.close();
    });

    act(() => {
      result.current.open(2);
    });
    expect(result.current.data).toBe(2);
  });
});
