import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TaskRecord } from "../src/services/api/taskClient";
import type { DraftSnapshot } from "../src/services/draftStore";

const API = "http://127.0.0.1:8001";
const ENDPOINT = "**/impetus/generate-intervention";
const EVIDENCE = resolve(
  "test-results/story",
  process.env.STORY_FRONTEND_MODE === "preview" ? "preview" : "development"
);
const EXISTING = "story_existing";
const PROTECTED = "> 登车凭证必须保留。 <!-- lock:story_existing source:muse -->\n";
const STORY = `# 雨夜车站\n\n她握着**旧钥匙**。钟声响起🙂她还没说完\n\n窗外的列车驶向远方。\n\n${PROTECTED}`;
const PARAGRAPH = "她握着旧钥匙。钟声响起🙂她还没说完";
const TARGET = "钟声响起🙂她还没说完";
const REPLACEMENT = "她终于说出藏了十年的秘密。";
type Mode = "muse" | "loki";
type Payload = {
  context: string;
  mode: Mode;
  client_meta: { selection_from: number; selection_to: number; doc_version: number };
};
type Held = { route: Route; request: Payload };
type Account = { id: string; storage: Awaited<ReturnType<BrowserContext["storageState"]>> };
let account: Account;
let context: BrowserContext;
let page: Page;
let task: TaskRecord;
const held: Held[] = [];

async function ready(p: Page): Promise<void> {
  await expect(p.getByTestId("app-root")).toBeVisible();
  const welcome = p.getByRole("button", { name: "Close welcome modal" });
  if (await welcome.isVisible()) await welcome.click();
  await expect(p.locator(".ProseMirror[contenteditable='true']")).toBeVisible();
  await expect(p.locator(".task-status")).toHaveText("Saved");
}

async function record(): Promise<TaskRecord> {
  const response = await context.request.get(`${API}/tasks/${task.id}`, {
    headers: { "X-Expected-User-ID": account.id },
  });
  expect(response.status()).toBe(200);
  return response.json() as Promise<TaskRecord>;
}

async function draft(): Promise<DraftSnapshot | undefined> {
  return page.evaluate(
    (id) =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith("impetus.draft."))
        .map(([, value]) => JSON.parse(value) as DraftSnapshot)
        .filter((value) => value.taskId === id && !value.recoveryOf)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0],
    task.id
  );
}

async function settled(): Promise<TaskRecord> {
  await expect(page.locator(".task-status")).toHaveText("Saved");
  await expect
    .poll(async () => {
      const saved = await record();
      const local = await draft();
      return Boolean(
        local &&
        !local.dirty &&
        local.versionKnown &&
        local.content === saved.content &&
        local.version === saved.version &&
        JSON.stringify(local.lockIds) === JSON.stringify(saved.lock_ids)
      );
    })
    .toBe(true);
  return record();
}

async function caret(text: string, offset: number): Promise<void> {
  // Move only the native DOM selection; never dispatch an editor transaction.
  await page.locator(".ProseMirror").evaluate(
    (element, point) => {
      (element as HTMLElement).focus();
      const block = Array.from(element.children).find((child) => child.textContent === point.text);
      if (!block) throw new Error(`Missing textblock: ${point.text}`);
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let remaining = point.offset;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (remaining <= (node.textContent?.length ?? 0)) {
          const range = document.createRange();
          range.setStart(node, remaining);
          range.collapse(true);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          return;
        }
        remaining -= node.textContent?.length ?? 0;
      }
      throw new Error("Caret offset exceeds textblock");
    },
    { text, offset }
  );
}

async function trigger(mode: Mode, index = held.length): Promise<Held> {
  await page.getByTestId("mode-selector").selectOption(mode);
  if (mode === "muse") await page.getByTestId("manual-trigger-button").click();
  else if (process.env.STORY_FRONTEND_MODE === "preview") {
    // Production has no manual Loki button. Advance its real timer at the browser
    // test boundary, without changing application intervals or browser security.
    await page.clock.fastForward(120_001);
  } else await page.getByTestId("manual-loki-trigger").click();
  await expect.poll(() => held.length).toBe(index + 1);
  const item = held[index]!;
  expect(item.request.mode).toBe(mode);
  const headers = item.route.request().headers();
  expect(headers["x-contract-version"]).toBe("2.0.0");
  expect(headers["x-csrf-token"]).toBeTruthy();
  expect(headers["x-expected-user-id"]).toBe(account.id);
  return item;
}

