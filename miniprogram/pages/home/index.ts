import { api, currentSubject, requestId, verifySession } from '../../lib/api';
import { beginAction, markFeedback, markReady } from '../../lib/perf';
import { getPrivate, putPrivate, removePrivate } from '../../lib/storage';
import type { Library, Receipt, Run } from '../../lib/types';

const firstLine = '十年后，你收到一封自己寄出的信';
const choices = [
  { label: '翻看信封', action: '把信封翻过来，找寄件地址' },
  { label: '请女儿看笔迹', action: '把信封递给女儿，问她认不认得这个笔迹' },
];
const launchKey = 'home:launch';
const draftKey = 'home:draft';
const blankForm = {
  opening: firstLine,
  editingOpening: false,
  writing: false,
  draft: '',
  inputError: '',
  editingStory: false,
};

type FirstTurn = { request_id: string; source: 'choice' | 'keyboard'; text: string };
type OpeningDraft = Pick<typeof blankForm, 'opening' | 'editingOpening' | 'writing' | 'draft'>;

function hasDraft(form: OpeningDraft): boolean {
  return form.opening !== firstLine || form.draft !== '';
}

type Launch = {
  owner: string;
  requestId: string;
  opening: string;
  submittedOpening?: string;
  openingRequestId?: string;
  compose: boolean;
  first?: FirstTurn;
  draft?: string;
  skipFirst?: boolean;
  deferNavigation?: boolean;
};

type HiddenInput = { foreground: number; draft?: OpeningDraft; launch?: Launch };

function labelForLaunch(launch: Launch): string {
  if (launch.skipFirst) return '';
  if (launch.first?.source === 'keyboard') return '刚写的一段';
  return choices.find(choice => choice.action === launch.first?.text)?.label ?? '';
}

