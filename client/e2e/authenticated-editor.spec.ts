import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TaskRecord } from "../src/services/api/taskClient";

const API = "http://127.0.0.1:8001";
const UI = "http://127.0.0.1:3000";
const PASSWORD = "localAuthPass!2026";
const evidence = resolve("../.scratch/authenticated-editor-entry-2026-10-07");
type Storage = Awaited<ReturnType<BrowserContext["storageState"]>>;
type Account = { email: string; id: string; storage: Storage };
let alice: Account;
let bob: Account;
const contexts: BrowserContext[] = [];
let loginAttempts: number[] = [];

function protectedPath(url: string): boolean {
  return /\/(tasks|stats|achievements|style|impetus)(\/|\?|$)/.test(new URL(url).pathname);
}

async function makePage(browser: Browser, account?: Account, narrow = false): Promise<Page> {
  const context = await browser.newContext({
    baseURL: UI,
    storageState: account ? { cookies: account.storage.cookies, origins: [] } : undefined,
    viewport: narrow ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  contexts.push(context);
  // Every AI call is stopped at the HTTP boundary; no provider or paid model is used.
  await context.route("**/impetus/generate-intervention", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "provoke",
        content: "Controlled browser constraint",
        lock_id: "lock_browser_default",
        source: "loki",
        anchor: { type: "pos", from: 1 },
      }),
    })
  );
  return context.newPage();
}

async function dismissWelcome(page: Page): Promise<void> {
  const close = page.getByRole("button", { name: "Close welcome modal" });
  if (await close.isVisible()) await close.click();
}

async function captureBrowser(page: Page, filename: string): Promise<void> {
  // Capture actual Chromium pixels without waiting on an external font service.
  // No DOM, CSS, font response, or browser security setting is changed.
  const session = await page.context().newCDPSession(page);
  try {
    const { cssContentSize } = await session.send("Page.getLayoutMetrics");
    const { data } = await session.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
    });
    await writeFile(resolve(evidence, filename), Buffer.from(data, "base64"));
  } finally {
    await session.detach();
  }
}

async function ready(page: Page): Promise<void> {
  await expect(page.getByTestId("app-root")).toBeVisible();
  await dismissWelcome(page);
  await expect(page.locator(".ProseMirror[contenteditable='true']")).toBeVisible();
  await expect(page.locator(".task-status")).toHaveText("Saved");
}

async function register(page: Page, email: string): Promise<Account> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Register", exact: true }).click();
  const form = page.getByRole("form", { name: "Register", exact: true });
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await form.getByLabel("Confirm Password", { exact: true }).fill(PASSWORD);
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/auth/register" && r.request().method() === "POST"
  );
  await form.getByRole("button", { name: "Register", exact: true }).click();
  const registered = await response;
  expect(registered.status()).toBe(201);
  const data = (await registered.json()) as { user: { id: string; email: string } };
  await ready(page);
  await expect(page.locator(".account-bar")).toContainText(email);
  return { email, id: data.user.id, storage: await page.context().storageState() };
}

