import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UsersTable } from "@/components/admin/UsersTable";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

const users = [
  {
    id: "user-1",
    name: "Asha",
    email: "asha@example.com",
    image: null,
    role: "CUSTOMER",
    orderCount: 4,
    createdAt: "2026-03-01T10:00:00.000Z",
  },
];

describe("UsersTable", () => {
  it("renders user rows and table headers", () => {
    render(
      <UsersTable users={users} updatingUserId={null} onRoleChange={vi.fn()} />,
    );

    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("asha@example.com")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("confirms and forwards role changes", async () => {
    const onRoleChange = vi.fn();

    render(
      <UsersTable
        users={users}
        updatingUserId={null}
        onRoleChange={onRoleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Change role for Asha"), {
      target: { value: "ADMIN" },
    });

    expect(screen.getByText("Change User Role")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Yes, change role"));

    await waitFor(() => {
      expect(onRoleChange).toHaveBeenCalledWith("user-1", "ADMIN");
    });
  });
});