async function release(
  item: Held,
  mode: Mode,
  action = "rewrite",
  lockId = `story_${randomUUID()}`,
  anchor?: { type: "range"; from: number; to: number }
): Promise<string> {
  const finished = page.waitForEvent(
    "requestfinished",
    (request) => request === item.route.request()
  );
  const end = item.request.client_meta.selection_to;
  await item.route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      action,
      source: mode,
      action_id: randomUUID(),
      issued_at: new Date().toISOString(),
      ...(action === "delete" ? {} : { content: REPLACEMENT, lock_id: lockId }),
      anchor:
        anchor ??
        (action === "provoke"
          ? { type: "pos", from: end }
          : { type: "range", from: end - TARGET.length, to: end }),
    }),
  });
  await finished;
  // Synchronize with rendering after the completed HTTP response, without sleeps.
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
  return lockId;
}

async function exactReload(saved: TaskRecord, name: string): Promise<void> {
  const visible = await page.locator(".ProseMirror").innerText();
  await page.getByTestId("mode-selector").selectOption("off");
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  expect(await page.locator(".ProseMirror").innerText()).toBe(visible);
  const reloaded = await settled();
  expect({
    content: reloaded.content,
    locks: reloaded.lock_ids,
    version: reloaded.version,
  }).toEqual({ content: saved.content, locks: saved.lock_ids, version: saved.version });
  await mkdir(EVIDENCE, { recursive: true });
  await writeFile(
    resolve(EVIDENCE, `${name}.json`),
    JSON.stringify(
      {
        taskId: saved.id,
        content: saved.content,
        lockIds: saved.lock_ids,
        version: saved.version,
        reloadedVersion: reloaded.version,
      },
      null,
      2
    )
  );
}

async function enforce(lockId: string): Promise<void> {
  const locked = page
    .locator(`.ProseMirror .locked-content[data-lock-id="${lockId}"]:not(.locked-comment-hidden)`)
    .first();
  await expect(locked).toBeVisible();
  const before = await page.locator(".ProseMirror").innerText();
  const saved = await settled();
  await locked.evaluate((element) => {
    (element.closest(".ProseMirror") as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.press("Backspace");
  expect(await page.locator(".ProseMirror").innerText()).toBe(before);
  await page.keyboard.press("ControlOrMeta+z");
  expect(await page.locator(".ProseMirror").innerText()).toBe(before);
  const after = await settled();
  expect(after.content).toBe(saved.content);
  expect(after.lock_ids).toEqual(saved.lock_ids);
  expect(after.version).toBe(saved.version);
}

test.beforeAll(async ({ browser }) => {
  const c = await browser.newContext();
  // Installed before any key is configured or application page is opened.
  await c.route(ENDPOINT, (route) => route.abort());
  const p = await c.newPage();
  await p.goto("/", { waitUntil: "domcontentloaded" });
  await p.getByRole("button", { name: "Register", exact: true }).click();
  const form = p.getByRole("form", { name: "Register", exact: true });
  await form.getByLabel("Email", { exact: true }).fill(`story-${randomUUID()}@example.com`);
  await form.getByLabel("Password", { exact: true }).fill("localStoryPass!2026");
  await form.getByLabel("Confirm Password", { exact: true }).fill("localStoryPass!2026");
  const response = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/auth/register" && r.request().method() === "POST"
  );
  await form.getByRole("button", { name: "Register", exact: true }).click();
  const registered = await response;
  expect(registered.status()).toBe(201);
  account = {
    id: ((await registered.json()) as { user: { id: string } }).user.id,
    storage: await c.storageState(),
  };
  expect(account.storage.cookies.find((cookie) => cookie.name === "access_token")?.httpOnly).toBe(
    true
  );
  expect(account.storage.cookies.find((cookie) => cookie.name === "csrf_token")).toBeDefined();
  await c.close();
});

test.beforeEach(async ({ browser }) => {
  held.length = 0;
  context = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    storageState: { cookies: account.storage.cookies, origins: [] },
  });
  await context.route(ENDPOINT, (route) => {
    held.push({ route, request: route.request().postDataJSON() as Payload });
  });
  const csrf = account.storage.cookies.find((cookie) => cookie.name === "csrf_token")!.value;
  const created = await context.request.post(`${API}/tasks`, {
    headers: { "X-CSRF-Token": csrf, "X-Expected-User-ID": account.id },
    data: { content: STORY, lock_ids: [EXISTING] },
  });
  expect(created.status()).toBe(201);
  task = (await created.json()) as TaskRecord;
  page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  if (!(await page.getByTestId("task-sidebar").isVisible()))
    await page.getByTestId("task-list-toggle").click();
  await page.getByTestId(`task-item-${task.id}`).click();
  await expect(page.locator(".ProseMirror h1")).toHaveText("雨夜车站");
  await expect(page.locator(".ProseMirror strong")).toHaveText("旧钥匙");
  await settled();
  await page.getByTestId("llm-settings-trigger").click();
  await page.getByTestId("storage-mode-select").selectOption("session");
  await page.getByTestId("llm-key-input").fill("sk-local-story-http-stub-only");
  await page.getByTestId("llm-settings-save").click();
  await page.getByTestId("mode-selector").selectOption("off");
  if (process.env.STORY_FRONTEND_MODE === "preview") await page.clock.install();
  await caret(PARAGRAPH, PARAGRAPH.length);
});

