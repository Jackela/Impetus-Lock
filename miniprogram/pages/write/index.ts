import { api, currentSubject, ensureSession, requestId } from "../../lib/api";
import { readingSize } from "../../lib/font";
import { markCommitted } from "../../lib/perf";
import { getPrivate, putPrivate, removePrivate } from "../../lib/storage";
import type { Action, Run, Segment, VoiceStyle } from "../../lib/types";
import { beginVoice, cancelVoice, voiceAvailable } from "../../lib/voice";

type NoticeKind = "status" | "error";
type EditKind = "edit" | "unlock" | "replace" | "restore" | "intervene" | "restyle";
type FinishControl = "begin_finish" | "resume";
type WriterAction = Action & { retain?: boolean };
type ReceiptStatus = "unknown" | "pending" | "committed" | "canceled";
interface Receipt { status: ReceiptStatus; run_version: number }
type PlotEvent = WechatMiniprogram.CustomEvent<{}, {}, { text: string }>;
type ValueEvent = WechatMiniprogram.CustomEvent<{ value: string }>;
type TargetEvent = WechatMiniprogram.CustomEvent<{}, {}, { target: string; kind?: EditKind }>;
type AbilityEvent = WechatMiniprogram.CustomEvent<{}, {}, { ability: NonNullable<Action["ability"]> }>;
type PrivacyDecision = (choice: { event: "agree"; buttonId: string } | { event: "disagree" }) => void;
type PreviewKind = "restyle" | "rewrite" | "insert" | "replace";
type StoryRun = Run & {
  generation_pending?: boolean;
  waiting_response?: boolean;
  finishing?: boolean;
  recoveries?: Recovery[];
};

interface Recovery {
  id: string;
  target: string;
  segment: Segment;
  replacement?: string | null;
}

interface Pending {
  action: WriterAction;
  first?: boolean;
  cancelRequestId?: string;
  turnsAtStart: number;
  reviewedVersion?: number;
}

interface Editor {
  kind: EditKind;
  target: string;
  current: string;
  text: string;
  title: string;
  description: string;
  previewKind?: PreviewKind;
  version: number;
}

interface Preview {
  target: string;
  version: number;
  text: string;
}

interface Runtime {
  id: string;
  subject: string;
  foreground: boolean;
  disposed: boolean;
  sequence: number;
  loading: boolean;
  cancelling: boolean;
  pending?: Pending;
  finishControl?: { kind: FinishControl; requestId: string };
  heldVoice?: { text: string; style: VoiceStyle };
  releaseVoice?: () => void;
  privacyDecision?: PrivacyDecision;
  voiceAuthorized: boolean;
  voiceEpoch: number;
  leaveCancelledVoice: boolean;
}

const styleNames = ["逐字记录", "保留口吻", "轻度书面化"];
const styleValues: VoiceStyle[] = ["verbatim", "voice", "polish"];

let privacyHandler: ((resolve: PrivacyDecision) => void) | undefined;
let privacyOwner: Runtime | undefined;
let installedPrivacyHook = false;

function registerPrivacyHook(): void {
  if (installedPrivacyHook) return;
  const listener = (resolve: PrivacyDecision) => {
    if (privacyHandler) privacyHandler(resolve);
    else resolve({ event: "disagree" });
  };
  // The platform passes a decision callback, while its generated typings declare a result object.
  wx.onNeedPrivacyAuthorization(listener as unknown as Parameters<typeof wx.onNeedPrivacyAuthorization>[0]);
  installedPrivacyHook = true;
}

