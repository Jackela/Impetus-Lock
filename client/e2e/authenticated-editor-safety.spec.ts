import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type Request,
  type Route,
  type Locator,
} from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { TaskRecord } from "../src/services/api/taskClient";
import type { EditorView } from "@milkdown/prose/view";
import type { Editor } from "@milkdown/core";

const API = "http://127.0.0.1:8101";
const UI = "http://127.0.0.1:3101";
const PASSWORD = "localAuthPass!2026";
const evidence = resolve("../.scratch/authenticated-editor-safety-2026-10-11");
type Storage = Awaited<ReturnType<BrowserContext["storageState"]>>;
type Account = { email: string; id: string; storage: Storage };
type RetainedAccounts = {
  alice: Pick<Account, "email" | "id">;
  bob: Pick<Account, "email" | "id">;
};
let alice: Account;
let bob: Account;
const contexts: BrowserContext[] = [];
let loginAttempts: number[] = [];
type NativeFocusEvent = {
  type: "focus" | "blur";
  isTrusted: boolean;
  hasFocus: boolean;
  visibility: string;
};
type FocusObservedWindow = Window & { impetusValidationFocusEvents?: NativeFocusEvent[] };

async function observeNativeFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    const observed = window as FocusObservedWindow;
    const events: NativeFocusEvent[] = [];
    observed.impetusValidationFocusEvents = events;
    for (const type of ["focus", "blur"] as const)
      window.addEventListener(type, (event) => {
        events.push({
          type,
          isTrusted: event.isTrusted,
          hasFocus: document.hasFocus(),
          visibility: document.visibilityState,
        });
      });
  });
}

async function nativeFocusState(page: Page) {
  return page.evaluate(() => ({
    hasFocus: document.hasFocus(),
    events: (window as FocusObservedWindow).impetusValidationFocusEvents ?? [],
  }));
}

async function restoreNativeBrowserFocus(page: Page): Promise<void> {
  const engine = page.context().browser()?.browserType().name();
  if (engine === "chromium") {
    const session = await page.context().newCDPSession(page);
    // Restore native browser activation; Playwright otherwise keeps every page focused.
    await session.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await session.detach();
  } else if (engine === "webkit" && process.env.AUTH_E2E_WEBKIT_XVFB === "1") {
    expect(process.platform).toBe("linux");
    // Playwright 1.63's local WebKit PageProxy protocol has no public session API.
    // Omitting optional active clears the automation override; false would force blur.
    const localPage = page as unknown as {
      _connection: {
        toImpl(target: Page): {
          delegate: {
            _pageProxySession: { send(method: string, params: object): Promise<unknown> };
          };
        };
      };
    };
    await localPage._connection
      .toImpl(page)
      .delegate._pageProxySession.send("Emulation.setActiveAndFocused", {});
  }
}

async function enterText(page: Page, locator: Locator, text: string): Promise<void> {
  if (
    page.context().browser()?.browserType().name() === "firefox" &&
    test.info().project.use.channel === "moz-firefox"
  ) {
    // BiDi fill sets DOM values directly; use real keys for React-controlled input.
    await page.bringToFront();
    await locator.click();
    await locator.press("ControlOrMeta+A");
    await locator.press("Backspace");
    await locator.pressSequentially(text);
  } else {
    await locator.fill(text);
  }
}

type BidiSession = {
  sessionId: string;
  send(method: string, params: object): Promise<unknown>;
  connection: { browserSession: { send(method: string, params: object): Promise<unknown> } };
};
type LocalBidiPage = {
  delegate: {
    _session: BidiSession;
    _networkManager: {
      _requests: Map<string, { _id: string; request: LocalBidiRequest }>;
    };
  };
};
type LocalBidiRequest = {
  frame(): { _id: string; _page: LocalBidiPage };
  url(): string;
  method(): string;
};
type LocalConnection = { toImpl(target: Page | Request): LocalBidiPage | LocalBidiRequest };
type RequestBodyRecord = {
  requestId: string;
  context: string;
  pathname: string;
  method: string;
  byteLength: number;
  sha256: string;
  forwardedSha256?: string;
  forwardedResponseStatus?: number;
};
type RequestCollector = {
  session: BidiSession;
  collector: string;
  records: RequestBodyRecord[];
};
const requestCollectors = new Map<Page, RequestCollector>();
const actualRequestBodies = new WeakMap<Request, Promise<Buffer>>();
const actualRequestRecords = new WeakMap<Request, RequestBodyRecord>();

function stockBiDi(page: Page): boolean {
  return (
    page.context().browser()?.browserType().name() === "firefox" &&
    test.info().project.use.channel === "moz-firefox"
  );
}

async function collectBusinessRequests(page: Page): Promise<void> {
  if (!stockBiDi(page) || requestCollectors.has(page)) return;
  const connection = (page as unknown as { _connection: LocalConnection })._connection;
  const local = connection.toImpl(page) as LocalBidiPage;
  const session = local.delegate._session;
  // The existing Playwright subscription includes network.beforeRequestSent.
  // Register before business requests; login/register explicitly remove this collector.
  const result = (await session.send("network.addDataCollector", {
    dataTypes: ["request"],
    contexts: [session.sessionId],
    maxEncodedDataSize: 20_000_000,
  })) as { collector?: string };
  if (typeof result.collector !== "string") throw new Error("Missing native request collector");
  requestCollectors.set(page, { session, collector: result.collector, records: [] });
}

async function actualRequestBody(request: Request): Promise<Buffer> {
  const cached = actualRequestBodies.get(request);
  if (cached) return cached;
  const pending = (async () => {
    const page = request.frame().page();
    const state = requestCollectors.get(page);
    const url = new URL(request.url());
    if (
      !state ||
      url.origin !== API ||
      !protectedPath(request.url()) ||
      !["POST", "PUT"].includes(request.method())
    )
      throw new Error("Native body requires an active collector and a protected business write");
    const connection = (page as unknown as { _connection: LocalConnection })._connection;
    if ((request as unknown as { _connection: LocalConnection })._connection !== connection)
      throw new Error("Native request connection mismatch");
    const localPage = connection.toImpl(page) as LocalBidiPage;
    const localRequest = connection.toImpl(request) as LocalBidiRequest;
    const matches = [...localPage.delegate._networkManager._requests.entries()].filter(
      ([, entry]) => entry.request === localRequest
    );
    if (matches.length !== 1) throw new Error("Native request identity is not unique");
    const [requestId, entry] = matches[0]!;
    if (
      requestId !== entry._id ||
      localRequest.frame()._page !== localPage ||
      localRequest.frame()._id !== state.session.sessionId ||
      localRequest.url() !== request.url() ||
      localRequest.method() !== request.method()
    )
      throw new Error("Native request ID, context, URL or method mismatch");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: { bytes?: { type?: string; value?: string } };
    try {
      result = (await Promise.race([
        state.session.send("network.getData", {
          request: requestId,
          dataType: "request",
          collector: state.collector,
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Native request data timeout")), 12_000);
        }),
      ])) as typeof result;
    } catch {
      // Do not include protocol events, request headers or body text in an error.
      throw new Error("Native request data unavailable");
    } finally {
      clearTimeout(timer);
    }
    if (
      typeof result.bytes?.value !== "string" ||
      !["string", "base64"].includes(result.bytes.type ?? "")
    )
      throw new Error("Native request bytes missing");
    const bytes = Buffer.from(
      result.bytes.value,
      result.bytes.type === "base64" ? "base64" : "utf8"
    );
    if (!bytes.length) throw new Error("Native business request body is empty");
    const record: RequestBodyRecord = {
      requestId,
      context: state.session.sessionId,
      pathname: url.pathname,
      method: request.method(),
      byteLength: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    state.records.push(record);
    actualRequestRecords.set(request, record);
    return bytes;
  })();
  actualRequestBodies.set(request, pending);
  return pending;
}

async function requestJSON(request: Request): Promise<Record<string, unknown>> {
  if (!stockBiDi(request.frame().page())) return request.postDataJSON();
  const bytes = await actualRequestBody(request);
  try {
    return JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("Native business request is not valid JSON");
  }
}

async function requestText(request: Request): Promise<string> {
  return stockBiDi(request.frame().page())
    ? (await actualRequestBody(request)).toString("utf8")
    : (request.postData() ?? "");
}

async function fetchActualRoute(route: Route): Promise<Awaited<ReturnType<Route["fetch"]>>> {
  const request = route.request();
  if (!stockBiDi(request.frame().page()) || !["POST", "PUT"].includes(request.method()))
    return route.fetch();
  const bytes = await actualRequestBody(request);
  const record = actualRequestRecords.get(request);
  if (!record) throw new Error("Native forwarded request has no physical request body record");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (record.sha256 !== sha256) throw new Error("Native forwarding body changed");
  record.forwardedSha256 = sha256;
  // Forward the exact bytes returned for this physical request, including original headers.
  const response = await route.fetch({ postData: bytes });
  record.forwardedResponseStatus = response.status();
  return response;
}

async function removeRequestCollector(page: Page): Promise<void> {
  const state = requestCollectors.get(page);
  if (!state) return;
  // The browser session uses the same protocol connection and survives page closure.
  const session = state.session.connection.browserSession;
  for (const record of state.records)
    await session.send("network.disownData", {
      collector: state.collector,
      dataType: "request",
      request: record.requestId,
    });
  await session.send("network.removeDataCollector", { collector: state.collector });
  requestCollectors.delete(page);
  await writeFile(
    resolve(
      evidence,
      `native-request-body-${process.env.AUTH_E2E_RUN ?? "current"}-${randomUUID()}.json`
    ),
    JSON.stringify({
      method: "Firefox155 native BiDi request collector",
      records: state.records,
      disowned: true,
      collectorRemoved: true,
    })
  );
}

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
  await context.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) =>
    route.abort()
  );
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
  // External font requests are blocked in makePage; capture real browser pixels.
  await page.screenshot({ path: resolve(evidence, filename), fullPage: true });
}

async function ready(page: Page): Promise<void> {
  await expect(page.getByTestId("app-root")).toBeVisible();
  await dismissWelcome(page);
  await expect(page.locator(".ProseMirror[contenteditable='true']")).toBeVisible();
  await expect(page.locator(".task-status")).toHaveText("Saved");
}

async function register(page: Page, email: string): Promise<Account> {
  await removeRequestCollector(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Register", exact: true }).click();
  const form = page.getByRole("form", { name: "Register", exact: true });
  await enterText(page, form.getByLabel("Email", { exact: true }), email);
  await enterText(page, form.getByLabel("Password", { exact: true }), PASSWORD);
  await enterText(page, form.getByLabel("Confirm Password", { exact: true }), PASSWORD);
  const submit = async () => {
    const response = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/auth/register" && r.request().method() === "POST"
    );
    await form.getByRole("button", { name: "Register", exact: true }).click();
    return response;
  };
  let registered = await submit();
  if (registered.status() === 429) {
    // Setup obeys the real endpoint window. This retries the user's unchanged
    // form after Retry-After; Playwright test retries remain disabled.
    const seconds = Number(registered.headers()["retry-after"]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
    const began = Date.now();
    const until = began + (seconds + 1) * 1000;
    while (Date.now() < until) await page.waitForTimeout(Math.min(30_000, until - Date.now()));
    await writeFile(
      resolve(evidence, `setup-register-wait-${randomUUID()}.json`),
      JSON.stringify({
        status: 429,
        retryAfterSeconds: seconds,
        waitedMs: Date.now() - began,
        testRetries: 0,
      })
    );
    registered = await submit();
  }
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
  await removeRequestCollector(page);
  await waitForLoginWindow(page);
  const form = page.getByRole("form", { name: "Login", exact: true });
  await enterText(page, form.getByLabel("Email", { exact: true }), account.email);
  await enterText(page, form.getByLabel("Password", { exact: true }), password);
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
    const user = (await (await fetch(`${api}/auth/me`, { credentials: "include" })).json()) as {
      id: string;
    };
    const response = await fetch(`${api}/tasks/`, {
      credentials: "include",
      headers: { "X-Expected-User-ID": user.id },
    });
    if (!response.ok) throw new Error(`Real task read failed: ${response.status}`);
    const body = (await response.json()) as { tasks: TaskRecord[] };
    return body.tasks;
  }, API);
}

