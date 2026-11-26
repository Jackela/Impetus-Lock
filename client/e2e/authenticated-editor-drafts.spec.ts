import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import type { TaskRecord } from "../src/services/api/taskClient";
import type { DraftSnapshot } from "../src/services/draftStore";
import { openHeaderDevTools, openHeaderMenu } from "./helpers/waitHelpers";

const API = "http://127.0.0.1:8001";
const editor = (page: Page) => page.locator(".ProseMirror[contenteditable='true']");

async function dismissWelcome(page: Page): Promise<void> {
  await expect(editor(page)).toBeVisible();
  const close = page.getByRole("button", { name: "Close welcome modal" });
  if (await close.isVisible()) await close.click();
}

async function register(page: Page): Promise<string> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Register", exact: true }).click();
  const form = page.getByRole("form", { name: "Register", exact: true });
  await form.getByLabel("Email", { exact: true }).fill(`drafts-${randomUUID()}@example.com`);
  const password = "localAuthPass!2026";
  await form.getByLabel("Password", { exact: true }).fill(password);
  await form.getByLabel("Confirm Password", { exact: true }).fill(password);
  const submit = async () => {
    const response = page.waitForResponse(
      (reply) =>
        new URL(reply.url()).pathname === "/auth/register" && reply.request().method() === "POST"
    );
    await form.getByRole("button", { name: "Register", exact: true }).click();
    return response;
  };
  let response = await submit();
  if (response.status() === 429) {
    const retryAfter = Number(response.headers()["retry-after"] ?? 60);
    await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
    response = await submit();
  }
  expect(response.status()).toBe(201);
  const registered = (await response.json()) as { user: { id: string } };
  await dismissWelcome(page);
  await expect(page.locator(".task-status")).toHaveText("Saved");
  return registered.user.id;
}

async function taskRequest(
  page: Page,
  userId: string,
  options: { id: string } | { content: string }
): Promise<TaskRecord> {
  return page.evaluate(
    async ({ api, owner, request }) => {
      const headers: Record<string, string> = { "X-Expected-User-ID": owner };
      const path = "id" in request ? `/tasks/${request.id}` : "/tasks";
      const init: RequestInit = { credentials: "include", headers };
      if ("content" in request) {
        const csrf = document.cookie.split("; ").find((cookie) => cookie.startsWith("csrf_token="));
        if (!csrf) throw new Error("Registration did not set a CSRF cookie");
        headers["X-CSRF-Token"] = csrf.slice("csrf_token=".length);
        headers["Content-Type"] = "application/json";
        init.method = "POST";
        init.body = JSON.stringify({ content: request.content, lock_ids: [] });
      }
      const response = await fetch(`${api}${path}`, init);
      if (!response.ok) throw new Error(`Real task request failed: ${response.status}`);
      return response.json() as Promise<TaskRecord>;
    },
    { api: API, owner: userId, request: options }
  );
}

async function addLocalLock(page: Page, text: string, lockId: string): Promise<void> {
  // Stub generation at the HTTP boundary. The editor applies its real lock transaction.
  await page.route("**/impetus/generate-intervention", (route) =>
    route.fulfill({
      json: {
        action: "provoke",
        content: text,
        lock_id: lockId,
        source: "loki",
        anchor: { type: "pos", from: 1 },
      },
    })
  );
  await openHeaderMenu(page);
  await page.getByTestId("llm-settings-trigger").click();
  await page.getByTestId("storage-mode-select").selectOption("session");
  await page.getByTestId("llm-key-input").fill("sk-local-draft-test");
  await page.getByTestId("llm-settings-save").click();
  await page.getByTestId("mode-selector").selectOption("loki");
  await openHeaderDevTools(page);
  await page.getByTestId("manual-loki-trigger").click();
  await expect(editor(page).locator(`[data-lock-id="${lockId}"]`)).toContainText(text);
  await page.getByTestId("mode-selector").selectOption("off");
}

async function selectTask(page: Page, task: TaskRecord): Promise<void> {
  const sidebar = page.getByTestId("task-sidebar");
  if (!(await sidebar.isVisible())) {
    await openHeaderMenu(page);
    await page.getByTestId("task-list-toggle").click();
  }
  await sidebar.getByTestId(`task-item-${task.id}`).click();
  await expect(sidebar.getByTestId(`task-item-${task.id}`)).toHaveAttribute("aria-current", "true");
}

