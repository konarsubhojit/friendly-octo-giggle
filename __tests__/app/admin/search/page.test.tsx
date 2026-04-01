import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import AdminSearchPage from "@/app/admin/search/page";

const isSearchAvailable = vi.fn();
const areOrdersSearchControlsAvailable = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/search", () => ({
  isSearchAvailable: () => isSearchAvailable(),
}));

vi.mock("@/features/orders/services/orders-search-index", () => ({
  areOrdersSearchControlsAvailable: () => areOrdersSearchControlsAvailable(),
}));

vi.mock("@/features/admin/components/SearchReindexClient", () => ({
  default: ({
    productsConfigured,
    ordersConfigured,
  }: {
    productsConfigured: boolean;
    ordersConfigured: boolean;
  }) => (
    <div>
      Search reindex client: products{" "}
      {productsConfigured ? "configured" : "missing"}, orders{" "}
      {ordersConfigured ? "configured" : "missing"}
    </div>
  ),
}));

describe("AdminSearchPage", () => {
  it("renders the upgraded page shell for configured search", () => {
    isSearchAvailable.mockReturnValue(true);
    areOrdersSearchControlsAvailable.mockReturnValue(true);

    render(<AdminSearchPage />);

    expect(
      screen.getByRole("heading", {
        name: "Search Index Management",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Products index")).toBeInTheDocument();
    expect(screen.getAllByText("Configured")).toHaveLength(2);
    expect(
      screen.getByText(
        "Search reindex client: products configured, orders configured",
      ),
    ).toBeInTheDocument();
  });

  it("renders the fallback metric state when search is not configured", () => {
    isSearchAvailable.mockReturnValue(false);
    areOrdersSearchControlsAvailable.mockReturnValue(false);

    render(<AdminSearchPage />);

    expect(screen.getAllByText("Missing config")).toHaveLength(2);
    expect(
      screen.getByText(
        "Search reindex client: products missing, orders missing",
      ),
    ).toBeInTheDocument();
  });

  it("renders mixed search infrastructure states", () => {
    isSearchAvailable.mockReturnValue(false);
    areOrdersSearchControlsAvailable.mockReturnValue(true);

    render(<AdminSearchPage />);

    expect(screen.getByText("Products index")).toBeInTheDocument();
    expect(screen.getByText("Orders index")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Search reindex client: products missing, orders configured",
      ),
    ).toBeInTheDocument();
  });
});