test.afterEach(async () => {
  // Context closure aborts every unreleased HTTP route and stops all timers.
  await context?.close();
});

test("Muse unfinished Chinese Markdown and emoji uses live middle cursor, even after cursor-only movement", async () => {
  const item = await trigger("muse");
  expect(item.request.context).toBe(`雨夜车站\n${PARAGRAPH}`);
  expect(item.request.context).not.toContain("**");
  expect(item.request.context).not.toContain("窗外");
  expect(item.request.client_meta.selection_from).toBe(item.request.client_meta.selection_to);
  await caret("窗外的列车驶向远方。", 3);
  const lock = await release(item, "muse", "provoke");
  await expect(page.locator(".ProseMirror")).toContainText(REPLACEMENT);
  await expect(page.locator(".ProseMirror")).not.toContainText(TARGET);
  await expect(page.locator(".ProseMirror strong")).toHaveText("旧钥匙");
  await expect(page.locator(".ProseMirror")).toContainText("窗外的列车驶向远方。");
  const saved = await settled();
  expect(saved.lock_ids).toEqual([EXISTING, lock]);
  expect(saved.content).toBe(
    `# 雨夜车站\n\n她握着**旧钥匙**。\n\n${REPLACEMENT} <!-- lock:${lock} source:muse -->\n\n窗外的列车驶向远方。\n\n${PROTECTED}`
  );
  expect(saved.version).toBeGreaterThan(task.version);
  await enforce(lock);
  await exactReload(saved, "muse-midcursor");
  await enforce(lock);
});

test("Muse at paragraph start inserts at the captured empty range after native cursor movement", async () => {
  await caret(PARAGRAPH, 0);
  const item = await trigger("muse");
  expect(item.request.client_meta.selection_from).toBe(item.request.client_meta.selection_to);
  expect(item.request.context).not.toContain(PARAGRAPH);
  await caret("窗外的列车驶向远方。", 3);
  const lock = await release(item, "muse", "provoke");
  await expect(page.locator(".ProseMirror")).toContainText(REPLACEMENT);
  const saved = await settled();
  expect(saved.content).toBe(
    `# 雨夜车站\n\n<br />\n\n${REPLACEMENT} <!-- lock:${lock} source:muse -->\n\n她握着**旧钥匙**。钟声响起🙂她还没说完\n\n窗外的列车驶向远方。\n\n${PROTECTED}`
  );
  expect(saved.lock_ids).toEqual([EXISTING, lock]);
  expect(saved.version).toBeGreaterThan(task.version);
  await enforce(lock);
  await exactReload(saved, "muse-empty-captured-range");
  await enforce(lock);
});

