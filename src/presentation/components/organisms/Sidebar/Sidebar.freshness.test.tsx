import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SidebarView } from "./Sidebar.view.tsx";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const shared = {
  accountCount: 2,
  currentPath: "/resumen",
  minDate: "2024-01-01" as const,
  maxDate: "2024-09-30" as const,
  onLock: vi.fn<() => void>(),
};

describe("Sidebar freshness", () => {
  it("separates transaction coverage, unzoned filename date, import instant and public revision", async () => {
    render(<SidebarView
      {...shared}
      source={{
        format: "myexpenses-backup",
        schemaVersion: 189,
        backupSha256: "a".repeat(64),
        databaseSha256: "b".repeat(64),
        backupFilenameTimestamp: "20240229140506",
        importedAt: "2026-09-27T14:15:16.123Z",
      }}
      appRevision={"c".repeat(40)}
    />);
    await userEvent.setup().click(screen.getByText("Datos"));
    expect(screen.getByText("Cobertura de movimientos")).toBeVisible();
    expect(screen.getByText("01/01/2024").closest("p")).toHaveTextContent("01/01/2024—30/09/2024");
    expect(screen.getByText(/Fecha del nombre.*no confirma la captura/)).toBeVisible();
    expect(screen.getByText(/29\/02\/2024 14:05:06.*zona no indicada/)).toBeVisible();
    expect(screen.getByText(/27\/09\/2026 14:15:16 UTC/)).toBeVisible();
    expect(screen.getByText("c".repeat(40))).toBeVisible();
  });

  it("shows unavailable evidence for legacy datasets and unknown builds", () => {
    render(<SidebarView {...shared} source={null} appRevision={null} />);
    expect(screen.getAllByText("No disponible")).toHaveLength(3);
    expect(screen.getByText("01/01/2024").closest("p")).toHaveTextContent("01/01/2024—30/09/2024");
  });
});