async function login(
  page: Page,
  account: Pick<Account, "email">,
  password = PASSWORD
): Promise<void> {
  await waitForLoginWindow(page);
  const form = page.getByRole("form", { name: "Login", exact: true });
  await form.getByLabel("Email", { exact: true }).fill(account.email);
  await form.getByLabel("Password", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Login", exact: true }).click();
}

async function waitForLoginWindow(page: Page): Promise<void> {
  // Respect the real five-per-minute endpoint policy without modifying it.
  loginAttempts = loginAttempts.filter((attempt) => Date.now() - attempt < 60_500);
  if (loginAttempts.length >= 5) {
    const until = loginAttempts[0]! + 60_500;
    while (Date.now() < until) await page.waitForTimeout(Math.min(30_000, until - Date.now()));
    loginAttempts = loginAttempts.filter((attempt) => Date.now() - attempt < 60_500);
  }
  loginAttempts.push(Date.now());
}

async function tasks(page: Page): Promise<TaskRecord[]> {
  return page.evaluate(async (api) => {
    const response = await fetch(`${api}/tasks/`, { credentials: "include" });
    if (!response.ok) throw new Error(`Real task read failed: ${response.status}`);
    const body = (await response.json()) as { tasks: TaskRecord[] };
    return body.tasks;
  }, API);
}

async function savedText(page: Page, text: string): Promise<TaskRecord> {
  await expect
    .poll(async () => (await tasks(page)).some((task) => task.content.includes(text)))
    .toBe(true);
  return (await tasks(page)).find((task) => task.content.includes(text))!;
}

async function write(page: Page, text: string): Promise<TaskRecord> {
  await page.locator(".ProseMirror").fill(text);
  return savedText(page, text);
}

async function prefixWriting(page: Page, text: string): Promise<void> {
  const editor = page.locator(".ProseMirror");
  // Place the native contenteditable caret in the writer's last paragraph.
  // This avoids platform-specific Home shortcuts and never calls editor internals.
  await editor.evaluate((element) => {
    (element as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(element.lastElementChild ?? element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.insertText(text);
}

async function configureAI(page: Page): Promise<void> {
  await page.getByTestId("llm-settings-trigger").click();
  await page.getByTestId("storage-mode-select").selectOption("session");
  await page.getByTestId("llm-key-input").fill("sk-local-auth-contract-key-only");
  await page.getByTestId("llm-settings-save").click();
  await page.getByTestId("mode-selector").selectOption("loki");
}

async function addLock(page: Page, text: string, lockId: string): Promise<void> {
  await page.route("**/impetus/generate-intervention", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "provoke",
        content: text,
        lock_id: lockId,
        source: "loki",
        anchor: { type: "pos", from: 1 },
      }),
    })
  );
  await configureAI(page);
  await page.getByTestId("manual-loki-trigger").click();
  await expect(page.locator(".ProseMirror")).toContainText(text);
  await savedText(page, text);
  await page.getByTestId("mode-selector").selectOption("off");
}

async function expire(page: Page): Promise<void> {
  await page.context().clearCookies({ name: "access_token" });
  await page.getByTestId("stats-toggle").click();
  await expect(page.getByRole("region", { name: "Session status" })).toContainText(
    "Session expired"
  );
  await expect(page.locator(".task-status")).toHaveText("Writing locally");
}

async function signOut(page: Page): Promise<void> {
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/auth/logout");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  expect((await response).status()).toBe(204);
  await expect(page.getByRole("form", { name: "Login", exact: true })).toBeVisible();
}

async function updateServer(
  page: Page,
  task: TaskRecord,
  content: string,
  lockIds: string[]
): Promise<TaskRecord> {
  return page.evaluate(
    async ({ api, task, content, lockIds }) => {
      const csrf = document.cookie
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("csrf_token="))
        ?.slice(11);
      const response = await fetch(`${api}/tasks/${task.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf ?? "" },
        body: JSON.stringify({ content, lock_ids: lockIds, version: task.version }),
      });
      if (!response.ok) throw new Error(`Real CSRF task update failed: ${response.status}`);
      return response.json() as Promise<TaskRecord>;
    },
    { api: API, task, content, lockIds }
  );
}

async function createServerTask(
  page: Page,
  content: string,
  lockIds: string[] = []
): Promise<TaskRecord> {
  return page.evaluate(
    async ({ api, content, lockIds }) => {
      const csrf = document.cookie
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("csrf_token="))
        ?.slice(11);
      const response = await fetch(`${api}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf ?? "" },
        body: JSON.stringify({ content, lock_ids: lockIds }),
      });
      if (!response.ok) throw new Error(`Real task creation failed: ${response.status}`);
      return response.json() as Promise<TaskRecord>;
    },
    { api: API, content, lockIds }
  );
}

async function lockedRange(
  page: Page,
  lockId: string
): Promise<{ type: "range"; from: number; to: number }> {
  return page
    .locator(`.ProseMirror .locked-content[data-lock-id="${lockId}"]`)
    .evaluate((element) => {
      // Read the actual rendered node position for the controlled HTTP response.
      // The browser does not mutate the editor document through this descriptor.
      const descriptor = (
        element as HTMLElement & {
          pmViewDesc?: { posBefore: number; node?: { nodeSize: number }; size: number };
        }
      ).pmViewDesc;
      if (!descriptor) throw new Error("Rendered locked node has no ProseMirror descriptor");
      const from = descriptor.posBefore;
      const to = from + (descriptor.node?.nodeSize ?? descriptor.size);
      if (!Number.isInteger(from) || to <= from)
        throw new Error("Invalid rendered locked node range");
      return { type: "range" as const, from, to };
    });
}

async function releaseRoute(route: Route, body: string): Promise<void> {
  await route.fulfill({ status: 200, contentType: "application/json", body }).catch(() => {});
}

test.beforeAll(async ({ browser }) => {
  alice = await register(await makePage(browser), `browser-alice-${randomUUID()}@example.com`);
  bob = await register(await makePage(browser), `browser-bob-${randomUUID()}@example.com`);
  for (const context of contexts.splice(0)) await context.close();
});

test.afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
});

