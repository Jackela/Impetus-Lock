import { api, ApiError, currentSubject, ensureSession, requestId } from '../../lib/api';
import { confirm, errorText, MODE_NAMES, SHARE_COVER, THEME_NAMES } from '../../lib/library-actions';
import { getPrivate, putPrivate, removePrivate } from '../../lib/storage';
import { readingSize } from '../../lib/font';
import type { Card, Work } from '../../lib/types';
import { copyWork, shareTextFile } from '../../lib/work-files';

const COPIES_NOTICE = '持有卡片的人可以阅读。已阅读、复制、截图或由微信缓存的内容，撤回后仍可能保留。';
const UNAVAILABLE_NOTICE = '当前微信身份需要重新确认，请重试读取。';

type Draft = { base: Work; title: string; text: string };
type CardSummary = Pick<Card, 'id' | 'title'> & { snippet: string };
type Data = {
  fontSize: number;
  base: Work | null;
  latest: Work | null;
  preview: (Work & { consentNotice: string }) | null;
  title: string;
  text: string;
  themeName: string;
  modeName: string;
  dirty: boolean;
  verified: boolean;
  loading: boolean;
  busy: boolean;
  error: string;
  status: string;
  storageError: string;
  cards: CardSummary[];
  cardsLoading: boolean;
  cardsError: string;
};

type Methods = {
  id: string;
  subject: string;
  generation: number;
  memoryDraft?: { subject: string; draft: Draft };
  refresh(): Promise<void>;
  refreshCards(): Promise<void>;
  isCurrent(generation: number, subject: string): boolean;
  keepDraft(): void;
  setVersion(work: Work): void;
  titleChanged(event: WechatMiniprogram.Input): void;
  textChanged(event: WechatMiniprogram.TextareaInput): void;
  save(): Promise<void>;
  detectSaveResult(base: Work, title: string, text: string, generation: number, subject: string): Promise<void>;
  useCurrentEdits(): void;
  useSavedVersion(): Promise<void>;
  copy(): Promise<void>;
  exportTxt(): Promise<void>;
  previewShare(): void;
  closePreview(): void;
  publish(): Promise<void>;
  withdraw(event: WechatMiniprogram.BaseEvent): Promise<void>;
};

type CardList = { cards: Array<Card & { revoked?: boolean }> };

function summarizeCard(card: Card): CardSummary {
  return { id: card.id, title: card.title, snippet: card.text.slice(0, 200) };
}

