import { api, currentSubject, ensureSession, requestId } from './api';
import { getPrivate, putPrivate, removePrivate } from './storage';
import type { Run } from './types';

export const IRREVERSIBLE_NOTICE = '本局规则可能删除未锁正文。删除后，局内历史、撤销、作品、导出和分享均无法找回该文字。已经另存的外部副本仍然保留。';
export const HIGH_NOTICE = '锁句受到保护。行动可能引出一次额外后果。「换个解释」进化且启用时，每局可主动解锁或替换锁句一次。';
export const SHARE_COVER = '/pages/work/share-cover.png';

export const THEME_NAMES = { letter: '来信', detective: '古风探案' } as const;
export const MODE_NAMES = { normal: '普通模式', high: '高强度模式', custom: '个人模式' } as const;

type StartRun = {
  theme: Run['theme'];
  mode: Run['mode'];
  mode_id?: string;
  card_id?: string;
  accept_irreversible?: boolean;
  accept_high?: boolean;
};

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function confirm(options: Pick<WechatMiniprogram.ShowModalOption, 'title' | 'content' | 'confirmText'>): Promise<boolean> {
  return new Promise(resolve => {
    wx.showModal({
      ...options,
      success: result => resolve(result.confirm),
      fail: () => resolve(false),
    });
  });
}

export function openWriting(id: string, replace = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      url: '/pages/write/index?id=' + encodeURIComponent(id),
      success: () => resolve(),
      fail: () => reject(new Error('暂时打不开写作页，请重试。')),
    };
    if (replace) wx.redirectTo(options);
    else wx.navigateTo(options);
  });
}

export async function startWriting(input: StartRun, stillCurrent: () => boolean, replace = false): Promise<void> {
  const subject = await ensureSession();
  if (subject !== currentSubject() || !stillCurrent()) return;
  const key = 'start:' + [input.theme, input.mode, input.mode_id ?? '', input.card_id ?? '', input.accept_irreversible ? 'accepted' : ''].join(':');
  const operation = getPrivate<string>(key) || requestId();
  putPrivate(key, operation);
  const run = await api<Run>('/runs', 'POST', { ...input, request_id: operation });
  if (subject !== currentSubject() || !stillCurrent()) return;
  await openWriting(run.id, replace);
  if (currentSubject() === subject) {
    try { removePrivate(key); } catch { /* The new run has already opened. */ }
  }
}