test("old account task survives the real backend restart with exact content locks and version", async ({
  browser,
}) => {
  const old = JSON.parse(
    await readFile(resolve(evidence, "browser-persisted-before-restart.json"), "utf8")
  ) as { email: string; taskId: string; content: string; lockIds: string[]; version: number };
  const page = await makePage(browser);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await login(page, old);
  await ready(page);
  const persisted = await page.evaluate(
    async ({ api, id }) => {
      const response = await fetch(`${api}/tasks/${id}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Task after backend restart failed: ${response.status}`);
      return response.json() as Promise<TaskRecord>;
    },
    { api: API, id: old.taskId }
  );
  expect(persisted.id).toBe(old.taskId);
  expect(persisted.content).toBe(old.content);
  expect(persisted.lock_ids).toEqual(old.lockIds);
  expect(persisted.version).toBe(old.version);
  await page.getByTestId(`task-item-${old.taskId}`).click();
  await expect(page.locator(".ProseMirror")).toContainText("Protected browser lock");
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true");
  await writeFile(
    resolve(evidence, "browser-restart-durability.json"),
    JSON.stringify(
      {
        email: old.email,
        taskId: persisted.id,
        exactContent: persisted.content === old.content,
        exactLocks: JSON.stringify(persisted.lock_ids) === JSON.stringify(old.lockIds),
        exactVersion: persisted.version === old.version,
        selectedInRealUI: true,
      },
      null,
      2
    )
  );
});

