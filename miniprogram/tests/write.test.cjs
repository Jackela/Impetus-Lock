const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

function harness(initialRun, stored = {}) {
  let definition;
  let subject = "wechat-author";
  let id = 0;
  const calls = [];
  const navigation = [];
  const memory = new Map(Object.entries(stored));
  const endpoint = {
    handle: async () => initialRun,
    receipt: async () => ({ status: "unknown", run_version: initialRun.version }),
  };
  const originalLoad = Module._load;
  Module._load = function (path, parent, ...rest) {
    if (path === "../../lib/api") {
      return {
        api: (...args) => {
          calls.push(args);
          return args[0].includes("/receipts/") ? endpoint.receipt(...args) : endpoint.handle(...args);
        },
        ensureSession: async () => subject,
        currentSubject: () => subject,
        requestId: () => `request-${++id}`,
      };
    }
    if (path === "../../lib/storage") {
      return {
        getPrivate: (key) => memory.get(key),
        putPrivate: (key, value) => memory.set(key, value),
        removePrivate: (key) => memory.delete(key),
      };
    }
    return originalLoad.call(this, path, parent, ...rest);
  };
  global.Page = (options) => { definition = options; };
  global.wx = {
    hideShareMenu() {},
    navigateTo: (options) => navigation.push(options.url),
    navigateBack: (options) => options.fail(),
    reLaunch: (options) => navigation.push(options.url),
  };
  try {
    const file = require.resolve("../.build/pages/write/index.js");
    delete require.cache[file];
    require(file);
  } finally {
    Module._load = originalLoad;
  }
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(value) { Object.assign(this.data, value); },
  };
  return { page, memory, calls, endpoint, navigation, setSubject: (value) => { subject = value; } };
}

const run = {
  id: "run-a", version: 1, theme: "letter", mode: "normal", opening: "十年后，你收到一封自己寄出的信",
  segments: [], choices: ["先看看信封", "把信烧掉"], offers: [], turn: 0, turns: 0,
  abilities: { returning: { level: 0, enabled: false }, interpret: { level: 0, enabled: false } },
  lock_uses: 0, status: "active",
};
const event = (dataset = {}, detail = {}) => ({ currentTarget: { dataset }, detail });
const actionCalls = (calls) => calls.filter(([path]) => path.endsWith("/actions")).map(([, , action]) => action);
const settle = async () => new Promise((resolve) => setImmediate(resolve));

test("首页行动在当前局成功入稿，使用首页提交标识且不触发麦克风授权", async () => {
  const first = { request_id: "first-action", source: "choice", text: "先看看信封" };
  const { page, calls, endpoint, memory } = harness(run, { "first:run-a": first });
  endpoint.handle = async (_, method) => method === "POST" ? { ...run, version: 2, turns: 1,
    segments: [{ id: "lock", locked: true, text: "邮戳上的日期是明天。", source: "lock" }],
  } : run;
  await page.onLoad({ id: run.id });
  await settle();
  assert.equal(actionCalls(calls)[0].request_id, first.request_id);
  assert.equal(page.data.run.segments[0].locked, true);
  assert.equal(page.data.run.turns, 1);
  assert.equal(memory.has("first:run-a"), false);
});

test("回合错误后保留原文并按原标识重试，成功后才清理暂存", async () => {
  const { page, calls, endpoint, memory } = harness(run);
  await page.onLoad({ id: run.id, compose: "1" });
  endpoint.handle = async (_, method) => {
    if (method === "POST") throw Object.assign(new Error("暂时无法成文"), { status: 502 });
    return run;
  };
  page.onDraft(event({}, { value: "我把信藏了起来。" }));
  await page.submitDraft();
  assert.match(page.data.status, /暂时无法成文/);
  assert.equal(memory.get("draft:run-a"), "我把信藏了起来。");
  endpoint.handle = async (_, method) => method === "POST" ? { ...run, version: 2, turns: 1 } : run;
  await page.retryPending();
  assert.deepEqual(actionCalls(calls).map((value) => value.request_id), ["request-1", "request-1"]);
  assert.equal(page.data.run.turns, 1);
  assert.equal(memory.has("draft:run-a"), false);
});