async function savedText(page: Page, text: string, taskId?: string): Promise<TaskRecord> {
  const userId = await page.evaluate(async (api) => {
    const response = await fetch(`${api}/auth/me`, { credentials: "include" });
    if (!response.ok) throw new Error(`Real save identity check failed: ${response.status}`);
    return ((await response.json()) as { id: string }).id;
  }, API);
  let saved: TaskRecord | null = null;
  await expect
    .poll(async () => {
      saved = await page.evaluate(
        async ({ api, userId, taskId, text }) => {
          const draftId = sessionStorage.getItem(
            `impetus.selection.${encodeURIComponent(userId)}.editor`
          );
          if (!draftId) return null;
          const raw = localStorage.getItem(
            `impetus.draft.${encodeURIComponent(userId).replace(/\./g, "%2E")}.${encodeURIComponent(draftId)}`
          );
          if (!raw) return null;
          const draft = JSON.parse(raw) as {
            taskId: string | null;
            content: string;
            lockIds: string[];
            version: number;
            versionKnown: boolean;
            dirty: boolean;
          };
          const targetId = taskId ?? draft.taskId;
          if (!targetId || draft.taskId !== targetId) return null;
          const response = await fetch(`${api}/tasks/${encodeURIComponent(targetId)}`, {
            credentials: "include",
            headers: { "X-Expected-User-ID": userId },
          });
          if (!response.ok) throw new Error(`Real selected task read failed: ${response.status}`);
          const record = (await response.json()) as TaskRecord;
          if (record.id !== targetId)
            throw new Error("Real task read returned a different task identity");
          return record.content.includes(text) &&
            record.content === draft.content &&
            JSON.stringify(record.lock_ids) === JSON.stringify(draft.lockIds) &&
            record.version === draft.version &&
            draft.versionKnown &&
            !draft.dirty
            ? record
            : null;
        },
        { api: API, userId, taskId, text }
      );
      return saved !== null;
    })
    .toBe(true);
  if (!saved) throw new Error("The selected owned task did not reach a complete acknowledged save");
  return saved;
}

async function write(page: Page, text: string): Promise<TaskRecord> {
  await enterText(page, page.locator(".ProseMirror"), text);
  return savedText(page, text);
}

async function prefixWriting(page: Page, text: string): Promise<void> {
  const editor = page.locator(".ProseMirror");
  // Place the native contenteditable caret in the writer's last unlocked paragraph.
  // This avoids platform-specific Home shortcuts and never calls editor internals.
  const expectedParagraphs = await editor.evaluate((element) => {
    const paragraphs = [...element.querySelectorAll("p")];
    let index = paragraphs.length - 1;
    while (index >= 0 && paragraphs[index]?.querySelector(".locked-content[data-lock-id]")) index--;
    const paragraph = paragraphs[index];
    if (!paragraph) throw new Error("Native continuation requires an unlocked writer paragraph");
    (element as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return { paragraphs: paragraphs.map((node) => node.textContent ?? ""), index };
  });
  await page.keyboard.insertText(text);
  expectedParagraphs.paragraphs[expectedParagraphs.index] += text;
  await expect
    .poll(() =>
      editor
        .locator("p")
        .evaluateAll((paragraphs) => paragraphs.map((node) => node.textContent ?? ""))
    )
    .toEqual(expectedParagraphs.paragraphs);
}

async function ownedContinuation(page: Page, taskId: string, text: string, lockIds: string[]) {
  let snapshot: { content: string; lockIds: string[] } | undefined;
  await expect
    .poll(async () => {
      snapshot = await page.evaluate(
        ({ taskId, text, lockIds }) =>
          Object.entries(localStorage)
            .filter(([key]) => key.startsWith("impetus.draft."))
            .map(
              ([, raw]) =>
                JSON.parse(raw) as { taskId?: string; content: string; lockIds: string[] }
            )
            .find(
              (draft) =>
                draft.taskId === taskId &&
                draft.content.includes(text) &&
                JSON.stringify(draft.lockIds) === JSON.stringify(lockIds)
            ),
        { taskId, text, lockIds }
      );
      return Boolean(snapshot);
    })
    .toBe(true);
  if (!snapshot) throw new Error("The complete owned continuation was not persisted locally");
  return snapshot;
}

async function auditTask(browser: Browser, account: Account, taskId: string): Promise<TaskRecord> {
  // A separate authenticated fixture client reads the real record. This is not
  // protected work from the expired editor or a session bypass.
  const context = await browser.newContext({
    storageState: { cookies: account.storage.cookies, origins: [] },
  });
  contexts.push(context);
  const response = await context.request.get(`${API}/tasks/${taskId}`, {
    headers: { "X-Expected-User-ID": account.id },
  });
  expect(response.status()).toBe(200);
  return response.json() as Promise<TaskRecord>;
}

async function configureAI(page: Page, mode: "muse" | "loki" = "muse"): Promise<void> {
  await page.getByTestId("llm-settings-trigger").click();
  await page.getByTestId("storage-mode-select").selectOption("session");
  await enterText(page, page.getByTestId("llm-key-input"), "sk-local-auth-contract-key-only");
  await page.getByTestId("llm-settings-save").click();
  await page.getByTestId("mode-selector").selectOption(mode);
}

async function addLock(page: Page, text: string, lockId: string): Promise<void> {
  const editor = page.locator(".ProseMirror");
  const beforeParagraphs = await editor
    .locator("p")
    .evaluateAll((elements) => elements.map((element) => element.textContent ?? ""));
  const beforeLocks = await editor.evaluate((element) =>
    [
      ...new Set(
        [...element.querySelectorAll(".locked-content[data-lock-id]")].map((node) =>
          node.getAttribute("data-lock-id")
        )
      ),
    ].sort()
  );
  // Write a new, unlocked paragraph through native input. The controlled Muse
  // rewrite targets only this paragraph and cannot replace the existing writer.
  const target = `Editable AI fixture paragraph ${randomUUID()}`;
  const insertionIndex = await editor.evaluate((element) => {
    const paragraphs = [...element.querySelectorAll("p")];
    let index = paragraphs.length - 1;
    while (index >= 0 && paragraphs[index]?.querySelector(".locked-content[data-lock-id]")) index--;
    const paragraph = paragraphs[index];
    if (!paragraph) throw new Error("Fixture requires an actually unlocked writer paragraph");
    (element as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return index + 1;
  });
  await page.keyboard.press("Enter");
  await page.keyboard.insertText(target);
  const paragraph = editor.locator("p").filter({ hasText: target });
  await expect(paragraph).toHaveText(target);
  const anchor = await paragraph.evaluate((element) => {
    const descriptor = (
      element as HTMLElement & {
        pmViewDesc?: { posBefore: number; node?: { nodeSize: number } };
      }
    ).pmViewDesc;
    if (!descriptor?.node) throw new Error("Editable paragraph has no actual document position");
    return {
      type: "range" as const,
      from: descriptor.posBefore,
      to: descriptor.posBefore + descriptor.node.nodeSize,
    };
  });
  let requests = 0;
  await collectBusinessRequests(page);
  await page.route("**/impetus/generate-intervention", async (route) => {
    requests++;
    expect(await requestJSON(route.request())).toMatchObject({ mode: "muse" });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "rewrite",
        content: text,
        lock_id: lockId,
        source: "muse",
        anchor,
      }),
    });
  });
  await configureAI(page);
  await page.getByRole("button", { name: "I'm stuck! Trigger AI assistance", exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator(".ProseMirror")).toContainText(text);
  const expectedParagraphs = [...beforeParagraphs];
  expectedParagraphs.splice(insertionIndex, 0, `${text} <!-- lock:${lockId} source:muse -->`);
  expect(
    await editor
      .locator("p")
      .evaluateAll((elements) => elements.map((element) => element.textContent ?? ""))
  ).toEqual(expectedParagraphs);
  const persisted = await savedText(page, lockId);
  expect(persisted.content).toContain(text);
  expect([...persisted.lock_ids].sort()).toEqual([...beforeLocks, lockId].sort());
  for (const paragraphText of beforeParagraphs) expect(persisted.content).toContain(paragraphText);
  expect(persisted.content).not.toContain(target);
  const owned = await page.evaluate(
    ({ taskId, lockId }) => {
      const snapshots = Object.entries(localStorage)
        .filter(([key]) => key.startsWith("impetus.draft."))
        .map(
          ([, raw]) => JSON.parse(raw) as { taskId?: string; content: string; lockIds: string[] }
        );
      return snapshots.find(
        (snapshot) => snapshot.taskId === taskId && snapshot.lockIds.includes(lockId)
      );
    },
    { taskId: persisted.id, lockId }
  );
  expect(owned).toBeDefined();
  expect(persisted.content).toBe(owned?.content);
  expect(persisted.lock_ids).toEqual(owned?.lockIds);
  await writeFile(
    resolve(
      evidence,
      `production-muse-fixture-${process.env.AUTH_E2E_RUN ?? "current"}-${lockId}.json`
    ),
    JSON.stringify(
      {
        trigger: "native unlocked paragraph input and public Muse button",
        insertionIndex,
        anchor,
        beforeParagraphs,
        expectedParagraphs,
        beforeLocks,
        persistedLocks: persisted.lock_ids,
        persistedBodySha256: createHash("sha256").update(persisted.content).digest("hex"),
        originalParagraphsExactAndOrdered: true,
        ownedAndDatabaseCompleteBodyEqual: true,
      },
      null,
      2
    )
  );
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
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf ?? "",
          "X-Expected-User-ID": (
            (await (await fetch(`${api}/auth/me`, { credentials: "include" })).json()) as {
              id: string;
            }
          ).id,
        },
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
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf ?? "",
          "X-Expected-User-ID": (
            (await (await fetch(`${api}/auth/me`, { credentials: "include" })).json()) as {
              id: string;
            }
          ).id,
        },
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
    .first()
    .evaluate((element) => {
      // Read the actual rendered node position for the controlled HTTP response.
      // The browser does not mutate the editor document through this descriptor.
      const paragraph = element.closest("p");
      if (!paragraph) throw new Error("Rendered locked decoration has no paragraph");
      const descriptor = (
        paragraph as HTMLElement & {
          pmViewDesc?: { posBefore: number; node?: { nodeSize: number }; size: number };
        }
      ).pmViewDesc;
      if (!descriptor) throw new Error("Rendered locked paragraph has no ProseMirror descriptor");
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
  // Account setup can legitimately wait for real endpoint windows. This is
  // the setup hook's timeout; individual business/action timeouts stay intact.
  test.setTimeout(240_000);
  await mkdir(evidence, { recursive: true });
  const checkpoint = resolve(
    evidence,
    `.env.browser-accounts-${process.platform}-${browser.browserType().name()}.json`
  );
  let retained: RetainedAccounts | null = null;
  try {
    retained = JSON.parse(await readFile(checkpoint, "utf8")) as RetainedAccounts;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const authenticated = async (account: Pick<Account, "email" | "id">): Promise<Account> => {
    expect(account.email).toMatch(/^browser-.*@example\.com$/);
    const page = await makePage(browser);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const submit = async () => {
      const response = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/auth/login" && r.request().method() === "POST"
      );
      await login(page, account);
      return response;
    };
    let response = await submit();
    if (response.status() === 429) {
      const seconds = Number(response.headers()["retry-after"]);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(60);
      const began = Date.now();
      const until = began + (seconds + 1) * 1000;
      while (Date.now() < until) await page.waitForTimeout(Math.min(30_000, until - Date.now()));
      await writeFile(
        resolve(evidence, `setup-login-wait-${randomUUID()}.json`),
        JSON.stringify({
          status: 429,
          retryAfterSeconds: seconds,
          waitedMs: Date.now() - began,
          testRetries: 0,
        })
      );
      response = await submit();
    }
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    expect(body.user.id).toBe(account.id);
    await ready(page);
    return { ...account, storage: await page.context().storageState() };
  };
  if (retained) {
    alice = await authenticated(retained.alice);
    bob = await authenticated(retained.bob);
  } else {
    alice = await register(await makePage(browser), `browser-alice-${randomUUID()}@example.com`);
    bob = await register(await makePage(browser), `browser-bob-${randomUUID()}@example.com`);
    await writeFile(
      checkpoint,
      JSON.stringify(
        { alice: { email: alice.email, id: alice.id }, bob: { email: bob.email, id: bob.id } },
        null,
        2
      ),
      { mode: 0o600 }
    );
  }
  for (const context of contexts.splice(0)) await context.close();
  // Previous runners and real setup share the same Redis/IP login bucket.
  // Wait one actual policy window after setup so delayed auth tests begin with
  // a fresh budget, rather than accidentally gating a 429 without Set-Cookie.
  const began = Date.now();
  const until = began + 60_500;
  while (Date.now() < until)
    await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, until - Date.now())));
  loginAttempts = [];
  await writeFile(
    resolve(evidence, `setup-login-window-${randomUUID()}.json`),
    JSON.stringify({
      run: process.env.AUTH_E2E_RUN ?? "current",
      reason: "fresh real 5-per-minute login budget after account setup and earlier runners",
      policyWindowMs: 60_000,
      actualWaitedMs: Date.now() - began,
      testRetries: 0,
    })
  );
});

