import { api, currentSubject, ensureSession } from '../../lib/api';
import { confirm, errorText, HIGH_NOTICE, IRREVERSIBLE_NOTICE, startWriting, THEME_NAMES } from '../../lib/library-actions';
import { readingSize } from '../../lib/font';
import type { Library, Mode, Run } from '../../lib/types';

type Data = {
  fontSize: number;
  progress: Library['progress'] | null;
  modes: Mode[];
  theme: Run['theme'];
  mode: Run['mode'];
  modeId: string;
  loading: boolean;
  starting: boolean;
  saving: boolean;
  error: string;
  message: string;
  name: string;
  trigger: Mode['trigger'];
  action: Mode['action'];
  lock: boolean;
  recoverable: boolean;
  highNotice: string;
};
type Methods = {
  subject: string;
  generation: number;
  refresh(): Promise<void>;
  themeChanged(event: WechatMiniprogram.RadioGroupChange): void;
  modeChanged(event: WechatMiniprogram.RadioGroupChange): void;
  savedModeChanged(event: WechatMiniprogram.RadioGroupChange): void;
  nameChanged(event: WechatMiniprogram.Input): void;
  triggerChanged(event: WechatMiniprogram.RadioGroupChange): void;
  actionChanged(event: WechatMiniprogram.RadioGroupChange): void;
  lockChanged(event: WechatMiniprogram.SwitchChange): void;
  recoveryChanged(event: WechatMiniprogram.SwitchChange): void;
  launch(): Promise<void>;
  saveMode(): Promise<void>;
};

