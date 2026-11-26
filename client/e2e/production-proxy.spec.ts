import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { openHeaderMenu } from "./helpers/waitHelpers";

test("production Nginx reaches Web health and preserves the WeChat session path", async ({
  request,
}) => {
  const site = await request.get("/health");
  expect(site.status()).toBe(200);
  expect(await site.text()).toBe("healthy\n");

  const api = await request.get("/api/health");
  expect(api.status()).toBe(200);
  expect(await api.json()).toMatchObject({ service: "impetus-lock", status: "ok" });

  const database = await request.get("/api/health/db");
  expect(database.status()).toBe(200);
  expect(await database.json()).toMatchObject({ is_healthy: true });

  // FastAPI validates this route's session body without contacting WeChat.
  const session = await request.post("/api/wechat/session", { data: {} });
  expect(session.status()).toBe(422);
  expect(await session.json()).toMatchObject({
    error: {
      code: "VALIDATION_ERROR",
      details: { errors: [{ field: "body.code", type: "missing" }] },
    },
  });
});

test("production API allows only the configured split Web origin", async ({ request }) => {
  const api = process.env.PRODUCTION_SMOKE_API_URL;
  expect(api).toBeTruthy();
  const path = new URL("/tasks/", api).href;
  const preflight = (origin: string) =>
    request.fetch(path, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-CSRF-Token",
      },
    });

  const allowed = await preflight("https://writer.example");
  expect(allowed.status()).toBe(200);
  expect(allowed.headers()["access-control-allow-origin"]).toBe("https://writer.example");
  expect(allowed.headers()["access-control-allow-credentials"]).toBe("true");

  const denied = await preflight("https://other.example");
  expect(denied.status()).toBe(400);
  expect(denied.headers()["access-control-allow-origin"]).toBeUndefined();
});

test("compiled editor authenticates and saves via the proxy with dev tools hidden", async ({
  page,
  baseURL,
}) => {
  function responseFor(path: string, method = "GET") {
    return page.waitForResponse(
      (response) =>
        new URL(response.url()).origin === baseURL &&
        new URL(response.url()).pathname === path &&
        response.request().method() === method,
      { timeout: 10_000 }
    );
  }

  await page.addInitScript(() => {
    localStorage.setItem("impetus-lock-welcome-dismissed", "true");
  });
  const session = responseFor("/api/auth/me");
  await page.goto("/");
  await expect(page).toHaveTitle("Impetus Lock");
  expect((await session).status()).toBe(401);

  await page.getByRole("button", { name: "Register", exact: true }).click();
  const form = page.getByRole("form", { name: "Register", exact: true });
  const password = "production-smoke-fixture!";
  await form.getByLabel("Email", { exact: true }).fill(`smoke-${randomUUID()}@example.com`);
  await form.getByLabel("Password", { exact: true }).fill(password);
  await form.getByLabel("Confirm Password").fill(password);
  const registration = responseFor("/api/auth/register", "POST");
  await form.getByRole("button", { name: "Register", exact: true }).click();
  expect((await registration).status()).toBe(201);

  const cookies = await page.context().cookies();
  expect(cookies).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "access_token", httpOnly: true, secure: true }),
      expect.objectContaining({ name: "csrf_token", httpOnly: false, secure: true }),
    ])
  );

  const editor = page.locator(".ProseMirror[contenteditable=true]");
  await expect(editor).toBeVisible();
  await openHeaderMenu(page);
  await expect(page.getByTestId("header-dev-region")).toHaveCount(0);
  await expect(page.getByTestId("manual-delete-trigger")).toHaveCount(0);
  await page.keyboard.press("Escape");

  const content = "Production smoke draft";
  const saving = page.waitForResponse((response) => {
    const url = new URL(response.url());
    const request = response.request();
    if (
      url.origin !== baseURL ||
      !/^\/api\/tasks(?:\/[^/]+)?\/?$/.test(url.pathname) ||
      !["POST", "PUT"].includes(request.method())
    )
      return false;
    const draft = request.postDataJSON() as { content?: string } | null;
    return draft?.content?.includes(content) === true;
  });
  await editor.fill(content);
  const saved = await saving;
  expect(saved.status()).toBe(saved.request().method() === "POST" ? 201 : 200);
  expect(saved.request().headers()["x-csrf-token"]).toBe(
    cookies.find((cookie) => cookie.name === "csrf_token")?.value
  );
  expect(await saved.json()).toMatchObject({ content: expect.stringContaining(content) });

  const listing = responseFor("/api/tasks/");
  await page.reload({ waitUntil: "domcontentloaded" });
  const listed = await listing;
  expect(listed.status()).toBe(200);
  expect(await listed.json()).toMatchObject({
    tasks: expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining(content) }),
    ]),
  });
  await expect(page.getByRole("heading", { name: content, exact: true })).toBeVisible();
});
