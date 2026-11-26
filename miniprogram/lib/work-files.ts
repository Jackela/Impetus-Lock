import { requestId } from './api';

export type PlainWork = { title: string; text: string };

export function plainText({ title, text }: PlainWork): string {
  return title.trim() ? title + '\n\n' + text : text;
}

export function copyWork(work: PlainWork): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data: plainText(work),
      success: () => resolve(),
      fail: () => reject(new Error('复制未完成，可以重试或导出 TXT。')),
    });
  });
}

export function shareTextFile(work: PlainWork): Promise<boolean> {
  if (typeof wx.shareFileMessage !== 'function') {
    return Promise.reject(new Error('当前微信版本无法发送 TXT 文件，可以复制文字。'));
  }

  const files = wx.getFileSystemManager();
  const filePath = wx.env.USER_DATA_PATH + '/story-' + requestId() + '.txt';
  const cleanedTitle = work.title.trim().replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ').trim();
  const fileName = (Array.from(cleanedTitle).slice(0, 40).join('') || '我的作品') + '.txt';
  return new Promise<boolean>((resolve, reject) => {
    files.writeFile({
      filePath,
      data: plainText(work),
      encoding: 'utf8',
      success: () => {
        wx.shareFileMessage({
          filePath,
          fileName,
          success: () => resolve(true),
          fail: result => {
            if (result.errMsg.includes('cancel')) resolve(false);
            else reject(new Error('未能用微信发送 TXT 文件，可以重试或复制文字。'));
          },
          complete: () => files.unlink({ filePath, fail: () => undefined }),
        });
      },
      fail: () => reject(new Error('无法生成 TXT 文件，可以复制文字。')),
    });
  });
}
