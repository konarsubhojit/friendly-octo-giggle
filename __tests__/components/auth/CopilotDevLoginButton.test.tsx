import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotDevLoginButton } from "@/components/auth/CopilotDevLoginButton";

const mockSignIn = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

describe("CopilotDevLoginButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_COPILOT_DEV_KEY", "client-dev-key");
    vi.stubGlobal("location", { href: "http://localhost/" });
  });

  it("renders nothing outside development", () => {
    vi.stubEnv("NODE_ENV", "test");
    const { container } = render(<CopilotDevLoginButton />);
    expect(container.innerHTML).toBe("");
  });

  it("passes the env-backed dev token to signIn", async () => {
    mockSignIn.mockResolvedValue({ ok: false });
    render(<CopilotDevLoginButton />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in as copilot admin/i }));
    });

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("copilot-dev", {
        devToken: "client-dev-key",
        redirect: false,
      });
    });
  });

  it("calls onSuccess and redirects on successful sign-in", async () => {
    mockSignIn.mockResolvedValue({ ok: true });
    const onSuccess = vi.fn();
    render(<CopilotDevLoginButton onSuccess={onSuccess} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in as copilot admin/i }));
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(globalThis.location.href).toBe("/admin");
    });
  });
});