async function localCopy(
  page: Page,
  owner: string,
  lock: string
): Promise<DraftSnapshot | undefined> {
  return page.evaluate(
    ({ userId, lockId }) => {
      const prefix = `impetus.draft.${encodeURIComponent(userId)}.`;
      return Object.entries(localStorage)
        .filter(([key]) => key.startsWith(prefix))
        .map(([, raw]) => JSON.parse(raw) as DraftSnapshot)
        .find((snapshot) => snapshot.dirty && snapshot.lockIds.includes(lockId));
    },
    { userId: owner, lockId: lock }
  );
}

async function blockSaves(page: Page, id: string): Promise<void> {
  await page.route(`**/tasks/${id}`, (route) =>
    route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.continue()
  );
}

test("two tabs keep their own unsent writing and locks after switching tasks and refreshing", async ({
  page,
}) => {
  const userId = await register(page);
  const taskA = await taskRequest(page, userId, { content: "Starting prose for task A" });
  const taskB = await taskRequest(page, userId, { content: "Selected writing for task B" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await dismissWelcome(page);
  await selectTask(page, taskA);
  await expect(page.locator(".task-status")).toHaveText("Saved");
  // An opener copies sessionStorage into the second tab. The copies must fork on edit.
  const opened = page.waitForEvent("popup");
  await page.evaluate(() => {
    window.open(location.href, "_blank");
  });
  const sibling = await opened;
  for (const writer of [page, sibling]) {
    await dismissWelcome(writer);
    await selectTask(writer, taskA);
    await expect(editor(writer)).toContainText(taskA.content);
    await expect(writer.locator(".task-status")).toHaveText("Saved");
    // Keep only A's writes offline; reload, authentication and task reads use the real backend.
    await blockSaves(writer, taskA.id);
  }
  await addLocalLock(page, "First tab's unique writing", "first_tab_lock");
  await expect
    .poll(() => localCopy(page, userId, "first_tab_lock"))
    .toMatchObject({
      taskId: taskA.id,
      version: taskA.version,
      versionKnown: true,
      content: expect.stringContaining("First tab's unique writing"),
      lockIds: ["first_tab_lock"],
    });
  await selectTask(page, taskB);
  await expect(editor(page)).toContainText(taskB.content);
  await expect(page.locator(".task-status")).toHaveText("Saved");
  await addLocalLock(sibling, "Second tab's newer writing", "second_tab_lock");
  await expect
    .poll(() => localCopy(sibling, userId, "second_tab_lock"))
    .toMatchObject({
      taskId: taskA.id,
      version: taskA.version,
      versionKnown: true,
      content: expect.stringContaining("Second tab's newer writing"),
      lockIds: ["second_tab_lock"],
    });
  await page.reload({ waitUntil: "domcontentloaded" });
  await dismissWelcome(page);
  await expect(editor(page)).toContainText(taskB.content);
  await expect(page.locator(".task-status")).toHaveText("Saved");
  await selectTask(page, taskA);
  await expect(editor(page).locator('[data-lock-id="first_tab_lock"]')).toContainText(
    "First tab's unique writing"
  );
  await expect(editor(page)).not.toContainText("Second tab's newer writing");
  expect(await taskRequest(page, userId, { id: taskA.id })).toMatchObject({
    content: taskA.content,
    version: taskA.version,
    lock_ids: [],
  });

  await page.unroute(`**/tasks/${taskA.id}`);
  const retried = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/tasks/${taskA.id}` &&
      response.request().method() === "PUT"
  );
  await page.getByRole("button", { name: "Retry draft recovery" }).click();
  expect((await retried).status()).toBe(200);
  const saved = await taskRequest(page, userId, { id: taskA.id });
  expect(saved).toMatchObject({
    content: expect.stringContaining("First tab's unique writing"),
    version: taskA.version + 1,
    lock_ids: ["first_tab_lock"],
  });
  expect(saved.content).not.toContain("Second tab's newer writing");
  await expect(editor(sibling).locator('[data-lock-id="second_tab_lock"]')).toContainText(
    "Second tab's newer writing"
  );
});
