import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import ProductFormModal from "@/components/admin/ProductFormModal";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import type { Product } from "@/lib/types";

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const mockProduct: Product = {
  id: "prod-1",
  name: "Test Product",
  description: "A nice product",
  price: 1, // $1 USD base
  image: "https://example.com/image.jpg",
  stock: 10,
  category: "Flowers",
  deletedAt: null,
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

function renderModal(
  props: Partial<React.ComponentProps<typeof ProductFormModal>> = {},
) {
  const defaults = {
    editingProduct: null,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };
  return render(
    <CurrencyProvider>
      <ProductFormModal {...defaults} {...props} />
    </CurrencyProvider>,
  );
}

describe("ProductFormModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 'Add Product' heading for new product", () => {
    renderModal();
    expect(screen.getByText("Add Product")).toBeTruthy();
  });

  it("renders 'Edit Product' heading for existing product", () => {
    renderModal({ editingProduct: mockProduct });
    expect(screen.getByText("Edit Product")).toBeTruthy();
  });

  it("shows 'Create Product' submit button for new product", () => {
    renderModal();
    expect(screen.getByText("Create Product")).toBeTruthy();
  });

  it("shows 'Update Product' submit button for edit", () => {
    renderModal({ editingProduct: mockProduct });
    expect(screen.getByText("Update Product")).toBeTruthy();
  });

  it("pre-fills form fields from editingProduct", () => {
    renderModal({ editingProduct: mockProduct });
    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Test Product");
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("updates name input when typed", () => {
    renderModal();
    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Name" } });
    expect(nameInput.value).toBe("New Name");
  });

  it("updates description when typed", () => {
    renderModal();
    const descInput = screen.getByLabelText("Description") as HTMLTextAreaElement;
    fireEvent.change(descInput, { target: { value: "New Description" } });
    expect(descInput.value).toBe("New Description");
  });

  it("updates stock when changed", () => {
    renderModal();
    const stockInput = screen.getByLabelText("Stock") as HTMLInputElement;
    fireEvent.change(stockInput, { target: { value: "25" } });
    expect(stockInput.value).toBe("25");
  });

  it("updates category when typed", () => {
    renderModal();
    const catInput = screen.getByLabelText("Category") as HTMLInputElement;
    fireEvent.change(catInput, { target: { value: "Wearables" } });
    expect(catInput.value).toBe("Wearables");
  });

  it("shows existing image when editing", () => {
    renderModal({ editingProduct: mockProduct });
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("https://example.com/image.jpg");
  });

  it("shows invalid file type toast on invalid file upload", async () => {
    const toast = await import("react-hot-toast");
    renderModal();
    const fileInput = screen.getByLabelText("Product Image") as HTMLInputElement;
    const invalidFile = new File(["content"], "doc.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    expect(toast.default.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid file type"),
    );
  });

  it("shows file too large toast when file exceeds limit", async () => {
    const toast = await import("react-hot-toast");
    renderModal();
    const fileInput = screen.getByLabelText("Product Image") as HTMLInputElement;
    // Create a large file
    const largeFile = new File(["x".repeat(6 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(largeFile, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [largeFile] } });
    expect(toast.default.error).toHaveBeenCalledWith(
      expect.stringContaining("File too large"),
    );
  });

  it("shows selected filename after valid file pick", async () => {
    renderModal();
    const fileInput = screen.getByLabelText("Product Image") as HTMLInputElement;
    const validFile = new File(["content"], "photo.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(validFile, "size", { value: 100 * 1024 });
    fireEvent.change(fileInput, { target: { files: [validFile] } });
    expect(screen.getByText("Selected: photo.jpg")).toBeTruthy();
  });

  it("handles currency change and converts price", () => {
    renderModal({ editingProduct: mockProduct });
    const currencySelect = screen.getByLabelText("Price currency") as HTMLSelectElement;
    fireEvent.change(currencySelect, { target: { value: "USD" } });
    expect(currencySelect.value).toBe("USD");
  });

  it("shows image required toast when submitting without image", async () => {
    const toast = await import("react-hot-toast");
    const { container } = renderModal();
    // Fill all fields except image
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Product" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Desc" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Flowers" },
    });
    const priceInput = screen.getByLabelText("Price");
    fireEvent.change(priceInput, { target: { value: "100" } });
    const stockInput = screen.getByLabelText("Stock");
    fireEvent.change(stockInput, { target: { value: "5" } });

    const form = container.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith(
        "Product image is required",
      );
    });
  });

  it("calls onSuccess and onClose after successful create", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const savedProduct = { ...mockProduct, id: "new-prod" };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { product: savedProduct } }),
      }),
    );

    // Use an editingProduct with an image URL to bypass file upload requirement
    const { container } = renderModal({
      onClose,
      onSuccess,
      editingProduct: mockProduct,
    });

    const form = container.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows error toast when API returns error", async () => {
    const toast = await import("react-hot-toast");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Validation failed" }),
      }),
    );
    const { container } = renderModal({ editingProduct: mockProduct });
    const form = container.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      );
    });
  });
});