test("initial me waits for the real server before any protected work; cookie is HttpOnly", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  let meRoute: Route | undefined;
  const work: string[] = [];
  page.on("request", (request) => {
    if (protectedPath(request.url())) work.push(request.url());
  });
  await page.route("**/auth/me", (route) => {
    meRoute = route;
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status")).toHaveText("Checking your session…");
  expect(work).toEqual([]);
  await expect.poll(() => Boolean(meRoute)).toBe(true);
  await meRoute!.continue();
  await ready(page);
  expect(work.length).toBeGreaterThan(0);
  const cookies = await page.context().cookies(API);
  expect(cookies.find((cookie) => cookie.name === "access_token")?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain("access_token=");
  const bar = await page.locator(".account-bar").boundingBox();
  const header = await page.locator(".app-header").boundingBox();
  expect(bar).not.toBeNull();
  expect(header).not.toBeNull();
  expect(header!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
  await captureBrowser(page, "browser-editor-wide.png");
});

test("narrow authenticated editor keeps long account identity controls and normal footer click accessible", async ({
  browser,
}) => {
  const page = await makePage(browser, alice, true);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const bar = await page.locator(".account-bar").boundingBox();
  const header = await page.locator(".app-header").boundingBox();
  expect(bar).not.toBeNull();
  expect(header).not.toBeNull();
  expect(header!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
  await expect(page.locator(".account-bar")).toContainText(alice.email);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await captureBrowser(page, "browser-editor-narrow-drawer-open.png");
  // The drawer occupies the main writing region; surrounding controls stay usable.
  await expect(page.getByTestId("task-sidebar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  const firstTask = page.locator(".task-list-item-button").first();
  const firstId = await firstTask.getAttribute("data-task-id");
  await firstTask.click();
  await expect(page.getByTestId(`task-item-${firstId}`)).toHaveAttribute("aria-selected", "true");
  await ready(page);
  const [openDrawerDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".export-panel").getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  expect(openDrawerDownload.suggestedFilename()).toMatch(/^impetus-export-.*\.md$/);
  await page.getByTestId("task-list-toggle").click();
  await expect(page.getByTestId("task-sidebar")).toHaveCount(0);
  await write(page, `Narrow real writing ${randomUUID()}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".export-panel").getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^impetus-export-.*\.md$/);
  await page.locator(".account-bar").scrollIntoViewIfNeeded();
  await captureBrowser(page, "browser-editor-narrow.png");
});

test("real anonymous me401 shows keyboard accessible login without protected requests", async ({
  browser,
}) => {
  const page = await makePage(browser, undefined, true);
  const work: string[] = [];
  page.on("request", (request) => {
    if (protectedPath(request.url())) work.push(request.url());
  });
  const me = page.waitForResponse((r) => new URL(r.url()).pathname === "/auth/me");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect((await me).status()).toBe(401);
  await expect(page.getByRole("form", { name: "Login", exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeFocused();
  expect(work).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await captureBrowser(page, "browser-login-narrow.png");
});

for (const fault of ["network", "503"] as const) {
  test(`me ${fault} preserves a retryable error and starts no protected work`, async ({
    browser,
  }) => {
    const page = await makePage(browser, alice);
    const work: string[] = [];
    page.on("request", (request) => {
      if (protectedPath(request.url())) work.push(request.url());
    });
    await page.route("**/auth/me", (route) =>
      fault === "network"
        ? route.abort("failed")
        : route.fulfill({ status: 503, body: "Unavailable" })
    );
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Retry session check" })).toBeVisible();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(work).toEqual([]);
    await page.unroute("**/auth/me");
    await page.getByRole("button", { name: "Retry session check" }).click();
    await ready(page);
  });
}

test("real login rejects wrong credentials and keyboard retry authenticates the same account", async ({
  browser,
}) => {
  const page = await makePage(browser);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await login(page, alice, "incorrectPassword!2026");
  await expect(page.getByRole("alert")).toContainText(/invalid|incorrect|failed/i);
  await expect(page.getByRole("alert")).toBeFocused();
  const form = page.getByRole("form", { name: "Login", exact: true });
  await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await waitForLoginWindow(page);
  await form.getByLabel("Password", { exact: true }).press("Enter");
  await ready(page);
  await expect(page.locator(".account-bar")).toContainText(alice.email);
});

test("real registration rejects duplicate account and keeps recoverable form state", async ({
  browser,
}) => {
  const page = await makePage(browser);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Register", exact: true }).click();
  const form = page.getByRole("form", { name: "Register", exact: true });
  await form.getByLabel("Email", { exact: true }).fill(alice.email);
  await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await form.getByLabel("Confirm Password", { exact: true }).fill(PASSWORD);
  await form.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/already|registered|exists/i);
  await expect(form.getByLabel("Email", { exact: true })).toHaveValue(alice.email);
  await expect(page.getByTestId("app-root")).toHaveCount(0);
});

test("real autosave, reload and keyboard delete preserve prose locks", async ({ browser }) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const text = `Browser persisted ${randomUUID()}`;
  await write(page, text);
  const lock = `lock_browser_${randomUUID()}`;
  await addLock(page, "Protected browser lock", lock);
  const record = await savedText(page, "Protected browser lock");
  expect(record.lock_ids).toContain(lock);
  await writeFile(
    resolve(evidence, "browser-persisted-sample.json"),
    JSON.stringify(
      {
        email: alice.email,
        taskId: record.id,
        content: record.content,
        lockIds: record.lock_ids,
        version: record.version,
      },
      null,
      2
    )
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await expect(page.locator(".ProseMirror")).toContainText(text);
  await expect(page.locator(".ProseMirror")).toContainText("Protected browser lock");
  const before = await page.locator(".ProseMirror").innerText();
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await expect.poll(() => page.locator(".ProseMirror").innerText()).toBe(before);
  expect((await tasks(page)).find((task) => task.id === record.id)?.lock_ids).toContain(lock);
});

test("logout204 removes the workspace and refresh stays anonymous", async ({ browser }) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  await write(page, `Logout retained ${randomUUID()}`);
  await signOut(page);
  expect(
    (await page.context().cookies(API)).find((cookie) => cookie.name === "access_token")
  ).toBeUndefined();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("form", { name: "Login", exact: true })).toBeVisible();
});

test("clicking the current task twice preserves editor readiness and real autosave", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const text = `Current selected ${randomUUID()}`;
  const record = await write(page, text);
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  const item = page.getByTestId(`task-item-${record.id}`);
  await item.click();
  await item.click();
  await prefixWriting(page, "After repeated selection ");
  const saved = await savedText(page, "After repeated selection");
  expect(saved.id).toBe(record.id);
});

test("task selection storage read failure retains actual A and explicit retry loads requested B", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const textA = `Retained storage A ${randomUUID()}`;
  const recordA = await write(page, textA);
  const textB = `Requested storage B ${randomUUID()}`;
  const recordB = await createServerTask(page, textB);
  const draftId = `storage_B_${randomUUID()}`;
  const key = `impetus.draft.${encodeURIComponent(alice.id)}.${encodeURIComponent(draftId)}`;
  await page.evaluate(
    ({ key, draftId, record }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          draftId,
          content: record.content,
          lockIds: record.lock_ids,
          taskId: record.id,
          version: record.version,
          versionKnown: true,
          dirty: false,
          updatedAt: 1,
        })
      );
    },
    { key, draftId, record: recordB }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await expect(page.locator(".ProseMirror")).toContainText(textA);
  let requestsB = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === `/tasks/${recordB.id}`) requestsB++;
  });
  await page.evaluate((key) => {
    const original = Storage.prototype.getItem;
    Object.defineProperty(window, "restoreBrowserGetItem", {
      configurable: true,
      value: () => {
        Storage.prototype.getItem = original;
      },
    });
    Storage.prototype.getItem = function (candidate: string) {
      if (candidate === key)
        throw new DOMException("Controlled storage read failure", "SecurityError");
      return original.call(this, candidate);
    };
  }, key);
  await page.getByTestId(`task-item-${recordB.id}`).click();
  const recovery = page.getByRole("region", { name: "Draft recovery actions" });
  await expect(recovery).toContainText("could not be saved on this device");
  await expect(page.locator(".ProseMirror")).toContainText(textA);
  await expect(page.getByTestId(`task-item-${recordA.id}`)).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByTestId(`task-item-${recordB.id}`)).toHaveAttribute(
    "aria-selected",
    "false"
  );
  await recovery.getByRole("button", { name: "Retry draft recovery" }).click();
  await expect(recovery).toContainText("could not be saved on this device");
  expect(requestsB).toBe(0);
  expect(errors).toEqual([]);
  await page.evaluate(() => {
    (window as typeof window & { restoreBrowserGetItem: () => void }).restoreBrowserGetItem();
  });
  await recovery.getByRole("button", { name: "Retry draft recovery" }).click();
  await ready(page);
  await expect(page.locator(".ProseMirror")).toContainText(textB);
  await expect(page.getByTestId(`task-item-${recordB.id}`)).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await prefixWriting(page, " B retry continuation");
  expect((await savedText(page, "B retry continuation")).id).toBe(recordB.id);
  expect((await tasks(page)).find((task) => task.id === recordA.id)?.content).toBe(recordA.content);
  expect(errors).toEqual([]);
});

test("heading and locked noncanonical Markdown remains editable through selection save and reload", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const heading = `Restored heading ${randomUUID()}`;
  const lockId = `heading_${randomUUID()}`;
  const record = await createServerTask(
    page,
    `# ${heading}\n\n> Heading protected <!-- lock:${lockId} -->\n\nWriter tail.`,
    [lockId]
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await page.getByTestId(`task-item-${record.id}`).click();
  await ready(page);
  await expect(page.locator(".ProseMirror h1")).toHaveText(heading);
  await expect(
    page.locator(`.ProseMirror .locked-content[data-lock-id="${lockId}"]`)
  ).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await expect(page.locator(".ProseMirror h1")).toHaveText(heading);
  await prefixWriting(page, " Heading continuation");
  const saved = await savedText(page, "Heading continuation");
  expect(saved.id).toBe(record.id);
  expect(saved.lock_ids).toEqual([lockId]);
  const before = await page.locator(".ProseMirror").innerText();
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await expect.poll(() => page.locator(".ProseMirror").innerText()).toBe(before);
});

for (const action of ["delete", "rewrite"] as const) {
  test(`controlled HTTP AI ${action} retires only removed locks and survives real save and reload`, async ({
    browser,
  }) => {
    const page = await makePage(browser, alice);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await ready(page);
    const writerText = `AI ${action} writer ${randomUUID()}`;
    const original = await write(page, writerText);
    const oldText = `Old AI constraint ${randomUUID()}`;
    const oldLock = `old_${randomUUID()}`;
    const retainedText = `Unaffected AI constraint ${randomUUID()}`;
    const retainedLock = `retained_${randomUUID()}`;
    const newText = `Replacement AI constraint ${randomUUID()}`;
    const newLock = `new_${randomUUID()}`;
    await addLock(page, oldText, oldLock);
    await page.waitForTimeout(4_100);
    await addLock(page, retainedText, retainedLock);
    const anchor = await lockedRange(page, oldLock);
    let interventionRequests = 0;
    await page.route("**/impetus/generate-intervention", (route) => {
      interventionRequests++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action,
          source: "loki",
          anchor,
          ...(action === "rewrite" ? { content: newText, lock_id: newLock } : {}),
        }),
      });
    });
    await page.getByTestId("mode-selector").selectOption("loki");
    await page.waitForTimeout(4_100);
    await page.getByTestId("manual-loki-trigger").click();
    await expect.poll(() => interventionRequests).toBe(1);
    await expect(page.locator(".ProseMirror")).not.toContainText(oldText);
    if (action === "rewrite") await expect(page.locator(".ProseMirror")).toContainText(newText);
    await expect
      .poll(async () => {
        const record = (await tasks(page)).find((task) => task.id === original.id);
        return record && !record.content.includes(oldText) && JSON.stringify(record.lock_ids);
      })
      .toBe(JSON.stringify(action === "rewrite" ? [retainedLock, newLock] : [retainedLock]));
    await page.getByTestId("mode-selector").selectOption("off");
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    await expect(page.locator(".ProseMirror")).toContainText(writerText);
    await expect(page.locator(".ProseMirror")).toContainText(retainedText);
    await expect(
      page.locator(`.ProseMirror .locked-content[data-lock-id="${retainedLock}"]`)
    ).toBeVisible();
    await expect(page.locator(".ProseMirror")).not.toContainText(oldText);
    if (action === "rewrite") {
      await expect(
        page
          .locator(
            `.ProseMirror .locked-content[data-lock-id="${newLock}"]:not(.locked-comment-hidden)`
          )
          .first()
      ).toBeVisible();
      const before = await page.locator(".ProseMirror").innerText();
      await page
        .locator(
          `.ProseMirror .locked-content[data-lock-id="${newLock}"]:not(.locked-comment-hidden)`
        )
        .first()
        .evaluate((element) => {
          (element.closest(".ProseMirror") as HTMLElement).focus();
          const range = document.createRange();
          range.selectNodeContents(element.closest("p") ?? element);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        });
      await page.keyboard.press("Backspace");
      await expect.poll(() => page.locator(".ProseMirror").innerText()).toBe(before);
    } else {
      await prefixWriting(page, " Human after trusted delete");
      expect((await savedText(page, "Human after trusted delete")).lock_ids).toEqual([
        retainedLock,
      ]);
    }
  });
}

test("logout503 keeps local writing and pauses every protected request including footer export", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const text = `Logout failure ${randomUUID()}`;
  await write(page, text);
  await page.route("**/auth/logout", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" })
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("region", { name: "Session status" })).toContainText("not confirmed");
  const work: string[] = [];
  page.on("request", (request) => {
    if (protectedPath(request.url())) work.push(request.url());
  });
  await expect(
    page.locator(".export-panel").getByRole("button", { name: "Export", exact: true })
  ).toBeDisabled();
  await prefixWriting(page, "Offline after logout ");
  await expect(page.locator(".ProseMirror")).toContainText(text);
  await page.waitForTimeout(1_000);
  expect(work).toEqual([]);
  await page.unroute("**/auth/logout");
  await page.getByRole("button", { name: "Retry sign out" }).click();
  await expect(page.getByRole("form", { name: "Login", exact: true })).toBeVisible();
});

test("legacy export is lossless, explicit import creates an owned locked draft, discard removes only legacy", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  const content = `Unassigned ${randomUUID()}\n\n> Legacy protected <!-- lock:legacy_browser -->`;
  const metaRaw = JSON.stringify({
    taskId: "untrusted-old-task",
    version: 72,
    lockIds: ["legacy_browser"],
  });
  await page.addInitScript(
    ({ content, metaRaw }) => {
      localStorage.setItem("impetus.task.cache", content);
      localStorage.setItem("impetus.task.meta", metaRaw);
    },
    { content, metaRaw }
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const recovery = page.getByRole("region", { name: "Unassigned draft recovery" });
  await expect(recovery).toBeVisible();
  expect((await tasks(page)).some((task) => task.content.includes(content))).toBe(false);
  const download = page.waitForEvent("download");
  await recovery.getByRole("button", { name: "Export original draft" }).click();
  const file = resolve(evidence, "browser-legacy-original.json");
  await (await download).saveAs(file);
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ contentRaw: content, metaRaw });
  await recovery.getByRole("button", { name: "Import as a new draft" }).click();
  await expect(page.locator(".ProseMirror")).toContainText("Legacy protected");
  const imported = await savedText(page, content.split("\n")[0]!);
  expect(imported.id).not.toBe("untrusted-old-task");
  expect(imported.lock_ids).toContain("legacy_browser");
  expect(await page.evaluate(() => localStorage.getItem("impetus.task.cache"))).toBe(content);
  await recovery.getByRole("button", { name: "Discard unassigned draft" }).click();
  expect(
    await page.evaluate(() => [
      localStorage.getItem("impetus.task.cache"),
      localStorage.getItem("impetus.task.meta"),
    ])
  ).toEqual([null, null]);
  await expect(page.locator(".ProseMirror")).toContainText("Legacy protected");
});

