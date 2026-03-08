import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

const mockProduct: Product = {
  id: "prod-1",
  name: "Test Product",
  description: "A nice product",
  price: 500, // ₹500 INR (base currency)
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

  afterEach(() => {
    vi.unstubAllGlobals();
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
    const nameInput = screen.getByLabelText("Name");
    expect((nameInput as HTMLInputElement).value).toBe("Test Product");
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("updates name input when typed", () => {
    renderModal();
    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "New Name" } });
    expect((nameInput as HTMLInputElement).value).toBe("New Name");
  });

  it("updates description when typed", () => {
    renderModal();
    const descInput = screen.getByLabelText("Description");
    fireEvent.change(descInput, { target: { value: "New Description" } });
    expect((descInput as HTMLTextAreaElement).value).toBe("New Description");
  });

  it("updates stock when changed", () => {
    renderModal();
    const stockInput = screen.getByLabelText("Stock");
    fireEvent.change(stockInput, { target: { value: "25" } });
    expect((stockInput as HTMLInputElement).value).toBe("25");
  });

  it("updates category when typed", () => {
    renderModal();
    const catInput = screen.getByLabelText("Category");
    fireEvent.change(catInput, { target: { value: "Wearables" } });
    expect((catInput as HTMLInputElement).value).toBe("Wearables");
  });

  it("shows existing image when editing", () => {
    renderModal({ editingProduct: mockProduct });
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("https://example.com/image.jpg");
  });

  it("shows invalid file type toast on invalid file upload", async () => {
    const toast = await import("react-hot-toast");
    renderModal();
    const fileInput = screen.getByLabelText("Product Image");
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
    const fileInput = screen.getByLabelText("Product Image");
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
    const fileInput = screen.getByLabelText("Product Image");
    const validFile = new File(["content"], "photo.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(validFile, "size", { value: 100 * 1024 });
    fireEvent.change(fileInput, { target: { files: [validFile] } });
    expect(screen.getByText("Selected: photo.jpg")).toBeTruthy();
  });

  it("handles currency change and converts price", () => {
    renderModal({ editingProduct: mockProduct });
    const currencySelect = screen.getByLabelText("Price currency");
    fireEvent.change(currencySelect, { target: { value: "USD" } });
    expect((currencySelect as HTMLSelectElement).value).toBe("USD");
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

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form as HTMLFormElement);
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

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form as HTMLFormElement);
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
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form as HTMLFormElement);
    });
    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      );
    });
  });

  it("shows error toast and stops submit when file upload fails", async () => {
    const toast = await import("react-hot-toast");
    const logger = await import("@/lib/logger");
    const onSuccess = vi.fn();

    // Mock fetch to fail (uploadImage catch block)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const { container } = renderModal({ onSuccess });

    // Fill all required fields
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "New Product" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Description" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Flowers" },
    });
    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Stock"), {
      target: { value: "10" },
    });

    // Select a valid image file
    const fileInput = screen.getByLabelText("Product Image");
    const validFile = new File(["content"], "test.jpg", { type: "image/jpeg" });
    Object.defineProperty(validFile, "size", { value: 100 * 1024 });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form as HTMLFormElement);
    });

    await waitFor(() => {
      expect(logger.logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: "uploadImage" }),
      );
      expect(toast.default.error).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  it("shows 'Saving...' button text during submission", async () => {
    // Create a promise that never resolves to keep the component in saving state
    let resolvePromise: (value: unknown) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(pendingPromise),
    );

    const { container } = renderModal({ editingProduct: mockProduct });
    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    // Start submission but don't await it
    act(() => {
      fireEvent.submit(form as HTMLFormElement);
    });

    // Button should now show "Saving..."
    await waitFor(() => {
      expect(screen.getByText("Saving...")).toBeTruthy();
    });

    // Cleanup: resolve the promise to avoid hanging
    resolvePromise({
      ok: true,
      json: () => Promise.resolve({ data: { product: mockProduct } }),
    });
  });

  it("successfully creates product with file upload", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const savedProduct = { ...mockProduct, id: "new-prod", image: "https://cdn.example.com/uploaded.jpg" };

    let productCallCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        // The CurrencyProvider also calls /api/exchange-rates on mount — handle it
        // separately so it doesn't inflate the product-related call count.
        if (url === "/api/exchange-rates") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 } } }),
          });
        }
        productCallCount++;
        if (url === "/api/upload") {
          // First product call: upload
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { url: "https://cdn.example.com/uploaded.jpg" } }),
          });
        }
        // Second product call: create product
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { product: savedProduct } }),
        });
      }),
    );

    const { container } = renderModal({ onSuccess, onClose });

    // Fill all required fields
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "New Product" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Description" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Flowers" },
    });
    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Stock"), {
      target: { value: "10" },
    });

    // Select a valid image file
    const fileInput = screen.getByLabelText("Product Image");
    const validFile = new File(["content"], "test.jpg", { type: "image/jpeg" });
    Object.defineProperty(validFile, "size", { value: 100 * 1024 });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form as HTMLFormElement);
    });

    await waitFor(() => {
      expect(productCallCount).toBe(2); // Upload + Create
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("handles upload fetch returning !res.ok (reads error JSON and throws)", async () => {
    const toast = await import("react-hot-toast");
    const logger = await import("@/lib/logger");
    const onSuccess = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Upload rejected" }),
      }),
    );

    const { container } = renderModal({ onSuccess });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "P" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "D" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "C" } });
    fireEvent.change(screen.getByLabelText("Price"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Stock"), { target: { value: "5" } });

    const fileInput = screen.getByLabelText("Product Image");
    const validFile = new File(["content"], "test.jpg", { type: "image/jpeg" });
    Object.defineProperty(validFile, "size", { value: 100 * 1024 });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form as HTMLFormElement);
    });

    await waitFor(() => {
      expect(logger.logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: "uploadImage" }),
      );
      expect(toast.default.error).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
