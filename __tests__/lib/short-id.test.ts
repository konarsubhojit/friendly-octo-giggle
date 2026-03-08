import { describe, it, expect } from "vitest";
import { generateShortId } from "@/lib/short-id";

describe("generateShortId", () => {
  it("returns a string of length 7", () => {
    const id = generateShortId();
    expect(id).toHaveLength(7);
  });

  it("contains only base62 characters", () => {
    const base62Regex = /^[0-9A-Za-z]{7}$/;
    for (let i = 0; i < 100; i++) {
      expect(generateShortId()).toMatch(base62Regex);
    }
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(generateShortId());
    }
    expect(ids.size).toBe(10_000);
  });
});