test("收笔先处理在途动作，确认取消后固定核对过的正文", async () => {
  const { page, calls, endpoint, navigation } = harness(run);
  let resolveTurn;
  let stored = run;
  endpoint.handle = async (_, method, action) => {
    if (method !== "POST") return stored;
    if (action.kind === "turn") return new Promise((resolve) => { resolveTurn = resolve; });
    if (action.kind === "begin_finish") stored = { ...stored, version: 2, finishing: true };
    if (action.kind === "cancel") stored = { ...stored, version: 3 };
    if (action.kind === "finish") stored = { ...stored, version: 4, finishing: false, status: "finished", work_id: "work-a" };
    return stored;
  };
  endpoint.receipt = async () => ({ status: "canceled", run_version: stored.version });
  await page.onLoad({ id: run.id });
  const late = page.choosePlot(event({ text: "先看看信封" }));
  await settle();
  await page.beginFinish();
  assert.equal(page.data.finishing, true);
  assert.deepEqual(actionCalls(calls).map((value) => value.kind), ["turn", "begin_finish"]);
  await page.discardAndFinish();
  assert.deepEqual(actionCalls(calls).map((value) => value.kind), ["turn", "begin_finish", "cancel", "finish"]);
  assert.equal(actionCalls(calls)[2].target, actionCalls(calls)[0].request_id);
  assert.deepEqual(navigation, ["/pages/work/index?id=work-a"]);
  resolveTurn({ ...run, version: 50, turns: 1 });
  await late;
  assert.equal(page.data.run.status, "finished");
});

test("暂停后只在作者明确保留时按新版本重用原回合标识，旧响应不覆写正文", async () => {
  const { page, calls, endpoint } = harness(run);
  let resolveEarly;
  let stored = run;
  endpoint.handle = async (_, method, action) => {
    if (method !== "POST") return stored;
    if (action.kind === "turn" && action.version === 1) return new Promise((resolve) => { resolveEarly = resolve; });
    if (action.kind === "begin_finish") stored = { ...stored, version: 2, finishing: true };
    if (action.kind === "turn" && action.version === 2) stored = { ...stored, version: 3, turns: 1 };
    return stored;
  };
  endpoint.receipt = async () => ({ status: "pending", run_version: stored.version });
  await page.onLoad({ id: run.id });
  const early = page.choosePlot(event({ text: "先看看信封" }));
  await settle();
  await page.beginFinish();
  await page.retryPending();
  const original = actionCalls(calls)[0];
  const kept = actionCalls(calls)[2];
  assert.equal(kept.request_id, original.request_id);
  assert.equal(kept.version, 2);
  assert.equal(kept.retain, true);
  assert.equal(page.data.run.turns, 1);
  resolveEarly({ ...run, version: 99, turns: 49 });
  await early;
  assert.equal(page.data.run.version, 3);
  assert.equal(page.data.finishing, true);
});

test("重新打开持久化暂停局进入收笔面板，继续写需服务端恢复", async () => {
  const paused = { ...run, version: 4, finishing: true };
  const { page, calls, endpoint } = harness(paused);
  await page.onLoad({ id: run.id });
  assert.equal(page.data.finishing, true);
  assert.equal(page.data.pauseConfirmed, true);
  endpoint.handle = async () => ({ ...paused, version: 5, finishing: false });
  await page.returnToWriting();
  assert.equal(actionCalls(calls)[0].kind, "resume");
  assert.equal(page.data.finishing, false);
});

test("暂停发生版本冲突时重读已提交正文并沿用原暂停标识", async () => {
  const { page, calls, endpoint } = harness(run);
  const latest = { ...run, version: 2, turns: 1 };
  await page.onLoad({ id: run.id });
  endpoint.handle = async (_, method, action) => {
    if (method !== "POST") return latest;
    if (action.version === 1) throw Object.assign(new Error("稿件版本变更"), { status: 409 });
    return { ...latest, version: 3, finishing: true };
  };
  await page.beginFinish();
  const commands = actionCalls(calls);
  assert.deepEqual(commands.map((command) => command.version), [1, 2]);
  assert.equal(commands[0].request_id, commands[1].request_id);
  assert.equal(page.data.pauseConfirmed, true);
  assert.equal(page.data.run.turns, 1);
});

test("写作页在前台读取微信字号，并随设置变化更新", async () => {
  const { page } = harness(run);
  await page.onLoad({ id: run.id });
  global.wx.getAppBaseInfo = () => ({ fontSizeScaleFactor: 1.5 });
  await page.onShow();
  assert.equal(page.data.fontSize, 25.5);
});

test("重新确认身份后清除私密画面，不写回前一身份的异步结果", async () => {
  const { page, endpoint, setSubject, memory } = harness(run);
  let resolveTurn;
  endpoint.handle = async (_, method) => {
    if (method === "POST") return new Promise((resolve) => { resolveTurn = resolve; });
    return run;
  };
  await page.onLoad({ id: run.id });
  const late = page.choosePlot(event({ text: "先看看信封" }));
  await settle();
  setSubject("different-author");
  resolveTurn({ ...run, version: 2, turns: 1 });
  await late;
  assert.equal(page.data.run, null);
  assert.match(page.data.status, /身份/);
  assert.equal(memory.get("pending:run-a").action.kind, "turn");
});

