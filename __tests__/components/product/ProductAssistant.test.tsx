import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductAssistant from "@/components/product/ProductAssistant";

const mockSendMessage = vi.fn();
const mockStop = vi.fn();

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: mockSendMessage,
    status: "ready",
    stop: mockStop,
  })),
}));

vi.mock("ai", () => ({
  DefaultChatTransport: class MockTransport {
    api: string;
    constructor(opts: { api: string }) {
      this.api = opts.api;
    }
  },
}));

describe("ProductAssistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders collapsed state with open button", () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />);
    expect(
      screen.getByRole("button", {
        name: "Ask a question about Test Product",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Ask about this product")).toBeTruthy();
  });

  it("expands when clicked", () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ask a question about Test Product",
      }),
    );
    expect(screen.getByText("Product Assistant")).toBeTruthy();
  });

  it("renders starter prompts when expanded", () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ask a question about Test Product",
      }),
    );
    expect(screen.getByText("Is this product in stock?")).toBeTruthy();
    expect(screen.getByText("What variations are available?")).toBeTruthy();
    expect(screen.getByText("Tell me more about this product")).toBeTruthy();
  });

  it("calls sendMessage when a starter prompt is clicked", () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ask a question about Test Product",
      }),
    );
    fireEvent.click(screen.getByText("Is this product in stock?"));
    expect(mockSendMessage).toHaveBeenCalledWith({
      text: "Is this product in stock?",
    });
  });

  it("has a textarea for typing questions", () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ask a question about Test Product",
      }),
    );
    expect(screen.getByLabelText("Type your question")).toBeTruthy();
  });

  it("can close the assistant", () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ask a question about Test Product",
      }),
    );
    expect(screen.getByText("Product Assistant")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close assistant"));
    expect(
      screen.getByRole("button", {
        name: "Ask a question about Test Product",
      }),
    ).toBeTruthy();
  });
});