for (const mode of ["muse", "loki"] as const) {
  test(`${mode} delayed response preserves continuing native Chinese typing exactly`, async () => {
    const item = await trigger(mode);
    await caret(PARAGRAPH, PARAGRAPH.length);
    await page.keyboard.insertText("，这是我刚写下的新句子🌧️");
    await expect(page.locator(".ProseMirror")).toContainText("，这是我刚写下的新句子🌧️");
    const before = await settled();
    const visible = await page.locator(".ProseMirror").innerText();
    await release(item, mode, mode === "muse" ? "provoke" : "rewrite");
    expect(await page.locator(".ProseMirror").innerText()).toBe(visible);
    const after = await settled();
    expect(after.content).toBe(before.content);
    expect(after.lock_ids).toEqual(before.lock_ids);
    expect(after.version).toBe(before.version);
    await exactReload(after, `${mode}-continued-typing`);
  });

  test(`${mode} mode switch away and back invalidates old response without changing writing`, async () => {
    const item = await trigger(mode);
    const before = await settled();
    const visible = await page.locator(".ProseMirror").innerText();
    await page.getByTestId("mode-selector").selectOption("off");
    await page.getByTestId("mode-selector").selectOption(mode);
    await release(item, mode, "rewrite");
    expect(await page.locator(".ProseMirror").innerText()).toBe(visible);
    const after = await settled();
    expect(after.content).toBe(before.content);
    expect(after.lock_ids).toEqual([EXISTING]);
    expect(after.version).toBe(before.version);
    await exactReload(after, `${mode}-mode-switch`);
  });
}

for (const action of ["provoke", "rewrite", "delete"] as const) {
  test(`Loki ${action} applies its exact target and persists the actual content and locks`, async () => {
    const item = await trigger("loki");
    const end = item.request.client_meta.selection_to;
    const anchor = { type: "range" as const, from: end - TARGET.length, to: end };
    const lock = await release(
      item,
      "loki",
      action,
      `loki_${randomUUID()}`,
      action === "provoke" ? undefined : anchor
    );
    await expect(page.locator(".ProseMirror")).toContainText("她握着旧钥匙。");
    await expect(page.locator(".ProseMirror")).toContainText("窗外的列车驶向远方。");
    if (action !== "provoke") await expect(page.locator(".ProseMirror")).not.toContainText(TARGET);
    else await expect(page.locator(".ProseMirror")).toContainText(TARGET);
    if (action !== "delete") await expect(page.locator(".ProseMirror")).toContainText(REPLACEMENT);
    const saved = await settled();
    expect(saved.lock_ids).toEqual(action === "delete" ? [EXISTING] : [EXISTING, lock]);
    expect(saved.version).toBeGreaterThan(task.version);
    expect(saved.content).toContain("她握着**旧钥匙**。");
    if (action !== "provoke") {
      expect(saved.content).toBe(
        `# 雨夜车站\n\n她握着**旧钥匙**。\n\n${action === "rewrite" ? `${REPLACEMENT} <!-- lock:${lock} source:loki -->\n\n` : ""}窗外的列车驶向远方。\n\n${PROTECTED}`
      );
    }
    if (action === "delete") {
      await page.locator(".ProseMirror").click();
      await page.keyboard.press("ControlOrMeta+z");
      expect((await settled()).content).toBe(saved.content);
    }
    if (action !== "delete") await enforce(lock);
    await exactReload(saved, `loki-${action}`);
    if (action !== "delete") await enforce(lock);
  });
}

test("new Muse response wins when older request completes last", async () => {
  const old = await trigger("muse");
  await page.getByTestId("mode-selector").selectOption("off");
  await page.getByTestId("mode-selector").selectOption("muse");
  await expect(page.getByTestId("manual-trigger-button")).toBeEnabled();
  const current = await trigger("muse");
  const currentLock = await release(current, "muse", "provoke");
  await expect(page.locator(".ProseMirror")).toContainText(REPLACEMENT);
  const before = await settled();
  const visible = await page.locator(".ProseMirror").innerText();
  await release(old, "muse", "provoke", "old_muse_lock");
  expect(await page.locator(".ProseMirror").innerText()).toBe(visible);
  const saved = await settled();
  expect(saved.content).toBe(before.content);
  expect(saved.lock_ids).toEqual([EXISTING, currentLock]);
  expect(saved.version).toBe(before.version);
  await exactReload(saved, "muse-response-order");
});