test("服务端固定题面保留时，写作页显示并只修改实际开头段", async () => {
  const actual = {
    ...run, version: 3,
    segments: [{ id: "opening", text: "搬家那天，你收到一封旧信。", locked: false, source: "opening" }],
  };
  const { page, calls, endpoint } = harness(actual);
  await page.onLoad({ id: run.id });
  assert.equal(page.data.opening, actual.segments[0].text);
  assert.deepEqual(page.data.sections, []);
  page.openEditor(event({ target: "opening" }));
  assert.equal(page.data.editor.text, actual.segments[0].text);
  page.editText(event({}, { value: "搬家那天，她带来一封旧信。" }));
  endpoint.handle = async () => ({ ...actual, version: 4, segments: [
    { ...actual.segments[0], text: "搬家那天，她带来一封旧信。" },
  ] });
  await page.confirmEditor();
  assert.equal(actionCalls(calls)[0].target, "opening");
  assert.equal(page.data.opening, "搬家那天，她带来一封旧信。");
  assert.equal(page.data.run.turns, 0);
});

test("高强度改锁先展示旧句与服务端预览，确认一次才提交预览原文", async () => {
  const actual = {
    ...run, mode: "high", turns: 2, version: 5, lock_uses: 1,
    abilities: { ...run.abilities, interpret: { level: 2, enabled: true } },
    segments: [{ id: "lock", text: "邮戳上的日期却是明天。", locked: true, source: "lock" }],
  };
  const preview = { version: 5, target: "lock", text: "窗上的反光让我把日期看成了明天。" };
  const { page, calls, endpoint } = harness(actual);
  await page.onLoad({ id: run.id });
  endpoint.handle = async (path) => path.endsWith("/preview") ? preview : {
    ...actual, version: 6, lock_uses: 0,
    segments: [{ ...actual.segments[0], text: preview.text }],
  };
  page.openEditor(event({ target: "lock" }));
  assert.equal(page.data.editor, null);
  page.openEditor(event({ target: "lock", kind: "replace" }));
  assert.equal(page.data.editor.current, actual.segments[0].text);
  await page.confirmEditor();
  assert.deepEqual(actionCalls(calls), []);
  assert.equal(page.data.run.lock_uses, 1);
  assert.equal(page.data.editor.text, preview.text);
  await page.confirmEditor();
  assert.deepEqual(actionCalls(calls).map(({ kind, target, text }) => ({ kind, target, text })), [
    { kind: "replace", target: preview.target, text: preview.text },
  ]);
  assert.equal(page.data.run.lock_uses, 0);
  assert.equal(page.data.sections[0].locked, true);
});

test("个人局恢复操作使用恢复标识，不把锁定改写直接覆盖", async () => {
  const actual = {
    ...run, mode: "custom", turns: 2,
    segments: [{ id: "s1", text: "现在的锁句。", locked: true, source: "intervention" }],
    recoveries: [{
      id: "recovery1", target: "s1", replacement: "现在的锁句。",
      segment: { id: "s1", text: "可恢复的旧段。", locked: false, source: "keyboard" },
    }],
  };
  const { page, calls, endpoint } = harness(actual);
  await page.onLoad({ id: run.id });
  page.openEditor(event({ target: "recovery1", kind: "restore" }));
  assert.equal(page.data.editor.text, "可恢复的旧段。");
  assert.match(page.data.editor.description, /附在当前锁句后/);
  endpoint.handle = async () => ({ ...actual, version: 2, recoveries: [], segments: [
    actual.segments[0], { ...actual.recoveries[0].segment, id: "s2" },
  ] });
  await page.confirmEditor();
  const [action] = actionCalls(calls);
  assert.equal(action.kind, "restore");
  assert.equal(action.target, "recovery1");
  assert.equal(action.text, undefined);
  assert.equal(page.data.sections[0].locked, true);
});

test("不可恢复删除局刷新新版本时不显示旧的已提交口述候选", async () => {
  const actual = {
    ...run, version: 5, mode: "custom", turns: 2, rules: {
      trigger: "manual", action: "delete", lock: false, recoverable: false,
    },
  };
  const pending = {
    turnsAtStart: 1, action: {
      request_id: "previous-input", kind: "turn", version: 2, source: "voice", style: "voice", text: "旧口述",
    },
  };
  const { page, calls, memory, endpoint } = harness(actual, { "pending:run-a": pending, "draft:run-a": "旧口述" });
  endpoint.receipt = async () => ({ status: "committed", run_version: actual.version });
  await page.onLoad({ id: run.id });
  assert.equal(page.data.pendingText, "");
  assert.equal(page.data.draft, "");
  assert.equal(page.data.canRetryPending, false);
  assert.equal(memory.has("pending:run-a"), false);
  assert.equal(memory.has("draft:run-a"), false);
  await page.retryPending();
  assert.deepEqual(actionCalls(calls), []);
});

