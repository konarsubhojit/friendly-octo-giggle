import { render, screen } from "@testing-library/react";
import { SalesTrendChart } from "@/components/admin/SalesTrendChart";
import type { SalesTrendPoint } from "@/lib/admin-sales";

vi.mock("@/contexts/CurrencyContext", () => ({
  useCurrency: () => ({
    formatPrice: (value: number) => `$${value.toFixed(2)}`,
    convertPrice: (value: number) => value,
  }),
}));

const points: SalesTrendPoint[] = [
  { date: "2026-03-16", label: "Mon", revenue: 500, orders: 4 },
  { date: "2026-03-17", label: "Tue", revenue: 650, orders: 5 },
  { date: "2026-03-18", label: "Wed", revenue: 720, orders: 6 },
  { date: "2026-03-19", label: "Thu", revenue: 610, orders: 4 },
  { date: "2026-03-20", label: "Fri", revenue: 860, orders: 8 },
  { date: "2026-03-21", label: "Sat", revenue: 920, orders: 9 },
  { date: "2026-03-22", label: "Sun", revenue: 650, orders: 7 },
];

describe("SalesTrendChart", () => {
  it("renders the chart heading, legends, and accessible svg summary", () => {
    render(<SalesTrendChart points={points} />);

    expect(
      screen.getByRole("heading", { name: "Revenue Pulse" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(
      screen.getByText("Seven day sales trend showing revenue and order volume"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Sun")).toBeInTheDocument();
  });

  it("renders an empty state when no points are available", () => {
    render(<SalesTrendChart points={[]} />);

    expect(
      screen.getByText("No recent sales trend available."),
    ).toBeInTheDocument();
  });
});
