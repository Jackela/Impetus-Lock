declare const requirePlugin: (name: string) => unknown;

const recordingLimit = 60000;
const startingTimeout = 10000;
const completionTimeout = 15000;

interface RecognitionResult {
  result?: string;
  duration?: number;
  tempFilePath?: string;
}

interface RecognitionManager {
  start(settings: { duration: number; lang: "zh_CN" }): void;
  stop(): void;
  onStart: () => void;
  onStop: (result: RecognitionResult) => void;
  onError: () => void;
}

interface RecognitionPlugin {
  getRecordRecognitionManager(): RecognitionManager;
}

interface VoiceHandlers {
  progress: (remaining: number) => void;
  limit: () => void;
  processing: () => void;
  complete: (text: string) => void;
  review: (text: string) => void;
  error: (message: string) => void;
}

interface Recording {
  handlers: VoiceHandlers;
  scope: string;
  needsReview: boolean;
  startedAt: number;
  started: boolean;
  released: boolean;
  terminal: boolean;
  result?: string;
  starting?: ReturnType<typeof setTimeout>;
  countdown?: ReturnType<typeof setInterval>;
  timeout?: ReturnType<typeof setTimeout>;
}

interface Recovery {
  scope: string;
  outstanding: number;
  allowReview: boolean;
}

let manager: RecognitionManager | undefined;
let current: Recording | undefined;
let recovery: Recovery | undefined;
const completedPaths = new Set<string>();
let hasRetiredRecording = false;

function clearTimers(recording: Recording): void {
  if (recording.starting !== undefined) clearTimeout(recording.starting);
  if (recording.countdown !== undefined) clearInterval(recording.countdown);
  if (recording.timeout !== undefined) clearTimeout(recording.timeout);
}

function clearCurrent(recording: Recording): void {
  clearTimers(recording);
  if (current === recording) current = undefined;
}

function cleanTemporaryRecording(path?: string): void {
  if (!path) return;
  try {
    wx.getFileSystemManager().unlink({ filePath: path, fail() {} });
  } catch {
    // The WeChat-managed temporary file can already be gone.
  }
}

function reportResult(recording: Recording, text: string): void {
  clearCurrent(recording);
  if (!text) recording.handlers.error("没有识别到文字。可以重录，也可以打字续写。");
  else if (recording.needsReview) recording.handlers.review(text);
  else recording.handlers.complete(text);
}

function onStop(result: RecognitionResult): void {
  const path = result.tempFilePath;
  cleanTemporaryRecording(path);
  if (path) {
    if (completedPaths.has(path)) return;
    completedPaths.add(path);
    // WechatSI's singleton returns one temporary file for an ended recording.
    // A pathless result or error cannot prove that a pending recording ended.
    if (recovery && --recovery.outstanding === 0) recovery = undefined;
  }
  const recording = current;
  if (!recording || recording.terminal || !recording.started) return;
  if (!path && hasRetiredRecording) return;
  const text = result.result?.trim() ?? "";
  if (recording.released) {
    reportResult(recording, text);
    return;
  }
  const elapsed = Date.now() - recording.startedAt;
  const limitReached = (result.duration ?? elapsed) >= recordingLimit - 1200;
  if (limitReached && (!recording.needsReview || elapsed >= recordingLimit - 1200)) {
    clearTimers(recording);
    recording.terminal = true;
    recording.result = text;
    recording.handlers.limit();
    return;
  }
  if (recording.needsReview && recovery) return;
  clearCurrent(recording);
  recording.handlers.error("录音已中断。可以重新按住说话，也可以打字。");
}

function onError(): void {
  const recording = current;
  if (!recording || recording.terminal || recording.needsReview) return;
  clearCurrent(recording);
  recording.handlers.error("语音识别没有完成。可以重录，也可以打字。");
}

function requestStop(): void {
  try {
    manager?.stop();
  } catch {
    // A thrown stop does not establish that the singleton ended recording.
  }
}

function retire(recording: Recording, allowReview: boolean): void {
  if (!recovery && !recording.needsReview) {
    recovery = { scope: recording.scope, outstanding: 1, allowReview };
    hasRetiredRecording = true;
  } else if (recovery && !allowReview) {
    recovery.allowReview = false;
  }
  clearCurrent(recording);
  if (!recording.started || !recording.released) requestStop();
}

function getManager(): RecognitionManager {
  if (manager) return manager;
  const plugin = requirePlugin("WechatSI") as RecognitionPlugin;
  manager = plugin.getRecordRecognitionManager();
  manager.onStart = () => {
    const recording = current;
    if (!recording) {
      if (recovery) requestStop();
      return;
    }
    if (recording.terminal || recording.started) return;
    if (recording.starting !== undefined) clearTimeout(recording.starting);
    recording.started = true;
    recording.startedAt = Date.now();
    if (recording.released) requestStop();
  };
  manager.onStop = onStop;
  manager.onError = onError;
  return manager;
}

export function voiceAvailable(): boolean {
  try {
    return Boolean(getManager());
  } catch {
    return false;
  }
}

export function beginVoice(handlers: VoiceHandlers, scope: string): (() => void) | undefined {
  if (current) {
    handlers.error("上一段录音仍在结束。请稍后重录，或先打字。");
    return;
  }
  const pending = recovery;
  if (pending && (pending.scope !== scope || !pending.allowReview)) {
    handlers.error("上一段录音尚未结束。可以先打字，或关闭并重新打开小程序后录音。");
    return;
  }
  const recording: Recording = {
    handlers, scope, needsReview: Boolean(pending), startedAt: Date.now(), started: false,
    released: false, terminal: false,
  };
  current = recording;
  if (pending) pending.outstanding++;
  try {
    getManager().start({ duration: recordingLimit, lang: "zh_CN" });
  } catch {
    if (pending && recovery === pending && --pending.outstanding === 0) recovery = undefined;
    clearCurrent(recording);
    handlers.error("这台设备暂时无法开启语音识别。可以打字或点选剧情。");
    return;
  }
  if (current !== recording) return;
  if (!recording.started) {
    recording.starting = setTimeout(() => {
      if (current !== recording || recording.started) return;
      retire(recording, true);
      handlers.error("麦克风没有及时开始。请稍后重录，或先打字。");
    }, startingTimeout);
  }
  recording.countdown = setInterval(() => {
    if (!recording.started) return;
    const remaining = Math.max(0, Math.ceil((recordingLimit - Date.now() + recording.startedAt) / 1000));
    if (remaining > 0) handlers.progress(remaining);
    else if (!recording.released) {
      clearTimers(recording);
      handlers.limit();
    }
  }, 300);

  return () => {
    if (current !== recording || recording.released) return;
    recording.released = true;
    if (recording.terminal) {
      reportResult(recording, recording.result ?? "");
      return;
    }
    clearTimers(recording);
    handlers.processing();
    recording.timeout = setTimeout(() => {
      if (current !== recording || recording.terminal) return;
      retire(recording, true);
      handlers.error("语音识别超时。可以重录，也可以打字。");
    }, completionTimeout);
    if (recording.started) requestStop();
  };
}

export function cancelVoice(): void {
  const recording = current;
  if (!recording) return;
  if (recording.terminal) clearCurrent(recording);
  else retire(recording, false);
}
