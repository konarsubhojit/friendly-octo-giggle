import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/skeletons/HeaderSkeleton", () => ({
  default: () => <div data-testid="header-skeleton">HeaderSkeleton</div>,
}));
vi.mock("@/components/skeletons/HeroSkeleton", () => ({
  default: () => <div data-testid="hero-skeleton">HeroSkeleton</div>,
}));
vi.mock("@/components/skeletons/ProductCardSkeleton", () => ({
  default: () => (
    <div data-testid="product-card-skeleton">ProductCardSkeleton</div>
  ),
}));

describe("app/loading.tsx – Root Loading", () => {
  it("renders without crashing", async () => {
    const { default: Loading } = await import("@/app/loading");
    const { container } = render(<Loading />);
    expect(container).toBeTruthy();
  });

  it("renders HeroSkeleton and 6 ProductCardSkeletons", async () => {
    const { default: Loading } = await import("@/app/loading");
    render(<Loading />);
    expect(screen.getByTestId("hero-skeleton")).toBeInTheDocument();
    expect(screen.getAllByTestId("product-card-skeleton")).toHaveLength(6);
  });

  it("renders 4 link skeletons in the footer", async () => {
    const { default: Loading } = await import("@/app/loading");
    const { container } = render(<Loading />);
    const footer = container.querySelector("footer")!;
    const linkSkeletons = footer.querySelectorAll(".h-4.w-20");
    expect(linkSkeletons).toHaveLength(4);
  });

  it("contains animate-pulse elements", async () => {
    const { default: Loading } = await import("@/app/loading");
    const { container } = render(<Loading />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});

describe("app/products/loading.tsx – Products Loading", () => {
  it("renders without crashing", async () => {
    const { default: ProductsLoading } = await import("@/app/products/loading");
    const { container } = render(<ProductsLoading />);
    expect(container).toBeTruthy();
  });

  it("renders 9 ProductCardSkeletons", async () => {
    const { default: ProductsLoading } = await import("@/app/products/loading");
    render(<ProductsLoading />);
    expect(screen.getAllByTestId("product-card-skeleton")).toHaveLength(9);
  });

  it("renders a pagination skeleton", async () => {
    const { default: ProductsLoading } = await import("@/app/products/loading");
    const { container } = render(<ProductsLoading />);
    const paginationButtons = container.querySelectorAll(".h-10.w-10");
    expect(paginationButtons.length).toBeGreaterThanOrEqual(5);
  });

  it("contains animate-pulse elements", async () => {
    const { default: ProductsLoading } = await import("@/app/products/loading");
    const { container } = render(<ProductsLoading />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});

describe("app/products/[id]/loading.tsx – Product Detail Loading", () => {
  it("renders without crashing", async () => {
    const { default: ProductDetailLoading } =
      await import("@/app/products/[id]/loading");
    const { container } = render(<ProductDetailLoading />);
    expect(container).toBeTruthy();
  });

  it("renders an image area skeleton", async () => {
    const { default: ProductDetailLoading } =
      await import("@/app/products/[id]/loading");
    const { container } = render(<ProductDetailLoading />);
    const imageArea = container.querySelector(".shadow-warm-lg");
    expect(imageArea).toBeInTheDocument();
  });

  it("renders 4 variation skeletons", async () => {
    const { default: ProductDetailLoading } =
      await import("@/app/products/[id]/loading");
    const { container } = render(<ProductDetailLoading />);
    const variationSkeletons = container.querySelectorAll(".h-10.w-20");
    expect(variationSkeletons).toHaveLength(4);
  });

  it("renders additional info card skeleton", async () => {
    const { default: ProductDetailLoading } =
      await import("@/app/products/[id]/loading");
    const { container } = render(<ProductDetailLoading />);
    const infoIcons = container.querySelectorAll(".rounded-full.animate-pulse");
    expect(infoIcons.length).toBeGreaterThanOrEqual(3);
  });

  it("contains animate-pulse elements", async () => {
    const { default: ProductDetailLoading } =
      await import("@/app/products/[id]/loading");
    const { container } = render(<ProductDetailLoading />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});

describe("app/wishlist/loading.tsx – Wishlist Loading", () => {
  it("renders without crashing", async () => {
    const { default: WishlistLoading } = await import("@/app/wishlist/loading");
    const { container } = render(<WishlistLoading />);
    expect(container).toBeTruthy();
  });

  it("uses pt-8 spacing (not pt-28)", async () => {
    const { default: WishlistLoading } = await import("@/app/wishlist/loading");
    const { container } = render(<WishlistLoading />);
    const main = container.querySelector("main");
    expect(main?.className).toContain("pt-8");
    expect(main?.className).not.toContain("pt-28");
  });

  it("contains animate-pulse elements", async () => {
    const { default: WishlistLoading } = await import("@/app/wishlist/loading");
    const { container } = render(<WishlistLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });
});

describe("app/shop/loading.tsx – Shop Loading", () => {
  it("renders without crashing", async () => {
    const { default: ShopLoading } = await import("@/app/shop/loading");
    const { container } = render(<ShopLoading />);
    expect(container).toBeTruthy();
  });

  it("uses pt-8 spacing (not pt-28)", async () => {
    const { default: ShopLoading } = await import("@/app/shop/loading");
    const { container } = render(<ShopLoading />);
    const section = container.querySelector("section");
    expect(section?.className).toContain("pt-8");
    expect(section?.className).not.toContain("pt-28");
  });

  it("contains animate-pulse elements", async () => {
    const { default: ShopLoading } = await import("@/app/shop/loading");
    const { container } = render(<ShopLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });
});

describe("Spacing consistency – pt-8 on all loading skeletons", () => {
  it("products loading uses pt-8", async () => {
    const { default: ProductsLoading } = await import("@/app/products/loading");
    const { container } = render(<ProductsLoading />);
    const main = container.querySelector("main");
    expect(main?.className).toContain("pt-8");
    expect(main?.className).not.toContain("pt-28");
  });

  it("product detail loading uses pt-8", async () => {
    const { default: ProductDetailLoading } =
      await import("@/app/products/[id]/loading");
    const { container } = render(<ProductDetailLoading />);
    const main = container.querySelector("main");
    expect(main?.className).toContain("pt-8");
    expect(main?.className).not.toContain("pt-28");
  });
});