Page<Data, Methods>({
  data: {
    fontSize: 17,
    progress: null, modes: [], theme: 'letter', mode: 'normal', modeId: '',
    loading: true, starting: false, saving: false, error: '', message: '',
    name: '', trigger: 'manual', action: 'insert', lock: true, recoverable: true, highNotice: HIGH_NOTICE,
  },
  subject: '',
  generation: 0,

  onShow() {
    this.setData({ fontSize: readingSize() });
    void this.refresh();
  },

  onHide() {
    this.generation += 1;
    this.setData({ progress: null, modes: [], loading: true, starting: false, saving: false });
  },

  onUnload() {
    this.generation += 1;
  },

  async refresh() {
    const generation = ++this.generation;
    this.setData({ loading: true, progress: null, modes: [], error: '', message: '' });
    try {
      const subject = await ensureSession();
      if (generation !== this.generation || subject !== currentSubject()) return;
      if (this.subject !== subject) {
        this.setData({ theme: 'letter', mode: 'normal', modeId: '', name: '', trigger: 'manual', action: 'insert', lock: true, recoverable: true });
      }
      this.subject = subject;
      const { modes, progress } = await api<Library>('/library');
      if (generation !== this.generation || subject !== currentSubject()) return;
      const modeId = modes.some(mode => mode.id === this.data.modeId) ? this.data.modeId : '';
      this.setData({
        modes, progress, modeId,
        theme: progress.detective ? this.data.theme : 'letter',
        mode: (this.data.mode === 'high' && !progress.high) || (this.data.mode === 'custom' && !modeId)
          ? 'normal' : this.data.mode,
        action: (this.data.action === 'rewrite' && !progress.rewrite) || (this.data.action === 'delete' && !progress.delete)
          ? 'insert' : this.data.action,
      });
    } catch (error) {
      if (generation === this.generation) this.setData({ error: errorText(error, '暂时打不开题目和模式。') });
    } finally {
      if (generation === this.generation) this.setData({ loading: false });
    }
  },

  themeChanged(event) {
    const { value } = event.detail;
    if (value === 'letter' || (value === 'detective' && this.data.progress?.detective)) this.setData({ theme: value });
  },

  modeChanged(event) {
    const { value } = event.detail;
    if (value === 'normal' || (value === 'high' && this.data.progress?.high)) {
      this.setData({ mode: value, modeId: '' });
    }
  },

  savedModeChanged(event) {
    const { value } = event.detail;
    if (this.data.modes.some(mode => mode.id === value)) this.setData({ mode: 'custom', modeId: value });
  },

  nameChanged(event) {
    this.setData({ name: event.detail.value, message: '' });
  },

  triggerChanged(event) {
    const { value } = event.detail;
    if (value === 'manual' || value === 'response' || value === 'automatic') {
      this.setData({ trigger: value, message: '' });
    }
  },

  actionChanged(event) {
    const { value } = event.detail;
    if (value === 'insert' || (value === 'rewrite' && this.data.progress?.rewrite) || (value === 'delete' && this.data.progress?.delete)) {
      this.setData({ action: value, lock: value !== 'delete', recoverable: true, message: '' });
    }
  },

  lockChanged(event) {
    if (this.data.action !== 'delete') this.setData({ lock: event.detail.value, message: '' });
  },

  recoveryChanged(event) {
    if (this.data.action === 'delete') this.setData({ recoverable: event.detail.value, message: '' });
  },

  async launch() {
    const { progress, theme, mode, modeId, loading, starting, saving } = this.data;
    const subject = this.subject;
    const generation = this.generation;
    if (!progress || loading || starting || saving || !subject || subject !== currentSubject()) return;
    const custom = mode === 'custom' ? this.data.modes.find(option => option.id === modeId) : undefined;
    if ((mode === 'custom' && !custom) || (mode === 'high' && !progress.high) || (theme === 'detective' && !progress.detective)) return;
    const stillCurrent = () => generation === this.generation && subject === currentSubject();
    this.setData({ starting: true, error: '', message: '' });
    try {
      const irreversible = custom?.action === 'delete' && !custom.recoverable;
      if (irreversible && !await confirm({
        title: '确认不可恢复删除',
        content: IRREVERSIBLE_NOTICE,
        confirmText: '确认开局',
      })) return;
      if (mode === 'high' && !await confirm({
        title: '开启高强度模式',
        content: HIGH_NOTICE,
        confirmText: '确认开局',
      })) return;
      if (!stillCurrent()) return;
      await startWriting({
        theme, mode,
        ...(mode === 'high' ? { accept_high: true } : {}),
        ...(custom ? { mode_id: custom.id } : {}),
        ...(irreversible ? { accept_irreversible: true } : {}),
      }, stillCurrent, true);
    } catch (error) {
      if (generation === this.generation) {
        if (subject !== currentSubject()) this.setData({ progress: null, modes: [] });
        this.setData({ error: errorText(error, `暂时无法开始《${THEME_NAMES[theme]}》，请重试。`) });
      }
    } finally {
      if (generation === this.generation) this.setData({ starting: false });
    }
  },

  async saveMode() {
    const { progress, name, trigger, action, lock, recoverable, starting, saving } = this.data;
    const subject = this.subject;
    const generation = this.generation;
    if (!progress?.rewrite || starting || saving || !subject || subject !== currentSubject()) return;
    if (!name.trim()) {
      this.setData({ error: '请给个人模式起一个名字。' });
      return;
    }
    this.setData({ saving: true, error: '', message: '' });
    try {
      const saved = await api<Mode>('/modes', 'POST', { name: name.trim(), trigger, action, lock, recoverable });
      if (generation !== this.generation || subject !== currentSubject()) return;
      this.setData({ modes: [...this.data.modes, saved], mode: 'custom', modeId: saved.id, name: '', message: '个人模式已保存，可以在上方选择开局。' });
    } catch (error) {
      if (generation === this.generation) {
        if (subject !== currentSubject()) this.setData({ progress: null, modes: [] });
        this.setData({ error: errorText(error, '保存失败，已保留规则设置。') });
      }
    } finally {
      if (generation === this.generation) this.setData({ saving: false });
    }
  },
});
