import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthenticatedEntry } from "./AuthenticatedEntry";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it("shows confirmed server sign out separately from failed local preservation and keeps writing visible", async () => {
  let confirm!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    confirm = resolve;
  });
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "account-a", email: "a@example.com" }))
    )
    .mockReturnValueOnce(response);
  let rejectStorage = false;
  function Writing() {
    const { registerSnapshot } = useAuth();
    useEffect(
      () =>
        registerSnapshot(() => {
          if (rejectStorage) throw new Error("Storage full");
        }),
      [registerSnapshot]
    );
    return <textarea aria-label="Writing" defaultValue="Only memory writing" />;
  }
  render(
    <AuthProvider>
      <AuthenticatedEntry>
        <Writing />
      </AuthenticatedEntry>
    </AuthProvider>
  );
  await screen.findByRole("textbox", { name: "Writing" });
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Writing" }), {
    target: { value: "Latest only memory writing" },
  });
  rejectStorage = true;
  confirm(new Response(null, { status: 204 }));
  await waitFor(() =>
    expect(
      screen.getByText("Server sign out is confirmed. Keep this page open to recover your writing.")
    ).toBeVisible()
  );
  expect(screen.getByRole("textbox", { name: "Writing" })).toHaveValue(
    "Latest only memory writing"
  );
  expect(screen.queryByText(/Sign out is not confirmed/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check session again" })).toBeEnabled();
});