test("invalid legacy locks remain exportable and cannot be imported or uploaded", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  const content = `Invalid legacy ${randomUUID()}`;
  await page.addInitScript((content) => {
    localStorage.setItem("impetus.task.cache", content);
    localStorage.setItem(
      "impetus.task.meta",
      JSON.stringify({ lockIds: ["missing_browser_lock"] })
    );
  }, content);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const recovery = page.getByRole("region", { name: "Unassigned draft recovery" });
  await recovery.getByRole("button", { name: "Import as a new draft" }).click();
  await expect(recovery.getByRole("alert")).toContainText("no protected document position");
  expect((await tasks(page)).some((task) => task.content.includes(content))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("impetus.task.cache"))).toBe(content);
});

test("invalid owned locks block editing and remote creation while preserving the original source", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  const content = `Invalid owned ${randomUUID()}`;
  const draftId = `owned_${randomUUID()}`;
  const snapshot = {
    draftId,
    content,
    lockIds: ["missing_owned_lock"],
    taskId: null,
    version: 0,
    versionKnown: false,
    dirty: true,
    updatedAt: Date.now(),
  };
  await page.addInitScript(
    ({ id, snapshot }) => {
      localStorage.setItem(
        `impetus.draft.${encodeURIComponent(id)}.${encodeURIComponent(snapshot.draftId)}`,
        JSON.stringify(snapshot)
      );
    },
    { id: alice.id, snapshot }
  );
  const writes: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/tasks") && request.method() === "POST")
      writes.push(request.url());
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("unrecovered-draft")).toContainText(content);
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "false");
  expect(writes).toEqual([]);
  expect((await tasks(page)).some((task) => task.content.includes(content))).toBe(false);
  const stored = await page.evaluate(
    ({ id, draftId }) =>
      localStorage.getItem(
        `impetus.draft.${encodeURIComponent(id)}.${encodeURIComponent(draftId)}`
      ),
    { id: alice.id, draftId }
  );
  expect(JSON.parse(stored!).content).toBe(content);
});

