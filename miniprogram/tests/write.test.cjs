const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

function harness(initialRun, stored = {}, voice) {
  let definition;
  let subject = "wechat-author";
  let id = 0;
  const calls = [];
  const navigation = [];
  const memory = new Map(Object.entries(stored));
  const committed = new Map();
  const storage = {
    getPrivate: (key) => memory.get(key),
    putPrivate: (key, value) => memory.set(key, value),
    removePrivate: (key) => memory.delete(key),
  };
  const endpoint = {
    handle: async () => initialRun,
    receipt: async (path) => {
      const version = committed.get(path.split("/").at(-1));
      return { status: version ? "committed" : "unknown", run_version: version ?? initialRun.version };
    },
  };
  const originalLoad = Module._load;
  Module._load = function (path, parent, ...rest) {
    if (path === "../../lib/api") {
      return {
        api: async (...args) => {
          calls.push(args);
          if (args[0].includes("/receipts/")) return endpoint.receipt(...args);
          const result = await endpoint.handle(...args);
          if (args[2]?.kind === "turn" && result.version > args[2].version) {
            committed.set(args[2].request_id, result.version);
          }
          return result;
        },
        ensureSession: async () => subject,
        currentSubject: () => subject,
        requestId: () => `request-${++id}`,
      };
    }
    if (path === "../../lib/storage") return storage;
    if (path === "../../lib/voice" && voice) return voice;
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
  return { page, memory, calls, endpoint, navigation, storage, setSubject: (value) => { subject = value; } };
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

test("本机暂存失败时，同一页跨后台保留草稿和结果未知的操作，并按原标识重试一次", async () => {
  const { page, calls, endpoint, storage } = harness(run);
  storage.putPrivate = () => { throw new Error("本机故障"); };
  storage.removePrivate = () => { throw new Error("本机故障"); };
  await page.onLoad({ id: run.id, compose: "1" });
  page.onDraft(event({}, { value: "我用铅笔留下了记号。" }));
  endpoint.handle = async (_, method) => {
    if (method === "POST") throw new Error("连接中断");
    return run;
  };
  await page.submitDraft();
  page.onHide();
  assert.equal(page.data.draft, "");
  await page.onShow();
  assert.equal(page.data.draft, "我用铅笔留下了记号。");
  assert.equal(page.data.hasPending, true);
  assert.deepEqual(actionCalls(calls).map(({ request_id }) => request_id), ["request-1"]);
  endpoint.handle = async (_, method) => method === "POST" ? { ...run, version: 2, turns: 1 } : run;
  await page.retryPending();
  assert.deepEqual(actionCalls(calls).map(({ request_id }) => request_id), ["request-1", "request-1"]);
  assert.equal(page.data.run.turns, 1);
  assert.equal(page.data.draft, "");
  assert.equal(page.data.hasPending, false);
});

test("本机读取失败仍能写入，切换身份或打开另一局不带入页内文字", async () => {
  const { page, endpoint, storage, calls, setSubject } = harness(run);
  const unavailable = () => { throw new Error("本机故障"); };
  Object.assign(storage, { getPrivate: unavailable, putPrivate: unavailable, removePrivate: unavailable });
  await page.onLoad({ id: run.id, compose: "1" });
  assert.equal(page.data.run?.id, run.id);
  page.onDraft(event({}, { value: "只属于原身份和原局的文字。" }));
  page.onHide();
  setSubject("another-author");
  await page.onShow();
  assert.equal(page.data.draft, "");
  assert.equal(page.data.run, null);
  assert.equal(page.data.hasPending, false);
  endpoint.handle = async () => ({ ...run, id: "run-b" });
  await page.onLoad({ id: "run-b", compose: "1" });
  assert.equal(page.data.run?.id, "run-b");
  assert.equal(page.data.draft, "");
  assert.deepEqual(actionCalls(calls), []);
});

test("别处已有新段时，取消操作的成功回包不能清除未入稿草稿", async () => {
  const { page, endpoint, memory } = harness(run);
  await page.onLoad({ id: run.id, compose: "1" });
  const otherTurn = { ...run, version: 3, turns: 1 };
  endpoint.handle = async () => otherTurn;
  endpoint.receipt = async () => ({ status: "canceled", run_version: 3 });
  page.onDraft(event({}, { value: "这段还没有入稿。" }));
  await page.submitDraft();
  assert.equal(page.data.run.version, 3);
  assert.equal(page.data.draft, "这段还没有入稿。");
  assert.equal(memory.get("draft:run-a"), "这段还没有入稿。");
  assert.equal(page.data.hasPending, false);
  assert.match(page.data.status, /取消/);
});

function recordingStub() {
  const recording = { starts: 0, stops: 0 };
  recording.voice = {
    voiceAvailable: () => true,
    beginVoice: (listener, scope) => {
      recording.starts++;
      recording.listener = listener;
      recording.scope = scope;
      return () => {
        recording.stops++;
        listener.processing();
      };
    },
    cancelVoice() {},
  };
  return recording;
}

test("补发干预时先确认取消已生效，再开录并按新版本入稿，迟到干预不显示", async () => {
  const recording = recordingStub();
  const awaiting = { ...run, version: 4, turns: 1, generation_pending: true };
  const { page, calls, endpoint } = harness(awaiting, {}, recording.voice);
  let resolveIntervention;
  let stored = awaiting;
  let canceledId;
  endpoint.handle = async (_, method, action) => {
    if (method !== "POST") return stored;
    if (action.kind === "intervene") return new Promise((resolve) => { resolveIntervention = resolve; });
    if (action.kind === "cancel") {
      canceledId = action.target;
      stored = { ...stored, version: 5 };
    }
    if (action.kind === "turn") stored = { ...stored, version: 6, turns: 2, generation_pending: false };
    return stored;
  };
  endpoint.receipt = async (path) => ({
    status: path.endsWith("/" + canceledId) ? "canceled" : "committed", run_version: stored.version,
  });
  await page.onLoad({ id: run.id, compose: "1" });
  page.runtime.voiceAuthorized = true;
  const intervention = page.retryIntervention();
  await settle();
  await page.startRecording();
  assert.equal(recording.starts, 1);
  assert.equal(page.data.run.version, 5);
  assert.deepEqual(actionCalls(calls).map(({ kind }) => kind), ["intervene", "cancel"]);
  resolveIntervention({ ...awaiting, version: 99, generation_pending: false, choices: ["旧候选"] });
  await intervention;
  assert.equal(page.data.run.version, 5);
  assert.equal(page.data.voicePhase, "recording");

  page.releaseRecording();
  recording.listener.complete("我把信交给了女儿。");
  await settle();
  assert.equal(recording.stops, 1);
  const [original, cancel, voice] = actionCalls(calls);
  assert.equal(cancel.target, original.request_id);
  assert.equal(voice.version, 5);
  assert.equal(voice.source, "voice");
  assert.equal(page.data.run.version, 6);
  assert.equal(page.data.run.generation_pending, false);
});

test("补发仲裁中提前松手不会打开麦克风，干预先成功时下次录音使用最新版本", async () => {
  const recording = recordingStub();
  const awaiting = { ...run, version: 4, turns: 1, pending_intervention: true };
  const { page, calls, endpoint } = harness(awaiting, {}, recording.voice);
  let resolveIntervention;
  let resolveCancel;
  let stored = awaiting;
  endpoint.handle = async (_, method, action) => {
    if (method !== "POST") return stored;
    if (action.kind === "intervene") return new Promise((resolve) => { resolveIntervention = resolve; });
    if (action.kind === "cancel") return new Promise((resolve) => { resolveCancel = resolve; });
    stored = { ...stored, version: 7, turns: 2 };
    return stored;
  };
  endpoint.receipt = async () => ({ status: "committed", run_version: stored.version });
  await page.onLoad({ id: run.id, compose: "1" });
  page.runtime.voiceAuthorized = true;
  const intervention = page.retryIntervention();
  await settle();
  const preparing = page.startRecording();
  page.releaseRecording();
  await settle();
  assert.equal(recording.starts, 0);
  stored = { ...awaiting, version: 6, pending_intervention: false };
  resolveCancel(stored);
  resolveIntervention({ ...stored, version: 5 });
  await Promise.all([intervention, preparing]);
  assert.equal(recording.starts, 0);
  assert.equal(page.data.run.version, 6);

  await page.startRecording();
  page.releaseRecording();
  recording.listener.complete("我听见楼梯上的脚步。");
  await settle();
  assert.equal(recording.starts, 1);
  assert.equal(actionCalls(calls).at(-1).version, 6);
  assert.equal(page.data.run.turns, 2);
});

test("录音准备时取消回执丢失，核对前不开麦且重试沿用同一取消标识", async () => {
  const recording = recordingStub();
  const awaiting = { ...run, version: 4, turns: 1, generation_pending: true };
  const { page, calls, endpoint } = harness(awaiting, {}, recording.voice);
  let stored = awaiting;
  let resolveIntervention;
  endpoint.handle = async (_, method, action) => {
    if (method !== "POST") return stored;
    if (action.kind === "intervene") return new Promise((resolve) => { resolveIntervention = resolve; });
    if (stored.version === 4) {
      stored = { ...stored, version: 5 };
      throw new Error("取消回包丢失");
    }
    return stored;
  };
  endpoint.receipt = async () => ({ status: "canceled", run_version: stored.version });
  await page.onLoad({ id: run.id, compose: "1" });
  page.runtime.voiceAuthorized = true;
  const intervention = page.retryIntervention();
  await settle();
  await page.startRecording();
  assert.equal(recording.starts, 0);
  assert.equal(page.data.hasPending, true);
  assert.match(page.data.status, /取消回包丢失/);
  await page.startRecording();
  assert.equal(recording.starts, 1);
  assert.equal(page.data.run.version, 5);
  const cancels = actionCalls(calls).filter(({ kind }) => kind === "cancel");
  assert.equal(cancels.length, 2);
  assert.equal(cancels[0].request_id, cancels[1].request_id);
  resolveIntervention({ ...awaiting, version: 99, choices: ["旧候选"] });
  await intervention;
  assert.equal(page.data.run.version, 5);
  page.cancelRecording();
});

test("不能确认录音归属时，只为当前身份与局展示文字供明确确认", async () => {
  const recording = recordingStub();
  const { page, calls, endpoint } = harness(run, {}, recording.voice);
  await page.onLoad({ id: run.id, compose: "1" });
  page.runtime.voiceAuthorized = true;
  await page.startRecording();
  assert.equal(recording.scope, JSON.stringify(["wechat-author", run.id]));
  page.releaseRecording();
  recording.listener.review("这段识别内容需要核对。");
  assert.equal(page.data.heldVoiceText, "这段识别内容需要核对。");
  assert.deepEqual(actionCalls(calls), []);
  endpoint.handle = async () => ({ ...run, version: 2, turns: 1 });
  await page.submitHeldVoice();
  assert.equal(actionCalls(calls)[0].text, "这段识别内容需要核对。");
  assert.equal(page.data.heldVoiceText, "");
});

test("收笔发现别处待续写时，明确放弃前只核查状态，确认后才逐项处理并保存", async () => {
  const paused = { ...run, version: 4, finishing: true };
  const { page, calls, endpoint, navigation } = harness(paused);
  const unresolved = new Set(["elsewhere-1", "elsewhere-2"]);
  let stored = paused;
  endpoint.handle = async (_, method, action) => {
    if (method !== "POST") return stored;
    if (action.kind === "finish" && unresolved.size) {
      throw Object.assign(new Error("还有待续写输入。"), {
        status: 409, code: "STORY_FINISH_INPUT_PENDING", details: { request_ids: [...unresolved] },
      });
    }
    if (action.kind === "cancel") {
      assert.equal(action.version, stored.version);
      unresolved.delete(action.target);
      stored = { ...stored, version: stored.version + 1 };
    }
    if (action.kind === "finish") stored = { ...stored, version: stored.version + 1, status: "finished", work_id: "work-a" };
    return stored;
  };
  endpoint.receipt = async (path) => ({
    status: unresolved.has(path.split("/").at(-1)) ? "pending" : "canceled",
    run_version: stored.version,
  });
  await page.onLoad({ id: run.id });
  await page.confirmFinish();
  assert.equal(page.data.finishing, true);
  assert.equal(page.data.blockedFinishCount, 2);
  assert.equal(page.data.hasPending, false);
  assert.deepEqual(actionCalls(calls).map(({ kind }) => kind), ["finish"]);
  assert.deepEqual(navigation, []);
  await page.discardBlockedAndFinish();
  assert.deepEqual(actionCalls(calls).map(({ kind, target }) => [kind, target]), [
    ["finish", undefined], ["cancel", "elsewhere-1"], ["cancel", "elsewhere-2"], ["finish", undefined],
  ]);
  assert.deepEqual(navigation, ["/pages/work/index?id=work-a"]);
});

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
  endpoint.receipt = async () => ({ status: stored.turns ? "committed" : "pending", run_version: stored.version });
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

for (const initialOutcome of ["canceled", "committed", "unknown"]) {
  test(`切后台后按口述原文切换的旧回执恢复一次写入（${initialOutcome}）`, async () => {
    const original = "我把信原封不动寄回去。";
    const failedVoice = {
      action: { request_id: "failed-voice", version: 1, kind: "turn", source: "voice", style: "voice", text: original },
    };
    const originalPage = harness(run, { "pending:run-a": failedVoice });
    let { page, memory } = originalPage;
    const { endpoint, calls } = originalPage;
    await page.onLoad({ id: run.id, compose: "1" });
    let settleCancellation;
    let outcome = "unknown";
    let saved = run;
    let cancellationCount = 0;
    const committedIds = new Set();
    endpoint.handle = async (_path, method, action) => {
      if (method !== "POST") return saved;
      if (action.kind === "cancel") {
        if (++cancellationCount === 1) return new Promise(resolve => { settleCancellation = resolve; });
        outcome = "canceled";
        saved = { ...run, version: 2 };
        return saved;
      }
      assert.equal(action.style, "verbatim");
      assert.equal(outcome, "canceled");
      assert.equal(action.text, original);
      committedIds.add(action.request_id);
      saved = { ...saved, version: saved.version + 1, turns: 1, segments: [{ id: "voice", text: original, source: "voice" }] };
      return saved;
    };
    endpoint.receipt = async (path) => {
      const id = path.split("/").at(-1);
      return { run_version: saved.version, status: id === "failed-voice" ? outcome : committedIds.has(id) ? "committed" : "unknown" };
    };
    const switching = page.useVoiceOriginal();
    await settle();
    assert.equal(actionCalls(calls).at(-1).target, "failed-voice");
    page.onHide();
    outcome = initialOutcome;
    if (outcome === "canceled") saved = { ...run, version: 2 };
    if (outcome === "committed") {
      saved = { ...run, version: 2, turns: 1, segments: [{ id: "corrected", text: "我把信原封寄回。", source: "voice" }] };
    }
    settleCancellation(saved);
    await switching;
    let resumedCalls = calls;
    if (initialOutcome === "canceled") {
      page.onUnload();
      const reopened = harness(saved, Object.fromEntries(memory));
      Object.assign(reopened.endpoint, endpoint);
      ({ page, memory, calls: resumedCalls } = reopened);
      await page.onLoad({ id: run.id, compose: "1" });
    } else {
      await page.onShow();
    }
    const attempts = () => actionCalls(resumedCalls === calls ? calls : [...calls, ...resumedCalls]);
    assert.equal(attempts().length, 1);
    assert.equal(page.data.hasPending, outcome !== "committed");
    if (outcome !== "committed") {
      assert.equal(page.data.pendingText, original);
      await page.retryPending();
      const submitted = attempts().filter(action => action.kind === "turn");
      assert.deepEqual(submitted.map(({ version, style, text }) => [version, style, text]), [[2, "verbatim", original]]);
      if (initialOutcome === "unknown") {
        const cancels = attempts().filter(action => action.kind === "cancel");
        assert.equal(cancels.length, 2);
        assert.equal(cancels[0].request_id, cancels[1].request_id);
      }
    }
    await page.reload();
    assert.equal(page.data.run.turns, 1);
    assert.equal(page.data.run.segments.length, 1);
    assert.equal(page.data.hasPending, false);
    assert.equal(memory.has("pending:run-a"), false);
  });
}

test("本机不能保存原文切换意图时不取消旧口述", async () => {
  const original = "我把信原封不动寄回去。";
  const failedVoice = {
    action: { request_id: "failed-voice", version: 1, kind: "turn", source: "voice", style: "voice", text: original },
  };
  const { page, calls, memory, storage } = harness(run, { "pending:run-a": failedVoice });
  await page.onLoad({ id: run.id });
  storage.putPrivate = () => { throw new Error("本机故障"); };
  await page.useVoiceOriginal();
  assert.deepEqual(actionCalls(calls), []);
  assert.deepEqual(memory.get("pending:run-a"), failedVoice);
  assert.equal(page.data.pendingText, original);
  assert.match(page.data.status, /无法暂存/);
});

test("另一设备先续写时保留首页手稿，重进后由作者确认写入最新稿", async () => {
  const original = "我把信原封不动寄回去。";
  const staged = { request_id: "staged-first", source: "keyboard", text: original };
  const otherTurn = { id: "different", source: "choice", text: "先翻看信封。" };
  let saved = { ...run, version: 2, turns: 1, segments: [otherTurn] };
  let status = "unknown";
  const installBackend = (endpoint) => {
    endpoint.handle = async (_path, method, action) => {
      if (method !== "POST") return saved;
      assert.deepEqual(action, { ...staged, kind: "turn", version: 2 });
      saved = { ...saved, version: 3, turns: 2, segments: [otherTurn, { id: "mine", text: original, source: "keyboard" }] };
      status = "committed";
      return saved;
    };
    endpoint.receipt = async () => ({ status, run_version: saved.version });
  };
  const firstOpen = harness(saved, { "first:run-a": staged, "draft:run-a": "本机另一段手稿。" });
  installBackend(firstOpen.endpoint);
  await firstOpen.page.onLoad({ id: run.id });
  assert.deepEqual(actionCalls(firstOpen.calls), []);
  assert.deepEqual(firstOpen.page.data.run.segments, [otherTurn]);
  assert.equal(firstOpen.page.data.pendingText, original);
  assert.equal(firstOpen.page.data.pendingFirstKeyboard, true);
  assert.equal(firstOpen.page.data.draft, "本机另一段手稿。");
  firstOpen.page.onUnload();

  const reopened = harness(saved, Object.fromEntries(firstOpen.memory));
  installBackend(reopened.endpoint);
  await reopened.page.onLoad({ id: run.id });
  assert.deepEqual(actionCalls(reopened.calls), []);
  assert.equal(reopened.page.data.pendingText, original);
  await reopened.page.retryPending();
  assert.deepEqual(reopened.page.data.run.segments.map(segment => segment.text), [otherTurn.text, original]);
  assert.equal(reopened.page.data.run.turns, 2);
  assert.equal(reopened.page.data.draft, "本机另一段手稿。");
  assert.deepEqual([...reopened.memory.keys()], ["draft:run-a"]);
});

test("首页手稿的回执已入稿时重进不会再提交同一段", async () => {
  const staged = { request_id: "staged-first", source: "keyboard", text: "我把信原封不动寄回去。" };
  const written = { ...run, version: 2, turns: 1, segments: [{ id: "mine", text: staged.text, source: "keyboard" }] };
  const { page, calls, endpoint, memory } = harness(written, { "first:run-a": staged });
  endpoint.receipt = async () => ({ status: "committed", run_version: written.version });
  await page.onLoad({ id: run.id });
  assert.ok(calls.some(([path]) => path.endsWith("/receipts/staged-first")));
  assert.deepEqual(actionCalls(calls), []);
  assert.equal(page.data.hasPending, false);
  assert.equal(memory.has("first:run-a"), false);
  assert.equal(page.data.run.segments[0].text, staged.text);
});

test("普通模式关闭局规时在首个锁句旁说明可以继续转写", async () => {
  const { readFileSync } = require("node:fs");
  const locked = { ...run, version: 2, turns: 1, segments: [
    { id: "passage", text: "我打开信封。" },
    { id: "first-lock", locked: true, text: "邮戳是明天。" },
    { id: "later-lock", locked: true, text: "门外没有人。" },
  ] };
  const { page } = harness(locked);
  await page.onLoad({ id: run.id });
  assert.equal(page.data.showRules, false);
  assert.equal(page.data.firstLockId, "first-lock");
  const template = readFileSync(require.resolve("../.build/pages/write/index.wxml"), "utf8");
  assert.match(template, /class="manuscript"[\s\S]*?wx:if="{{item\.id === firstLockId}}"[^>]*>原句会保留，你仍可以写别的情节。/);
});
