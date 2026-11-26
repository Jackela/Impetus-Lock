const test = require("node:test");
const assert = require("node:assert/strict");

function sandbox() {
  const calls = [];
  const clean = [];
  const fields = [];
  const manager = {
    start: (options) => { calls.push(["start", options]); manager.onStart(); },
    stop: () => calls.push(["stop"]),
  };
  global.requirePlugin = (name) => {
    assert.equal(name, "WechatSI");
    return { getRecordRecognitionManager: () => manager };
  };
  global.wx = { getFileSystemManager: () => ({ unlink: ({ filePath }) => clean.push(filePath) }) };
  const file = require.resolve("../.build/lib/voice.js");
  delete require.cache[file];
  const voice = require(file);
  const listen = () => voice.beginVoice({
    progress: (seconds) => fields.push(["progress", seconds]),
    limit: () => fields.push(["limit"]),
    processing: () => fields.push(["processing"]),
    complete: (text) => fields.push(["complete", text]),
    review: (text) => fields.push(["review", text]),
    error: (error) => fields.push(["error", error]),
  }, JSON.stringify(["wechat-author", "run-a"]));
  return { manager, listen, voice, clean, calls, fields };
}

test("长按到时限须正常松手，原声临时文件清理且文字只交付一次", () => {
  const { manager, listen, fields, clean } = sandbox();
  const release = listen();
  manager.onStop({ result: " 我认识这只鸟。 ", duration: 60000, tempFilePath: "wxfile://original" });
  assert.deepEqual(fields, [["limit"]]);
  assert.deepEqual(clean, ["wxfile://original"]);
  release();
  release();
  assert.deepEqual(fields, [["limit"], ["complete", "我认识这只鸟。"]]);
});

test("后台或取消的回包只清理文件，不会提交到下一录音", () => {
  const { manager, listen, fields, clean, voice } = sandbox();
  const release = listen();
  voice.cancelVoice();
  assert.equal(listen(), undefined);
  manager.onStop({ result: "已经取消", tempFilePath: "wxfile://cancelled" });
  release();
  const newRelease = listen();
  newRelease();
  manager.onStop({ result: "这是新录音", tempFilePath: "wxfile://new" });
  assert.deepEqual(fields.map(([type]) => type), ["error", "processing", "complete"]);
  assert.deepEqual(fields.at(-1), ["complete", "这是新录音"]);
  assert.deepEqual(clean, ["wxfile://cancelled", "wxfile://new"]);
});

test("手势还未松开时系统提前中止录音，清理且不会提交", () => {
  const { manager, listen, fields, clean } = sandbox();
  const release = listen();
  manager.onStop({ result: "此段不写入", duration: 1500, tempFilePath: "wxfile://interrupted" });
  release();
  assert.deepEqual(fields.map(([type]) => type), ["error"]);
  assert.deepEqual(clean, ["wxfile://interrupted"]);
});

test("新录音停录时也忽略上次临时文件的重复回调", () => {
  const { manager, listen, fields } = sandbox();
  listen()();
  manager.onStop({ result: "第一段文字", tempFilePath: "wxfile://one" });
  listen()();
  manager.onStop({ result: "第一段文字", tempFilePath: "wxfile://one" });
  manager.onStop({ result: "第二段文字", tempFilePath: "wxfile://two" });
  assert.deepEqual(fields.filter(([type]) => type === "complete"), [
    ["complete", "第一段文字"], ["complete", "第二段文字"],
  ]);
});