test.afterEach(async () => {
  try {
    for (const page of [...requestCollectors.keys()]) await removeRequestCollector(page);
  } finally {
    for (const context of contexts.splice(0)) await context.close();
  }
});

test("current account task survives the real backend restart with exact content locks and version", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  await write(page, `Current round checkpoint ${randomUUID()}`);
  const lockId = `restart_${randomUUID()}`;
  await addLock(page, "Protected browser restart lock", lockId);
  const before = await savedText(page, lockId);
  await writeFile(
    resolve(evidence, "browser-current-checkpoint.json"),
    JSON.stringify(
      {
        email: alice.email,
        taskId: before.id,
        content: before.content,
        lockIds: before.lock_ids,
        version: before.version,
        browserStorage: await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
      },
      null,
      2
    )
  );
  execFileSync(
    "../server/.venv/bin/python",
    [resolve("../scripts/authenticated-editor-validation/services.py"), "restart"],
    { timeout: 60_000, stdio: "pipe" }
  );
  const after = (await tasks(page)).find((task) => task.id === before.id);
  expect(after).toEqual(before);
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await expect(page.locator(".ProseMirror")).toContainText("Protected browser restart lock");
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true");
  await writeFile(
    resolve(evidence, "browser-restart-durability.json"),
    JSON.stringify(
      {
        taskId: before.id,
        exactContent: after?.content === before.content,
        exactLocks: JSON.stringify(after?.lock_ids) === JSON.stringify(before.lock_ids),
        exactVersion: after?.version === before.version,
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
  await expect(page.getByTestId(`task-item-${firstId}`)).toHaveAttribute("aria-current", "true");
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
  const protectedPosts: string[] = [];
  const observePost = (request: Request) => {
    if (request.method() === "POST" && protectedPath(request.url()))
      protectedPosts.push(new URL(request.url()).pathname);
  };
  page.on("request", observePost);
  await page.getByTestId("style-learning-toggle").click();
  const style = page.getByRole("dialog", { name: "Style Learning", exact: true });
  await expect(style).toBeVisible();
  const analyze = style.getByRole("button", { name: "Analyze Style", exact: true });
  await expect(analyze).toBeDisabled();
  await style
    .getByRole("textbox", { name: "Writing sample input", exact: true })
    .fill(Array.from({ length: 501 }, () => "sample").join(" "));
  await expect(analyze).toBeEnabled();
  // Measure the enabled state after its real 200ms CSS transition completes.
  await page.waitForTimeout(250);
  await analyze.scrollIntoViewIfNeeded();
  const analyzeBounds = await analyze.boundingBox();
  expect(analyzeBounds).not.toBeNull();
  expect(analyzeBounds!.width).toBeGreaterThanOrEqual(44);
  expect(analyzeBounds!.height).toBeGreaterThanOrEqual(44);
  expect(protectedPosts).toEqual([]);
  await style.getByRole("button", { name: "Close Style Learning", exact: true }).click();
  await expect(style).toBeHidden();
  expect(protectedPosts).toEqual([]);
  page.off("request", observePost);
  await writeFile(
    resolve(evidence, `style-analyze-target-${process.env.AUTH_E2E_RUN ?? "current"}.json`),
    JSON.stringify({
      sampleWords: 501,
      enabled: true,
      settledMs: 250,
      analyzeBounds,
      protectedPosts,
    })
  );
  await page.locator(".account-bar").scrollIntoViewIfNeeded();
  await captureBrowser(page, "browser-editor-narrow.png");
});

test("short viewport 320 by 256 keeps a visible writing area for normal pointer input and real saving without horizontal overflow", async ({
  browser,
}) => {
  const page = await makePage(browser);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await login(page, alice);
  await ready(page);
  await page.setViewportSize({ width: 320, height: 256 });
  if (await page.getByTestId("task-sidebar").count())
    await page.getByTestId("task-list-toggle").click();
  await expect(page.getByTestId("task-sidebar")).toHaveCount(0);
  const area = page.locator(".editor-area");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const geometry = await area.evaluate((element) => ({
    clientHeight: element.clientHeight,
    width: element.getBoundingClientRect().width,
    rectHeight: element.getBoundingClientRect().height,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
  }));
  await writeFile(
    resolve(
      evidence,
      `short-${process.env.AUTH_E2E_RUN ?? "current"}-320x256-writing-geometry.json`
    ),
    JSON.stringify(geometry, null, 2)
  );
  expect(geometry.clientHeight).toBeGreaterThan(100);
  expect(geometry.rectHeight).toBeGreaterThan(100);
  expect(geometry.documentWidth).toBeLessThanOrEqual(320);
  await expect(area).toBeVisible();
  await expect(editor).toBeVisible();
  await editor.click();
  const tail = ` Visible short window input ${randomUUID()}`;
  await prefixWriting(page, tail);
  await expect(editor).toContainText(tail);
  expect(
    await editor.evaluate(
      (element, ending) => element.textContent?.trim().endsWith(ending.trim()),
      tail
    )
  ).toBe(true);
  const actual = await savedText(page, tail);
  expect(actual.content.trim().endsWith(tail.trim())).toBe(true);
  const footerTargets: { label: string; width: number; height: number }[] = [];
  for (const [label, control] of [
    [
      "Export format",
      page.locator(".export-panel").getByRole("combobox", { name: "Export format" }),
    ],
    ["Export", page.locator(".export-panel").getByRole("button", { name: "Export", exact: true })],
  ] as const) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    footerTargets.push({ label, width: box!.width, height: box!.height });
  }
  await writeFile(
    resolve(evidence, `footer-${process.env.AUTH_E2E_RUN ?? "current"}-320x256-targets.json`),
    JSON.stringify(
      { viewport: { width: 320, height: 256 }, targets: footerTargets, minimumSize: 44 },
      null,
      2
    )
  );
  for (const target of footerTargets) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  await page.keyboard.press(
    browser.browserType().name() === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab"
  );
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
  await enterText(page, form.getByLabel("Password", { exact: true }), PASSWORD);
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
  // Preserve the original Loki-provoke production branch as well as the Muse
  // fixture. One genuine random timer can take 120 seconds.
  test.setTimeout(220_000);
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const text = `Browser persisted ${randomUUID()}`;
  await write(page, text);
  const lock = `lock_browser_${randomUUID()}`;
  await addLock(page, "Protected browser lock", lock);
  const beforeProvoke = await page
    .locator(".ProseMirror p")
    .evaluateAll((elements) => elements.map((element) => element.textContent ?? ""));
  const provokeText = `Production Loki provoke ${randomUUID()}`;
  const provokeLock = `provoke_browser_${randomUUID()}`;
  let requests = 0;
  await page.route("**/impetus/generate-intervention", async (route) => {
    requests++;
    expect(await requestJSON(route.request())).toMatchObject({ mode: "loki" });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "provoke",
        source: "loki",
        content: provokeText,
        lock_id: provokeLock,
        anchor: { type: "pos", from: 0 },
      }),
    });
  });
  const timerBegan = Date.now();
  const scheduledRequest = page.waitForRequest(
    async (request) =>
      new URL(request.url()).pathname === "/impetus/generate-intervention" &&
      request.method() === "POST" &&
      (await requestJSON(request)).mode === "loki",
    { timeout: 125_000 }
  );
  await page.getByTestId("mode-selector").selectOption("loki");
  await scheduledRequest;
  await writeFile(
    resolve(
      evidence,
      `production-loki-timer-${process.env.AUTH_E2E_RUN ?? "current"}-provoke.json`
    ),
    JSON.stringify(
      {
        mode: "loki",
        action: "provoke",
        actualWaitedMs: Date.now() - timerBegan,
        configuredIntervalRangeMs: [30_000, 120_000],
        requestTimeoutMs: 125_000,
        caseTimeoutMs: 220_000,
        testRetries: 0,
        clock: "real; no override",
        trigger: "production random timer",
      },
      null,
      2
    )
  );
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator(".ProseMirror")).toContainText(provokeText);
  const beforeReload = await page
    .locator(".ProseMirror p")
    .evaluateAll((elements) => elements.map((element) => element.textContent ?? ""));
  expect(beforeReload).toEqual([
    `${provokeText} <!-- lock:${provokeLock} source:loki -->`,
    ...beforeProvoke,
  ]);
  const record = await savedText(page, provokeText);
  expect([...record.lock_ids].sort()).toEqual([lock, provokeLock].sort());
  expect(record.content).toContain(text);
  expect(record.content).toContain("Protected browser lock");
  const owned = await page.evaluate(
    (taskId) =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith("impetus.draft."))
        .map(
          ([, raw]) => JSON.parse(raw) as { taskId?: string; content: string; lockIds: string[] }
        )
        .find((draft) => draft.taskId === taskId),
    record.id
  );
  expect(owned).toBeDefined();
  expect(record.content).toBe(owned?.content);
  expect(record.lock_ids).toEqual(owned?.lockIds);
  await page.getByTestId("mode-selector").selectOption("off");
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
  expect(
    await page
      .locator(".ProseMirror p")
      .evaluateAll((elements) => elements.map((element) => element.textContent ?? ""))
  ).toEqual(beforeReload);
  const afterReload = (await tasks(page)).find((task) => task.id === record.id);
  expect(afterReload?.content).toBe(record.content);
  expect(afterReload?.lock_ids).toEqual(record.lock_ids);
  expect(afterReload?.version).toBe(record.version);
  const before = await page.locator(".ProseMirror").innerText();
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await expect.poll(() => page.locator(".ProseMirror").innerText()).toBe(before);
  const afterRejectedDelete = (await tasks(page)).find((task) => task.id === record.id);
  expect(afterRejectedDelete?.content).toBe(record.content);
  expect(afterRejectedDelete?.lock_ids).toEqual(record.lock_ids);
  expect(afterRejectedDelete?.version).toBe(record.version);
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
  const saved = await savedText(page, "After repeated selection", record.id);
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
  await expect(page.getByTestId(`task-item-${recordA.id}`)).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId(`task-item-${recordB.id}`)).not.toHaveAttribute(
    "aria-current",
    "true"
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
  await expect(page.getByTestId(`task-item-${recordB.id}`)).toHaveAttribute("aria-current", "true");
  await prefixWriting(page, " B retry continuation");
  expect((await savedText(page, "B retry continuation", recordB.id)).id).toBe(recordB.id);
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
  const saved = await savedText(page, "Heading continuation", record.id);
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
    // One real production Loki timer can take 120 seconds; leave a separate
    // budget for two public Muse fixtures and the unchanged persistence checks.
    test.setTimeout(220_000);
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
    const beforeIntervention = await page
      .locator(".ProseMirror p")
      .evaluateAll((paragraphs) => paragraphs.map((paragraph) => paragraph.textContent ?? ""));
    const removedIndex = beforeIntervention.indexOf(
      `${oldText} <!-- lock:${oldLock} source:muse -->`
    );
    expect(removedIndex).toBeGreaterThanOrEqual(0);
    const expectedParagraphs = [...beforeIntervention];
    expectedParagraphs.splice(
      removedIndex,
      1,
      ...(action === "rewrite" ? [`${newText} <!-- lock:${newLock} source:loki -->`] : [])
    );
    let interventionRequests = 0;
    await page.route("**/impetus/generate-intervention", async (route) => {
      interventionRequests++;
      expect(await requestJSON(route.request())).toMatchObject({ mode: "loki" });
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
    const timerBegan = Date.now();
    const scheduledRequest = page.waitForRequest(
      async (request) =>
        new URL(request.url()).pathname === "/impetus/generate-intervention" &&
        request.method() === "POST" &&
        (await requestJSON(request)).mode === "loki",
      { timeout: 125_000 }
    );
    await page.getByTestId("mode-selector").selectOption("loki");
    await scheduledRequest;
    await writeFile(
      resolve(
        evidence,
        `production-loki-timer-${process.env.AUTH_E2E_RUN ?? "current"}-${action}.json`
      ),
      JSON.stringify(
        {
          mode: "loki",
          action,
          actualWaitedMs: Date.now() - timerBegan,
          configuredIntervalRangeMs: [30_000, 120_000],
          requestTimeoutMs: 125_000,
          caseTimeoutMs: 220_000,
          testRetries: 0,
          clock: "real; no override",
          trigger: "production random timer",
        },
        null,
        2
      )
    );
    await expect.poll(() => interventionRequests).toBe(1);
    await expect(page.locator(".ProseMirror")).not.toContainText(oldText);
    if (action === "rewrite") await expect(page.locator(".ProseMirror")).toContainText(newText);
    expect(
      await page
        .locator(".ProseMirror p")
        .evaluateAll((paragraphs) => paragraphs.map((paragraph) => paragraph.textContent ?? ""))
    ).toEqual(expectedParagraphs);
    await expect
      .poll(async () => {
        const record = (await tasks(page)).find((task) => task.id === original.id);
        return record && !record.content.includes(oldText) && JSON.stringify(record.lock_ids);
      })
      .toBe(JSON.stringify(action === "rewrite" ? [retainedLock, newLock] : [retainedLock]));
    const persisted = (await tasks(page)).find((task) => task.id === original.id);
    expect(persisted).toBeDefined();
    const owned = await page.evaluate(
      ({ taskId, retainedLock }) =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith("impetus.draft."))
          .map(
            ([, raw]) => JSON.parse(raw) as { taskId?: string; content: string; lockIds: string[] }
          )
          .find(
            (snapshot) => snapshot.taskId === taskId && snapshot.lockIds.includes(retainedLock)
          ),
      { taskId: original.id, retainedLock }
    );
    expect(owned).toBeDefined();
    expect(persisted?.content).toBe(owned?.content);
    expect(persisted?.lock_ids).toEqual(owned?.lockIds);
    await page.getByTestId("mode-selector").selectOption("off");
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    await expect(page.locator(".ProseMirror")).toContainText(writerText);
    await expect(page.locator(".ProseMirror")).toContainText(retainedText);
    await expect(
      page.locator(`.ProseMirror .locked-content[data-lock-id="${retainedLock}"]`).first()
    ).toBeVisible();
    expect(
      await page
        .locator(".ProseMirror p")
        .evaluateAll((paragraphs) => paragraphs.map((paragraph) => paragraph.textContent ?? ""))
    ).toEqual(expectedParagraphs);
    expect((await tasks(page)).find((task) => task.id === original.id)).toEqual(persisted);
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
      expect((await savedText(page, "Human after trusted delete", original.id)).lock_ids).toEqual([
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
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const originalServer = await createServerTask(page, `Authoritative unchanged ${randomUUID()}`);
  const key = `impetus.draft.${encodeURIComponent(alice.id)}.malformed_browser`;
  const olderKey = `impetus.draft.${encodeURIComponent(alice.id)}.older_valid_browser`;
  const selectionKey = `impetus.selection.${encodeURIComponent(alice.id)}.editor`;
  const content = `Malformed owned source ${randomUUID()}`;
  const raw = JSON.stringify({
    draftId: "malformed_browser",
    content,
    lockIds: "must-be-an-array",
    taskId: originalServer.id,
    version: 0,
    versionKnown: false,
    dirty: true,
    updatedAt: Date.now(),
  });
  const older = JSON.stringify({
    draftId: "older_valid_browser",
    content: `Older dirty body must not upload ${randomUUID()}`,
    lockIds: [],
    taskId: originalServer.id,
    version: 0,
    versionKnown: true,
    dirty: true,
    updatedAt: Date.now() - 1000,
  });
  await page.addInitScript(
    ({ key, raw, olderKey, older, selectionKey }) => {
      // Seed only the first visit. Refresh preserves the application's actual
      // recovery pointer and never silently repairs or replaces a mutated raw source.
      if (localStorage.getItem(key) !== null) return;
      localStorage.setItem(key, raw);
      localStorage.setItem(olderKey, older);
      sessionStorage.setItem(selectionKey, "malformed_browser");
    },
    { key, raw, olderKey, older, selectionKey }
  );
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/tasks") &&
      ["POST", "PUT"].includes(request.method())
    )
      writes.push(request.url());
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".account-bar")).toBeVisible();
  await dismissWelcome(page);
  const issue = page.getByRole("region", { name: "Account draft recovery" });
  await expect(issue).toContainText("Owned draft needs recovery");
  await expect(page.getByTestId("unrecovered-account-draft")).toHaveText(content);
  expect(
    await page
      .getByTestId("unrecovered-account-draft")
      .evaluate((element) => (element as HTMLElement).isContentEditable)
  ).toBe(false);
  await expect(page.locator(".ProseMirror")).toHaveCount(0);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    issue.getByRole("button", { name: "Export original account draft" }).click(),
  ]);
  const file = resolve(evidence, "browser-malformed-owned-original.json");
  await download.saveAs(file);
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ key, raw });
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
  expect(await page.evaluate((key) => localStorage.getItem(key), olderKey)).toBe(older);
  expect(writes).toEqual([]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(issue).toContainText("Owned draft needs recovery");
  await dismissWelcome(page);
  await expect(page.getByTestId("unrecovered-account-draft")).toHaveText(content);
  expect(
    await page
      .getByTestId("unrecovered-account-draft")
      .evaluate((element) => (element as HTMLElement).isContentEditable)
  ).toBe(false);
  await expect(page.locator(".ProseMirror")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
  expect(writes).toEqual([]);
  const actual = await page.evaluate(
    async ({ api, id, owner }) => {
      const response = await fetch(`${api}/tasks/${id}`, {
        credentials: "include",
        headers: { "X-Expected-User-ID": owner },
      });
      if (!response.ok) throw new Error(`Blocked recovery DB read failed: ${response.status}`);
      return response.json() as Promise<TaskRecord>;
    },
    { api: API, id: originalServer.id, owner: alice.id }
  );
  expect(actual.content).toBe(originalServer.content);
  expect(actual.lock_ids).toEqual(originalServer.lock_ids);
  expect(actual.version).toBe(originalServer.version);
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
  const lockId = `expiry_${randomUUID()}`;
  await addLock(page, "Expiry protected", lockId);
  const before = await savedText(page, lockId);
  await expire(page);
  const work: string[] = [];
  page.on("request", (request) => {
    if (protectedPath(request.url())) work.push(request.url());
  });
  await prefixWriting(page, "Offline continuation ");
  const local = await ownedContinuation(page, before.id, "Offline continuation ", [lockId]);
  expect(local.content).toContain(text);
  expect(local.content).toContain(`Expiry protected <!-- lock:${lockId} source:muse -->`);
  await page.waitForTimeout(1_000);
  expect(work).toEqual([]);
  expect(await auditTask(browser, alice, before.id)).toEqual(before);
  await page.getByRole("button", { name: "Sign in again", exact: true }).click();
  await login(page, alice);
  await ready(page);
  await expect(page.locator(".ProseMirror")).toContainText("Offline continuation");
  await expect(page.locator(".ProseMirror")).toContainText("Expiry protected");
  const record = await savedText(page, "Offline continuation", before.id);
  expect(record.content).toBe(local.content);
  expect(record.lock_ids).toEqual([lockId]);
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
  const record = await savedText(page, localLock);
  const serverText = `# Server chosen ${randomUUID()}\n\n> Server protected <!-- lock:server_browser_conflict -->\n\nServer writer tail.`;
  const server = await updateServer(page, record, serverText, ["server_browser_conflict"]);
  await expire(page);
  await prefixWriting(page, "Local unsaved conflict ");
  const local = await ownedContinuation(page, record.id, "Local unsaved conflict ", [localLock]);
  expect(local.content).toContain(localText);
  expect(local.content).toContain(
    `Local protected conflict <!-- lock:${localLock} source:muse -->`
  );
  expect(await auditTask(browser, alice, record.id)).toEqual(server);
  await page.getByRole("button", { name: "Sign in again", exact: true }).click();
  await login(page, alice);
  const conflict = page.getByRole("region", { name: "Version conflict" });
  await expect(conflict).toBeVisible();
  await expect(page.locator(".account-bar")).toContainText(alice.email);
  // The expiry probe opened Statistics before its real 401 disabled remote UI.
  // Close the restored public dialog before interacting with the conflict controls.
  const statistics = page.getByRole("dialog", { name: "Writing Statistics", exact: true });
  if (await statistics.isVisible()) {
    await statistics.getByRole("button", { name: "Close Stats", exact: true }).click();
    await expect(statistics).toBeHidden();
  }
  await expect(conflict).toContainText("Local protected conflict");
  await expect(conflict).toContainText("Server protected");
  const summaryTargets = [];
  for (const name of ["Local draft", "Server version"]) {
    const summary = conflict.locator("summary").filter({ hasText: name });
    await summary.scrollIntoViewIfNeeded();
    const before = await summary.boundingBox();
    expect(before).not.toBeNull();
    expect(before!.width).toBeGreaterThanOrEqual(44);
    expect(before!.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press("Space");
    await expect(summary.locator("..")).toHaveAttribute("open", "");
    const after = await summary.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.width).toBeGreaterThanOrEqual(44);
    expect(after!.height).toBeGreaterThanOrEqual(44);
    summaryTargets.push({ name, before, after, nativeSpaceExpanded: true });
  }
  await writeFile(
    resolve(evidence, `summary-targets-${process.env.AUTH_E2E_RUN ?? "current"}.json`),
    JSON.stringify(summaryTargets, null, 2)
  );
  expect(
    await conflict
      .locator("details")
      .filter({ hasText: "Local draft" })
      .locator("pre")
      .textContent()
  ).toBe(local.content);
  expect(
    await conflict
      .locator("details")
      .filter({ hasText: "Server version" })
      .locator("pre")
      .textContent()
  ).toBe(server.content);
  await conflict.getByRole("button", { name: "Use server version" }).click();
  await expect(page.locator(".ProseMirror")).toContainText("Server chosen");
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true");
  await expect(page.locator(".ProseMirror")).not.toContainText("Local protected conflict");
  await prefixWriting(page, "Server continuation ");
  const chosen = await savedText(page, "Server continuation", record.id);
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
          "X-Expected-User-ID": (
            (await (await fetch(`${api}/auth/me`, { credentials: "include" })).json()) as {
              id: string;
            }
          ).id,
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
        const response = await fetchActualRoute(route);
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
      await collectBusinessRequests(page);
      await page.route("**/tasks/*", async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        const response = await fetchActualRoute(route);
        body = await response.text();
        held = route;
      });
      await prefixWriting(page, "Queued private A ");
    } else {
      await page.route("**/impetus/generate-intervention", async (route) => {
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
      await page
        .getByRole("button", { name: "I'm stuck! Trigger AI assistance", exact: true })
        .click();
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

async function gateResponse(method: string, path: string): Promise<string> {
  const id = randomUUID();
  const env = resolve(evidence, "environment");
  await Promise.all(
    [
      "response-gate-observed.json",
      "response-gate-released.json",
      "response-gate-disconnected.json",
    ].map((file) => rm(resolve(env, file), { force: true }))
  );
  await writeFile(resolve(env, "response-gate.json"), JSON.stringify({ id, method, path }));
  return id;
}

async function gateObserved(id: string, file = "response-gate-observed.json"): Promise<void> {
  await expect
    .poll(async () => {
      try {
        return (
          JSON.parse(await readFile(resolve(evidence, "environment", file), "utf8")) as {
            id: string;
          }
        ).id;
      } catch {
        return null;
      }
    })
    .toBe(id);
}

async function releaseGate(): Promise<void> {
  await rm(resolve(evidence, "environment", "response-gate.json"), { force: true });
}

test.afterEach(releaseGate);

test("logout waiting preserves the final unique memory body when storage fails after the real server commits logout", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const before = await write(page, `Before sign out ${randomUUID()}`);
  const id = await gateResponse("POST", "/auth/logout");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await gateObserved(id);
  await expect(page.getByRole("region", { name: "Session status" })).toContainText("Signing out");
  const tail = `Unique latest memory ${randomUUID()}`;
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("impetus.draft."))
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await prefixWriting(page, tail);
  await expect(page.locator(".ProseMirror")).toContainText(tail);
  expect(
    await page.evaluate(
      (marker) => Object.values(localStorage).some((value) => value.includes(marker)),
      tail
    )
  ).toBe(false);
  await releaseGate();
  await gateObserved(id, "response-gate-released.json");
  await expect(page.getByRole("region", { name: "Session status" })).toContainText(
    "Server sign out is confirmed"
  );
  await expect(page.locator(".ProseMirror")).toContainText(tail);
  await expect(page.locator(".ProseMirror")).toContainText(before.content.trim());
  await expect(page.locator(".task-status")).toHaveText("Save failed");
  await expect(page.getByRole("region", { name: "Session status" })).toContainText(
    /local|recover/i
  );
  expect((await page.context().cookies()).some((cookie) => cookie.name === "access_token")).toBe(
    false
  );
});

test("multi-tab real auth headers stay undelivered until release and a closed sender cannot unlock another auth write", async ({
  browser,
}, testInfo) => {
  const sender = await makePage(browser);
  await sender.goto("/", { waitUntil: "domcontentloaded" });
  const other = await sender.context().newPage();
  await other.goto("/", { waitUntil: "domcontentloaded" });
  await expect(other.getByRole("form", { name: "Login", exact: true })).toBeVisible();
  const id = await gateResponse("POST", "/auth/login");
  await login(sender, alice);
  await gateObserved(id);
  const gatedHeaders = JSON.parse(
    await readFile(resolve(evidence, "environment", "response-gate-observed.json"), "utf8")
  ) as { status: number; set_cookie_headers_present: boolean };
  expect(gatedHeaders.status).toBe(200);
  expect(gatedHeaders.set_cookie_headers_present).toBe(true);
  expect((await sender.context().cookies()).some((cookie) => cookie.name === "access_token")).toBe(
    false
  );
  expect(await other.evaluate(() => localStorage.getItem("impetus.auth.pending"))).not.toBeNull();
  let authWrites = 0;
  other.on("request", (request) => {
    if (new URL(request.url()).pathname === "/auth/login" && request.method() === "POST")
      authWrites++;
  });
  await login(other, bob);
  await sender.close();
  await expect(other.getByRole("alert")).toContainText(
    /not confirmed|could not be confirmed|another page|pending|still pending|unknown/i
  );
  expect(authWrites).toBe(0);
  expect(await other.evaluate(() => localStorage.getItem("impetus.auth.pending"))).not.toBeNull();
  await releaseGate();
  await gateObserved(id, "response-gate-released.json");
  const transportEvidence = await readFile(
    resolve(evidence, "environment", "response-gate-released.json"),
    "utf8"
  );
  await testInfo.attach("closed-sender-real-transport", {
    body: transportEvidence,
    contentType: "application/json",
  });
  const transport = (
    JSON.parse(transportEvidence) as {
      transport: { uvicorn_cycle_observed: boolean; transport_write_observed: boolean };
    }
  ).transport;
  expect(transport.uvicorn_cycle_observed).toBe(true);
  expect(transport.transport_write_observed).toBe(true);
  expect((await other.context().cookies()).some((cookie) => cookie.name === "access_token")).toBe(
    false
  );
  await other.reload({ waitUntil: "domcontentloaded" });
  await login(other, bob);
  await expect(other.getByRole("alert")).toContainText(
    /not confirmed|could not be confirmed|another page|pending|still pending|unknown/i
  );
  expect(authWrites).toBe(0);
});

test("multi-tab shared cookie rejects account A writes and logout after account B signs in", async ({
  browser,
}) => {
  const first = await makePage(browser, alice);
  await first.goto("/", { waitUntil: "domcontentloaded" });
  await ready(first);
  const marker = `Account A private ${randomUUID()}`;
  const original = await write(first, marker);
  const other = await first.context().newPage();
  await other.goto("/", { waitUntil: "domcontentloaded" });
  await ready(other);
  await signOut(other);
  await login(other, bob);
  await ready(other);
  const results = await first.evaluate(
    async ({ api, expectedUser, taskId, version }) => {
      const csrf =
        document.cookie
          .split(";")
          .map((cookie) => cookie.trim())
          .find((cookie) => cookie.startsWith("csrf_token="))
          ?.slice(11) ?? "";
      const headers = {
        "X-Expected-User-ID": expectedUser,
        "X-CSRF-Token": csrf,
        "Content-Type": "application/json",
      };
      const save = await fetch(`${api}/tasks/${taskId}`, {
        method: "PUT",
        credentials: "include",
        headers,
        body: JSON.stringify({ content: "Wrong-account contamination", lock_ids: [], version }),
      });
      const logout = await fetch(`${api}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      const me = await fetch(`${api}/auth/me`, { credentials: "include" });
      return {
        save: { status: save.status, body: await save.json() },
        logout: { status: logout.status, body: await logout.json() },
        me: (await me.json()) as { id: string },
      };
    },
    { api: API, expectedUser: alice.id, taskId: original.id, version: original.version }
  );
  expect(results.save.status).toBe(409);
  expect(results.save.body.code).toBe("account_mismatch");
  expect(results.logout.status).toBe(409);
  expect(results.logout.body.code).toBe("account_mismatch");
  expect(results.me.id).toBe(bob.id);
  expect(
    (await tasks(other)).some(
      (task) =>
        task.content.includes(marker) || task.content.includes("Wrong-account contamination")
    )
  ).toBe(false);
  expect(
    await other.evaluate(
      ({ account, marker }) =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith(`impetus.draft.${account}.`))
          .some(([, value]) => value.includes(marker)),
      { account: bob.id, marker }
    )
  ).toBe(false);
});

test("multi-tab same-account copies keep both writers and each selected task through independent refresh", async ({
  browser,
}) => {
  const first = await makePage(browser, alice);
  await first.goto("/", { waitUntil: "domcontentloaded" });
  await ready(first);
  await write(first, `Shared source ${randomUUID()}`);
  const other = await first.context().newPage();
  await other.goto("/", { waitUntil: "domcontentloaded" });
  await ready(other);
  const a = `Independent writer A ${randomUUID()}`;
  const b = `Independent writer B ${randomUUID()}`;
  await first.route("**/tasks/*", (route) =>
    route.request().method() === "PUT" ? route.abort("failed") : route.continue()
  );
  await other.route("**/tasks/*", (route) =>
    route.request().method() === "PUT" ? route.abort("failed") : route.continue()
  );
  await prefixWriting(first, a);
  await prefixWriting(other, b);
  await expect
    .poll(async () =>
      first.evaluate(
        ({ id, a, b }) => {
          const entries = Object.entries(localStorage).filter(([key]) =>
            key.startsWith(`impetus.draft.${id}.`)
          );
          const keysA = entries.filter(([, value]) => value.includes(a)).map(([key]) => key);
          const keysB = entries.filter(([, value]) => value.includes(b)).map(([key]) => key);
          return keysA.length > 0 && keysB.length > 0 && keysA.every((key) => !keysB.includes(key));
        },
        { id: alice.id, a, b }
      )
    )
    .toBe(true);
  await first.reload({ waitUntil: "domcontentloaded" });
  await other.reload({ waitUntil: "domcontentloaded" });
  await expect(first.locator(".ProseMirror")).toContainText(a);
  await expect(first.locator(".ProseMirror")).not.toContainText(b);
  await expect(other.locator(".ProseMirror")).toContainText(b);
  await expect(other.locator(".ProseMirror")).not.toContainText(a);
});

test("unknown owned version keeps complete local and server content without uploading", async ({
  browser,
}) => {
  const seed = await makePage(browser, alice);
  await seed.goto("/", { waitUntil: "domcontentloaded" });
  await ready(seed);
  const server = await createServerTask(seed, `Server unknown version ${randomUUID()}`);
  const local = `Local unknown version ${randomUUID()}`;
  const page = await makePage(browser, alice);
  await page.context().addInitScript(
    ({ id, task, local }) => {
      const draftId = "unknown-version-browser";
      localStorage.setItem(
        `impetus.draft.${id}.${draftId}`,
        JSON.stringify({
          draftId,
          content: local,
          lockIds: [],
          taskId: task.id,
          version: 0,
          versionKnown: false,
          dirty: true,
          updatedAt: Date.now(),
        })
      );
    },
    { id: alice.id, task: server, local }
  );
  const writes: string[] = [];
  const writeBodies: Promise<void>[] = [];
  await collectBusinessRequests(page);
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === `/tasks/${server.id}`) {
      const index = writes.push("") - 1;
      writeBodies.push(
        requestText(request).then((body) => {
          writes[index] = body;
        })
      );
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "Version conflict" })).toBeVisible();
  await dismissWelcome(page);
  await page.getByText("Local draft", { exact: true }).click();
  await page.getByText("Server version", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Version conflict" })).toContainText(local);
  await expect(page.getByRole("region", { name: "Version conflict" })).toContainText(
    server.content
  );
  await Promise.all(writeBodies);
  expect(writes).toEqual([]);
  expect((await tasks(seed)).find((task) => task.id === server.id)).toEqual(server);
});

test("account export preserves all 0 100 101 and 201 real database tasks and refuses a failed second page or changing collection", async ({
  browser,
}) => {
  const page = await makePage(browser, bob);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  await page.getByRole("combobox", { name: "Export format" }).selectOption("json");
  const button = page.locator(".export-panel").getByRole("button", { name: "Export", exact: true });
  for (const count of [0, 100, 101, 201] as const) {
    const seeded = JSON.parse(
      execFileSync(
        "../server/.venv/bin/python",
        [
          resolve("../scripts/authenticated-editor-validation/seed_tasks.py"),
          bob.id,
          String(count),
        ],
        { encoding: "utf8" }
      )
    ) as { id: string; content: string; lock_ids: string[]; version: number }[];
    const download = page.waitForEvent("download");
    await button.click();
    const file = await download;
    const path = await file.path();
    expect(path).not.toBeNull();
    const exported = JSON.parse(await readFile(path!, "utf8")) as {
      tasks: { tasks: TaskRecord[]; total: number };
    };
    expect(exported.tasks.total).toBe(count);
    expect(exported.tasks.tasks).toHaveLength(count);
    expect(new Set(exported.tasks.tasks.map((task) => task.id)).size).toBe(count);
    expect(
      exported.tasks.tasks
        .map(({ id, content, lock_ids, version }) => ({ id, content, lock_ids, version }))
        .sort((a, b) => a.id.localeCompare(b.id))
    ).toEqual(
      seeded
        .map(({ id, content, lock_ids, version }) => ({ id, content, lock_ids, version }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
  }
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.route("**/tasks/?*", (route) =>
    new URL(route.request().url()).searchParams.get("offset") === "100"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Second page failed" }),
        })
      : route.continue()
  );
  await button.click();
  await expect(page.locator(".export-panel").getByRole("alert")).toContainText("503");
  expect(downloads).toBe(0);
  await page.unroute("**/tasks/?*");
  let changed = false;
  await page.route("**/tasks/?*", async (route) => {
    const response = await fetchActualRoute(route);
    if (!changed && new URL(route.request().url()).searchParams.get("offset") === "0") {
      changed = true;
      await createServerTask(page, "Real database addition during export");
    }
    await route.fulfill({ response });
  });
  await button.click();
  await expect(page.locator(".export-panel").getByRole("alert")).toContainText(
    "collection changed"
  );
  expect(downloads).toBe(0);
});

test("legacy storage read failure remains visible until retry recovers both original strings", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  const content = `Unread original ${randomUUID()}`;
  const metaRaw = JSON.stringify({ lockIds: [], taskId: "unassigned-original", version: 17 });
  await page.addInitScript(
    ({ content, metaRaw }) => {
      localStorage.setItem("impetus.task.cache", content);
      localStorage.setItem("impetus.task.meta", metaRaw);
      const original = Storage.prototype.getItem;
      Object.defineProperty(window, "restoreLegacyRead", {
        value: () => {
          Storage.prototype.getItem = original;
        },
        configurable: true,
      });
      Storage.prototype.getItem = function (key: string) {
        if (key === "impetus.task.cache" || key === "impetus.task.meta")
          throw new DOMException("Controlled legacy read denial", "SecurityError");
        return original.call(this, key);
      };
    },
    { content, metaRaw }
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const recovery = page.getByRole("region", { name: "Unassigned draft recovery" });
  await expect(recovery).toContainText("Unassigned draft could not be read");
  await expect(recovery.getByRole("button", { name: "Import as a new draft" })).toBeDisabled();
  await expect(
    recovery.getByRole("button", { name: "Export original draft", exact: true })
  ).toBeDisabled();
  expect((await tasks(page)).some((task) => task.content.includes(content))).toBe(false);
  await page.evaluate(() => {
    const restore = Reflect.get(window, "restoreLegacyRead");
    if (typeof restore !== "function") throw new Error("Legacy read recovery helper missing");
    restore();
  });
  await recovery.getByRole("button", { name: "Retry reading unassigned draft" }).click();
  await expect(recovery).toContainText("Unassigned draft found");
  await expect(recovery.getByRole("button", { name: "Import as a new draft" })).toBeEnabled();
  const download = page.waitForEvent("download");
  await recovery.getByRole("button", { name: "Export original draft", exact: true }).click();
  const path = resolve(evidence, "legacy-read-recovered-original.json");
  await (await download).saveAs(path);
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ contentRaw: content, metaRaw });
  expect(
    await page.evaluate(() => [
      localStorage.getItem("impetus.task.cache"),
      localStorage.getItem("impetus.task.meta"),
    ])
  ).toEqual([content, metaRaw]);
});

test("unconfirmed creation preserves continued writing across refresh and explicit adoption retains a complete conflict before choosing the server", async ({
  browser,
}) => {
  const page = await makePage(browser, alice);
  const draftId = `creation_${randomUUID()}`;
  const attempted = `Unique unacknowledged creation ${randomUUID()}`;
  const key = `impetus.draft.${encodeURIComponent(alice.id)}.${encodeURIComponent(draftId)}`;
  await page.addInitScript(
    ({ key, draftId, content, owner }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(
          key,
          JSON.stringify({
            draftId,
            content,
            lockIds: [],
            taskId: null,
            version: 0,
            versionKnown: true,
            dirty: true,
            updatedAt: Date.now(),
          })
        );
        sessionStorage.setItem(`impetus.selection.${encodeURIComponent(owner)}.editor`, draftId);
      }
    },
    { key, draftId, content: attempted, owner: alice.id }
  );
  let posts = 0;
  let puts = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname.startsWith("/tasks/")) puts++;
  });
  let committed: TaskRecord | null = null;
  await collectBusinessRequests(page);
  await page.route("**/tasks", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    const response = await fetchActualRoute(route);
    expect(response.status()).toBe(201);
    committed = (await response.json()) as TaskRecord;
    // The actual database commit succeeds, while the browser receives no acknowledgement.
    await route.abort("failed");
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".ProseMirror[contenteditable='true']")).toBeVisible();
  await dismissWelcome(page);
  const recovery = page.getByRole("region", { name: "Unconfirmed task creation" });
  await expect(recovery).toBeVisible();
  await expect.poll(() => committed !== null).toBe(true);
  expect(posts).toBe(1);
  const tail = ` Continued after unknown ${randomUUID()}`;
  await prefixWriting(page, tail);
  await expect(page.locator(".ProseMirror")).toContainText(tail);
  await expect
    .poll(() =>
      page.evaluate(
        (tail) =>
          Object.entries(localStorage).some(
            ([key, raw]) => key.startsWith("impetus.draft.") && raw.includes(tail)
          ),
        tail
      )
    )
    .toBe(true);
  const continued = await page.evaluate(
    ({ owner, marker }) => {
      const drafts = Object.entries(localStorage)
        .filter(([key]) => key.startsWith(`impetus.draft.${encodeURIComponent(owner)}.`))
        .map(
          ([, raw]) =>
            JSON.parse(raw) as {
              content: string;
              lockIds: string[];
              creationUncertain?: boolean;
            }
        );
      return drafts.find((draft) => draft.creationUncertain && draft.content.includes(marker));
    },
    { owner: alice.id, marker: tail }
  );
  expect(continued?.content).toContain(attempted + tail);
  expect(continued?.lockIds).toEqual([]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(recovery).toBeVisible();
  await dismissWelcome(page);
  await expect(page.locator(".ProseMirror")).toContainText(attempted + tail);
  expect(posts).toBe(1);
  await recovery.getByRole("button", { name: "Check for the created task" }).click();
  const candidate = recovery.getByRole("button", { name: /^Use created task:/ });
  await expect(candidate).toHaveCount(1);
  await candidate.click();
  await expect(recovery).toHaveCount(0);
  const conflict = page.getByRole("region", { name: "Version conflict" });
  await expect(conflict).toBeVisible();
  await conflict.locator("summary", { hasText: "Local draft" }).click();
  await conflict.locator("summary", { hasText: "Server version" }).click();
  await expect(conflict.locator("details").filter({ hasText: "Local draft" })).toContainText(
    attempted + tail
  );
  await expect(conflict.locator("details").filter({ hasText: "Server version" })).toContainText(
    attempted
  );
  await expect(conflict.locator("details").filter({ hasText: "Server version" })).not.toContainText(
    tail
  );
  expect(puts).toBe(0);
  const beforeChoice = (await tasks(page)).find(
    (task) => task.id === (committed as TaskRecord | null)?.id
  );
  expect(beforeChoice?.content).toBe(attempted);
  expect(beforeChoice?.lock_ids).toEqual([]);
  expect(beforeChoice?.version).toBe((committed as TaskRecord | null)?.version);
  await conflict.getByRole("button", { name: "Use server version" }).click();
  await ready(page);
  await expect(page.locator(".ProseMirror")).toHaveText(attempted);
  const backups = await page.evaluate(
    (owner) =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith(`impetus.draft.${encodeURIComponent(owner)}.`))
        .map(
          ([, raw]) =>
            JSON.parse(raw) as { content: string; lockIds: string[]; recoveryOf?: string }
        ),
    alice.id
  );
  expect(
    backups.some(
      (draft) =>
        draft.recoveryOf &&
        draft.content === continued?.content &&
        JSON.stringify(draft.lockIds) === JSON.stringify(continued?.lockIds)
    )
  ).toBe(true);
  const afterChoice = (await tasks(page)).find((task) => task.id === beforeChoice?.id);
  expect(afterChoice?.content).toBe(attempted);
  expect(afterChoice?.lock_ids).toEqual([]);
  expect(afterChoice?.version).toBe(beforeChoice?.version);
  expect(puts).toBe(0);
  expect(posts).toBe(1);
  expect((await tasks(page)).filter((task) => task.content.includes(attempted))).toHaveLength(1);
});

for (const delayed of ["read", "save"] as const) {
  test(`task switch rejects the earlier task's delayed ${delayed} completion and saves only the selected task`, async ({
    browser,
  }) => {
    const page = await makePage(browser, alice);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await ready(page);
    const originalA = `Selection A ${randomUUID()}`;
    const originalB = `Selection B ${randomUUID()}`;
    const recordA = await createServerTask(page, originalA);
    const recordB = await createServerTask(page, originalB);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    await page.getByTestId(`task-item-${recordA.id}`).click();
    await expect(page.locator(".ProseMirror")).toContainText(originalA);
    let held: Route | undefined;
    let body = "";
    const path = delayed === "read" ? recordB.id : recordA.id;
    if (delayed === "save") await collectBusinessRequests(page);
    await page.route(`**/tasks/${path}`, async (route) => {
      if (route.request().method() !== (delayed === "read" ? "GET" : "PUT") || held)
        return route.continue();
      const response = await fetchActualRoute(route);
      body = await response.text();
      held = route;
    });
    if (delayed === "read") await page.getByTestId(`task-item-${recordB.id}`).click();
    else await prefixWriting(page, " Delayed A save");
    await expect.poll(() => Boolean(held) && Boolean(body)).toBe(true);
    const selected = delayed === "read" ? recordA : recordB;
    const expectedBody = delayed === "read" ? originalA : originalB;
    await page.getByTestId(`task-item-${selected.id}`).click();
    await expect(page.locator(".ProseMirror")).toContainText(expectedBody);
    await releaseRoute(held!, body);
    await ready(page);
    await expect(page.getByTestId(`task-item-${selected.id}`)).toHaveAttribute(
      "aria-current",
      "true"
    );
    await expect(page.locator(".ProseMirror")).toContainText(expectedBody);
    await expect(page.locator(".ProseMirror")).not.toContainText(
      delayed === "read" ? originalB : originalA
    );
    await page.unroute(`**/tasks/${path}`);
    const tail = ` Selected continuation ${randomUUID()}`;
    await prefixWriting(page, tail);
    await expect(page.locator(".ProseMirror")).toContainText(tail);
    expect((await savedText(page, tail)).id).toBe(selected.id);
    const other = (await tasks(page)).find(
      (task) => task.id === (delayed === "read" ? recordB.id : recordA.id)
    );
    expect(other?.content).not.toContain(tail);
  });
}

for (const mode of ["unsubmitted", "another"] as const) {
  test(`multi-tab focus rechecks the real session while retaining a modal ${mode} title and its explicit creation mode`, async ({
    browser,
  }) => {
    const page = await makePage(browser, bob);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await ready(page);
    const other = await page.context().newPage();
    await other.goto("/", { waitUntil: "domcontentloaded" });
    await ready(other);
    for (const target of [page, other]) {
      await observeNativeFocus(target);
      await restoreNativeBrowserFocus(target);
    }
    await page.bringToFront();
    await ready(page);
    let posts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/tasks") posts++;
    });
    const original = `Focus original ${mode} ${randomUUID()}`;
    await page.getByRole("button", { name: "Create new task", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Create New Task" });
    const input = modal.getByLabel("Task Title", { exact: false });
    await enterText(page, input, original);
    if (mode === "another") {
      await collectBusinessRequests(page);
      await page.route("**/tasks", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await fetchActualRoute(route);
        expect(response.status()).toBe(201);
        await route.abort("failed");
      });
      await modal.getByRole("button", { name: "Create Task", exact: true }).click();
      await expect(modal.getByLabel("Attempted task content")).toHaveText(original);
      await modal.getByRole("button", { name: "Create another task", exact: true }).click();
    }
    const title = `Unsubmitted focused ${mode} ${randomUUID()}`;
    await enterText(page, input, title);
    const submit = modal.getByRole("button", {
      name: mode === "another" ? "Create another task anyway" : "Create Task",
      exact: true,
    });
    await expect(submit).toBeEnabled();
    const expectedPosts = mode === "another" ? 1 : 0;
    expect(posts).toBe(expectedPosts);
    const initialFocus = await nativeFocusState(page);
    await other.bringToFront();
    await expect.poll(async () => (await nativeFocusState(page)).hasFocus).toBe(false);
    await expect.poll(async () => (await nativeFocusState(other)).hasFocus).toBe(true);
    let held: Route | undefined;
    let body = "";
    await page.route("**/auth/me", async (route) => {
      const response = await fetchActualRoute(route);
      expect(response.status()).toBe(200);
      body = await response.text();
      held = route;
    });
    await page.bringToFront();
    await expect.poll(() => Boolean(held)).toBe(true);
    await expect.poll(async () => (await nativeFocusState(page)).hasFocus).toBe(true);
    await expect.poll(async () => (await nativeFocusState(other)).hasFocus).toBe(false);
    const restoredFocus = await nativeFocusState(page);
    const transitions = restoredFocus.events.slice(initialFocus.events.length);
    expect(transitions.some((event) => event.type === "blur" && event.isTrusted)).toBe(true);
    expect(transitions.some((event) => event.type === "focus" && event.isTrusted)).toBe(true);
    await writeFile(
      resolve(evidence, `native-focus-${process.env.AUTH_E2E_RUN ?? "current"}-${mode}.json`),
      JSON.stringify({
        engine: browser.browserType().name(),
        channel: test.info().project.use.channel,
        os: process.platform,
        display: process.env.DISPLAY ?? null,
        driverProtocol:
          browser.browserType().name() === "chromium"
            ? "public CDP; Emulation.setFocusEmulationEnabled false"
            : browser.browserType().name() === "firefox" &&
                test.info().project.use.channel === "moz-firefox"
              ? "Playwright 1.63 standard Mozilla WebDriver BiDi; official stock Firefox; two native-focus preferences false"
              : "Playwright 1.63 private WebKit PageProxy; Emulation.setActiveAndFocused optional active cleared",
        method:
          browser.browserType().name() === "firefox" &&
          test.info().project.use.channel === "moz-firefox"
            ? "native bringToFront through BiDi browsingContext.activate; observe trusted window focus and blur"
            : "native bringToFront; observe trusted events after removing driver focus emulation",
        initialFocus,
        restoredFocus,
        otherFocus: await nativeFocusState(other),
        realMeResponseHeld: Boolean(held),
      })
    );
    await expect(modal).toBeVisible();
    await expect(input).toHaveValue(title);
    await expect(input).toBeEnabled();
    await expect(submit).toBeDisabled();
    if (mode === "another")
      await expect(modal.getByRole("button", { name: "Recheck creation" })).toBeDisabled();
    const latest = `${title} continued while checked`;
    await enterText(page, input, latest);
    expect(posts).toBe(expectedPosts);
    await releaseRoute(held!, body);
    await expect(submit).toBeEnabled();
    await expect(input).toHaveValue(latest);
    await expect(page.locator(".account-bar")).toContainText(bob.email);
    expect(posts).toBe(expectedPosts);
    if (mode === "another")
      await expect(modal.getByLabel("Attempted task content")).toHaveText(original);
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  });
}

for (const failure of ["network", "incomplete201", "server500"] as const) {
  test(`modal unconfirmed creation ${failure} keeps its exact attempted body across refresh and rechecks all pages before explicitly selecting the committed task`, async ({
    browser,
  }) => {
    if (failure === "network") test.setTimeout(300_000);
    const page = await makePage(browser, bob);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await ready(page);
    const text = `Modal unknown ${failure} ${randomUUID()}`;
    let committed: TaskRecord | null = null;
    let posts = 0;
    await collectBusinessRequests(page);
    await page.route("**/tasks", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts++;
      const response = await fetchActualRoute(route);
      expect(response.status()).toBe(201);
      committed = (await response.json()) as TaskRecord;
      if (failure === "network") await route.abort("failed");
      else
        await route.fulfill({
          status: failure === "incomplete201" ? 201 : 500,
          contentType: "application/json",
          body: JSON.stringify(
            failure === "incomplete201"
              ? { content: text }
              : { detail: "Controlled missing creation acknowledgement" }
          ),
        });
    });
    await page.getByRole("button", { name: "Create new task", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Create New Task" });
    await enterText(page, modal.getByLabel("Task Title", { exact: false }), text);
    await modal.getByRole("button", { name: "Create Task", exact: true }).click();
    await expect(modal.getByLabel("Attempted task content")).toHaveText(text);
    await expect(modal.getByRole("button", { name: "Create Task", exact: true })).toBeDisabled();
    await expect.poll(() => committed !== null).toBe(true);
    expect(posts).toBe(1);
    const originals = await page.evaluate(
      (owner) =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith(`impetus.draft.${encodeURIComponent(owner)}.`))
          .map(([key, raw]) => ({
            key,
            raw,
            draft: JSON.parse(raw) as {
              content: string;
              lockIds: string[];
              creationUncertain?: boolean;
              recoveryOf?: string;
              creationAttempt?: { content: string; lockIds: string[] };
            },
          })),
      bob.id
    );
    const attempted = originals.find(
      (item) => item.draft.content === text && item.draft.recoveryOf === "create-task-modal"
    );
    expect(attempted?.draft.creationUncertain).toBe(true);
    expect(attempted?.draft.lockIds).toEqual([]);
    expect(attempted?.draft.creationAttempt).toEqual({ content: text, lockIds: [] });
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(modal).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    await page.getByRole("button", { name: "Create new task", exact: true }).click();
    await expect(modal.getByLabel("Attempted task content")).toHaveText(text);
    await expect(modal.getByRole("button", { name: "Create Task", exact: true })).toBeDisabled();
    expect(posts).toBe(1);
    const downloaded = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Export attempted content" }).click();
    const exportPath = resolve(evidence, `modal-unknown-${failure}-original.json`);
    await (await downloaded).saveAs(exportPath);
    const exported = JSON.parse(await readFile(exportPath, "utf8")) as {
      content: string;
      lockIds: string[];
      creationAttempt: { content: string; lockIds: string[] };
    };
    expect(exported.content).toBe(text);
    expect(exported.lockIds).toEqual([]);
    expect(exported.creationAttempt).toEqual({ content: text, lockIds: [] });
    if (failure === "network") {
      // Move the real candidate beyond the first 100 rows without deleting it.
      // APIRequestContext shares this browser's genuine cookies and bypasses
      // only the page's simulated lost acknowledgement, not the real backend.
      const csrf = (await page.context().cookies()).find(
        (cookie) => cookie.name === "csrf_token"
      )?.value;
      expect(csrf).toBeTruthy();
      let fixturePosts = 0;
      let fixtureWaits = 0;
      for (let index = 0; index < 201; index++) {
        const data = { content: `Later modal fixture ${index} ${randomUUID()}`, lock_ids: [] };
        const appendFixture = () => {
          fixturePosts++;
          return page.request.post(`${API}/tasks`, {
            headers: { "X-CSRF-Token": csrf!, "X-Expected-User-ID": bob.id },
            data,
          });
        };
        let seeded = await appendFixture();
        if (seeded.status() === 429) {
          fixtureWaits++;
          // This explicit fixture was refused before commit. Respect the real
          // server window; do not retry the creation under test or an unknown write.
          const seconds = Number(seeded.headers()["retry-after"]);
          expect(seconds).toBeGreaterThan(0);
          expect(seconds).toBeLessThanOrEqual(60);
          await seeded.dispose();
          const began = Date.now();
          let remaining = (seconds + 1) * 1000;
          while (remaining > 0) {
            const chunk = Math.min(30_000, remaining);
            await page.waitForTimeout(chunk);
            remaining -= chunk;
          }
          await writeFile(
            resolve(evidence, `setup-modal-seed-wait-${randomUUID()}.json`),
            JSON.stringify({
              run: process.env.AUTH_E2E_RUN ?? "current",
              fixtureIndex: index,
              status: 429,
              retryAfterSeconds: seconds,
              actualWaitedMs: Date.now() - began,
              coreCreationRetries: 0,
              testRetries: 0,
            })
          );
          seeded = await appendFixture();
        }
        expect(seeded.status()).toBe(201);
        const seededTask = (await seeded.json()) as TaskRecord;
        expect(seededTask.lock_ids).toEqual([]);
        expect(Number.isInteger(seededTask.version)).toBe(true);
        await seeded.dispose();
      }
      await writeFile(
        resolve(evidence, `setup-modal-seed-${process.env.AUTH_E2E_RUN ?? "current"}.json`),
        JSON.stringify({
          fixtureRows: 201,
          actualPostRequests: fixturePosts,
          refused429: fixtureWaits,
          coreCreationPosts: posts,
          coreCreationRetries: 0,
          testRetries: 0,
          timeoutReason: "real 100-per-minute fixture windows can require two Retry-After waits",
        })
      );
    }
    const offsets: number[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() === "GET" && url.pathname === "/tasks/")
        offsets.push(Number(url.searchParams.get("offset") ?? 0));
    });
    await modal.getByRole("button", { name: "Recheck creation" }).click();
    const selected = modal.getByRole("button", {
      name: `Use task ${(committed as TaskRecord | null)?.id}`,
      exact: true,
    });
    await expect(selected).toBeVisible();
    if (failure === "network") expect(offsets).toContain(200);
    expect(posts).toBe(1);
    await selected.click();
    await expect(modal).toHaveCount(0);
    await ready(page);
    await expect(page.locator(".ProseMirror")).toHaveText(text);
    expect(posts).toBe(1);
    const actual = await page.evaluate(
      async ({ api, taskId, owner }) => {
        const response = await fetch(`${api}/tasks/${taskId}`, {
          credentials: "include",
          headers: { "X-Expected-User-ID": owner },
        });
        if (!response.ok) throw new Error(`Committed modal task read failed: ${response.status}`);
        return response.json() as Promise<TaskRecord>;
      },
      { api: API, taskId: (committed as TaskRecord | null)?.id, owner: bob.id }
    );
    expect(actual.id).toBe((committed as TaskRecord | null)?.id);
    expect(actual.content).toBe(text);
    expect(actual.lock_ids).toEqual([]);
    expect(actual.version).toBe((committed as TaskRecord | null)?.version);
  });
}