test("malformed owned lock metadata is reported and exported as its exact source without a remote write", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  const key = `impetus.draft.${encodeURIComponent(alice.id)}.malformed_browser`;
  const raw = JSON.stringify({
    draftId: "malformed_browser",
    content: "Malformed owned source",
    lockIds: "must-be-an-array",
    taskId: null,
    version: 0,
    versionKnown: false,
    dirty: true,
    updatedAt: Date.now(),
  });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/tasks") &&
      ["POST", "PUT"].includes(request.method())
    )
      writes.push(request.url());
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".account-bar")).toBeVisible();
  await dismissWelcome(page);
  const issue = page.getByRole("region", { name: "Account draft recovery" });
  await expect(issue).toContainText("Owned draft needs recovery");
  await expect(page.getByTestId("unrecovered-account-draft")).toHaveText("Malformed owned source");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    issue.getByRole("button", { name: "Export original account draft" }).click(),
  ]);
  const file = resolve(evidence, "browser-malformed-owned-original.json");
  await download.saveAs(file);
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ key, raw });
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
  expect(writes).toEqual([]);
});

test("owned storage failure prevents logout request and preserves the editable draft for recovery", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const text = `Storage failure ${randomUUID()}`;
  await write(page, text);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("impetus.draft."))
        throw new DOMException("Controlled quota failure", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  let logoutRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/auth/logout") logoutRequests++;
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("region", { name: "Session status" })).toContainText("not confirmed");
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true");
  await prefixWriting(page, "Quota retained continuation ");
  await expect(page.locator(".ProseMirror")).toContainText("Quota retained continuation");
  expect(logoutRequests).toBe(0);
});

