'use strict';

const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const fs = require('node:fs');
const {setTimeout: delay} = require('node:timers/promises');
const vm = require('node:vm');

const origin = process.env.WECHAT_WIRE_ORIGIN || 'http://127.0.0.1:58474';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const compiled = process.argv[2];
const apiCode = fs.readFileSync(compiled, 'utf8');
const namespace = randomUUID().replaceAll('-', '');

function client(account) {
  let loseNextReply = false;
  const requests = [];
  const exports = {};
  const wx = {
    login({success}) {
      const once = randomUUID().replaceAll('-', '');
      queueMicrotask(() => success({code: account + '-' + namespace + '-' + once}));
    },
    request(options) {
      const url = new URL(options.url);
      assert.equal(url.origin, origin);
      requests.push({path: url.pathname, method: options.method, bearer: Boolean(options.header.Authorization)});
      fetch(url, {
        method: options.method,
        headers: options.header,
        body: options.data === undefined ? undefined : JSON.stringify(options.data),
      }).then(async response => {
        if (loseNextReply) {
          loseNextReply = false;
          options.fail();
        } else {
          const data = response.status === 204 ? undefined : await response.json();
          options.success({statusCode: response.status, data});
        }
      }).catch(error => {
        console.error('Local transport error', String(error));
        options.fail();
      });
    },
  };
  vm.runInNewContext(apiCode, {
    exports,
    wx,
    require(name) {
      assert.equal(name, './config');
      return {API_ORIGIN: origin};
    },
  }, {filename: compiled});
  return {
    api: exports.api,
    login: exports.ensureSession,
    invalidate: exports.invalidateSession,
    id: exports.requestId,
    requests,
    dropReply() { loseNextReply = true; },
    switchAccount(next) { account = next; exports.invalidateSession(); },
  };
}

const A = client('author-a');
const B = client('reader-b');
const guest = client('guest');
const opening = '十年后，你收到一封自己寄出的信';
const editedOpening = '昨夜停电后，门缝下多了一封我自己寄来的信。';

function start(actor, extra = {}) {
  return actor.api('/runs', 'POST', {request_id: actor.id(), theme: 'letter', mode: 'normal', ...extra});
}

function command(actor, run, kind, fields = {}) {
  return actor.api('/runs/' + run.id + '/actions', 'POST', {
    request_id: actor.id(), version: run.version, kind, ...fields,
  });
}

function status(code) {
  return error => error.status === code;
}