Page<Data, Methods>({
  data: {
    fontSize: 17,
    base: null, latest: null, preview: null, title: '', text: '', themeName: '', modeName: '',
    dirty: false, verified: false, loading: true, busy: false, error: '', status: '',
    storageError: '', cards: [], cardsLoading: false, cardsError: '',
  },
  id: '',
  subject: '',
  generation: 0,

  onLoad(query) {
    this.id = query.id ?? '';
    wx.hideShareMenu?.();
  },

  onShow() {
    this.setData({ fontSize: readingSize() });
    if (!this.subject || this.subject !== currentSubject()) void this.refresh();
  },

  onUnload() {
    this.generation += 1;
  },

  isCurrent(generation, subject) {
    return generation === this.generation && subject === currentSubject();
  },

  async refresh() {
    if (this.data.busy && this.subject && this.subject === currentSubject()) return;
    const generation = ++this.generation;
    const path = '/works/' + encodeURIComponent(this.id);
    this.setData({
      loading: true, verified: false, busy: false, base: null, latest: null, preview: null, title: '', text: '',
      dirty: false, cards: [], cardsLoading: false, error: '', cardsError: '', status: '', storageError: '',
    });
    if (!this.id) {
      this.setData({ loading: false, error: '缺少作品编号。' });
      return;
    }
    try {
      const subject = await ensureSession();
      if (!this.isCurrent(generation, subject)) return;
      this.subject = subject;
      let cached = this.memoryDraft?.subject === subject ? this.memoryDraft.draft : undefined;
      try {
        cached ??= getPrivate<Draft>('work:' + this.id);
      } catch {
        this.setData({ storageError: '未能读取本机暂存。将尝试打开已保存的作品。' });
      }
      const local = cached?.base?.id === this.id ? cached : undefined;
      if (local) {
        this.setData({
          base: local.base, dirty: true, title: local.title, text: local.text,
          themeName: THEME_NAMES[local.base.theme], modeName: MODE_NAMES[local.base.mode],
        });
        this.keepDraft();
      }
      const work = await api<Work>(path);
      if (!this.isCurrent(generation, subject)) return;
      this.setData({ verified: true });
      if (!local || (local.title === work.title && local.text === work.text)) {
        this.setVersion(work);
      } else if (local.base.version === work.version) {
        this.setData({ base: work, status: '已恢复这台设备上的未保存修改。' });
      } else {
        this.setData({ latest: work, error: '已保存的版本有更新。本次修改仍在，请先核对两个版本。' });
      }
      void this.refreshCards();
    } catch (error) {
      if (generation !== this.generation) return;
      if (this.subject !== currentSubject() || (error instanceof ApiError && [403, 404].includes(error.status))) {
        this.setData({
          base: null, latest: null, title: '', text: '', dirty: false,
          error: this.subject !== currentSubject()
            ? errorText(error, UNAVAILABLE_NOTICE)
            : '当前微信身份无法打开这篇作品。',
        });
      } else {
        this.setData({ error: errorText(error, '暂时打不开已保存的作品。') });
      }
    } finally {
      if (generation === this.generation) this.setData({ loading: false });
    }
  },

  async refreshCards() {
    const generation = this.generation;
    const subject = this.subject;
    if (!subject || !this.isCurrent(generation, subject) || this.data.cardsLoading) return;
    this.setData({ cardsLoading: true, cardsError: '' });
    try {
      const { cards } = await api<CardList>('/works/' + encodeURIComponent(this.id) + '/cards');
      if (this.isCurrent(generation, subject)) {
        this.setData({ cards: cards.filter(card => !card.revoked).map(summarizeCard) });
      }
    } catch (error) {
      if (this.isCurrent(generation, subject)) {
        this.setData({ cardsError: errorText(error, '暂时打不开已发布的作品卡。') });
      } else if (generation === this.generation) {
        this.setData({
          base: null, latest: null, preview: null, title: '', text: '', cards: [],
          dirty: false, verified: false, error: errorText(error, UNAVAILABLE_NOTICE),
        });
      }
    } finally {
      if (generation === this.generation) this.setData({ cardsLoading: false });
    }
  },

  keepDraft() {
    const { base, title, text } = this.data;
    if (!base || this.subject !== currentSubject()) return;
    const dirty = title !== base.title || text !== base.text;
    this.setData({ dirty, status: '' });
    const draft: Draft = { base, title, text };
    if (dirty) this.memoryDraft = { subject: this.subject, draft };
    else if (this.memoryDraft?.subject === this.subject) this.memoryDraft = undefined;
    try {
      if (dirty) putPrivate('work:' + this.id, draft);
      else removePrivate('work:' + this.id);
      this.setData({ storageError: '' });
    } catch {
      if (dirty) this.setData({ storageError: '未能在此设备暂存修改。离开前请保存、复制或导出文字。' });
    }
  },

  setVersion(work) {
    this.setData({
      base: work, title: work.title, text: work.text, dirty: false, latest: null, preview: null, error: '',
      themeName: THEME_NAMES[work.theme], modeName: MODE_NAMES[work.mode],
    });
    this.keepDraft();
  },

  titleChanged(event) {
    if (this.data.busy || this.data.loading || this.subject !== currentSubject()) return;
    this.setData({ title: event.detail.value });
    this.keepDraft();
  },

  textChanged(event) {
    if (this.data.busy || this.data.loading || this.subject !== currentSubject()) return;
    this.setData({ text: event.detail.value });
    this.keepDraft();
  },

  async save() {
    const { base, title, text, dirty, verified, latest, busy } = this.data;
    const generation = this.generation;
    const subject = this.subject;
    if (!base || !dirty || !verified || latest || busy || !this.isCurrent(generation, subject)) return;
    this.setData({ busy: true, error: '', status: '' });
    try {
      const updated = await api<Work>('/works/' + encodeURIComponent(this.id), 'PATCH', { version: base.version, title, text });
      if (!this.isCurrent(generation, subject)) return;
      this.setVersion(updated);
      this.setData({ status: '作品已保存。' });
    } catch (error) {
      if (!this.isCurrent(generation, subject)) {
        if (generation === this.generation) void this.refresh();
        return;
      }
      this.setData({ error: errorText(error, '保存未完成。现在的文字仍在，可以重试或带走。') });
      if (error instanceof ApiError && (error.status === 409 || error.status === 0 || error.status >= 500)) {
        await this.detectSaveResult(base, title, text, generation, subject);
      }
    } finally {
      if (generation === this.generation) this.setData({ busy: false });
    }
  },

  async detectSaveResult(base, title, text, generation, subject) {
    try {
      const saved = await api<Work>('/works/' + encodeURIComponent(this.id));
      if (!this.isCurrent(generation, subject)) return;
      if (saved.title === title && saved.text === text) {
        this.setVersion(saved);
        this.setData({ status: '已核对，作品已保存。' });
      } else if (saved.version !== base.version) {
        this.setData({ latest: saved, error: '已保存的版本有更新。本次修改仍在，请先核对两个版本。' });
      } else {
        this.setData({ error: '已核对保存版本，本次修改还未保存。可以重试或带走现在的文字。' });
      }
    } catch {
      if (this.isCurrent(generation, subject)) {
        this.setData({ error: '还无法核对保存结果。现在的文字仍在，可以重试或带走。' });
      } else if (generation === this.generation) {
        void this.refresh();
      }
    }
  },

  useCurrentEdits() {
    const { latest, busy } = this.data;
    if (!latest || busy || this.subject !== currentSubject()) return;
    this.setData({ base: latest, latest: null, error: '' });
    this.keepDraft();
    this.setData({ status: '已保留当前修改。确认文字后可再保存。' });
  },

  async useSavedVersion() {
    const { latest, busy } = this.data;
    const generation = this.generation;
    const subject = this.subject;
    if (!latest || busy || !this.isCurrent(generation, subject)) return;
    if (await confirm({ title: '采用已保存版本', content: '采用后将放弃此页的未保存修改。', confirmText: '采用' })
      && this.isCurrent(generation, subject) && this.data.latest?.version === latest.version) {
      this.setVersion(latest);
      this.setData({ status: '已载入保存的版本。' });
    }
  },

  async copy() {
    const { base, title, text, busy } = this.data;
    const generation = this.generation;
    const subject = this.subject;
    if (!base || busy || !this.isCurrent(generation, subject)) return;
    try {
      await copyWork({ title, text });
      if (this.isCurrent(generation, subject)) this.setData({ status: '已复制当前文字。' });
    } catch (error) {
      if (this.isCurrent(generation, subject)) this.setData({ status: errorText(error, '复制未完成。') });
    }
  },

  async exportTxt() {
    const { base, title, text, busy } = this.data;
    const generation = this.generation;
    const subject = this.subject;
    if (!base || busy || !this.isCurrent(generation, subject)) return;
    this.setData({ busy: true, status: '' });
    try {
      const sent = await shareTextFile({ title, text });
      if (sent && this.isCurrent(generation, subject)) this.setData({ status: 'TXT 文件已交给微信。' });
    } catch (error) {
      if (this.isCurrent(generation, subject)) this.setData({ status: errorText(error, 'TXT 导出未完成。') });
    } finally {
      if (generation === this.generation) this.setData({ busy: false });
    }
  },

  previewShare() {
    const { base, dirty, verified, latest, busy, cardsLoading } = this.data;
    if (!base || dirty || !verified || latest || busy || cardsLoading || this.subject !== currentSubject()) return;
    if (!base.text.trim()) {
      this.setData({ error: '保存一段正文后即可发布作品卡。' });
      return;
    }
    const consentNotice = base.requires_consent
      ? '好友开局前需要确认不可恢复删除规则。'
      : base.mode === 'high' ? '好友开局前需要确认高强度模式。' : '';
    this.setData({ preview: { ...base, consentNotice }, error: '', status: '' }, () => {
      wx.pageScrollTo?.({ scrollTop: 0, duration: 0 });
    });
  },

  closePreview() {
    if (!this.data.busy) {
      this.setData({ preview: null, error: '' }, () => {
        wx.pageScrollTo?.({ selector: '#work-card-section', duration: 0 });
      });
      void this.refreshCards();
    }
  },

  async publish() {
    const { preview, busy, base } = this.data;
    const generation = this.generation;
    const subject = this.subject;
    if (!preview || busy || base?.version !== preview.version || !this.isCurrent(generation, subject)) return;
    const key = 'publish:' + this.id + ':' + preview.version;
    this.setData({ busy: true, error: '', status: '' });
    try {
      const operation = getPrivate<string>(key) || requestId();
      putPrivate(key, operation);
      const card = await api<Card>('/works/' + encodeURIComponent(this.id) + '/cards', 'POST', {
        request_id: operation, version: preview.version,
      });
      if (!this.isCurrent(generation, subject)) return;
      const cards = [summarizeCard(card), ...this.data.cards.filter(previous => previous.id !== card.id)];
      this.setData({ preview: null, cards, status: '已发布固定版本，使用下方按钮发送给微信好友。' }, () => {
        wx.pageScrollTo?.({ selector: '#work-card-section', duration: 0 });
      });
      try { removePrivate(key); } catch { /* The server has already confirmed this card. */ }
    } catch (error) {
      if (!this.isCurrent(generation, subject)) {
        if (generation === this.generation) void this.refresh();
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        this.setData({ preview: null, busy: false });
        await this.refresh();
        if (subject === currentSubject() && this.data.verified) {
          this.setData({ error: '发布时作品版本已变化。请核对最新保存的内容和已发布的卡片。' });
        }
      } else {
        this.setData({ error: errorText(error, '发布结果尚未确认，请重试确认发布。') });
      }
    } finally {
      if (generation === this.generation) this.setData({ busy: false });
    }
  },

  async withdraw(event) {
    const id = String(event.currentTarget.dataset.id ?? '');
    const generation = this.generation;
    const subject = this.subject;
    if (this.data.busy || this.data.cardsLoading || !this.isCurrent(generation, subject) || !this.data.cards.some(card => card.id === id)) return;
    this.setData({ busy: true, cardsError: '', status: '' });
    try {
      if (!await confirm({ title: '撤回作品卡', content: '撤回后，这张卡将停止提供正文并无法发起同题。' + COPIES_NOTICE, confirmText: '撤回' })
        || !this.isCurrent(generation, subject)) return;
      await api<void>('/works/' + encodeURIComponent(this.id) + '/cards/' + encodeURIComponent(id), 'DELETE');
      if (!this.isCurrent(generation, subject)) return;
      this.setData({ cards: this.data.cards.filter(card => card.id !== id), status: '作品卡已撤回。' });
    } catch (error) {
      if (this.isCurrent(generation, subject)) {
        this.setData({ cardsError: errorText(error, '撤回结果尚未确认，请核对作品卡列表。') });
      } else if (generation === this.generation) {
        void this.refresh();
      }
    } finally {
      if (generation === this.generation) this.setData({ busy: false });
    }
  },

  onShareAppMessage(event) {
    const id = event.from === 'button' ? event.target?.dataset?.id : undefined;
    if (this.subject && this.subject === currentSubject() && this.data.cards.some(card => card.id === id)) {
      return { title: '读一篇故事，试试同题续写', path: '/pages/card/index?id=' + encodeURIComponent(id), imageUrl: SHARE_COVER };
    }
    return { title: 'Impetus Lock', path: '/pages/home/index', imageUrl: SHARE_COVER };
  },
});
