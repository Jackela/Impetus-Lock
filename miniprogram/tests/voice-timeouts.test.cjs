const test = require("node:test");
const assert = require("node:assert/strict");

function sandbox(t) {
  t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"] });
  const events = [];
  const cleaned = [];
  const manager = {
    starts: 0,
    stops: 0,
    start() { this.starts++; },
    stop() { this.stops++; },
  };
  global.requirePlugin = () => ({ getRecordRecognitionManager: () => manager });
  global.wx = { getFileSystemManager: () => ({ unlink: ({ filePath }) => cleaned.push(filePath) }) };
  t.after(() => {
    delete global.requirePlugin;
    delete global.wx;
  });
  const file = require.resolve("../.build/lib/voice.js");
  delete require.cache[file];
  const voice = require(file);
  const start = (scope) => voice.beginVoice({
    progress() {},
    limit() {},
    processing() {},
    complete: (text) => events.push([scope, "complete", text]),
    review: (text) => events.push([scope, "review", text]),
    error: (message) => events.push([scope, "error", message]),
  }, scope);
  const result = (id, text) => manager.onStop({ result: text, tempFilePath: `wxfile://${id}` });
  return { events, cleaned, manager, start, result, voice };
}

const firstScope = '["author-a","run-a"]';
const anotherRun = '["author-a","run-b"]';
const anotherAuthor = '["author-b","run-a"]';

test("开始超时且插件始终不发终态时，同一局可再次按住录音", (t) => {
  const { events, manager, start, result } = sandbox(t);
  start(firstScope);
  t.mock.timers.tick(10000);
  assert.match(events[0][2], /没有及时开始/);
  assert.equal(manager.stops, 1);

  const release = start(firstScope);
  assert.equal(manager.starts, 2);
  manager.onStart();
  release();
  result("retry", "重新录下的文字");
  assert.deepEqual(events.slice(1), [[firstScope, "review", "重新录下的文字"]]);
});

test("停录超时后同一实例的歧义回包只供原局明确核对，暂时阻断其他局与身份", (t) => {
  const { events, cleaned, manager, start, result } = sandbox(t);
  const expiredRelease = start(firstScope);
  manager.onStart();
  expiredRelease();
  t.mock.timers.tick(15000);
  assert.match(events[0][2], /超时/);
  const release = start(firstScope);
  assert.equal(manager.starts, 2);
  manager.onStart();
  release();

  manager.onStop({ result: "无法识别来源的无文件回包" });
  assert.equal(events.length, 1);
  result("expired", "旧录音文字");
  assert.deepEqual(events.at(-1), [firstScope, "review", "旧录音文字"]);
  assert.equal(start(anotherRun), undefined);
  result("expired", "同一个旧文件重复回包");
  manager.onError();
  assert.equal(start(anotherAuthor), undefined);
  assert.equal(manager.starts, 2);
  assert.equal(events.some(([scope, kind]) => scope !== firstScope && kind !== "error"), false);

  result("retry", "第二次录音的迟到文字");
  const next = start(anotherRun);
  manager.onStart();
  next();
  result("expired", "属于旧局的重复文字");
  manager.onStop({ result: "属于旧局的无文件回包" });
  result("new-run", "新局的新录音");
  assert.deepEqual(events.at(-1), [anotherRun, "complete", "新局的新录音"]);
  assert.equal(events.some(([, kind, text]) => kind === "complete" && text.includes("旧")), false);
  assert.deepEqual(cleaned, ["wxfile://expired", "wxfile://expired", "wxfile://retry", "wxfile://expired", "wxfile://new-run"]);
});

test("超时录音在重录前独自收到终态时，之后正常松手仍自动提交", (t) => {
  const { events, manager, start, result } = sandbox(t);
  start(firstScope);
  t.mock.timers.tick(10000);
  manager.onStart();
  assert.equal(manager.stops, 2);
  result("expired", "迟到的启动及识别");

  const release = start(anotherAuthor);
  manager.onStart();
  release();
  result("new-author", "新账号录音");
  assert.deepEqual(events.slice(1), [[anotherAuthor, "complete", "新账号录音"]]);
});

test("明确取消的录音须先收尾，连同一局也不会看到它的识别文字", (t) => {
  const { events, cleaned, manager, start, result, voice } = sandbox(t);
  const release = start(firstScope);
  manager.onStart();
  voice.cancelVoice();
  release();
  assert.equal(start(firstScope), undefined);
  manager.onStop({ result: "无文件的取消回包" });
  assert.equal(start(firstScope), undefined);
  assert.equal(manager.starts, 1);
  result("canceled", "应丢弃的取消内容");

  const next = start(firstScope);
  manager.onStart();
  next();
  result("new-recording", "新的自由写");
  assert.deepEqual(events.filter(([, kind]) => kind !== "error"), [[firstScope, "complete", "新的自由写"]]);
  assert.deepEqual(cleaned, ["wxfile://canceled", "wxfile://new-recording"]);
});
