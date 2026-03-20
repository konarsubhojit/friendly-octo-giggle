import { describe, it, expect } from "vitest";
import { generateShortId, generateOrderId } from "@/lib/short-id";

describe("generateShortId", () => {
  it("returns a string of length 7", () => {
    const id = generateShortId();
    expect(id).toHaveLength(7);
  });

  it("contains only base62 characters", () => {
    const base62Regex = /^[0-9A-Za-z]{7}$/;
    for (let index = 0; index < 100; index++) {
      expect(generateShortId()).toMatch(base62Regex);
    }
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let index = 0; index < 10_000; index++) {
      ids.add(generateShortId());
    }
    expect(ids.size).toBe(10_000);
  });
});

describe("generateOrderId", () => {
  it("returns a string of length 10", () => {
    const id = generateOrderId();
    expect(id).toHaveLength(10);
  });

  it("always starts with ORD prefix", () => {
    for (let index = 0; index < 100; index++) {
      expect(generateOrderId()).toMatch(/^ORD/);
    }
  });

  it("contains ORD prefix followed by 7 base62 characters", () => {
    const orderIdRegex = /^ORD[0-9A-Za-z]{7}$/;
    for (let index = 0; index < 100; index++) {
      expect(generateOrderId()).toMatch(orderIdRegex);
    }
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let index = 0; index < 10_000; index++) {
      ids.add(generateOrderId());
    }
    expect(ids.size).toBe(10_000);
  });
});
