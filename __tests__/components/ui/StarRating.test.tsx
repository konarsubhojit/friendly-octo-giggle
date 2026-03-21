import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StarRating } from "@/components/ui/StarRating";

describe("StarRating", () => {
  it("renders correct number of stars", () => {
    const { container } = render(<StarRating rating={3} maxStars={5} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(5);
  });

  it("fills stars based on rating", () => {
    const { container } = render(<StarRating rating={3} maxStars={5} />);
    const svgs = container.querySelectorAll("svg");
    const filledStars = Array.from(svgs).filter((svg) =>
      svg.classList.contains("text-amber-400"),
    );
    expect(filledStars).toHaveLength(3);
  });

  it("renders with default aria-label", () => {
    render(<StarRating rating={4} />);
    expect(
      screen.getByLabelText("Rating: 4 out of 5 stars"),
    ).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(<StarRating rating={3} label="Product rating" />);
    expect(screen.getByLabelText("Product rating")).toBeInTheDocument();
  });

  it("renders interactive buttons when interactive is true", () => {
    const onChange = vi.fn();
    const { container } = render(
      <StarRating rating={2} interactive onChange={onChange} />,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(5);
  });

  it("calls onChange with correct value when clicked", () => {
    const onChange = vi.fn();
    const { container } = render(
      <StarRating rating={0} interactive onChange={onChange} />,
    );
    const buttons = container.querySelectorAll("button");
    fireEvent.click(buttons[3]); // Click 4th star
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("uses group role for interactive mode", () => {
    render(<StarRating rating={2} interactive />);
    const group = screen.getByRole("group");
    expect(group).toBeInTheDocument();
  });

  it("applies correct size class", () => {
    const { container } = render(<StarRating rating={1} size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("w-7")).toBe(true);
  });
});
