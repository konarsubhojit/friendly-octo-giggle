import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminOrderCard } from "@/components/admin/AdminOrderCard";
import { OrderStatus } from "@/lib/types";

const order = {
  id: "ord1234",
  customerName: "Riya Sen",
  customerEmail: "riya@example.com",
  customerAddress: "22 Market Road, Kolkata",
  totalAmount: 149.5,
  status: OrderStatus.PROCESSING,
  trackingNumber: "TRK-123",
  shippingProvider: "BlueDart",
  createdAt: "2026-03-20T10:30:00.000Z",
  items: [
    {
      id: "item-1",
      quantity: 2,
      price: 50,
      customizationNote: "Gift wrap",
      product: { id: "prod-1", name: "Rose Gift Box", image: "/rose.jpg" },
      variation: { id: "var-1", name: "Large", price: 110 },
    },
    {
      id: "item-2",
      quantity: 1,
      price: 49.5,
      product: { id: "prod-2", name: "Lily Vase", image: "/lily.jpg" },
      variation: null,
    },
    {
      id: "item-3",
      quantity: 1,
      price: 0,
      product: { id: "prod-3", name: "Tulip Candle", image: "/tulip.jpg" },
      variation: null,
    },
  ],
};

describe("AdminOrderCard", () => {
  it("renders a collapsed summary first and expands into details", () => {
    render(
      <AdminOrderCard
        order={order}
        updatingOrderId={null}
        savingShippingId={null}
        edit={{ trackingNumber: "TRK-123", shippingProvider: "BlueDart" }}
        onStatusChange={vi.fn()}
        onShippingFieldChange={vi.fn()}
        onSaveShipping={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Rose Gift Box, Lily Vase and 1 more"),
    ).toBeInTheDocument();
    expect(screen.getByText("Order #ORD1234")).toBeInTheDocument();
    expect(screen.getByText("Show details")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Expand to edit shipping, review the address, and inspect line items.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Pricing in order details"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tracking Number")).not.toBeInTheDocument();
    expect(screen.queryByText("$149.50")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show details/i }));

    expect(screen.getAllByText("Riya Sen")).toHaveLength(2);
    expect(screen.getAllByText("riya@example.com")).toHaveLength(2);
    expect(screen.getByText("Rose Gift Box")).toBeInTheDocument();
    expect(screen.getByText("Large")).toBeInTheDocument();
    expect(screen.getByText("✏️ Gift wrap")).toBeInTheDocument();
    expect(screen.getByText("Pricing in order details")).toBeInTheDocument();
    expect(screen.getByLabelText("Tracking Number")).toBeInTheDocument();
  });

  it("opens confirm dialog and forwards status changes", async () => {
    const onStatusChange = vi.fn();

    render(
      <AdminOrderCard
        order={order}
        updatingOrderId={null}
        savingShippingId={null}
        edit={{ trackingNumber: "TRK-123", shippingProvider: "BlueDart" }}
        onStatusChange={onStatusChange}
        onShippingFieldChange={vi.fn()}
        onSaveShipping={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show details/i }));

    fireEvent.change(screen.getByLabelText("Change status for order ord1234"), {
      target: { value: OrderStatus.SHIPPED },
    });

    expect(screen.getByText("Change Order Status")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Yes, update"));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith(
        "ord1234",
        OrderStatus.SHIPPED,
      );
    });
  });

  it("forwards shipping field edits and save actions", () => {
    const onShippingFieldChange = vi.fn();
    const onSaveShipping = vi.fn();

    render(
      <AdminOrderCard
        order={order}
        updatingOrderId={null}
        savingShippingId={null}
        edit={{ trackingNumber: "TRK-123", shippingProvider: "BlueDart" }}
        onStatusChange={vi.fn()}
        onShippingFieldChange={onShippingFieldChange}
        onSaveShipping={onSaveShipping}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show details/i }));

    fireEvent.change(screen.getByLabelText("Tracking Number"), {
      target: { value: "TRK-999" },
    });
    expect(onShippingFieldChange).toHaveBeenCalledWith(
      "ord1234",
      "trackingNumber",
      "TRK-999",
      order,
    );

    fireEvent.change(screen.getByLabelText("Shipping Provider"), {
      target: { value: "Delhivery" },
    });
    expect(onShippingFieldChange).toHaveBeenCalledWith(
      "ord1234",
      "shippingProvider",
      "Delhivery",
      order,
    );

    fireEvent.click(screen.getByText("Save Shipping"));
    expect(onSaveShipping).toHaveBeenCalledWith(
      "ord1234",
      OrderStatus.PROCESSING,
      order,
    );
  });
});
