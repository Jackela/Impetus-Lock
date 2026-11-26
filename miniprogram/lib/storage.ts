import { currentSubject } from "./api";

function scopedKey(key: string): string | undefined {
  const subject = currentSubject();
  return subject ? "il:wechat:v1:" + encodeURIComponent(subject) + ":" + key : undefined;
}

export function getPrivate<T>(key: string): T | undefined {
  const name = scopedKey(key);
  if (!name) return undefined;
  const value = wx.getStorageSync(name);
  return value === "" || value == null ? undefined : value as T;
}

export function putPrivate(key: string, value: unknown): void {
  const name = scopedKey(key);
  if (!name) throw new Error("需要确认微信身份才能暂存文字。");
  wx.setStorageSync(name, value);
}

export function removePrivate(key: string): void {
  const name = scopedKey(key);
  if (name) wx.removeStorageSync(name);
}
