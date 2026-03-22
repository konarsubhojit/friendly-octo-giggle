import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { TopProductsTable } from "@/components/admin/TopProductsTable";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("TopProductsTable", () => {
  it("renders product rows with admin detail links", () => {
    render(
      <TopProductsTable
        products={[
          {
            productId: "prod001",
            name: "Rose Gift Box",
            totalQuantity: 22,
            totalRevenue: 1800,
          },
        ]}
        formatPrice={(value) => `$${value.toFixed(2)}`}
      />,
    );

    expect(screen.getByText("Rose Gift Box")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
    expect(screen.getByText("$1800.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rose Gift Box" })).toHaveAttribute(
      "href",
      "/admin/products/prod001",
    );
  });

  it("renders the empty state when no products are present", () => {
    render(
      <TopProductsTable products={[]} formatPrice={(value) => `$${value}`} />,
    );

    expect(screen.getByText("No product sales yet.")).toBeInTheDocument();
  });
});
