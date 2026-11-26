/** Return the reading size selected in WeChat, in logical pixels. */
export function readingSize(): number {
  const scale = wx.getAppBaseInfo?.().fontSizeScaleFactor;
  return typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? 17 * scale : 17;
}
