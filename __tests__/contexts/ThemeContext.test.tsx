import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { ThemeProvider, useTheme, THEMES } from "@/contexts/ThemeContext";

const ThemeDisplay = () => {
  const { theme, setTheme, themes } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="theme-count">{themes.length}</span>
      <button onClick={() => setTheme("simple")}>Set Simple</button>
      <button onClick={() => setTheme("baby-pink")}>Set Baby Pink</button>
      <button onClick={() => setTheme("midnight-bloom")}>
        Set Midnight Bloom
      </button>
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
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete document.documentElement.dataset.theme;
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
    expect(document.documentElement.dataset.theme).toBe("baby-pink");
  });

  it("removes data-theme attribute when reverting to default", () => {
    document.documentElement.dataset.theme = "baby-pink";
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set Default"));
    });
    expect(document.documentElement.dataset.theme).toBeUndefined();
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

  it("reads any valid persisted theme from localStorage on mount", async () => {
    localStorage.setItem("kiyon_theme", "midnight-bloom");
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("midnight-bloom");
    });
  });

  it("falls back to default for an invalid persisted theme", async () => {
    localStorage.setItem("kiyon_theme", "unknown-theme");
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("default");
    });
  });

  it("sets data-theme attribute for non-default themes", () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set Simple"));
    });
    expect(document.documentElement.dataset.theme).toBe("simple");
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
  it("contains 5 themes", () => {
    expect(THEMES).toHaveLength(5);
  });

  it("includes default theme", () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain("default");
  });

  it("includes simple theme", () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain("simple");
  });

  it("includes baby-pink theme", () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain("baby-pink");
  });

  it("includes ocean-breeze theme", () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain("ocean-breeze");
  });

  it("includes midnight-bloom theme", () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain("midnight-bloom");
  });

  it("every theme has required fields", () => {
    for (const t of THEMES) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("label");
      expect(t).toHaveProperty("description");
      expect(t).toHaveProperty("bgPreview");
      expect(t).toHaveProperty("textPreview");
      expect(t).toHaveProperty("accentPreview");
    }
  });
});