async function verify() {
  const privateWithoutToken = await fetch(origin + '/api/wechat/library');
  assert.equal(privateWithoutToken.status, 401);
  const refused = await client('invalid').login().then(() => null, error => error);
  assert.equal(refused.status, 401);
  const [authorId, readerId] = await Promise.all([A.login(), B.login()]);
  assert.match(authorId, /^[a-f0-9-]{36}$/);
  assert.match(readerId, /^[a-f0-9-]{36}$/);
  assert.notEqual(authorId, readerId);
  A.invalidate();
  assert.equal(await A.login(), authorId);
  console.log('PASS WeChat provider code exchange, signed bearer, missing/invalid identity rejection and same-account recovery');

  const startRequest = A.id();
  const initial = await start(A, {request_id: startRequest});
  assert.equal((await start(A, {request_id: startRequest})).id, initial.id);
  const path = '/runs/' + initial.id;
  assert.equal(initial.segments[0].text, opening);
  assert.equal(initial.turns, 0);
  const edited = await command(A, initial, 'edit', {target: initial.segments[0].id, text: editedOpening});
  assert.equal(edited.segments[0].text, editedOpening);
  assert.equal(edited.turns, 0);
  await assert.rejects(B.api(path), status(404));
  assert.equal((await B.api('/library')).runs.length, 0);

  const turn = {request_id: A.id(), source: 'choice', text: edited.choices[0]};
  A.dropReply();
  await assert.rejects(command(A, edited, 'turn', turn), status(0));
  const receiptPath = path + '/receipts/' + turn.request_id;
  const afterLoss = await A.api(receiptPath);
  assert.equal(afterLoss.status, 'committed');
  await assert.rejects(B.api(receiptPath), status(404));
  const first = await command(A, edited, 'turn', turn);
  assert.equal(first.turns, 1);
  assert.equal(first.version, afterLoss.run_version);
  assert.equal(first.segments.filter(segment => segment.source === 'choice').length, 1);
  assert.equal(first.segments.filter(segment => segment.locked).length, 1);
  assert.equal(first.waiting_response, true);
  assert.ok(first.choices.includes('把信烧掉'));
  await assert.rejects(command(A, first, 'edit', {
    target: first.segments.find(segment => segment.locked).id, text: '绕过锁不可写入。',
  }), status(422));
  console.log('PASS opening edit leaves turns=0, model reads changed text, lost reply replay leaves one continuation and one first lock');

  const burned = await command(A, first, 'turn', {source: 'choice', text: '把信烧掉'});
  assert.equal(burned.turns, 2);
  assert.equal(burned.responses, 1);
  assert.ok(burned.segments.some(segment => segment.text.includes('信封和信纸烧成了灰')));
  assert.ok(burned.offers.includes('returning'));
  assert.ok(burned.offers.includes('interpret'));
  assert.ok(!burned.choices.includes('拆开原信') && !burned.choices.includes('核对原信的邮戳'));
  await assert.rejects(command(A, burned, 'turn', {source: 'choice', text: '拆开原信'}), status(422));
  const awarded = await command(A, burned, 'ability', {ability: 'returning'});
  assert.equal(awarded.abilities.returning.level, 1);
  assert.equal(awarded.abilities.returning.enabled, true);
  assert.equal(awarded.turns, 2);
  const paused = await command(A, awarded, 'begin_finish');
  assert.equal(paused.finishing, true);
  await assert.rejects(command(A, paused, 'turn', {source: 'keyboard', text: '暂停时不能直接写。'}), status(409));
  const finished = await command(A, paused, 'finish');
  assert.equal(finished.status, 'finished');
  assert.equal(finished.finishing, false);
  const workPath = '/works/' + finished.work_id;
  const work = await A.api(workPath);
  assert.equal(work.ai_generated, true);
  assert.equal(work.text, finished.segments.map(segment => segment.text).join('\n\n'));
  assert.deepEqual(JSON.parse(JSON.stringify((await A.api('/library')).progress)), {
    completed: 1, rewrite: false, delete: false, detective: true, high: true,
  });
  await assert.rejects(B.api(workPath), status(404));
  const late = await command(A, finished, 'turn', {source: 'keyboard', text: '收笔以后不能入稿。'});
  assert.equal(late.version, finished.version);
  assert.equal(late.turns, 2);
  assert.deepEqual(late.segments, finished.segments);
  await assert.rejects(start(A, {mode: 'high'}), status(403));
  assert.equal((await start(A, {mode: 'high', accept_high: true})).mode, 'high');
  console.log('PASS burned letter resolves intervention, level 1 ability awarded, finishing freezes the 2-turn private work and unlocks high intensity with consent');

  const publish = {request_id: A.id(), version: work.version};
  const card = await A.api(workPath + '/cards', 'POST', publish);
  assert.equal((await A.api(workPath + '/cards', 'POST', publish)).id, card.id);
  const cardPath = '/cards/' + card.id;
  const publicCard = await guest.api(cardPath);
  assert.equal(guest.requests.length, 1);
  assert.equal(guest.requests[0].bearer, false);
  assert.deepEqual(Object.keys(publicCard).sort(), [
    'ai_generated', 'challenge_id', 'id', 'mode', 'opening', 'requires_consent',
    'rules', 'rules_version', 'text', 'theme', 'title',
  ]);
  assert.equal(publicCard.challenge_id, work.challenge_id);
  assert.equal(publicCard.rules_version, work.rules_version);
  assert.equal(publicCard.opening, opening);
  assert.equal(publicCard.text, work.text);
  assert.equal(publicCard.theme, 'letter');
  assert.equal(publicCard.mode, 'normal');

  const updated = await A.api(workPath, 'PATCH', {
    title: '私稿另存的标题', text: work.text + '\n\n私稿新版本。', version: work.version,
  });
  const put = A.requests.at(-1);
  assert.equal(put.method, 'PUT');
  assert.equal(updated.version, work.version + 1);
  assert.equal((await A.api(workPath)).text, updated.text);
  assert.equal((await guest.api(cardPath)).text, work.text);
  assert.equal((await guest.api(cardPath)).title, work.title);
  console.log('PASS compiled wx.request saves the new private version by PUT and keeps the public snapshot unchanged');

  const reader = await start(B, {card_id: card.id, theme: 'detective', mode: 'high'});
  assert.notEqual(reader.id, initial.id);
  assert.equal(reader.segments.length, 1);
  assert.equal(reader.segments[0].text, publicCard.opening);
  assert.equal(reader.turns, 0);
  assert.equal(reader.abilities.returning.level, 0);
  assert.equal(reader.theme, 'letter');
  assert.equal(reader.mode, 'normal');
  await assert.rejects(A.api('/runs/' + reader.id), status(404));
  console.log('PASS anonymous card uses only approved fields; second account starts only the original prompt and rules');

  await A.api(workPath + '/cards/' + card.id, 'DELETE');
  await assert.rejects(guest.api(cardPath), status(404));
  await assert.rejects(start(B, {card_id: card.id}), status(404));
  const readerKeyboard = await command(B, reader, 'turn', {source: 'keyboard', text: '我敲了敲桌子。'});
  assert.equal(readerKeyboard.turns, 1);
  assert.ok(readerKeyboard.segments.find(segment => segment.source === 'keyboard').text.startsWith('我敲了敲桌子。'));
  const readerVoice = await command(B, readerKeyboard, 'turn', {source: 'voice', text: '我 我走到院子里', style: 'voice'});
  assert.equal(readerVoice.turns, 2);
  assert.equal(readerVoice.responses, 1);
  const voice = readerVoice.segments.find(segment => segment.source === 'voice');
  assert.equal(voice.text, '我走到院子里。');
  assert.equal(voice.original, '我 我走到院子里');
  assert.equal((await B.api('/library')).progress.completed, 0);

  A.switchAccount('reader-b');
  assert.equal(await A.login(), readerId);
  await assert.rejects(A.api(path), status(404));
  assert.equal((await A.api('/runs/' + reader.id)).turns, 2);
  A.switchAccount('author-a');
  assert.equal(await A.login(), authorId);
  assert.equal((await A.api(path)).status, 'finished');
  console.log('PASS revoked card reads/new starts return 404; existing independent run still accepts keyboard and corrected voice; account change isolates drafts');

  const pending = {request_id: B.id(), source: 'choice', text: '再等一会儿'};
  const readerReceipt = '/runs/' + reader.id + '/receipts/' + pending.request_id;
  const deferred = command(B, readerVoice, 'turn', pending).catch(error => error);
  let outcome;
  for (let attempt = 0; attempt < 20; attempt++) {
    outcome = await B.api(readerReceipt);
    if (outcome.status === 'pending') break;
    await delay(10);
  }
  assert.equal(outcome.status, 'pending');
  const readerPaused = await command(B, readerVoice, 'begin_finish');
  assert.equal(readerPaused.finishing, true);
  const retained = await command(B, readerPaused, 'turn', {...pending, retain: true});
  assert.equal(retained.finishing, true);
  assert.equal(retained.turns, 3);
  assert.equal(retained.segments.filter(segment => segment.locked).length, 1);
  assert.equal(retained.segments.at(-1).text, '我在院中又站了一会儿，风也渐渐歇了。');
  assert.equal((await B.api(readerReceipt)).status, 'committed');
  const readerFinished = await command(B, retained, 'finish');
  const originalReply = await deferred;
  if ('status' in originalReply && typeof originalReply.status === 'number') {
    assert.equal(originalReply.status, 409);
  }
  const readerWork = await B.api('/works/' + readerFinished.work_id);
  assert.equal(readerWork.text, readerFinished.segments.map(segment => segment.text).join('\n\n'));
  assert.ok(!readerWork.text.includes('迟到的影子'));
  assert.equal(readerWork.challenge_id, publicCard.challenge_id);
  assert.equal(readerWork.rules_version, publicCard.rules_version);
  console.log('PASS finishing an in-flight choice retains one narrative paragraph and its original receipt, without the stale passage or a new lock');

  const firstBurn = await start(A);
  const spokenBurn = '我把信点着了，信封和信纸烧成了灰。';
  const awaitingLock = await command(A, firstBurn, 'turn', {
    source: 'voice', style: 'verbatim', text: spokenBurn,
  });
  assert.equal(awaitingLock.generation_pending, true);
  assert.equal(awaitingLock.turns, 1);
  assert.equal(awaitingLock.responses, 0);
  assert.equal(awaitingLock.segments.at(-1).text, spokenBurn);
  assert.equal(awaitingLock.segments.some(segment => segment.locked), false);
  const retry = {request_id: A.id()};
  const recovered = await command(A, awaitingLock, 'intervene', retry);
  assert.equal(recovered.generation_pending, false);
  assert.equal(recovered.turns, 1);
  assert.equal(recovered.responses, 0);
  assert.deepEqual(recovered.segments.slice(0, -1), awaitingLock.segments);
  assert.equal(recovered.segments.at(-1).locked, true);
  assert.deepEqual(await command(A, awaitingLock, 'intervene', retry), recovered);
  const next = await command(A, recovered, 'turn', {source: 'choice', text: '去买早饭'});
  assert.equal(next.turns, 2);
  assert.equal(next.responses, 1);
  console.log('PASS voice burn recovers from provider failure using the committed passage, inserts one lock, and persists the burned original without replaying the author turn');
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
