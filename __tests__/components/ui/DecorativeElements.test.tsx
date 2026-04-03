import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  FlowerAccent,
  LeafAccent,
  SparkleAccent,
  VineDivider,
  ScatteredFlowers,
  FlowerBullet,
  FloralCartIcon,
  ButterflyAccent,
  MushroomAccent,
  FloralBorder,
} from "@/components/ui/DecorativeElements";

describe("DecorativeElements", () => {
  it("renders FlowerAccent as SVG", () => {
    const { container } = render(<FlowerAccent />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("FlowerAccent applies custom className", () => {
    const { container } = render(<FlowerAccent className="custom-class" />);
    expect(container.querySelector("svg.custom-class")).toBeTruthy();
  });

  it("renders LeafAccent as SVG", () => {
    const { container } = render(<LeafAccent />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("LeafAccent applies custom className", () => {
    const { container } = render(<LeafAccent className="leaf-cls" />);
    expect(container.querySelector("svg.leaf-cls")).toBeTruthy();
  });

  it("renders SparkleAccent as SVG", () => {
    const { container } = render(<SparkleAccent />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("SparkleAccent applies custom className", () => {
    const { container } = render(<SparkleAccent className="sp-cls" />);
    expect(container.querySelector("svg.sp-cls")).toBeTruthy();
  });

  it("renders VineDivider as SVG with aria-hidden", () => {
    const { container } = render(<VineDivider />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("VineDivider applies custom className", () => {
    const { container } = render(<VineDivider className="vine-cls" />);
    expect(container.querySelector("svg.vine-cls")).toBeTruthy();
  });

  it("renders ScatteredFlowers with multiple SVGs", () => {
    const { container } = render(<ScatteredFlowers />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("ScatteredFlowers applies custom className to container", () => {
    const { container } = render(<ScatteredFlowers className="scattered-cls" />);
    expect(container.firstElementChild?.classList.contains("scattered-cls")).toBe(true);
  });

  it("renders FlowerBullet as SVG", () => {
    const { container } = render(<FlowerBullet />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("FlowerBullet applies custom className", () => {
    const { container } = render(<FlowerBullet className="fb-cls" />);
    expect(container.querySelector("svg.fb-cls")).toBeTruthy();
  });

  it("renders FloralCartIcon as SVG", () => {
    const { container } = render(<FloralCartIcon />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("FloralCartIcon applies custom className", () => {
    const { container } = render(<FloralCartIcon className="cart-cls" />);
    expect(container.querySelector("svg.cart-cls")).toBeTruthy();
  });

  it("renders ButterflyAccent as SVG", () => {
    const { container } = render(<ButterflyAccent />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("ButterflyAccent applies custom className", () => {
    const { container } = render(<ButterflyAccent className="bf-cls" />);
    expect(container.querySelector("svg.bf-cls")).toBeTruthy();
  });

  it("renders MushroomAccent as SVG", () => {
    const { container } = render(<MushroomAccent />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("MushroomAccent applies custom className", () => {
    const { container } = render(<MushroomAccent className="mush-cls" />);
    expect(container.querySelector("svg.mush-cls")).toBeTruthy();
  });

  it("renders FloralBorder with aria-hidden", () => {
    const { container } = render(<FloralBorder />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
  });

  it("FloralBorder applies custom className", () => {
    const { container } = render(<FloralBorder className="border-cls" />);
    expect(
      container.firstElementChild?.classList.contains("border-cls"),
    ).toBe(true);
  });

  it("FloralBorder contains both full and simplified versions", () => {
    const { container } = render(<FloralBorder />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("all decorative SVGs are rendered without errors", () => {
    const { container } = render(
      <div>
        <FlowerAccent />
        <LeafAccent />
        <SparkleAccent />
        <VineDivider />
        <ScatteredFlowers />
        <FlowerBullet />
        <FloralCartIcon />
        <ButterflyAccent />
        <MushroomAccent />
        <FloralBorder />
      </div>,
    );
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(10);
  });
});
