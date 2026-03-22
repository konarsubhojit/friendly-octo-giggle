import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import AdminSearchPage from "@/app/admin/search/page";

const isSearchAvailable = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/search", () => ({
  isSearchAvailable: () => isSearchAvailable(),
}));

vi.mock("@/components/admin/SearchReindexClient", () => ({
  default: ({ configured }: { configured: boolean }) => (
    <div>Search reindex client: {configured ? "configured" : "missing"}</div>
  ),
}));

describe("AdminSearchPage", () => {
  it("renders the upgraded page shell for configured search", () => {
    isSearchAvailable.mockReturnValue(true);

    render(<AdminSearchPage />);

    expect(
      screen.getByRole("heading", {
        name: "Search indexing with clearer operational guardrails.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Index status")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(
      screen.getByText("Search reindex client: configured"),
    ).toBeInTheDocument();
  });

  it("renders the fallback metric state when search is not configured", () => {
    isSearchAvailable.mockReturnValue(false);

    render(<AdminSearchPage />);

    expect(screen.getByText("Missing config")).toBeInTheDocument();
    expect(
      screen.getByText("Search reindex client: missing"),
    ).toBeInTheDocument();
  });
});