function statusOf(reason: unknown): number | undefined {
  if (typeof reason === "object" && reason !== null && "status" in reason) {
    const status = (reason as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function errorText(reason: unknown): string {
  if (reason instanceof Error && reason.message) return reason.message;
  return "暂时无法完成。请稍后重试。";
}

function receiptFor(runId: string, requestId: string): Promise<Receipt> {
  return api<Receipt>("/runs/" + encodeURIComponent(runId) + "/receipts/" + encodeURIComponent(requestId));
}

function chapterName(run: Run): string {
  return run.theme === "detective" ? "古风探案" : "来信";
}

function abilityOptions(run: Run) {
  const { returning, interpret } = run.abilities;
  const options: Record<string, { name: string; description: string }> = {
    returning: returning.level
      ? { name: "旧人物带回线索", description: "让回场的人物带来一条和故事有关的新线索。" }
      : { name: "旧人物回场", description: "让本局出现过的人物在后续情节中自然回来。" },
    interpret: interpret.level
      ? { name: "进化「换个解释」", description: "可以沿选定的解释续写，也可以给故事留白。" }
      : { name: "换个解释", description: "让后文为锁句提供一种说得通的解释。" },
    toggle_returning: { name: returning.enabled ? "停用「旧人物带回线索」" : "恢复「旧人物带回线索」",
      description: "之后的行动将按新状态出题。" },
    toggle_interpret: { name: interpret.enabled ? "停用「换个解释」" : "恢复「换个解释」",
      description: "之后的行动将按新状态出题，已用的改锁机会照常计算。" },
    keep: { name: "保持现状", description: "沿用已启用的能力。" },
    skip: { name: "跳过", description: "接着写故事。" },
  };
  const offered = run.offers.filter((key) => Object.prototype.hasOwnProperty.call(options, key));
  if (offered.length && !offered.includes("keep") && !offered.includes("skip")) offered.push("skip");
  return offered.map((key) => ({ key, ...options[key] }));
}

const initialData = {
  fontSize: 17,
  run: null as StoryRun | null,
  opening: "",
  sections: [] as Run["segments"],
  chapter: "",
  modeLabel: "",
  loading: true,
  busy: false,
  status: "",
  noticeKind: "status" as NoticeKind,
  needsReload: false,
  hasPending: false,
  pendingKind: "",
  pendingVoice: false,
  pendingText: "",
  canRetryPending: false,
  composing: false,
  draft: "",
  styles: styleNames,
  styleIndex: 1,
  voiceReady: false,
  voicePhase: "" as "" | "recording" | "limit" | "processing",
  seconds: 60,
  privacyOpen: false,
  privacyBusy: false,
  mustOpenSettings: false,
  finishing: false,
  pauseConfirmed: false,
  heldVoiceText: "",
  showRules: false,
  editor: null as Editor | null,
  originalTarget: "",
  originalText: "",
  showRecoveries: false,
  offers: [] as ReturnType<typeof abilityOptions>,
  canChangeLock: false,
  canIntervene: false,
};

Page({
  data: initialData,
  runtime: undefined as Runtime | undefined,

  async onLoad(query: Record<string, string | undefined>) {
    this.runtime = {
      id: query.id ?? "", subject: "", foreground: true, disposed: false, sequence: 0, loading: false, cancelling: false,
      voiceAuthorized: false, voiceEpoch: 0, leaveCancelledVoice: false,
    };
    this.setData({ composing: query.compose === "1" });
    wx.hideShareMenu?.({ menus: ["shareAppMessage", "shareTimeline"] });
    await this.reload();
  },

  async onShow() {
    this.setData({ fontSize: readingSize() });
    if (!this.runtime) return;
    const wasHidden = !this.runtime.foreground;
    this.runtime.foreground = true;
    if (wasHidden) await this.reload();
  },

  onHide() {
    this.leaveForeground();
  },

  onUnload() {
    this.leaveForeground();
    if (this.runtime) this.runtime.disposed = true;
  },

  leaveForeground() {
    const runtime = this.runtime;
    if (!runtime?.foreground) return;
    runtime.foreground = false;
    runtime.sequence++;
    runtime.loading = false;
    runtime.cancelling = false;
    runtime.leaveCancelledVoice = Boolean(this.data.voicePhase);
    this.abortRecording();
    this.rejectPrivacy();
    this.setData({ run: null, draft: "", busy: false, editor: null, originalTarget: "", showRules: false,
      opening: "", sections: [], pendingText: "", voiceReady: false, mustOpenSettings: false, privacyBusy: false,
      originalText: "", showRecoveries: false, pauseConfirmed: false, heldVoiceText: "", loading: true });
  },

  notice(status: string, noticeKind: NoticeKind = "status") {
    this.setData({ status, noticeKind });
  },

  hidePrivateContents(message: string) {
    this.abortRecording();
    this.rejectPrivacy();
    this.setData({
      run: null, draft: "", loading: false, busy: false, editor: null, originalTarget: "", showRules: false,
      opening: "", sections: [], originalText: "",
      hasPending: false, pendingKind: "", pendingVoice: false, pendingText: "", canRetryPending: false,
      offers: [], canChangeLock: false,
      canIntervene: false, showRecoveries: false,
      needsReload: true, finishing: false, pauseConfirmed: false, heldVoiceText: "",
      voiceReady: false, privacyBusy: false, mustOpenSettings: false,
    });
    this.notice(message, "error");
  },

  valid(runtime: Runtime, sequence: number, subject: string): boolean {
    if (this.runtime !== runtime || runtime.disposed || !runtime.foreground || runtime.sequence !== sequence) return false;
    if (!subject || currentSubject() !== subject) {
      this.hidePrivateContents("微信身份尚未确认。重新确认后可恢复对应的草稿。");
      return false;
    }
    return true;
  },

  async reload() {
    const runtime = this.runtime;
    if (!runtime || runtime.loading || runtime.disposed || !runtime.foreground || this.data.busy) return;
    if (!runtime.id) {
      this.setData({ loading: false });
      this.notice("找不到这一局。可以返回首页继续。", "error");
      return;
    }
    const sequence = ++runtime.sequence;
    runtime.loading = true;
    this.setData({ loading: true, needsReload: false });
    try {
      const subject = await ensureSession();
      if (!this.valid(runtime, sequence, subject)) return;
      if (runtime.subject && runtime.subject !== subject) {
        runtime.pending = undefined;
        runtime.heldVoice = undefined;
        runtime.finishControl = undefined;
        this.hidePrivateContents("微信身份已切换。请在「我的写作」打开当前身份的草稿。");
        return;
      }
      runtime.subject = subject;
      const path = "/runs/" + encodeURIComponent(runtime.id);
      let run = await api<StoryRun>(path);
      if (!this.valid(runtime, sequence, subject)) return;
      if (run.id !== runtime.id) throw new Error("返回的稿件与当前故事不一致。请重新打开。");
      runtime.pending = getPrivate<Pending>("pending:" + runtime.id);
      let draft = getPrivate<string>("draft:" + runtime.id) ?? "";
      const { pending } = runtime;
      if (pending) {
        const receipt = await receiptFor(runtime.id, pending.action.request_id);
        if (!this.valid(runtime, sequence, subject)) return;
        if (receipt.run_version > run.version) {
          run = await api<StoryRun>(path);
          if (!this.valid(runtime, sequence, subject)) return;
        }
        if (receipt.status === "committed" || receipt.status === "canceled") {
          if (receipt.status === "committed" && draft.trim() === pending.action.text) {
            draft = "";
            removePrivate("draft:" + runtime.id);
          }
          this.clearPending(pending, false);
        }
      }
      const first = getPrivate<Omit<Action, "kind" | "version">>("first:" + runtime.id);
      if (run.finishing && runtime.finishControl?.kind === "begin_finish") runtime.finishControl = undefined;
      if (!run.finishing && runtime.finishControl?.kind === "resume") runtime.finishControl = undefined;
      this.setData({
        draft, composing: this.data.composing || Boolean(draft), loading: false, editor: null,
        originalTarget: "", originalText: "",
        finishing: Boolean(run.finishing || runtime.finishControl?.kind === "begin_finish"),
        pauseConfirmed: Boolean(run.finishing),
        heldVoiceText: runtime.heldVoice?.text ?? "",
      });
      this.setRun(run);
      this.presentPending();
      if (run.status === "finished") {
        if (runtime.pending) this.clearPending(runtime.pending, runtime.pending.action.kind === "finish");
        this.openCompleted(run);
        return;
      }
      if (runtime.pending) {
        this.notice("有一次操作仍待核对。可以安全重试或放弃。");
        return;
      }
      if (this.data.finishing) {
        this.notice(run.finishing ? "本局已暂停续写。可以处理待写入内容或保存。" : "上次暂停尚未确认。请重试暂停。");
        return;
      }
      if (run.turns > 0 && first) removePrivate("first:" + runtime.id);
      if (runtime.leaveCancelledVoice) {
        runtime.leaveCancelledVoice = false;
        this.notice("离开写作页时已停止录音。可以重新录音或打字。");
      } else {
        this.notice("");
      }
      if (run.turns === 0 && first?.text && first.source && first.request_id) {
        runtime.loading = false;
        await this.startAction({ ...first, kind: "turn", version: run.version }, true);
      }
    } catch (reason) {
      if (this.runtime !== runtime || runtime.sequence !== sequence || runtime.disposed || !runtime.foreground) return;
      this.hidePrivateContents(errorText(reason));
    } finally {
      if (runtime.sequence === sequence) runtime.loading = false;
    }
  },

  setRun(run: StoryRun) {
    this.setData({
      run,
      opening: run.segments.find((segment) => segment.id === "opening")?.text ?? run.opening,
      sections: run.segments.filter((segment) => segment.id !== "opening"),
      chapter: chapterName(run),
      modeLabel: run.mode === "high" ? "高强度" : run.mode === "custom" ? "个人模式" : "普通",
      offers: abilityOptions(run),
      canChangeLock: run.mode === "high" && run.lock_uses > 0 && run.abilities.interpret.enabled &&
        run.abilities.interpret.level >= 2,
      canIntervene: run.mode === "custom" && run.rules?.trigger === "manual" && run.turns > 0 && !run.waiting_response,
      ...(run.finishing ? { finishing: true, pauseConfirmed: true }
        : this.data.pauseConfirmed ? { finishing: false, pauseConfirmed: false } : {}),
      originalTarget: "",
      originalText: "",
      needsReload: false,
    });
  },

  presentPending() {
    const pending = this.runtime?.pending;
    const action = pending?.action;
    this.setData({
      hasPending: Boolean(action),
      pendingKind: action?.kind ?? "",
      pendingVoice: action?.kind === "turn" && action.source === "voice",
      pendingText: action?.text ?? "",
      canRetryPending: Boolean(pending),
    });
  },

  retainPending(pending: Pending) {
    const runtime = this.runtime;
    if (!runtime) return;
    putPrivate("pending:" + runtime.id, pending);
    runtime.pending = pending;
    this.presentPending();
  },

  clearPending(pending: Pending, committed: boolean) {
    const runtime = this.runtime;
    if (!runtime || runtime.pending !== pending) return;
    runtime.pending = undefined;
    removePrivate("pending:" + runtime.id);
    if (pending.first) removePrivate("first:" + runtime.id);
    if (committed && pending.action.kind === "turn" && this.data.draft.trim() === pending.action.text) {
      this.setData({ draft: "" });
      removePrivate("draft:" + runtime.id);
    }
    this.presentPending();
  },

  async startAction(action: WriterAction, first = false) {
    if (!this.runtime || !this.data.run || this.data.run.status !== "active" || this.data.busy || this.runtime.pending) return;
    if (this.data.finishing && (!this.data.pauseConfirmed || (action.kind !== "turn" && action.kind !== "finish"))) return;
    if (!this.valid(this.runtime, this.runtime.sequence, this.runtime.subject)) return;
    const command = this.data.finishing && action.kind === "turn" ? { ...action, retain: true } : action;
    const pending = { action: command, first, turnsAtStart: this.data.run.turns };
    try {
      this.retainPending(pending);
    } catch (reason) {
      this.notice("无法在本机暂存这次操作。" + errorText(reason), "error");
      return;
    }
    await this.sendPending(pending);
  },

  async sendPending(pending: Pending) {
    const runtime = this.runtime;
    if (!runtime || this.data.busy || !this.valid(runtime, runtime.sequence, runtime.subject)) return;
    const sequence = ++runtime.sequence;
    const subject = runtime.subject;
    this.setData({ busy: true });
    const { action } = pending;
    let label = "正在保存…";
    if (action.kind === "turn" && action.source === "choice") label = "正在把你的选择写进故事…";
    if (action.kind === "turn" && action.source === "voice") label = "正在整理并写入这段口述…";
    if (action.kind === "finish") label = "正在保存作品…";
    this.notice(label);
    try {
      const result = await api<StoryRun>("/runs/" + encodeURIComponent(runtime.id) + "/actions", "POST", action);
      if (!this.valid(runtime, sequence, subject) || runtime.pending !== pending) return;
      if (result.id !== runtime.id) throw new Error("返回的稿件与当前故事不一致。请核对后重试。");
      const turnCommitted = action.kind === "turn" && result.turns > pending.turnsAtStart;
      if (turnCommitted && pending.turnsAtStart === 0) markCommitted();
      this.clearPending(pending, action.kind !== "turn" || turnCommitted);
      if (!this.data.run || result.version >= this.data.run.version) this.setRun(result);
      this.setData({ editor: null, originalTarget: "", busy: false });
      if (result.status === "finished") {
        this.openCompleted(result);
        return;
      }
      if (action.kind === "turn") {
        this.notice(turnCommitted ? "新段已写入。" : "这次没有新增正文。请核对当前稿件。", turnCommitted ? "status" : "error");
      } else if (action.kind === "intervene" && !action.target && (result.pending_intervention || result.generation_pending)) {
        this.notice("本轮变化还未生成。可以继续写或稍后重试。");
      } else {
        this.notice("已保存。");
      }
    } catch (reason) {
      if (!this.valid(runtime, sequence, subject)) return;
      const status = statusOf(reason);
      if (status === 401) {
        this.hidePrivateContents("微信会话已过期。重新确认当前身份后可接着写。");
        return;
      }
      this.setData({ busy: false });
      if (status === 409) {
        this.notice("这一局已有新版本。先核对最新正文，再处理待写入内容。", "error");
      } else if (action.kind === "turn" && action.source === "voice" && action.style !== "verbatim") {
        this.notice("这段口述还未确认入稿。" + errorText(reason), "error");
      } else {
        this.notice(errorText(reason), "error");
      }
    }
  },

  async retryPending() {
    const runtime = this.runtime;
    if (!runtime?.pending || this.data.busy) return;
    const pending = runtime.pending;
    const receipt = await this.reconcilePending(pending);
    if (receipt !== "unknown" && receipt !== "pending") return;
    const run = this.data.run;
    if (!run || run.status !== "active") return;
    if (this.data.finishing) {
      if (!this.data.pauseConfirmed || (pending.action.kind !== "turn" && pending.action.kind !== "finish")) return;
      pending.action = { ...pending.action, version: run.version, ...(pending.action.kind === "turn" ? { retain: true } : {}) };
    } else if (receipt === "pending") {
      this.notice("这次操作还在处理。稍后可以再次核对。");
      return;
    } else if (pending.action.version !== run.version) {
      if (pending.action.kind !== "turn") {
        this.notice("稿件已有新版本。请放弃这次操作，再查看受影响的正文。");
        return;
      }
      if (pending.action.source === "choice" && !run.choices.includes(pending.action.text ?? "")) {
        this.notice("原剧情选项已经变化。请从当前选项另选行动。");
        return;
      }
      if (pending.reviewedVersion !== run.version) {
        pending.reviewedVersion = run.version;
        this.notice("已更新正文。核对后，再点「重试这次操作」可写入当前版本。");
        return;
      }
      pending.action = { ...pending.action, version: run.version, retain: false };
    }
    try {
      this.retainPending(pending);
    } catch (reason) {
      this.notice(errorText(reason), "error");
      return;
    }
    await this.sendPending(pending);
  },

  async reconcilePending(pending: Pending): Promise<ReceiptStatus | undefined> {
    const runtime = this.runtime;
    if (!runtime || !this.valid(runtime, runtime.sequence, runtime.subject)) return;
    const subject = runtime.subject;
    const sequence = ++runtime.sequence;
    this.setData({ busy: true });
    this.notice("正在核对这次操作是否已写入…");
    try {
      const receipt = await receiptFor(runtime.id, pending.action.request_id);
      if (!this.valid(runtime, sequence, subject)) return;
      if (receipt.status === "committed" || receipt.status === "canceled" || receipt.run_version !== this.data.run?.version) {
        const latest = await api<StoryRun>("/runs/" + encodeURIComponent(runtime.id));
        if (!this.valid(runtime, sequence, subject)) return;
        this.setRun(latest);
        if (receipt.status === "committed" || receipt.status === "canceled") {
          this.clearPending(pending, receipt.status === "committed");
          this.notice(receipt.status === "committed" ? "这次操作已生效。正文已更新。" : "这次操作已取消。");
        }
        if (latest.status === "finished") this.openCompleted(latest);
      }
      return receipt.status;
    } catch (reason) {
      if (this.valid(runtime, sequence, subject)) this.notice(errorText(reason), "error");
    } finally {
      if (runtime.sequence === sequence) this.setData({ busy: false });
    }
  },

  async cancelPending(): Promise<"committed" | "canceled" | undefined> {
    const runtime = this.runtime;
    const pending = runtime?.pending;
    if (!runtime || !pending || pending.action.kind === "finish" || runtime.cancelling) return;
    if (!this.valid(runtime, runtime.sequence, runtime.subject)) return;
    const sequence = ++runtime.sequence;
    const subject = runtime.subject;
    this.setData({ busy: true });
    this.notice("正在核对这次操作是否已写入…");
    runtime.cancelling = true;
    try {
      pending.cancelRequestId ??= requestId();
      this.retainPending(pending);
      const url = "/runs/" + encodeURIComponent(runtime.id);
      const latestBeforeCancel = await api<StoryRun>(url);
      if (!this.valid(runtime, sequence, subject)) return;
      const cancel = (version: number) => api<StoryRun>(url + "/actions", "POST", {
        kind: "cancel", request_id: pending.cancelRequestId, version, target: pending.action.request_id,
      });
      let cancelled: StoryRun;
      try {
        cancelled = await cancel(latestBeforeCancel.version);
      } catch (reason) {
        if (statusOf(reason) !== 409 || !this.valid(runtime, sequence, subject)) throw reason;
        const latestVersion = await api<StoryRun>(url);
        if (!this.valid(runtime, sequence, subject)) return;
        cancelled = await cancel(latestVersion.version);
      }
      if (!this.valid(runtime, sequence, subject)) return;
      const receipt = await receiptFor(runtime.id, pending.action.request_id);
      if (!this.valid(runtime, sequence, subject)) return;
      if (receipt.status !== "canceled" && receipt.status !== "committed") throw new Error("尚未确认这次操作的结果。");
      const latest = await api<StoryRun>(url);
      if (!this.valid(runtime, sequence, subject)) return;
      if (latest.id !== runtime.id || cancelled.id !== runtime.id) throw new Error("返回的稿件与当前故事不一致。");
      this.clearPending(pending, receipt.status === "committed");
      const result = latest.version >= cancelled.version ? latest : cancelled;
      this.setRun(result);
      this.setData({ busy: false, editor: null, originalTarget: "" });
      if (result.status === "finished") {
        this.openCompleted(result);
        return;
      }
      this.notice(receipt.status === "committed" ? "这次操作在取消前已生效，正文已更新。" : "已放弃这次操作。");
      return receipt.status;
    } catch (reason) {
      if (this.valid(runtime, sequence, subject)) {
        this.setData({ busy: false });
        this.notice("尚未确认是否已入稿。" + errorText(reason), "error");
      }
      return;
    } finally {
      if (runtime.sequence === sequence) runtime.cancelling = false;
    }
  },

  async abandonPending() {
    await this.cancelPending();
  },

  async useVoiceOriginal() {
    const pending = this.runtime?.pending;
    const original = pending?.action.text;
    if (!pending || !original || !this.data.run || this.data.busy) return;
    if (await this.cancelPending() !== "canceled" || !this.data.run) return;
    await this.startAction({
      kind: "turn", request_id: requestId(), version: this.data.run.version, source: "voice", style: "verbatim", text: original,
    });
  },

  async takeOver() {
    this.setData({ composing: true }, () => wx.pageScrollTo?.({ selector: "#writing-composer", duration: 0 }));
    const pending = this.runtime?.pending;
    if (pending?.action.kind === "turn" && pending.action.source === "choice") await this.cancelPending();
  },

  async choosePlot(event: PlotEvent) {
    const run = this.data.run;
    const text = event.currentTarget.dataset.text;
    if (!run || !run.choices.includes(text) || this.data.finishing || this.data.voicePhase) return;
    if (this.runtime?.pending?.action.source === "choice" && !this.data.busy) {
      if (!await this.cancelPending() || !this.data.run?.choices.includes(text)) return;
    }
    const current = this.data.run;
    if (!current || this.data.busy || this.data.hasPending) return;
    await this.startAction({ kind: "turn", request_id: requestId(), version: current.version, source: "choice", text });
  },

  onDraft(event: ValueEvent) {
    const runtime = this.runtime;
    if (!runtime || !this.valid(runtime, runtime.sequence, runtime.subject) || !this.data.run) return;
    const draft = event.detail.value;
    this.setData({ draft });
    try {
      if (draft) putPrivate("draft:" + runtime.id, draft);
      else removePrivate("draft:" + runtime.id);
    } catch {
      this.notice("本机无法暂存文字。可以在当前页面写入故事。", "error");
    }
  },

  discardDraft() {
    const runtime = this.runtime;
    if (!runtime || !this.valid(runtime, runtime.sequence, runtime.subject)) return;
    this.setData({ draft: "" });
    removePrivate("draft:" + runtime.id);
  },

  async submitDraft() {
    const run = this.data.run;
    const text = this.data.draft.trim();
    if (!run || !text || this.data.voicePhase) return;
    await this.startAction({ kind: "turn", request_id: requestId(), version: run.version, source: "keyboard", text });
  },

  async chooseAbility(event: AbilityEvent) {
    const run = this.data.run;
    const ability = event.currentTarget.dataset.ability;
    if (!run || !this.data.offers.some((option) => option.key === ability) || this.data.finishing || this.data.voicePhase) return;
    await this.startAction({ kind: "ability", request_id: requestId(), version: run.version, ability });
  },

  async adoptInterpretation(event: PlotEvent) {
    const run = this.data.run;
    const interpretation = event.currentTarget.dataset.text;
    if (!run?.interpretations?.includes(interpretation) || this.data.finishing || this.data.voicePhase) return;
    await this.startAction({ kind: "ability", request_id: requestId(), version: run.version, ability: "interpret", interpretation });
  },

  toggleRules() {
    this.setData({ showRules: !this.data.showRules });
  },

  async toggleOriginal(event: TargetEvent) {
    const { target } = event.currentTarget.dataset;
    if (this.data.originalTarget === target) {
      this.setData({ originalTarget: "", originalText: "" });
      return;
    }
    const runtime = this.runtime;
    const run = this.data.run;
    if (!runtime || !run || this.data.busy || this.data.finishing || this.data.voicePhase) return;
    if (!this.valid(runtime, runtime.sequence, runtime.subject)) return;
    const subject = runtime.subject;
    const sequence = ++runtime.sequence;
    this.setData({ busy: true, originalTarget: "", originalText: "" });
    this.notice("正在核对这段的原文…");
    try {
      const latest = await api<StoryRun>("/runs/" + encodeURIComponent(runtime.id));
      if (!this.valid(runtime, sequence, subject)) return;
      if (latest.id !== runtime.id) throw new Error("返回的稿件与当前故事不一致。");
      this.setRun(latest);
      const original = latest.segments.find((segment) => segment.id === target)?.original;
      if (!original || latest.finishing || latest.status !== "active") {
        this.notice("这段原文目前无法查看。", "error");
        return;
      }
      this.setData({ originalTarget: target, originalText: original });
      this.notice("");
    } catch (reason) {
      if (this.valid(runtime, sequence, subject)) this.notice(errorText(reason), "error");
    } finally {
      if (runtime.sequence === sequence) this.setData({ busy: false });
    }
  },

  toggleRecoveries() {
    this.setData({ showRecoveries: !this.data.showRecoveries });
  },

  openEditor(event: TargetEvent) {
    const run = this.data.run;
    const { target, kind = "edit" } = event.currentTarget.dataset;
    if (!run || this.data.busy || this.data.hasPending || this.data.finishing || this.data.voicePhase) return;
    const recovery = kind === "restore" ? run.recoveries?.find((item) => item.id === target) : undefined;
    const segment = run.segments.find((item) => item.id === (recovery?.target ?? target));
    if (!segment && !recovery && target !== "opening") return;
    if ((kind === "unlock" || kind === "replace") && (!segment?.locked || !this.data.canChangeLock)) return;
    if ((kind === "edit" || kind === "restore" || kind === "restyle" || kind === "intervene") && segment?.locked && !recovery) return;
    if ((kind === "restore" || kind === "restyle") && !recovery &&
      (this.data.originalTarget !== target || !this.data.originalText)) return;
    if (recovery?.replacement != null && segment?.text !== recovery.replacement) {
      this.notice("这段已有后续修改，无法原位恢复。", "error");
      return;
    }
    const isDelete = run.rules?.action === "delete";
    if (kind === "intervene" && (!segment || !this.data.canIntervene || segment.id === "opening")) return;
    const configuredAction = run.rules?.action;
    const interventionPreview = configuredAction === "insert" || configuredAction === "rewrite" ? configuredAction : undefined;
    const deletionNotice = run.rules?.recoverable
      ? "确认后正文会移除这段，仍可在这局恢复。"
      : "确认后正文会移除这段。这局里的恢复、导出和分享都无法找回。";
    const original = recovery?.segment.text ?? this.data.originalText;
    const current = segment?.text ?? (target === "opening" ? this.data.opening : "");
    let restoreDescription = "确认后，这一段会替换为下方原文，之后可继续编辑。";
    if (recovery) {
      if (recovery.replacement == null) restoreDescription = "确认后，将把已删除的原文放回正文。";
      else if (segment?.locked) restoreDescription = "确认后，原文将附在当前锁句后，当前锁句保持原样。";
    }
    const definitions: Record<EditKind, Pick<Editor, "title" | "description" | "text" | "previewKind">> = {
      edit: { title: target === "opening" ? "编辑题句" : "编辑这段文字", description: "", text: current },
      unlock: { title: "解锁原句", description: "原字会保留，之后可按普通正文编辑。成功后使用本局一次改锁机会。",
        text: current },
      replace: { title: "替换原句", description: "新句会重新锁定，原句无法在本局恢复。已发生的剧情行动继续成立。",
        text: "", previewKind: "replace" },
      restore: { title: "恢复原文", description: restoreDescription,
        text: original },
      intervene: { title: isDelete ? "删除这段文字" : run.rules?.action === "insert" ? "插入一段文字" : "改写这段文字",
        description: isDelete ? deletionNotice : "系统按本局规则处理此段，其他锁句保持原样。",
        text: "", previewKind: interventionPreview },
      restyle: { title: "重新整理口述", description: "选一种方式重新整理下面的识别原文。保存后会替换这段当前文字。",
        text: "", previewKind: "restyle" },
    };
    const choice = definitions[kind];
    this.setData({ editor: { kind, target, current, version: run.version, ...choice } },
      () => wx.pageScrollTo?.({ selector: "#writing-editor", duration: 0 }));
  },

  editText(event: ValueEvent) {
    const editor = this.data.editor;
    if (editor) this.setData({ editor: { ...editor, text: event.detail.value } });
  },

  closeEditor() {
    if (!this.data.busy) this.setData({ editor: null });
  },

  async requestPreview() {
    const runtime = this.runtime;
    const editor = this.data.editor;
    if (!runtime || !editor?.previewKind || this.data.busy || this.data.hasPending) return;
    if (!this.valid(runtime, runtime.sequence, runtime.subject)) return;
    const { previewKind, version, target } = editor;
    const style = previewKind === "restyle" ? styleValues[this.data.styleIndex] : undefined;
    const sequence = ++runtime.sequence;
    const subject = runtime.subject;
    this.setData({ busy: true });
    this.notice("正在生成预览…");
    try {
      const preview = await api<Preview>("/runs/" + encodeURIComponent(runtime.id) + "/preview", "POST",
        { version, target, kind: previewKind, ...(style ? { style } : {}) });
      if (!this.valid(runtime, sequence, subject) || this.data.editor?.target !== target) return;
      if (preview.target !== target || preview.version !== version || !preview.text.trim()) {
        throw new Error("预览与当前稿件不一致。请重新核对正文。");
      }
      this.setData({ editor: { ...editor, text: preview.text }, busy: false });
      this.notice("预览已生成。确认后才会写入。");
    } catch (reason) {
      if (!this.valid(runtime, sequence, subject)) return;
      this.setData({ busy: false });
      this.notice(errorText(reason), "error");
    } finally {
      if (runtime.sequence === sequence && this.data.busy) this.setData({ busy: false });
    }
  },

  async confirmEditor() {
    const editor = this.data.editor;
    const run = this.data.run;
    if (!editor || !run || this.data.busy) return;
    if (editor.version !== run.version) {
      this.notice("这段文字已有新版本。请查看最新正文再操作。", "error");
      return;
    }
    const text = editor.text.trim();
    if (editor.previewKind && !text) {
      await this.requestPreview();
      return;
    }
    if (editor.kind === "edit" && !text) return;
    const kind = editor.kind === "restyle" ? "edit" : editor.kind;
    const action: Action = { kind, target: editor.target, request_id: requestId(), version: editor.version };
    if (editor.kind === "edit") action.text = text;
    else if (editor.previewKind) action.text = editor.text;
    if (editor.kind === "restyle") action.style = styleValues[this.data.styleIndex];
    await this.startAction(action);
  },

  async retryIntervention() {
    const run = this.data.run;
    if ((!run?.pending_intervention && !run?.generation_pending) || this.data.finishing || this.data.voicePhase) return;
    await this.startAction({ kind: "intervene", request_id: requestId(), version: run.version });
  },

  async beginFinish() {
    if (!this.data.run || this.data.run.status !== "active") return;
    if (this.data.privacyBusy) this.rejectPrivacy();
    this.setData({ finishing: true, editor: null, privacyOpen: false });
    await this.sendFinishControl("begin_finish");
  },

  async sendFinishControl(kind: FinishControl) {
    const runtime = this.runtime;
    const run = this.data.run;
    if (!runtime || !run || !this.valid(runtime, runtime.sequence, runtime.subject)) return;
    const previous = runtime.finishControl;
    const request = previous?.kind === kind ? previous : { kind, requestId: requestId() };
    runtime.finishControl = request;
    const subject = runtime.subject;
    const sequence = ++runtime.sequence;
    runtime.cancelling = false;
    this.setData({ busy: true });
    this.notice(kind === "begin_finish" ? "正在暂停续写并核对正文…" : "正在恢复写作…");
    const path = "/runs/" + encodeURIComponent(runtime.id);
    const submit = (version: number) => api<StoryRun>(path + "/actions", "POST", {
      request_id: request.requestId, kind, version,
    });
    try {
      let result: StoryRun;
      try {
        result = await submit(run.version);
      } catch (reason) {
        if (statusOf(reason) !== 409 || !this.valid(runtime, sequence, subject)) throw reason;
        const latest = await api<StoryRun>(path);
        if (!this.valid(runtime, sequence, subject)) return;
        result = await submit(latest.version);
      }
      if (!this.valid(runtime, sequence, subject) || runtime.finishControl !== request) return;
      if (result.id !== runtime.id) throw new Error("返回的稿件与当前故事不一致。");
      this.setRun(result);
      this.setData({ busy: false });
      if (result.status === "finished") {
        runtime.finishControl = undefined;
        this.openCompleted(result);
        return;
      }
      const paused = result.finishing === true;
      if (paused !== (kind === "begin_finish")) throw new Error("尚未确认收笔状态。请重试。");
      runtime.finishControl = undefined;
      this.setData({ pauseConfirmed: paused, finishing: paused });
      this.notice(paused ? "本局已暂停续写。可以处理待写入内容或保存。" : "已恢复写作。");
    } catch (reason) {
      if (!this.valid(runtime, sequence, subject)) return;
      this.setData({ busy: false });
      this.notice(errorText(reason), "error");
    }
  },

  async retryPause() {
    if (!this.data.finishing || this.data.busy || this.data.pauseConfirmed) return;
    await this.sendFinishControl("begin_finish");
  },

  async returnToWriting() {
    if (!this.data.busy && this.data.finishing && this.data.pauseConfirmed && this.data.pendingKind !== "finish") {
      await this.sendFinishControl("resume");
    }
  },

  async discardAndFinish() {
    if (!this.data.pauseConfirmed) return;
    if (this.runtime?.pending && !await this.cancelPending()) return;
    this.abortRecording();
    this.discardHeldVoice();
    this.discardDraft();
    await this.confirmFinish();
  },

  async includeDraft() {
    if (!this.data.finishing || !this.data.pauseConfirmed || this.data.hasPending || this.data.busy) return;
    await this.submitDraft();
  },

  async confirmFinish() {
    const run = this.data.run;
    if (!run || !this.data.pauseConfirmed || this.data.hasPending || this.data.busy ||
      this.data.draft.trim() || this.data.heldVoiceText || this.data.voicePhase) return;
    await this.startAction({ kind: "finish", request_id: requestId(), version: run.version });
  },

  openCompleted(run: Run) {
    this.setData({ finishing: false, pauseConfirmed: false, heldVoiceText: "", busy: false });
    if (run.work_id) {
      const url = "/pages/work/index?id=" + encodeURIComponent(run.work_id);
      if (wx.redirectTo) wx.redirectTo({ url, fail: () => this.notice("作品已保存，可在「我的写作」打开。", "error") });
      else wx.navigateTo({ url });
    } else {
      this.notice("已收笔。这局没有可以保存的正文。");
    }
  },

  openLibrary() {
    const stack = getCurrentPages();
    const previous = stack[stack.length - 2];
    if (previous?.route === "pages/library/index") {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({
      url: "/pages/library/index",
      fail: () => this.notice("暂时无法打开「我的写作」。", "error"),
    });
  },

  goHome() {
    wx.navigateBack({ fail: () => wx.reLaunch({ url: "/pages/home/index" }) });
  },

  selectStyle(event: ValueEvent) {
    const styleIndex = Number(event.detail.value);
    if (Number.isInteger(styleIndex) && styleValues[styleIndex]) {
      const editor = this.data.editor;
      this.setData({ styleIndex, ...(editor?.kind === "restyle" ? { editor: { ...editor, text: "" } } : {}) });
    }
  },

  enableVoice() {
    const runtime = this.runtime;
    if (!runtime || !this.data.run || this.data.privacyBusy || this.data.finishing) return;
    if (!voiceAvailable() || !wx.requirePrivacyAuthorize || !wx.onNeedPrivacyAuthorization) {
      this.notice("当前环境无法提供语音识别。可以打字或点选剧情。", "error");
      return;
    }
    registerPrivacyHook();
    const epoch = ++runtime.voiceEpoch;
    const active = () => this.runtime === runtime && runtime.foreground && runtime.voiceEpoch === epoch;
    this.setData({ privacyBusy: true, mustOpenSettings: false });
    privacyOwner = runtime;
    privacyHandler = (resolve) => {
      if (!active()) return resolve({ event: "disagree" });
      runtime.privacyDecision = resolve;
      this.setData({ privacyOpen: true });
    };
    wx.requirePrivacyAuthorize({
      success: () => {
        if (!active()) return;
        wx.authorize({
          scope: "scope.record",
          success: () => {
            if (!active()) return;
            runtime.voiceAuthorized = true;
            this.setData({ voiceReady: true, privacyBusy: false, mustOpenSettings: false });
            this.notice("麦克风已启用。重新按住说话，或用点按录音。");
          },
          fail: () => {
            if (!active()) return;
            this.setData({ privacyBusy: false, mustOpenSettings: true });
            this.notice("麦克风未获授权。可以打字，也可在微信设置中开启。", "error");
          },
        });
      },
      fail: () => {
        if (!active()) return;
        this.setData({ privacyBusy: false, privacyOpen: false });
        this.notice("未开启语音。你可以打字续写或点选剧情。");
      },
      complete: () => {
        if (privacyOwner === runtime && active()) {
          privacyOwner = undefined;
          privacyHandler = undefined;
        }
      },
    });
  },

  agreePrivacy() {
    const resolve = this.runtime?.privacyDecision;
    if (!resolve || !this.runtime) return;
    this.runtime.privacyDecision = undefined;
    this.setData({ privacyOpen: false });
    resolve({ event: "agree", buttonId: "write-agree-privacy" });
  },

  rejectPrivacy() {
    const runtime = this.runtime;
    if (!runtime) return;
    runtime.voiceEpoch++;
    runtime.voiceAuthorized = false;
    const resolve = runtime.privacyDecision;
    runtime.privacyDecision = undefined;
    if (privacyOwner === runtime) {
      privacyOwner = undefined;
      privacyHandler = undefined;
    }
    resolve?.({ event: "disagree" });
    this.setData({ privacyOpen: false, privacyBusy: false, voiceReady: false });
  },

  declinePrivacy() {
    this.rejectPrivacy();
    this.notice("未开启语音。你可以打字续写或点选剧情。");
  },

  viewPrivacy() {
    wx.openPrivacyContract?.({ fail: () => this.notice("暂时无法打开隐私保护指引。", "error") });
  },

  openMicSettings() {
    wx.openSetting?.({ fail: () => this.notice("暂时无法打开微信设置。", "error") });
  },

  startRecording() {
    const runtime = this.runtime;
    if (!runtime || !this.valid(runtime, runtime.sequence, runtime.subject) || !this.data.run || this.data.hasPending ||
      this.data.finishing || this.data.voicePhase || this.data.busy || this.data.editor) return;
    if (!runtime.voiceAuthorized) {
      this.enableVoice();
      return;
    }
    const version = this.data.run.version;
    const style = styleValues[this.data.styleIndex];
    const voiceEpoch = ++runtime.voiceEpoch;
    const isCurrent = () => this.runtime === runtime && runtime.voiceEpoch === voiceEpoch &&
      runtime.foreground && currentSubject() === runtime.subject;
    this.setData({ voicePhase: "recording", seconds: 60 });
    this.notice("正在录音。正常松手后发送文字。");
    runtime.releaseVoice = beginVoice({
      progress: (seconds) => { if (isCurrent()) this.setData({ seconds }); },
      limit: () => {
        if (!isCurrent()) return;
        this.setData({ voicePhase: "limit", seconds: 0 });
        this.notice("已达到录音时限。松手或点按发送。");
      },
      processing: () => {
        if (!isCurrent()) return;
        this.setData({ voicePhase: "processing" });
        this.notice("正在识别这段口述…");
      },
      complete: (text) => {
        runtime.releaseVoice = undefined;
        if (!isCurrent()) return;
        this.setData({ voicePhase: "" });
        if (this.data.finishing) {
          runtime.heldVoice = { text, style };
          this.setData({ heldVoiceText: text });
          this.notice("口述已识别。你可以写入这段文字或放弃。");
          return;
        }
        void this.startAction({ kind: "turn", request_id: requestId(), version, source: "voice", style, text });
      },
      error: (message) => {
        runtime.releaseVoice = undefined;
        if (!isCurrent()) return;
        this.setData({ voicePhase: "" });
        this.notice(message, "error");
      },
    });
  },

  releaseRecording() {
    this.runtime?.releaseVoice?.();
  },

  toggleRecording() {
    if (this.runtime?.releaseVoice) this.releaseRecording();
    else this.startRecording();
  },

  async submitHeldVoice() {
    const runtime = this.runtime;
    const run = this.data.run;
    const held = runtime?.heldVoice;
    if (!runtime || !run || !held || this.data.hasPending || this.data.busy) return;
    if (this.data.finishing && !this.data.pauseConfirmed) return;
    const sequence = runtime.sequence;
    const request_id = requestId();
    await this.startAction({ kind: "turn", request_id, version: run.version, source: "voice", ...held });
    if (this.runtime === runtime && runtime.foreground && currentSubject() === runtime.subject &&
      (runtime.pending?.action.request_id === request_id || runtime.sequence === sequence + 1)) {
      this.discardHeldVoice();
    }
  },

  discardHeldVoice() {
    if (this.runtime) this.runtime.heldVoice = undefined;
    this.setData({ heldVoiceText: "" });
  },

  abortRecording() {
    const runtime = this.runtime;
    if (!runtime?.releaseVoice) return;
    runtime.voiceEpoch++;
    runtime.releaseVoice = undefined;
    cancelVoice();
    this.setData({ voicePhase: "" });
  },

  cancelRecording() {
    if (!this.data.voicePhase) return;
    this.abortRecording();
    this.notice("已取消录音。可以重新录音或打字。");
  },
});
