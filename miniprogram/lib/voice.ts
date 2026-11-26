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
  error: (message: string) => void;
}

interface Recording {
  handlers: VoiceHandlers;
  startedAt: number;
  started: boolean;
  released: boolean;
  cancelled: boolean;
  terminal: boolean;
  result?: string;
  starting?: ReturnType<typeof setTimeout>;
  countdown?: ReturnType<typeof setInterval>;
  timeout?: ReturnType<typeof setTimeout>;
}

let manager: RecognitionManager | undefined;
let current: Recording | undefined;
let lastTemporaryPath: string | undefined;

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
  if (text) recording.handlers.complete(text);
  else recording.handlers.error("没有识别到文字。可以重录，也可以打字续写。");
}

function onStop(result: RecognitionResult): void {
  cleanTemporaryRecording(result.tempFilePath);
  if (result.tempFilePath && result.tempFilePath === lastTemporaryPath) return;
  lastTemporaryPath = result.tempFilePath;
  const recording = current;
  if (!recording || recording.terminal || (!recording.started && !recording.cancelled)) return;
  recording.terminal = true;
  if (recording.cancelled) {
    clearCurrent(recording);
    return;
  }
  const text = result.result?.trim() ?? "";
  if (recording.released) {
    reportResult(recording, text);
    return;
  }
  const elapsed = Date.now() - recording.startedAt;
  if ((result.duration ?? elapsed) >= recordingLimit - 1200) {
    clearTimers(recording);
    recording.result = text;
    recording.handlers.limit();
    return;
  }
  clearCurrent(recording);
  recording.handlers.error("录音已中断。可以重新按住说话，也可以打字。");
}

function onError(): void {
  const recording = current;
  if (!recording || recording.terminal) return;
  clearCurrent(recording);
  if (!recording.cancelled) recording.handlers.error("语音识别没有完成。可以重录，也可以打字。");
}

function getManager(): RecognitionManager {
  if (manager) return manager;
  const plugin = requirePlugin("WechatSI") as RecognitionPlugin;
  manager = plugin.getRecordRecognitionManager();
  manager.onStart = () => {
    const recording = current;
    if (!recording || recording.terminal) return;
    if (recording.starting !== undefined) clearTimeout(recording.starting);
    recording.started = true;
    recording.startedAt = Date.now();
    if (recording.released || recording.cancelled) manager?.stop();
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

export function beginVoice(handlers: VoiceHandlers): (() => void) | undefined {
  if (current) {
    handlers.error("上一段录音仍在结束。请稍后重录，或先打字。");
    return;
  }
  const recording: Recording = {
    handlers, startedAt: Date.now(), started: false, released: false, cancelled: false, terminal: false,
  };
  current = recording;
  try {
    getManager().start({ duration: recordingLimit, lang: "zh_CN" });
  } catch {
    clearCurrent(recording);
    handlers.error("这台设备暂时无法开启语音识别。可以打字或点选剧情。");
    return;
  }
  if (current !== recording) return;
  if (!recording.started) {
    recording.starting = setTimeout(() => {
      if (current !== recording || recording.started || recording.cancelled) return;
      recording.cancelled = true;
      clearTimers(recording);
      handlers.error("麦克风没有及时开始。请稍后重录，或先打字。");
    }, startingTimeout);
  }
  recording.countdown = setInterval(() => {
    if (!recording.started) return;
    const remaining = Math.max(0, Math.ceil((recordingLimit - Date.now() + recording.startedAt) / 1000));
    if (remaining > 0) handlers.progress(remaining);
    else if (!recording.released && !recording.cancelled) {
      clearTimers(recording);
      handlers.limit();
    }
  }, 300);

  return () => {
    if (current !== recording || recording.cancelled || recording.released) return;
    recording.released = true;
    if (recording.terminal) {
      reportResult(recording, recording.result ?? "");
      return;
    }
    clearTimers(recording);
    handlers.processing();
    recording.timeout = setTimeout(() => {
      if (current !== recording || recording.cancelled || recording.terminal) return;
      recording.cancelled = true;
      clearTimers(recording);
      handlers.error("语音识别超时。可以重录，也可以打字。");
    }, completionTimeout);
    if (recording.started) manager?.stop();
  };
}

export function cancelVoice(): void {
  const recording = current;
  if (!recording || recording.cancelled) return;
  recording.cancelled = true;
  clearTimers(recording);
  if (recording.terminal) clearCurrent(recording);
  else if (recording.started && !recording.released) manager?.stop();
}
