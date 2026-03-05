import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import DeleteConfirmModal from "@/components/admin/DeleteConfirmModal";

describe("DeleteConfirmModal", () => {
  it("renders the modal with heading and message", () => {
    render(
      <DeleteConfirmModal
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Confirm Delete")).toBeTruthy();
    expect(
      screen.getByText(/Are you sure you want to delete this product/),
    ).toBeTruthy();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <DeleteConfirmModal
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when Delete is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmModal
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("disables buttons when loading=true", () => {
    render(
      <DeleteConfirmModal
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        loading={true}
      />,
    );
    const cancelButton = screen.getByText("Cancel").closest("button");
    expect(cancelButton?.disabled).toBe(true);
  });

  it("shows loading spinner text when loading=true", () => {
    render(
      <DeleteConfirmModal
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        loading={true}
      />,
    );
    expect(screen.getByText("Deleting...")).toBeTruthy();
  });

  it("shows Delete text when loading=false", () => {
    render(
      <DeleteConfirmModal
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByText("Delete")).toBeTruthy();
  });
});