test("performance baseline measures 10000 words and 10 locks with 30 input switch and lock samples", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const page = await makePage(browser, alice);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const locks = Array.from({ length: 10 }, (_, index) => `performance_lock_${index}`);
  const makeParagraphs = (marker: string) => [
    ...locks.map((_, index) => (index === 0 ? marker : `Locked${index}`)),
    ...Array.from({ length: 111 }, () => Array.from({ length: 90 }, () => "writing").join(" ")),
  ];
  const makeDocument = (marker: string) =>
    makeParagraphs(marker)
      .map((paragraph, index) =>
        index < locks.length ? `${paragraph}<!-- lock:${locks[index]} -->` : paragraph
      )
      .join("\n\n");
  const alpha = await createServerTask(page, makeDocument("PerformanceAlpha"), locks);
  const beta = await createServerTask(page, makeDocument("PerformanceBeta"), locks);
  const saveLatencies: number[] = [];
  page.on("requestfinished", (request) => {
    if (request.method() !== "PUT" || !new URL(request.url()).pathname.startsWith("/tasks/"))
      return;
    const timing = request.timing();
    if (timing.responseEnd >= 0 && timing.requestStart >= 0)
      saveLatencies.push(timing.responseEnd - timing.requestStart);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await page.getByTestId(`task-item-${alpha.id}`).click();
  await expect(page.locator(".ProseMirror")).toContainText("PerformanceAlpha");
  await expect
    .poll(() =>
      page
        .locator(".ProseMirror")
        .evaluate((element) =>
          [
            ...new Set(
              [...element.querySelectorAll(".locked-content[data-lock-id]")].map((node) =>
                node.getAttribute("data-lock-id")
              )
            ),
          ].sort()
        )
    )
    .toEqual([...locks].sort());
  expect(
    await page
      .locator(".ProseMirror")
      .evaluate((element) => (element as HTMLElement).innerText.trim().split(/\s+/).length)
  ).toBe(10_000);
  const documentChecks: {
    kind: "input" | "switch" | "lock";
    sample: number;
    taskId: string;
    completeBodySha256: string;
    exactLockIds: string[];
  }[] = [];
  const verifyCompleteDocument = async (
    kind: "input" | "switch" | "lock",
    sample: number,
    task: TaskRecord,
    marker: string,
    inserted = 0
  ) => {
    const expected = makeParagraphs(marker);
    expected[expected.length - 1] += "z".repeat(inserted);
    const actual = await page.locator(".ProseMirror").evaluate((element) => ({
      paragraphs: [...element.querySelectorAll("p")].map(
        (paragraph) => (paragraph as HTMLElement).innerText
      ),
      lockIds: [
        ...new Set(
          [...element.querySelectorAll(".locked-content[data-lock-id]")].map((node) =>
            node.getAttribute("data-lock-id")
          )
        ),
      ].sort(),
    }));
    // Keep this independent verification outside the measured event/paint interval.
    expect(actual.paragraphs).toEqual(expected);
    expect(actual.lockIds).toEqual([...locks].sort());
    documentChecks.push({
      kind,
      sample,
      taskId: task.id,
      completeBodySha256: createHash("sha256")
        .update(JSON.stringify(actual.paragraphs))
        .digest("hex"),
      exactLockIds: locks,
    });
  };
  const measure = (
    kind: "input" | "switch" | "lock",
    marker: string,
    initialLength = 0
  ): Promise<number> =>
    page.evaluate(
      ({ kind, marker, initialLength }) =>
        new Promise<number>((resolve, reject) => {
          const eventName =
            kind === "input" ? "beforeinput" : kind === "switch" ? "pointerdown" : "keydown";
          const timeout = window.setTimeout(() => {
            document.removeEventListener(eventName, start, true);
            reject(new Error(`Performance ${kind} event/paint did not settle`));
          }, 10_000);
          function start() {
            document.removeEventListener(eventName, start, true);
            const began = performance.now();
            function settle() {
              const editor = document.querySelector(".ProseMirror");
              const content = editor?.textContent ?? "";
              const ready =
                editor?.getAttribute("contenteditable") === "true" &&
                content.includes(marker) &&
                new Set(
                  [...editor.querySelectorAll(".locked-content[data-lock-id]")].map((node) =>
                    node.getAttribute("data-lock-id")
                  )
                ).size === 10 &&
                (kind !== "input" || content.length === initialLength + 1) &&
                (kind !== "lock" ||
                  document.querySelector(
                    '[data-testid="sensory-feedback"][data-animation="shake"]'
                  ) !== null);
              if (!ready) {
                requestAnimationFrame(settle);
                return;
              }
              requestAnimationFrame(() => {
                clearTimeout(timeout);
                resolve(performance.now() - began);
              });
            }
            requestAnimationFrame(settle);
          }
          document.addEventListener(eventName, start, true);
        }),
      { kind, marker, initialLength }
    );
  const input: number[] = [];
  const switching: number[] = [];
  const lock: number[] = [];
  await page.locator(".ProseMirror").evaluate((element) => {
    (element as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(element.lastElementChild ?? element);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  for (let sample = 0; sample < 30; sample++) {
    const initialLength = await page
      .locator(".ProseMirror")
      .evaluate((element) => element.textContent?.length ?? 0);
    const measured = measure("input", "PerformanceAlpha", initialLength);
    await page.keyboard.insertText("z");
    input.push(await measured);
    await verifyCompleteDocument("input", sample, alpha, "PerformanceAlpha", sample + 1);
  }
  for (let sample = 0; sample < 30; sample++) {
    const task = sample % 2 === 0 ? beta : alpha;
    const marker = sample % 2 === 0 ? "PerformanceBeta" : "PerformanceAlpha";
    const measured = measure("switch", marker);
    await page.getByTestId(`task-item-${task.id}`).click();
    switching.push(await measured);
    await verifyCompleteDocument("switch", sample, task, marker, task.id === alpha.id ? 30 : 0);
  }
  for (let sample = 0; sample < 30; sample++) {
    // Each measured rejection must create new feedback; an already visible
    // overlay or a no-op key press cannot satisfy this sample.
    await expect(page.getByTestId("sensory-feedback")).not.toBeAttached();
    await page
      .locator(`.ProseMirror .locked-content[data-lock-id="${locks[0]}"]`)
      .first()
      .evaluate((element) => {
        const editor = element.closest(".ProseMirror") as HTMLElement;
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(element.closest("p") ?? element);
        const selection = getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const editor = (window as Window & { editorInstance?: Editor }).editorInstance;
          if (!editor) return null;
          return editor.action((ctx) => {
            const view = ctx.get<EditorView, "editorView">("editorView");
            const { from, to } = view.state.selection;
            return from !== to ? view.state.doc.textBetween(from, to) : null;
          });
        })
      )
      .toContain("PerformanceAlpha");
    const measured = measure("lock", "PerformanceAlpha");
    await page.keyboard.press("Backspace");
    lock.push(await measured);
    await expect(page.getByTestId("sensory-feedback")).toHaveAttribute("data-animation", "shake");
    await expect(page.locator(".ProseMirror")).toContainText("PerformanceAlpha");
    await verifyCompleteDocument("lock", sample, alpha, "PerformanceAlpha", 30);
  }
  await expect(page.locator(".task-status")).toHaveText("Saved");
  const summary = (samples: number[]) => ({
    samples,
    count: samples.length,
    p95: [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1],
  });
  const evidenceData = {
    words: 10_000,
    locks: 10,
    browser: browser.version(),
    browserChannel: test.info().project.use.channel,
    browserMode: "full Chromium new headless",
    os: process.platform,
    node: process.version,
    sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    mode: process.env.AUTH_E2E_MODE ?? "preview",
    externalFonts: "blocked",
    measurement:
      "native event capture to settled document and next animation frame; excludes driver transport",
    lockOperation:
      "native Backspace of a confirmed ProseMirror selection containing the locked marker; every sample starts with no feedback and ends with new shake rejection feedback",
    completeDocumentVerification:
      "after every measured sample, all 121 rendered paragraphs equal the complete generated fixture plus the exact accumulated input, and the unique lock ID set equals the 10 fixture IDs; verification is outside the measured interval",
    documentChecks,
    input: summary(input),
    taskSwitch: summary(switching),
    lockDeletionRejection: summary(lock),
    networkSave: summary(saveLatencies),
  };
  await writeFile(
    resolve(
      evidence,
      `performance-${process.env.AUTH_E2E_RUN ?? "current"}-10000-words-10-locks.json`
    ),
    JSON.stringify(evidenceData, null, 2)
  );
  expect(input).toHaveLength(30);
  expect(switching).toHaveLength(30);
  expect(lock).toHaveLength(30);
  expect(evidenceData.input.p95).toBeLessThan(100);
  expect(evidenceData.taskSwitch.p95).toBeLessThan(100);
  expect(evidenceData.lockDeletionRejection.p95).toBeLessThan(100);
});