test("expiry keeps local writing and locks; same-account real login resumes saving", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const text = `Expiry ${randomUUID()}`;
  await write(page, text);
  await addLock(page, "Expiry protected", `expiry_${randomUUID()}`);
  await expire(page);
  const work: string[] = [];
  page.on("request", (request) => {
    if (protectedPath(request.url())) work.push(request.url());
  });
  await prefixWriting(page, "Offline continuation ");
  await page.waitForTimeout(1_000);
  expect(work).toEqual([]);
  await page.getByRole("button", { name: "Sign in again", exact: true }).click();
  await login(page, alice);
  await ready(page);
  await expect(page.locator(".ProseMirror")).toContainText("Offline continuation");
  await expect(page.locator(".ProseMirror")).toContainText("Expiry protected");
  const record = await savedText(page, "Offline continuation");
  expect(record.lock_ids.length).toBeGreaterThan(0);
});

test("locked local/server conflict keeps both versions and explicit server choice installs the actual server document", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const localText = `Conflict local ${randomUUID()}`;
  await write(page, localText);
  const localLock = `local_${randomUUID()}`;
  await addLock(page, "Local protected conflict", localLock);
  const record = await savedText(page, "Local protected conflict");
  const serverText = `# Server chosen ${randomUUID()}\n\n> Server protected <!-- lock:server_browser_conflict -->\n\nServer writer tail.`;
  await updateServer(page, record, serverText, ["server_browser_conflict"]);
  await expire(page);
  await prefixWriting(page, "Local unsaved conflict ");
  await page.getByRole("button", { name: "Sign in again", exact: true }).click();
  await login(page, alice);
  const conflict = page.getByRole("region", { name: "Version conflict" });
  await expect(conflict).toBeVisible();
  await expect(conflict).toContainText("Local protected conflict");
  await expect(conflict).toContainText("Server protected");
  await conflict.getByRole("button", { name: "Use server version" }).click();
  await expect(page.locator(".ProseMirror")).toContainText("Server chosen");
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true");
  await expect(page.locator(".ProseMirror")).not.toContainText("Local protected conflict");
  await prefixWriting(page, "Server continuation ");
  const chosen = await savedText(page, "Server continuation");
  expect(chosen.id).toBe(record.id);
  expect(chosen.lock_ids).toEqual(["server_browser_conflict"]);
  await captureBrowser(page, "browser-conflict-server.png");
});

