import { describe, it, expect, vi, beforeAll } from "vitest";
import { handlers } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

describe("app/api/auth/[...nextauth]/route", () => {
  let GET: typeof handlers.GET;
  let POST: typeof handlers.POST;

  beforeAll(async () => {
    const mod = await import("@/app/api/auth/[...nextauth]/route");
    GET = mod.GET;
    POST = mod.POST;
  });

  it("exports GET as a function", () => {
    expect(typeof GET).toBe("function");
  });

  it("exports POST as a function", () => {
    expect(typeof POST).toBe("function");
  });

  it("GET delegates to handlers.GET", async () => {
    const req = new Request("http://localhost/api/auth/providers");
    await (GET as Function)(req);
    expect(handlers.GET).toHaveBeenCalledWith(req);
  });

  it("POST delegates to handlers.POST", async () => {
    const req = new Request("http://localhost/api/auth/callback/google", {
      method: "POST",
    });
    await (POST as Function)(req);
    expect(handlers.POST).toHaveBeenCalledWith(req);
  });
});
