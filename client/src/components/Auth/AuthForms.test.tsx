import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider } from "../../contexts/AuthContext";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it("submits login by keyboard and focuses an associated server error without losing input", async () => {
  const submission = deferred<Response>();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockReturnValueOnce(submission.promise);
  const user = userEvent.setup();
  await act(async () => {
    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );
  });
  const email = screen.getByLabelText("Email");
  const password = screen.getByLabelText("Password");
  await waitFor(() => expect(email).toBeEnabled());
  await act(async () => {
    await user.type(email, "writer@example.com");
    await user.type(password, "wrong-password");
    await user.keyboard("{Enter}");
  });

  expect(screen.getByRole("button", { name: "Logging in..." })).toBeDisabled();
  expect(email).toHaveValue("writer@example.com");
  expect(password).toHaveValue("wrong-password");

  submission.resolve(
    new Response(JSON.stringify({ detail: "Incorrect email or password" }), { status: 401 })
  );

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Incorrect email or password");
  expect(alert).toHaveFocus();
  expect(email).toHaveAccessibleDescription("Incorrect email or password");
  expect(password).toHaveAccessibleDescription("Incorrect email or password");
  expect(email).toHaveValue("writer@example.com");
  expect(password).toHaveValue("wrong-password");
  expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
});

it("offers autofill and submits a pending login only once", async () => {
  const submission = deferred<Response>();
  const onSuccess = vi.fn();
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockReturnValueOnce(submission.promise);
  render(
    <AuthProvider>
      <LoginForm onSuccess={onSuccess} />
    </AuthProvider>
  );
  const email = screen.getByLabelText("Email");
  const password = screen.getByLabelText("Password");
  await waitFor(() => expect(email).toBeEnabled());
  expect(email).toHaveAttribute("autocomplete", "email");
  expect(password).toHaveAttribute("autocomplete", "current-password");
  expect(email).toHaveFocus();
  fireEvent.change(email, { target: { value: "writer@example.com" } });
  fireEvent.change(password, { target: { value: "test-password" } });
  const form = screen.getByRole("form", { name: "Login" });

  await act(async () => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });

  expect(form).toHaveAttribute("aria-busy", "true");
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/auth/login"))).toHaveLength(
    1
  );
  await act(async () =>
    submission.resolve(
      new Response(JSON.stringify({ user: { id: "writer", email: "writer@example.com" } }))
    )
  );
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(form).toHaveAttribute("aria-busy", "false");
});

it("explains and focuses mismatched registration passwords without submitting them", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 401 }));
  const user = userEvent.setup();
  render(
    <AuthProvider>
      <RegisterForm />
    </AuthProvider>
  );
  const email = screen.getByLabelText("Email");
  const password = screen.getByLabelText("Password");
  const confirmation = screen.getByLabelText("Confirm Password");
  await waitFor(() => expect(email).toBeEnabled());
  await user.type(email, "writer@example.com");
  await user.type(password, "test-password");
  await user.type(confirmation, "different-password");
  await act(async () => {
    await user.keyboard("{Enter}");
  });

  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent("Passwords do not match");
  expect(alert).toHaveFocus();
  expect(password).toHaveAccessibleDescription(
    "Must be at least 8 characters Passwords do not match"
  );
  expect(confirmation).toHaveAccessibleDescription("Passwords do not match");
  expect(confirmation).toHaveValue("different-password");
  expect(
    fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/auth/register"))
  ).toHaveLength(0);
});

it("offers registration autofill and allows a single retry after a server error", async () => {
  const submission = deferred<Response>();
  const onSuccess = vi.fn();
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockReturnValueOnce(submission.promise);
  render(
    <AuthProvider>
      <RegisterForm onSuccess={onSuccess} />
    </AuthProvider>
  );
  const email = screen.getByLabelText("Email");
  const password = screen.getByLabelText("Password");
  const confirmation = screen.getByLabelText("Confirm Password");
  await waitFor(() => expect(email).toBeEnabled());
  expect(email).toHaveFocus();
  expect(email).toHaveAttribute("autocomplete", "email");
  expect(password).toHaveAttribute("autocomplete", "new-password");
  expect(confirmation).toHaveAttribute("autocomplete", "new-password");
  fireEvent.change(email, { target: { value: "writer@example.com" } });
  fireEvent.change(password, { target: { value: "test-password" } });
  fireEvent.change(confirmation, { target: { value: "test-password" } });
  const form = screen.getByRole("form", { name: "Register" });
  await act(async () => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });

  expect(screen.getByRole("button", { name: "Creating account..." })).toBeDisabled();
  expect(form).toHaveAttribute("aria-busy", "true");
  expect(
    fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/auth/register"))
  ).toHaveLength(1);
  await act(async () =>
    submission.resolve(
      new Response(JSON.stringify({ detail: "Email already registered" }), { status: 409 })
    )
  );
  const alert = screen.getByRole("alert");
  expect(alert).toHaveFocus();
  expect(email).toHaveAccessibleDescription("Email already registered");
  expect(password).toHaveValue("test-password");
  expect(confirmation).toHaveValue("test-password");
  expect(onSuccess).not.toHaveBeenCalled();

  fetchSpy.mockResolvedValueOnce(
    new Response(JSON.stringify({ user: { id: "writer", email: "writer@example.com" } }), {
      status: 201,
    })
  );
  await act(async () => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });

  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(form).toHaveAttribute("aria-busy", "false");
});
