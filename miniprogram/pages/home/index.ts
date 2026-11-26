import { api, currentSubject, ensureSession, requestId } from '../../lib/api';
import { beginAction, markFeedback, markReady } from '../../lib/perf';
import { getPrivate, putPrivate, removePrivate } from '../../lib/storage';
import type { Library, Run } from '../../lib/types';

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
  compose: boolean;
  first?: FirstTurn;
  draft?: string;
  skipFirst?: boolean;
  usesOwnedDraft?: boolean;
};

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
  editorSubject: string;
  timingStarted: boolean;
  launch: Launch | undefined;
  draftsAwaitingStorage: Map<string, OpeningDraft | null>;
  startTiming(): void;
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
  restoreLaunch(launch: Launch): void;
  continueLaunch(): Promise<void>;
  editPending(): void;
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
  editorSubject: '',
  timingStarted: false,
  launch: undefined,
  draftsAwaitingStorage: new Map(),

  onReady() {
    markReady();
  },

  onShow() {
    this.foreground += 1;
    const scale = wx.getAppBaseInfo?.().fontSizeScaleFactor ?? 1;
    this.setData({ fontSize: Number.isFinite(scale) && scale > 0 ? 17 * scale : 17 });
    return this.loadLibrary();
  },

  onHide() {
    this.leave();
  },

  onUnload() {
    this.foreground += 1;
  },

  leave() {
    this.foreground += 1;
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

  editForm(patch) {
    if (this.data.frozen) return;
    this.startTiming();
    this.editPending();
    const subject = currentSubject();
    if (subject && this.editorSubject && subject !== this.editorSubject) {
      this.editorSubject = '';
      this.setData(blankForm, markFeedback);
      return;
    }
    this.editorSubject ||= subject;
    this.setData({ ...patch, editingStory: true, inputError: '' }, markFeedback);
    if (hasDraft(this.data) || patch.opening !== undefined || patch.draft !== undefined) this.rememberDraft();
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
      const subject = await ensureSession();
      if (foreground !== this.foreground || subject !== currentSubject()) return;
      this.flushDraft(subject);

      if (!this.launch) {
        if (this.editorSubject && this.editorSubject !== subject) {
          this.editorSubject = '';
          this.setData(blankForm);
        }
        const saved = getPrivate<Launch>(launchKey);
        if (saved?.owner === subject) {
          this.restoreLaunch(saved);
        } else if (!this.data.editingStory) {
          const deferred = this.draftsAwaitingStorage.get(subject);
          const draft = deferred === undefined ? getPrivate<OpeningDraft>(draftKey) : deferred;
          if (draft) {
            this.editorSubject = subject;
            this.setData({ ...draft, editingStory: true });
          }
        }
      }

      const library = await api<Library>('/library');
      if (foreground !== this.foreground || subject !== currentSubject()) return;
      const draft = library.runs.find((run) => run.status === 'active');
      this.setData({ resumeId: draft?.id ?? '', resumeOpening: draft?.opening ?? '' });
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
    this.startTiming();
    const opening = this.data.opening.trim();
    if (!opening) {
      this.setData({ editingOpening: true, editingStory: true, inputError: '请先写一句开头。' }, markFeedback);
      return;
    }
    if (this.data.phase && this.launch?.opening === opening
        && this.launch.first?.source === source && this.launch.first?.text === text) return;
    this.editPending();
    this.launch = {
      owner: this.editorSubject || currentSubject(),
      requestId: requestId(),
      opening,
      compose: !source,
      first: source && text ? { request_id: requestId(), source, text } : undefined,
      draft: source !== 'keyboard' && this.data.draft ? this.data.draft : undefined,
      usesOwnedDraft: Boolean(this.editorSubject && hasDraft(this.data)),
    };
    await this.continueLaunch();
  },

  restoreLaunch(launch) {
    this.launch = launch;
    const draft = launch.first?.source === 'keyboard' ? launch.first.text : launch.draft ?? '';
    this.setData({
      ...blankForm,
      opening: launch.opening,
      editingStory: true,
      writing: Boolean(draft),
      draft,
      frozen: true,
      pendingLaunch: true,
      selectedAction: labelForLaunch(launch),
      phase: '',
      launchError: '上次开局还未确认。',
    });
  },

  async continueLaunch() {
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
    try {
      subject = await ensureSession();
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

      const saved = getPrivate<Launch>(launchKey);
      if (saved?.owner === subject && saved.requestId !== launch.requestId) {
        this.restoreLaunch(saved);
        return;
      }

      launch.owner = subject;
      putPrivate(launchKey, launch);
      this.setData({ frozen: true, phase: 'creating' });
      const run = await api<Run>('/runs', 'POST', {
        request_id: launch.requestId,
        theme: 'letter',
        mode: 'normal',
        opening: launch.opening,
      });
      if (!active()) return;
      if (subject !== currentSubject()) throw new Error('微信身份尚未确认。');
      runId = run.id;
      const firstKey = `first:${runId}`;
      if (launch.skipFirst && getPrivate<FirstTurn>(firstKey)?.request_id === launch.first?.request_id) {
        removePrivate(firstKey);
      } else if (!launch.skipFirst && launch.first && run.turns === 0) {
        putPrivate(firstKey, launch.first);
      }
      const draft = launch.skipFirst && launch.first?.source === 'keyboard' ? launch.first.text : launch.draft;
      if (draft && !getPrivate<string>(`draft:${runId}`)) putPrivate(`draft:${runId}`, draft);
      const url = `/pages/write/index?id=${encodeURIComponent(runId)}${launch.compose || draft ? '&compose=1' : ''}`;
      this.setData({ phase: 'navigating' });
      await new Promise<void>((resolve, reject) => {
        wx.navigateTo({ url, success: () => resolve(), fail: reject });
      });
      if (subject === currentSubject() && getPrivate<Launch>(launchKey)?.requestId === launch.requestId) {
        removePrivate(launchKey);
        if (launch.usesOwnedDraft) {
          this.draftsAwaitingStorage.set(subject, null);
          this.flushDraft(subject);
        }
      }
      if (active()) {
        this.launch = undefined;
        this.setData({ ...blankForm, pendingLaunch: false, frozen: false, selectedAction: '', phase: '' });
      }
    } catch (error) {
      if (!active()) return;
      if (subject && subject !== currentSubject()) {
        this.setData({
          ...blankForm,
          resumeId: '',
          resumeOpening: '',
          launchError: '请先重新确认微信身份，再继续这次开局。',
        });
        return;
      }
      const rejected = error instanceof Error && 'status' in error
        && [400, 403, 404, 422].includes(Number(error.status));
      if (this.data.frozen && !runId && rejected) {
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
        launchError: runId
          ? '这一局已建立，暂时打不开。请重试。'
          : this.data.frozen
            ? '开局结果还未确认。重试会核对原来的开局。'
            : subject
              ? '暂时无法保留开局记录，可以重试或修改本次输入。'
              : '暂时无法确认微信身份。已保留本次输入，可以重试。',
      });
    } finally {
      if (active()) this.setData({ phase: '' });
    }
  },

  editPending() {
    if (!this.launch || this.data.frozen) return;
    this.launch = undefined;
    this.setData({ pendingLaunch: false, launchError: '', selectedAction: '', phase: '' });
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
