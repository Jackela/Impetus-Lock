import { api, currentSubject, ensureSession } from '../../lib/api';
import { errorText, MODE_NAMES, openWriting, THEME_NAMES } from '../../lib/library-actions';
import { readingSize } from '../../lib/font';
import type { Library, Run, Work } from '../../lib/types';

type NamedRun = { id: string; turns: number; themeName: string; modeName: string; excerpt: string };
type NamedWork = Pick<Work, 'id' | 'title'> & { themeName: string };
type Data = {
  fontSize: number;
  loading: boolean;
  loaded: boolean;
  error: string;
  runs: NamedRun[];
  works: NamedWork[];
  opening: boolean;
};
type Methods = {
  generation: number;
  subject: string;
  refresh(): Promise<void>;
  openRun(event: WechatMiniprogram.BaseEvent): Promise<void>;
};

Page<Data, Methods>({
  data: { fontSize: 17, loading: true, loaded: false, error: '', runs: [], works: [], opening: false },
  generation: 0,
  subject: '',

  onShow() {
    this.setData({ fontSize: readingSize() });
    void this.refresh();
  },

  onHide() {
    this.generation += 1;
    this.setData({ runs: [], works: [], loaded: false, loading: true, opening: false, error: '' });
  },

  onUnload() {
    this.generation += 1;
  },

  onPullDownRefresh() {
    void this.refresh().finally(() => wx.stopPullDownRefresh());
  },

  async refresh() {
    const generation = ++this.generation;
    this.setData({ loading: true, loaded: false, error: '', runs: [], works: [] });
    try {
      const subject = await ensureSession();
      if (generation !== this.generation || subject !== currentSubject()) return;
      this.subject = subject;
      const library = await api<Library>('/library');
      if (generation !== this.generation || subject !== currentSubject()) return;
      this.setData({
        loaded: true,
        runs: library.runs.filter(run => run.status === 'active').map(run => ({
          id: run.id, turns: run.turns, themeName: THEME_NAMES[run.theme], modeName: MODE_NAMES[run.mode],
          excerpt: (run.segments[0]?.text || run.opening).slice(0, 200),
        })),
        works: library.works.map(work => ({ id: work.id, title: work.title, themeName: THEME_NAMES[work.theme] })),
      });
    } catch (error) {
      if (generation === this.generation) this.setData({ error: errorText(error, '暂时打不开写作记录。') });
    } finally {
      if (generation === this.generation) this.setData({ loading: false });
    }
  },

  async openRun(event) {
    if (this.data.opening || !this.subject || this.subject !== currentSubject()) return;
    const id = String(event.currentTarget.dataset.id ?? '');
    if (!this.data.runs.some(run => run.id === id)) return;
    const generation = this.generation;
    this.setData({ opening: true, error: '' });
    try {
      await openWriting(id, true);
    } catch (error) {
      if (generation === this.generation) this.setData({ error: errorText(error, '暂时打不开这局。') });
    } finally {
      if (generation === this.generation) this.setData({ opening: false });
    }
  },
});
