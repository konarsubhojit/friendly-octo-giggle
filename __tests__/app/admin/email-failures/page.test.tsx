import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import EmailFailuresPage from "@/app/admin/email-failures/page";

let mockFailures = [
  {
    id: "fail-1",
    status: "pending",
    createdAt: new Date("2026-03-20T10:00:00.000Z"),
  },
  {
    id: "fail-2",
    status: "pending",
    createdAt: new Date("2026-03-19T10:00:00.000Z"),
  },
  {
    id: "fail-3",
    status: "failed",
    createdAt: new Date("2026-03-18T10:00:00.000Z"),
  },
];

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(mockFailures),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/components/admin/EmailFailuresClient", () => ({
  EmailFailuresClient: ({
    initialRecords,
  }: {
    initialRecords: Array<{ id: string }>;
  }) => <div>Email failures client: {initialRecords.length}</div>,
}));

describe("EmailFailuresPage", () => {
  it("renders queue metrics and the upgraded admin shell", async () => {
    render(await EmailFailuresPage());

    expect(
      screen.getByRole("heading", {
        name: "Email Failures",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Retry queue")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Email failures client: 3")).toBeInTheDocument();
  });
});
