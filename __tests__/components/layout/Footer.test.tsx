import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import Footer from "@/components/layout/Footer";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// NewsletterForm is rendered inside Footer; mock it to simplify
vi.mock("@/components/ui/NewsletterForm", () => ({
  default: () => <div data-testid="newsletter-form" />,
}));

describe("Footer", () => {
  it("renders company section heading", () => {
    render(<Footer />);
    expect(screen.getByText("Company")).toBeTruthy();
  });

  it("renders Products section heading", () => {
    render(<Footer />);
    expect(screen.getByText("Products")).toBeTruthy();
  });

  it("renders Support section heading", () => {
    render(<Footer />);
    expect(screen.getByText("Support")).toBeTruthy();
  });

  it("renders Connect section heading", () => {
    render(<Footer />);
    expect(screen.getByText("Connect")).toBeTruthy();
  });

  it("renders About Us link", () => {
    render(<Footer />);
    const link = screen.getByText("About Us").closest("a");
    expect(link?.getAttribute("href")).toBe("/about");
  });

  it("renders Contact Us link", () => {
    render(<Footer />);
    const link = screen.getByText("Contact Us").closest("a");
    expect(link?.getAttribute("href")).toBe("/contact");
  });

  it("renders social media links", () => {
    render(<Footer />);
    expect(screen.getByLabelText("Twitter")).toBeTruthy();
    expect(screen.getByLabelText("Facebook")).toBeTruthy();
    expect(screen.getByLabelText("Instagram")).toBeTruthy();
    expect(screen.getByLabelText("LinkedIn")).toBeTruthy();
  });

  it("renders social media links as external links with rel=noopener noreferrer", () => {
    render(<Footer />);
    const twitter = screen.getByLabelText("Twitter").closest("a");
    expect(twitter?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(twitter?.getAttribute("target")).toBe("_blank");
  });

  it("renders newsletter form", () => {
    render(<Footer />);
    expect(screen.getByTestId("newsletter-form")).toBeTruthy();
  });

  it("renders copyright text", () => {
    render(<Footer />);
    expect(screen.getByText(/Craft & Cozy/)).toBeTruthy();
  });
});
