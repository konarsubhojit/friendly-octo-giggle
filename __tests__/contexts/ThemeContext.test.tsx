import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import {
  ThemeProvider,
  useTheme,
  THEMES,
  type ThemeId,
} from "@/contexts/ThemeContext";

const ThemeDisplay = () => {
  const { theme, setTheme, themes } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="theme-count">{themes.length}</span>
      <button onClick={() => setTheme("baby-pink")}>Set Baby Pink</button>
      <button onClick={() => setTheme("default")}>Set Default</button>
    </div>
  );
};

const ThrowingComponent = () => {
  useTheme();
  return null;
};

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("provides default theme on initial render", () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("default");
  });

  it("exposes all available themes", () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme-count").textContent).toBe(
      String(THEMES.length),
    );
  });

  it("switches to baby-pink theme via setTheme", () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set Baby Pink"));
    });
    expect(screen.getByTestId("theme").textContent).toBe("baby-pink");
  });

  it("sets data-theme attribute on documentElement when switching to baby-pink", () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set Baby Pink"));
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "baby-pink",
    );
  });

  it("removes data-theme attribute when reverting to default", () => {
    document.documentElement.setAttribute("data-theme", "baby-pink");
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set Default"));
    });
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("persists theme to localStorage on change", () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set Baby Pink"));
    });
    expect(localStorage.getItem("kiyon_theme")).toBe("baby-pink");
  });

  it("reads persisted theme from localStorage on mount", async () => {
    localStorage.setItem("kiyon_theme", "baby-pink");
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("baby-pink");
    });
  });

  it("throws when useTheme is used outside ThemeProvider", () => {
    const originalError = console.error;
    console.error = () => {};
    expect(() => render(<ThrowingComponent />)).toThrow(
      "useTheme must be used within a ThemeProvider",
    );
    console.error = originalError;
  });
});

describe("THEMES constant", () => {
  it("contains exactly 2 themes", () => {
    expect(THEMES).toHaveLength(2);
  });

  it("includes default theme", () => {
    const ids = THEMES.map((t) => t.id) as ThemeId[];
    expect(ids).toContain("default");
  });

  it("includes baby-pink theme", () => {
    const ids = THEMES.map((t) => t.id) as ThemeId[];
    expect(ids).toContain("baby-pink");
  });

  it("every theme has required fields", () => {
    for (const t of THEMES) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("label");
      expect(t).toHaveProperty("description");
      expect(t).toHaveProperty("bgPreview");
      expect(t).toHaveProperty("textPreview");
    }
  });
});