test("不可恢复删除局版本推进但提交未生效时，保留未入稿草稿等作者处理", async () => {
  const actual = {
    ...run, version: 9, mode: "custom", turns: 2, rules: {
      trigger: "manual", action: "delete", lock: false, recoverable: false,
    },
  };
  const pending = {
    turnsAtStart: 1, action: {
      request_id: "uncommitted-input", kind: "turn", version: 3, source: "keyboard", text: "未入稿草稿",
    },
  };
  const { page, memory, endpoint } = harness(actual, { "pending:run-a": pending, "draft:run-a": "未入稿草稿" });
  endpoint.receipt = async () => ({ status: "unknown", run_version: actual.version });
  await page.onLoad({ id: run.id });
  assert.equal(page.data.draft, "未入稿草稿");
  assert.equal(page.data.canRetryPending, true);
  assert.equal(memory.get("pending:run-a").action.text, "未入稿草稿");
});

test("查看口述原文先核对服务端当前段，已永久删除时不显示旧页面原文", async () => {
  const actual = {
    ...run, version: 2, mode: "custom", turns: 1, rules: {
      trigger: "manual", action: "delete", lock: false, recoverable: false,
    },
    segments: [{ id: "spoken", text: "整理过的文字", original: "原来的口述", locked: false, source: "voice" }],
  };
  const { page, calls, endpoint } = harness(actual);
  await page.onLoad({ id: run.id });
  assert.equal(page.data.originalText, "");
  endpoint.handle = async () => ({ ...actual, version: 3, segments: [] });
  await page.toggleOriginal(event({ target: "spoken" }));
  assert.equal(calls.filter(([path, method]) => path === "/runs/run-a" && !method).length, 2);
  assert.equal(page.data.originalText, "");
  assert.deepEqual(page.data.sections, []);
  assert.match(page.data.status, /无法查看/);
});

test("微信隐私和麦克风授权结束后，仍须独立录音手势才可发送", async () => {
  const { page, calls, endpoint } = harness(run);
  await page.onLoad({ id: run.id, compose: "1" });
  let triggerPrivacy;
  let authorizations = 0;
  let starts = 0;
  let stop = 0;
  let result;
  let unlinked;
  const manager = { start() { starts++; this.onStart(); }, stop() { stop++; } };
  global.requirePlugin = () => ({ getRecordRecognitionManager: () => manager });
  Object.assign(global.wx, {
    onNeedPrivacyAuthorization: (trigger) => { triggerPrivacy = trigger; },
    requirePrivacyAuthorize: (options) => triggerPrivacy((choice) => {
      result = choice;
      options.success();
      options.complete();
    }),
    authorize: (options) => { authorizations++; options.success(); },
    getFileSystemManager: () => ({ unlink: ({ filePath }) => { unlinked = filePath; } }),
  });
  page.startRecording();
  page.releaseRecording();
  assert.equal(page.data.privacyOpen, true);
  assert.equal(starts, 0);
  page.agreePrivacy();
  assert.deepEqual(result, { event: "agree", buttonId: "write-agree-privacy" });
  assert.equal(authorizations, 1);
  assert.equal(starts, 0);
  assert.equal(page.data.voiceReady, true);
  page.startRecording();
  assert.equal(starts, 1);
  assert.equal(stop, 0);
  assert.deepEqual(actionCalls(calls), []);
  page.releaseRecording();
  assert.equal(stop, 1);
  endpoint.handle = async () => ({ ...run, version: 2, turns: 1 });
  manager.onStop({ result: "我把信放回桌上。", tempFilePath: "wxfile://temp-voice" });
  await settle();
  assert.equal(unlinked, "wxfile://temp-voice");
  const [action] = actionCalls(calls);
  assert.equal(action.text, "我把信放回桌上。");
  assert.equal(action.source, "voice");
  assert.equal(action.style, "voice");
  assert.equal(JSON.stringify(action).includes("wxfile://"), false);

  let current = { ...run, version: 2, turns: 1 };
  endpoint.handle = async (_, method, action) => {
    if (method !== "POST") return current;
    if (action.kind === "begin_finish") current = { ...current, version: 3, finishing: true };
    if (action.kind === "turn") current = { ...current, version: 4, turns: 2 };
    return current;
  };
  page.startRecording();
  page.releaseRecording();
  await page.beginFinish();
  manager.onStop({ result: "她在门口等我。", tempFilePath: "wxfile://paused-voice" });
  assert.equal(page.data.heldVoiceText, "她在门口等我。");
  assert.deepEqual(actionCalls(calls).map(({ kind }) => kind), ["turn", "begin_finish"]);
  await page.submitHeldVoice();
  assert.equal(actionCalls(calls)[2].retain, true);
  assert.equal(actionCalls(calls)[2].version, 3);
  assert.equal(page.data.heldVoiceText, "");
});