type Data = typeof blankForm & {
  choices: typeof choices;
  fontSize: number;
  resumeId: string;
  resumeOpening: string;
  libraryError: string;
  privacyError: string;
  launchError: string;
  pendingLaunch: boolean;
  rules: boolean;
  frozen: boolean;
  selectedAction: string;
  phase: '' | 'identity' | 'creating' | 'navigating';
};
type Methods = {
  foreground: number;
  visible: boolean;
  verification: ReturnType<typeof verifySession> | undefined;
  editorSubject: string;
  timingStarted: boolean;
  launch: Launch | undefined;
  hiddenLaunches: Map<string, Launch>;
  hiddenInputs: Map<string, HiddenInput>;
  lastEdit: Map<string, number>;
  draftsAwaitingStorage: Map<string, OpeningDraft | null>;
  startTiming(): void;
  verifyAuthor(): Promise<string>;
  hideUnassignedInput(): void;
  restoreHiddenInput(owner: string): boolean;
  activateAuthor(subject: string): void;
  editForm(patch: Partial<OpeningDraft>): void;
  rememberDraft(): void;
  flushDraft(owner: string): void;
  loadLibrary(): Promise<void>;
  leave(): void;
  toggleOpening(): void;
  updateOpening(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  toggleWrite(): void;
  updateDraft(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  toggleRules(): void;
  openPrivacy(): void;
  chooseAction(event: WechatMiniprogram.BaseEvent): Promise<void>;
  submitDraft(): Promise<void>;
  openVoice(): Promise<void>;
  begin(source?: FirstTurn['source'], text?: string): Promise<void>;
  restoreLaunch(launch: Launch, submitted?: boolean): void;
  continueLaunch(): Promise<void>;
  launchAfterIdentity(confirmed?: string): Promise<void>;
  saveLaunchUpdate(launch: Launch): void;
  editPending(keepChoice?: boolean): void;
  skipFirstTurn(): Promise<void>;
};

Page<Data, Methods>({
  data: {
    ...blankForm,
    choices,
    fontSize: 17,
    resumeId: '',
    resumeOpening: '',
    libraryError: '',
    privacyError: '',
    launchError: '',
    pendingLaunch: false,
    rules: false,
    frozen: false,
    selectedAction: '',
    phase: '',
  },
  foreground: 0,
  visible: false,
  verification: undefined,
  editorSubject: '',
  timingStarted: false,
  launch: undefined,
  hiddenLaunches: new Map(),
  hiddenInputs: new Map(),
  lastEdit: new Map(),
  draftsAwaitingStorage: new Map(),

  onReady() {
    markReady();
  },

  onShow() {
    this.foreground += 1;
    this.visible = true;
    const scale = wx.getAppBaseInfo?.().fontSizeScaleFactor ?? 1;
    this.setData({ fontSize: Number.isFinite(scale) && scale > 0 ? 17 * scale : 17 });
    return this.loadLibrary();
  },

  onHide() {
    this.leave();
  },

  onUnload() {
    this.foreground += 1;
    this.visible = false;
  },

  leave() {
    this.visible = false;
    this.hideUnassignedInput();
    this.foreground += 1;
    this.verification = undefined;
    if (this.launch?.owner && this.data.phase !== 'navigating') {
      this.hiddenLaunches.set(this.launch.owner, this.launch);
    }
    this.editorSubject = '';
    this.launch = undefined;
    this.setData({
      ...blankForm,
      resumeId: '',
      resumeOpening: '',
      launchError: '',
      libraryError: '',
      privacyError: '',
      pendingLaunch: false,
      rules: false,
      frozen: false,
      selectedAction: '',
      phase: '',
    });
  },

  startTiming() {
    if (this.timingStarted) return;
    this.timingStarted = true;
    beginAction();
  },

  verifyAuthor() {
    const verification = verifySession();
    this.verification = verification;
    return verification.subject;
  },

  hideUnassignedInput() {
    const ownerProof = this.verification?.ownerProof;
    if (this.editorSubject || this.launch?.owner || !ownerProof) return;
    const { opening, editingOpening, writing, draft } = this.data;
    const input: HiddenInput = {
      foreground: this.foreground,
      draft: hasDraft(this.data) ? { opening, editingOpening, writing, draft } : undefined,
      launch: this.launch,
    };
    if (!input.draft && !input.launch) return;
    // Resolve ownership from the exchange that began while this input was on screen.
    // A later foreground login must never claim the hidden input.
    void ownerProof.then(owner => {
      if (!owner || (this.lastEdit.get(owner) ?? -1) >= input.foreground) return;
      const previous = this.hiddenInputs.get(owner);
      if (previous && previous.foreground >= input.foreground) return;
      if (input.launch) input.launch.owner = owner;
      this.hiddenInputs.set(owner, input);
      if (this.visible && owner === currentSubject() && !this.launch && !this.data.editingStory
          && this.restoreHiddenInput(owner) && this.launch) {
        void this.launchAfterIdentity(owner);
      }
    });
  },

  restoreHiddenInput(owner) {
    const input = this.hiddenInputs.get(owner);
    this.hiddenInputs.delete(owner);
    if (!input || input.foreground <= (this.lastEdit.get(owner) ?? -1)) return false;
    if (input.draft) {
      this.draftsAwaitingStorage.set(owner, input.draft);
      this.flushDraft(owner);
      this.editorSubject = owner;
      this.setData({ ...input.draft, editingStory: true });
    }
    if (input.launch) this.restoreLaunch(input.launch, false);
    return true;
  },

  editForm(patch) {
    if (this.data.frozen) return;
    this.startTiming();
    const subject = currentSubject();
    if (subject && this.editorSubject && subject !== this.editorSubject) {
      this.leave();
      return;
    }
    this.editorSubject ||= subject;
    if (this.editorSubject && (patch.opening !== undefined || patch.draft !== undefined)) {
      this.lastEdit.set(this.editorSubject, this.foreground);
    }
    this.setData({ ...patch, editingStory: true, inputError: '' }, markFeedback);
    if (hasDraft(this.data) || patch.opening !== undefined || patch.draft !== undefined) this.rememberDraft();
    this.editPending(patch.editingOpening !== undefined || patch.opening !== undefined);
  },

  activateAuthor(subject) {
    if (this.launch && !this.launch.owner) this.launch.owner = subject;
    if (this.editorSubject === subject || !this.data.editingStory) return;
    const previous = this.editorSubject;
    this.editorSubject = subject;
    if (previous) this.setData(blankForm);
    else if (this.launch || hasDraft(this.data)) {
      this.lastEdit.set(subject, this.foreground);
      if (hasDraft(this.data)) this.rememberDraft();
    }
  },

  rememberDraft() {
    const owner = this.editorSubject;
    if (!owner) return;
    const { opening, editingOpening, writing, draft } = this.data;
    const value = hasDraft(this.data) ? { opening, editingOpening, writing, draft } : null;
    this.draftsAwaitingStorage.set(owner, value);
    this.flushDraft(owner);
  },

  flushDraft(owner) {
    if (owner !== currentSubject()) return;
    const draft = this.draftsAwaitingStorage.get(owner);
    if (draft === undefined) return;
    try {
      if (draft === null) removePrivate(draftKey);
      else putPrivate(draftKey, draft);
      this.draftsAwaitingStorage.delete(owner);
    } catch {
      // Keep the current snapshot in memory under its confirmed owner and retry after revalidation.
    }
  },

  async loadLibrary() {
    const foreground = this.foreground;
    this.setData({ libraryError: '' });
    try {
      const subject = await this.verifyAuthor();
      if (foreground !== this.foreground || subject !== currentSubject()) return;
      this.activateAuthor(subject);
      this.flushDraft(subject);

      if (!this.launch) {
        const hidden = this.hiddenLaunches.get(subject);
        const saved = getPrivate<Launch>(launchKey);
        if (hidden?.submittedOpening || (hidden && !saved && !this.data.editingStory)) {
          this.hiddenLaunches.delete(subject);
          this.restoreLaunch(hidden, Boolean(hidden.submittedOpening));
        } else if (saved?.owner === subject) {
          this.restoreLaunch(saved);
        } else if (!this.data.editingStory && !this.restoreHiddenInput(subject)) {
          const deferred = this.draftsAwaitingStorage.get(subject);
          const draft = deferred === undefined ? getPrivate<OpeningDraft>(draftKey) : deferred;
          if (draft) {
            this.editorSubject = subject;
            this.setData({ ...draft, editingStory: true });
          }
        }
      }

      if (this.launch && !this.launch.submittedOpening && !this.data.phase) {
        await this.launchAfterIdentity(subject);
        if (foreground !== this.foreground || subject !== currentSubject()) return;
      }
      const library = await api<Library>('/library');
      if (foreground !== this.foreground || subject !== currentSubject()) return;
      const draft = library.runs.find((run) => run.status === 'active');
      const opening = draft?.segments?.find((segment) => segment.id === 'opening')?.text;
      this.setData({ resumeId: draft?.id ?? '', resumeOpening: opening ?? draft?.opening ?? '' });
    } catch {
      if (foreground === this.foreground) {
        this.setData({ libraryError: '暂时打不开写作记录。' });
      }
    }
  },

  toggleOpening() {
    this.editForm({ editingOpening: !this.data.editingOpening });
  },

  updateOpening(event) {
    this.editForm({ opening: event.detail.value });
  },

  toggleWrite() {
    this.editForm({ writing: !this.data.writing });
  },

  updateDraft(event) {
    this.editForm({ draft: event.detail.value });
  },

  toggleRules() {
    this.setData({ rules: !this.data.rules });
  },

  openPrivacy() {
    this.setData({ privacyError: '' });
    const foreground = this.foreground;
    const showError = () => {
      if (foreground === this.foreground) {
        this.setData({ privacyError: '暂时打不开隐私说明。可从微信小程序右上角菜单查看。' });
      }
    };
    if (typeof wx.openPrivacyContract !== 'function') {
      showError();
      return;
    }
    wx.openPrivacyContract({ fail: showError });
  },

  async chooseAction(event) {
    const choice = choices[Number(event.currentTarget.dataset.index)];
    if (choice) await this.begin('choice', choice.action);
  },

  async submitDraft() {
    const text = this.data.draft.trim();
    if (text) await this.begin('keyboard', text);
  },

  async openVoice() {
    await this.begin();
  },

  async begin(source, text) {
    if (this.data.frozen) return;
    const subject = currentSubject();
    if (subject && this.editorSubject && subject !== this.editorSubject) {
      this.leave();
      return;
    }
    this.startTiming();
    const opening = this.data.opening.trim();
    if (!opening) {
      this.setData({ editingOpening: true, editingStory: true, inputError: '请先写一句开头。' }, markFeedback);
      return;
    }
    if (subject) this.lastEdit.set(subject, this.foreground);
    if (this.data.phase && this.launch?.opening === opening && !this.launch.deferNavigation
        && this.launch.first?.source === source && this.launch.first?.text === text) return;
    const previous = this.launch?.submittedOpening ? this.launch : undefined;
    if (!previous) this.editPending();
    const launch: Launch = previous ?? {
      owner: this.editorSubject || subject,
      requestId: requestId(),
      opening,
      compose: false,
    };
    launch.compose = !source;
    launch.first = source && text ? { request_id: requestId(), source, text } : undefined;
    launch.draft = source !== 'keyboard' && this.data.draft ? this.data.draft : undefined;
    launch.skipFirst = false;
    launch.deferNavigation = false;
    this.launch = launch;
    if (this.data.phase === 'creating') {
      this.setData({ selectedAction: labelForLaunch(launch) }, markFeedback);
      this.saveLaunchUpdate(launch);
      return;
    }
    await this.continueLaunch();
  },

  restoreLaunch(launch, submitted = true) {
    // Records saved by earlier versions only contain the submitted opening.
    if (submitted) launch.submittedOpening ??= launch.opening;
    this.launch = launch;
    this.editorSubject = launch.owner;
    const draft = launch.first?.source === 'keyboard' ? launch.first.text : launch.draft ?? '';
    this.setData({
      ...blankForm,
      opening: launch.opening,
      editingStory: true,
      writing: Boolean(draft),
      draft,
      frozen: submitted && !launch.deferNavigation,
      pendingLaunch: true,
      selectedAction: labelForLaunch(launch),
      phase: '',
      launchError: submitted && !launch.deferNavigation ? '上次开局还未确认。' : '',
    });
  },

  continueLaunch() {
    return this.launchAfterIdentity();
  },

  async launchAfterIdentity(confirmed) {
    const launch = this.launch;
    if (!launch || this.data.phase) return;
    const foreground = this.foreground;
    const active = () => foreground === this.foreground && launch === this.launch;
    this.setData({
      pendingLaunch: true,
      launchError: '',
      editingStory: true,
      selectedAction: labelForLaunch(launch),
      phase: 'identity',
    }, markFeedback);
    let subject = '';
    let runId = '';
    let sentOpening = false;
    launch.deferNavigation = false;
    try {
      subject = confirmed ?? await this.verifyAuthor();
      if (!active()) return;
      if (subject !== currentSubject()) throw new Error('微信身份尚未确认。');
      if (launch.owner && launch.owner !== subject) {
        this.launch = undefined;
        this.editorSubject = '';
        this.setData({
          ...blankForm,
          resumeId: '',
          resumeOpening: '',
          pendingLaunch: false,
          frozen: false,
          selectedAction: '',
          phase: '',
          launchError: '微信身份已变化，请重新选择行动或写下新内容。',
        });
        return;
      }

      this.activateAuthor(subject);
      const saved = getPrivate<Launch>(launchKey);
      if (saved?.owner === subject && saved.requestId !== launch.requestId) {
        this.restoreLaunch(saved);
        return;
      }

      launch.owner = subject;
      if (!launch.opening) {
        this.setData({ editingOpening: true, inputError: '请先写一句开头。' });
        return;
      }
      const submittedOpening = launch.submittedOpening ?? launch.opening;
      // Opening retries replay the original create request. Later edits use the run's current version.
      putPrivate(launchKey, { ...launch, submittedOpening });
      launch.submittedOpening = submittedOpening;
      this.setData({ phase: 'creating' });
      sentOpening = true;
      let run = await api<Run>('/runs', 'POST', {
        request_id: launch.requestId,
        theme: 'letter',
        mode: 'normal',
        opening: submittedOpening,
      });
      if (!active()) return;
      if (subject !== currentSubject()) throw new Error('微信身份尚未确认。');
      runId = run.id;
      const openingInRun = () => run.segments?.find((segment) => segment.id === 'opening')?.text ?? submittedOpening;
      while (!launch.deferNavigation && run.status === 'active' && run.turns === 0 && openingInRun() !== launch.opening) {
        const opening = launch.opening;
        if (!opening) return;
        launch.openingRequestId ??= requestId();
        putPrivate(launchKey, launch);
        run = await api<Run>(`/runs/${encodeURIComponent(runId)}/actions`, 'POST', {
          kind: 'edit',
          target: 'opening',
          text: opening,
          version: run.version,
          request_id: launch.openingRequestId,
        });
        if (!active()) return;
        if (subject !== currentSubject()) throw new Error('微信身份尚未确认。');
        if (openingInRun() !== opening) throw new Error('开头还未确认，请重试。');
      }
      if (launch.deferNavigation || !launch.opening) return;
      this.setData({ frozen: true });
      const firstKey = `first:${runId}`;
      const stageFirst = !launch.skipFirst && run.status === 'active' && run.turns === 0;
      let firstCommitted = false;
      if (!stageFirst && launch.first?.source === 'keyboard' && run.turns > 0) {
        const receipt = await api<Receipt>(`/runs/${encodeURIComponent(runId)}/receipts/${encodeURIComponent(launch.first.request_id)}`);
        if (!active()) return;
        if (subject !== currentSubject()) throw new Error('微信身份尚未确认。');
        firstCommitted = receipt.status === 'committed';
      }
      if ((launch.skipFirst || firstCommitted) && getPrivate<FirstTurn>(firstKey)?.request_id === launch.first?.request_id) {
        removePrivate(firstKey);
      } else if (stageFirst && launch.first) {
        putPrivate(firstKey, launch.first);
      }
      const ownText = launch.first?.source === 'keyboard' ? launch.first.text : launch.draft;
      const draft = !firstCommitted && (launch.first?.source !== 'keyboard' || !stageFirst) ? ownText : undefined;
      const previousDraft = draft ? getPrivate<string>(`draft:${runId}`) : undefined;
      if (draft && !previousDraft) putPrivate(`draft:${runId}`, draft);
      const url = `/pages/write/index?id=${encodeURIComponent(runId)}${launch.compose || draft ? '&compose=1' : ''}`;
      this.setData({ phase: 'navigating' });
      await new Promise<void>((resolve, reject) => {
        wx.navigateTo({ url, success: () => resolve(), fail: reject });
      });
      if (subject === currentSubject() && getPrivate<Launch>(launchKey)?.requestId === launch.requestId) {
        removePrivate(launchKey);
        const queued = this.draftsAwaitingStorage.get(subject);
        const owned = queued === undefined ? getPrivate<OpeningDraft>(draftKey) : queued;
        if (owned && openingInRun() === launch.opening && owned.opening.trim() === launch.opening
            && owned.draft.trim() === (ownText?.trim() ?? '') && (!previousDraft || previousDraft === draft)) {
          this.draftsAwaitingStorage.set(subject, null);
          this.flushDraft(subject);
        }
      }
      if (this.launch === launch) this.launch = undefined;
      if (foreground === this.foreground) {
        this.setData({ ...blankForm, pendingLaunch: false, frozen: false, selectedAction: '', phase: '' });
      }
    } catch (error) {
      if (!active()) return;
      if (subject && subject !== currentSubject()) {
        this.setData({
          ...blankForm,
          resumeId: '',
          resumeOpening: '',
          frozen: true,
          selectedAction: '',
          launchError: '请先重新确认微信身份，再继续这次开局。',
        });
        return;
      }
      const rejected = error instanceof Error && 'status' in error
        && [400, 403, 404, 422].includes(Number(error.status));
      if (sentOpening && !runId && rejected) {
        removePrivate(launchKey);
        this.launch = undefined;
        this.setData({
          pendingLaunch: false,
          frozen: false,
          selectedAction: '',
          phase: '',
          launchError: error.message || '无法开局，请检查输入。',
        });
        return;
      }
      this.setData({
        frozen: sentOpening && !launch.deferNavigation,
        launchError: runId
          ? '这一局已建立，暂时打不开。请重试。'
          : sentOpening
            ? '开局结果还未确认。重试会核对原来的开局。'
            : subject
              ? '暂时无法保留开局记录，可以重试或修改本次输入。'
              : '暂时无法确认微信身份。已保留本次输入，可以重试。',
      });
    } finally {
      if (active()) this.setData({ phase: '' });
    }
  },

  editPending(keepChoice = false) {
    const launch = this.launch;
    if (!launch || this.data.frozen) return;
    if (keepChoice && launch.first?.source === 'choice' && !launch.skipFirst) {
      const opening = this.data.opening.trim();
      if (launch.opening !== opening) {
        launch.opening = opening;
        launch.openingRequestId = undefined;
        if (launch.submittedOpening) this.saveLaunchUpdate(launch);
        if (opening && !this.data.phase) void this.continueLaunch();
      }
      return;
    }
    if (!launch.submittedOpening) {
      this.launch = undefined;
      this.setData({ pendingLaunch: false, launchError: '', selectedAction: '', phase: '' });
      return;
    }
    const opening = this.data.opening.trim();
    if (launch.opening !== opening) {
      launch.opening = opening;
      launch.openingRequestId = undefined;
    }
    launch.draft = this.data.draft || undefined;
    launch.deferNavigation = true;
    launch.first = undefined;
    launch.compose = false;
    launch.skipFirst = false;
    this.setData({ launchError: '', selectedAction: '' });
    this.saveLaunchUpdate(launch);
  },

  saveLaunchUpdate(launch) {
    if (launch.owner !== currentSubject()) return;
    try {
      putPrivate(launchKey, launch);
    } catch {
      this.setData({ launchError: '暂时无法保留开局记录，可以重试或修改本次输入。' });
    }
  },

  async skipFirstTurn() {
    const launch = this.launch;
    if (!launch?.first || !this.data.frozen || this.data.phase === 'navigating') return;
    if (currentSubject() === launch.owner) {
      try {
        putPrivate(launchKey, { ...launch, skipFirst: true });
      } catch {
        this.setData({ launchError: '暂时无法记录这次操作，请重试。' });
        return;
      }
    }
    launch.skipFirst = true;
    this.setData({ selectedAction: '' });
    if (!this.data.phase) await this.continueLaunch();
  },
});
