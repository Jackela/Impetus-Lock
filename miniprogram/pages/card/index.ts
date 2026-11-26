import { api, ApiError } from '../../lib/api';
import { confirm, errorText, HIGH_NOTICE, IRREVERSIBLE_NOTICE, MODE_NAMES, SHARE_COVER, startWriting, THEME_NAMES } from '../../lib/library-actions';
import { readingSize } from '../../lib/font';
import type { Card } from '../../lib/types';

type Data = {
  fontSize: number;
  card: Card | null;
  themeName: string;
  modeName: string;
  opening: string;
  rules: string;
  loading: boolean;
  starting: boolean;
  unavailable: boolean;
  error: string;
};
type Methods = {
  id: string;
  generation: number;
  refresh(): Promise<void>;
  openSamePrompt(): Promise<void>;
};

Page<Data, Methods>({
  data: {
    fontSize: 17,
    card: null, themeName: '', modeName: '', opening: '', rules: '',
    loading: true, starting: false, unavailable: false, error: '',
  },
  id: '',
  generation: 0,

  onLoad(query) {
    this.id = query.id ?? '';
  },

  onShow() {
    this.setData({ fontSize: readingSize() });
    void this.refresh();
  },

  onHide() {
    this.generation += 1;
  },

  onUnload() {
    this.generation += 1;
  },

  async refresh() {
    const generation = ++this.generation;
    const id = this.id;
    wx.hideShareMenu?.();
    this.setData({ card: null, loading: true, starting: false, unavailable: false, error: '' });
    if (!id) {
      this.setData({ loading: false, unavailable: true, error: '没有找到这张作品卡。' });
      return;
    }
    try {
      const card = await api<Card & { opening?: unknown; rules?: unknown }>(`/cards/${encodeURIComponent(id)}`);
      if (generation !== this.generation) return;
      this.setData({
        card,
        themeName: THEME_NAMES[card.theme],
        modeName: MODE_NAMES[card.mode],
        opening: typeof card.opening === 'string' ? card.opening : '',
        rules: typeof card.rules === 'string' ? card.rules : '',
      });
      wx.showShareMenu?.({ menus: ['shareAppMessage'] });
    } catch (error) {
      if (generation !== this.generation) return;
      const unavailable = error instanceof ApiError && [403, 404, 410].includes(error.status);
      this.setData({
        unavailable,
        error: unavailable ? '这张作品卡已撤回或无法访问。' : errorText(error, '暂时打不开作品卡，请重试。'),
      });
    } finally {
      if (generation === this.generation) this.setData({ loading: false });
    }
  },

  async openSamePrompt() {
    const { card, starting, loading } = this.data;
    const generation = this.generation;
    if (!card || starting || loading) return;
    const stillCurrent = () => this.generation === generation && this.data.card?.id === card.id;
    this.setData({ starting: true, error: '' });
    try {
      if (card.requires_consent && !await confirm({
        title: '确认不可恢复删除',
        content: IRREVERSIBLE_NOTICE,
        confirmText: '确认开局',
      })) return;
      if (card.mode === 'high' && !await confirm({
        title: '开启高强度同题',
        content: HIGH_NOTICE,
        confirmText: '确认开局',
      })) return;
      if (!stillCurrent()) return;
      await startWriting({
        theme: card.theme, mode: card.mode, card_id: card.id,
        ...(card.mode === 'high' ? { accept_high: true } : {}),
        ...(card.requires_consent ? { accept_irreversible: true } : {}),
      }, stillCurrent);
    } catch (error) {
      if (!stillCurrent()) return;
      if (error instanceof ApiError && [404, 410].includes(error.status)) {
        await this.refresh();
        if (this.data.card?.id === card.id) {
          this.setData({ error: '作品仍可阅读。同题开局暂不可用，你可以另选题。' });
        }
      } else {
        this.setData({ error: errorText(error, '无法开启这张卡的同题局。你可以重试或另选题。') });
      }
    } finally {
      if (stillCurrent()) this.setData({ starting: false });
    }
  },

  onShareAppMessage() {
    const card = this.data.card;
    return card
      ? { title: '读一篇故事，试试同题续写', path: '/pages/card/index?id=' + encodeURIComponent(card.id), imageUrl: SHARE_COVER }
      : { title: 'Impetus Lock', path: '/pages/home/index', imageUrl: SHARE_COVER };
  },
});