test("real server rejects a wrong CSRF token and accepts the genuine browser cookie header", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const original = await write(page, `CSRF original ${randomUUID()}`);
  const rejected = await page.evaluate(
    async ({ api, task }) => {
      const response = await fetch(`${api}/tasks/${task.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "wrong-local-contract-token",
        },
        body: JSON.stringify({
          content: "Must not be stored",
          lock_ids: [],
          version: task.version,
        }),
      });
      return response.status;
    },
    { api: API, task: original }
  );
  expect(rejected).toBe(403);
  expect((await tasks(page)).find((task) => task.id === original.id)?.content).toBe(
    original.content
  );
  const accepted = await updateServer(page, original, "Genuine CSRF browser write", []);
  expect(accepted.version).toBe(original.version + 1);
});

test("403 save keeps local content and does not expire a confirmed session", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  await page.route("**/tasks/*", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ detail: "CSRF rejected" }),
        })
      : route.continue()
  );
  const text = `Forbidden local ${randomUUID()}`;
  await page.locator(".ProseMirror").fill(text);
  await expect(page.getByRole("region", { name: "Draft recovery actions" })).toContainText(
    "Permission or CSRF"
  );
  await expect(page.locator(".account-bar")).toContainText(alice.email);
  await expect(page.locator(".ProseMirror")).toContainText(text);
  await expect(page.getByRole("region", { name: "Session status" })).toHaveCount(0);
});

for (const delayed of ["query", "save", "AI", "export"] as const) {
  test(`account switch rejects account A's delayed ${delayed} completion`, async ({ browser }) => {
    const page = await makePage(browser, alice);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await ready(page);
    const marker = `Private A ${delayed} ${randomUUID()}`;
    await write(page, marker);
    let held: Route | undefined;
    let body = "";
    let downloads = 0;
    page.on("download", () => downloads++);
    if (delayed === "query" || delayed === "export") {
      await page.route("**/tasks/?*", async (route) => {
        if (held) return route.continue();
        held = route;
        const response = await route.fetch();
        body = await response.text();
      });
      if (delayed === "query") {
        await page.reload({ waitUntil: "domcontentloaded" });
        await ready(page);
      } else
        await page
          .locator(".export-panel")
          .getByRole("button", { name: "Export", exact: true })
          .click();
    } else if (delayed === "save") {
      await page.route("**/tasks/*", async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        const response = await route.fetch();
        body = await response.text();
        held = route;
      });
      await prefixWriting(page, "Queued private A ");
    } else {
      await page.route("**/impetus/generate-intervention", (route) => {
        body = JSON.stringify({
          action: "provoke",
          content: "Delayed A constraint",
          lock_id: "delayed_A",
          source: "loki",
          anchor: { type: "pos", from: 1 },
        });
        held = route;
      });
      await configureAI(page);
      await page.getByTestId("manual-loki-trigger").click();
    }
    await expect.poll(() => Boolean(held) && Boolean(body)).toBe(true);
    await signOut(page);
    await login(page, bob);
    await ready(page);
    await releaseRoute(held!, body);
    await expect(page.locator(".account-bar")).toContainText(bob.email);
    await expect(page.locator(".ProseMirror")).not.toContainText(marker);
    await expect(page.locator(".ProseMirror")).not.toContainText("Delayed A constraint");
    const bobText = `Only B ${delayed} ${randomUUID()}`;
    await page.unroute("**/tasks/*");
    await page.unroute("**/tasks/?*");
    await write(page, bobText);
    const owned = await page.evaluate(
      (id) =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith(`impetus.draft.${encodeURIComponent(id)}.`))
          .map(([, value]) => value),
      bob.id
    );
    expect(
      owned.some((value) => value.includes(marker) || value.includes("Delayed A constraint"))
    ).toBe(false);
    expect((await tasks(page)).some((task) => task.content.includes(marker))).toBe(false);
    expect(downloads).toBe(0);
  });
}
