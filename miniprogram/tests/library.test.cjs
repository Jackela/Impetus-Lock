const assert = require('node:assert/strict');
const { afterEach, beforeEach, test } = require('node:test');
const apiModule = require('../.build/lib/api');
const { invalidateSession } = apiModule;

const work = { id: 'w1', title: '初稿', version: 3, text: '初稿正文', theme: 'letter', mode: 'normal', ai_generated: true, opening: '题句' };
const pageCard = { id: 'card1', title: '已公开文本', text: '固定的公开文字', theme: 'detective', mode: 'custom', ai_generated: true, requires_consent: true, opening: '县衙案头的结案书', rules: '手动触发删除，无法恢复。' };
const progress = { completed: 3, detective: true, high: true, rewrite: true, delete: true };
const eraseMode = { id: 'mode1', name: '删句挑战', trigger: 'manual', action: 'delete', lock: false, recoverable: false };
const activeRun = {
  id: 'active1', version: 5, theme: 'letter', mode: 'normal', opening: '遇见一封信', turns: 2,
  status: 'active', segments: [{ id: 's1', text: '编辑后的第一句', original: '私有恢复原文' }],
};
const input = value => ({ detail: { value } });
const dataset = id => ({ currentTarget: { dataset: { id } } });
const tick = () => new Promise(resolve => setImmediate(resolve));

let previousWx;
let previousPage;
beforeEach(() => {
  previousWx = global.wx;
  previousPage = global.Page;
  invalidateSession();
});
afterEach(() => {
  global.wx = previousWx;
  global.Page = previousPage;
});

function host(route, handle, query = {}, options = {}) {
  const requests = [];
  const paths = [];
  const confirmations = [];
  const clipboard = [];
  const storage = options.storage ?? new Map();
  let profile = options.profile ?? 'owner-a';
  let definition;
  const navigate = (kind, value) => {
    paths.push({ kind, url: value.url });
    value.success();
  };

  global.wx = {
    login(args) { args.success({ code: profile }); },
    request(args) {
      const path = new URL(args.url).pathname.replace('/api/wechat', '');
      const request = { path, method: args.method, body: args.data, token: args.header.Authorization };
      requests.push(request);
      Promise.resolve().then(async () => {
        if (path === '/session') {
          args.success({ statusCode: 200, data: { subject: request.body.code, token: 'token-' + request.body.code } });
          return;
        }
        const result = await handle(request);
        args.success({ statusCode: result.status ?? 200, data: result.data });
      }).catch(() => args.fail({ errMsg: 'request:fail interrupted' }));
    },
    getStorageSync(key) { return storage.get(key) ?? ''; },
    setStorageSync(key, value) { storage.set(key, structuredClone(value)); },
    removeStorageSync(key) { storage.delete(key); },
    navigateTo: value => navigate('push', value),
    redirectTo: value => navigate('replace', value),
    hideShareMenu() {},
    showShareMenu() {},
    showModal(value) { confirmations.push(value); value.success({ confirm: Boolean(options.confirm?.()) }); },
    setClipboardData(value) { clipboard.push(value.data); value.success(); },
    ...options.wx,
  };
  global.Page = value => { definition = value; };
  const pagePath = '../.build/pages/' + route + '/index.js';
  delete require.cache[require.resolve(pagePath)];
  require(pagePath);
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(patch) { Object.assign(this.data, patch); },
  };
  page.onLoad?.(query);
  return { page, paths, requests, confirmations, clipboard, storage, setProfile(value) { profile = value; } };
}

const ok = data => ({ data });
const fail = (status, detail) => ({ status, data: { detail } });
const library = (values = {}) => ok({ runs: [], works: [], modes: [], progress, ...values });

test('library refresh exposes only active runs, recent opening edits, and private work links', async () => {
  const app = host('library', () => library({
    runs: [activeRun, { ...activeRun, id: 'finished', status: 'finished', work_id: work.id }],
    works: [work],
  }));
  await app.page.refresh();
  assert.deepEqual(app.page.data.runs.map(item => item.id), ['active1']);
  assert.equal(app.page.data.runs[0].excerpt, '编辑后的第一句');
  assert.ok(!JSON.stringify(app.page.data).includes('私有恢复原文'));
  assert.deepEqual(app.page.data.works.map(item => item.id), ['w1']);
  assert.ok(!JSON.stringify(app.page.data).includes(work.text));

  await app.page.openRun(dataset('finished'));
  await app.page.openRun(dataset('active1'));
  assert.deepEqual(app.paths, [{ kind: 'replace', url: '/pages/write/index?id=active1' }]);
  app.page.onHide();
  assert.deepEqual(app.page.data.runs, []);
  assert.deepEqual(app.page.data.works, []);
});

test('new players cannot select undiscovered rules and personal mode creation uses its canonical fields', async () => {
  let discovered = false;
  const app = host('modes', ({ path, method, body }) => {
    if (path === '/library') return library({ progress: discovered ? progress : { completed: 0, detective: false, high: false, rewrite: false, delete: false } });
    assert.equal(method, 'POST');
    assert.deepEqual(body, { name: '安静的谜案', trigger: 'automatic', action: 'rewrite', lock: true, recoverable: true });
    return ok({ ...body, id: 'personal1' });
  });
  await app.page.refresh();
  app.page.themeChanged(input('detective'));
  app.page.modeChanged(input('high'));
  app.page.actionChanged(input('delete'));
  app.page.nameChanged(input('安静的谜案'));
  await app.page.saveMode();
  assert.equal(app.page.data.theme, 'letter');
  assert.equal(app.page.data.mode, 'normal');
  assert.equal(app.page.data.action, 'insert');
  assert.equal(app.requests.filter(item => item.path === '/modes').length, 0);

  discovered = true;
  await app.page.refresh();
  app.page.themeChanged(input('detective'));
  app.page.triggerChanged(input('automatic'));
  app.page.actionChanged(input('rewrite'));
  await app.page.saveMode();
  assert.equal(app.page.data.theme, 'detective');
  assert.equal(app.page.data.mode, 'custom');
  assert.equal(app.page.data.modeId, 'personal1');
});

test('editing an existing personal mode starts from saved settings and saves to the same ID', async t => {
  const apiCalls = t.mock.method(apiModule, 'api');
  const anotherMode = { id: 'mode2', name: '插入一句', trigger: 'response', action: 'insert', lock: true, recoverable: true };
  const app = host('modes', ({ path, method, body }) => {
    if (path === '/library') return library({ modes: [eraseMode, anotherMode] });
    if (path === '/runs') return ok({ id: 'edited-rule-run' });
    assert.equal(path, '/modes/mode1');
    assert.equal(method, 'PUT');
    assert.deepEqual(body, { name: '慢慢查明', trigger: 'automatic', action: 'rewrite', lock: false, recoverable: false });
    return ok({ ...body, id: eraseMode.id });
  });
  await app.page.refresh();
  app.page.nameChanged(input('尚未创建的模式'));
  app.page.editMode(dataset(eraseMode.id));
  assert.equal(app.page.data.editingModeId, eraseMode.id);
  assert.equal(app.page.data.name, eraseMode.name);
  assert.equal(app.page.data.action, 'delete');
  assert.equal(app.page.data.recoverable, false);

  app.page.nameChanged(input('慢慢查明'));
  app.page.triggerChanged(input('automatic'));
  app.page.actionChanged(input('rewrite'));
  app.page.lockChanged(input(false));
  app.page.recoveryChanged(input(false));
  await app.page.saveMode();
  const update = apiCalls.mock.calls.find(call => call.arguments[0] === '/modes/mode1');
  assert.equal(update?.arguments[1], 'PUT');
  assert.deepEqual(app.page.data.modes.map(mode => mode.id), [eraseMode.id, anotherMode.id]);
  assert.equal(app.page.data.modes[0].name, '慢慢查明');
  assert.equal(app.page.data.modeId, eraseMode.id);
  assert.equal(app.page.data.editingModeId, '');
  assert.equal(app.page.data.name, '尚未创建的模式');
  await app.page.launch();
  assert.equal(app.requests.at(-1).body.mode_id, eraseMode.id);
  assert.equal(app.confirmations.length, 0);
  assert.equal(app.paths[0].url, '/pages/write/index?id=edited-rule-run');
});

test('a failed mode edit keeps its draft and cancel restores the independent creation form', async () => {
  const app = host('modes', ({ path }) => path === '/library'
    ? library({ modes: [eraseMode] })
    : fail(503, '暂时无法保存'));
  await app.page.refresh();
  app.page.nameChanged(input('准备创建'));
  app.page.triggerChanged(input('response'));
  app.page.actionChanged(input('rewrite'));
  app.page.lockChanged(input(false));
  app.page.editMode(dataset(eraseMode.id));
  app.page.nameChanged(input('仍想保存的名称'));
  app.page.triggerChanged(input('automatic'));
  await app.page.saveMode();
  assert.match(app.page.data.error, /暂时无法保存/);
  assert.equal(app.page.data.editingModeId, eraseMode.id);
  assert.equal(app.page.data.name, '仍想保存的名称');
  assert.equal(app.page.data.trigger, 'automatic');
  assert.equal(app.page.data.recoverable, false);

  app.page.cancelEdit();
  assert.equal(app.page.data.editingModeId, '');
  assert.deepEqual(app.page.data.modes, [eraseMode]);
  assert.deepEqual([app.page.data.name, app.page.data.trigger, app.page.data.action, app.page.data.lock],
    ['准备创建', 'response', 'rewrite', false]);
  assert.equal(app.requests.filter(item => item.method === 'PUT').length, 1);
  app.page.editMode(dataset(eraseMode.id));
  assert.equal(app.page.data.name, eraseMode.name);
});

test('a high-intensity mode requires explicit acceptance each time and normal opens without the flag', async () => {
  let agreed = false;
  const app = host('modes', ({ path }) => path === '/library' ? library() : ok({ id: 'mode-run' }), {}, {
    confirm: () => agreed,
  });
  await app.page.refresh();
  app.page.modeChanged(input('high'));
  await app.page.launch();
  assert.equal(app.requests.filter(item => item.path === '/runs').length, 0);
  assert.equal(app.paths.length, 0);

  agreed = true;
  await app.page.launch();
  const opening = app.requests.at(-1);
  assert.equal(opening.body.mode, 'high');
  assert.equal(opening.body.accept_high, true);
  assert.equal(app.paths[0].url, '/pages/write/index?id=mode-run');

  agreed = false;
  await app.page.launch();
  assert.equal(app.requests.filter(item => item.path === '/runs').length, 1);
  assert.equal(app.confirmations.length, 3);

  app.page.modeChanged(input('normal'));
  await app.page.launch();
  assert.equal(app.requests.at(-1).body.mode, 'normal');
  assert.equal(Object.hasOwn(app.requests.at(-1).body, 'accept_high'), false);
  assert.equal(app.confirmations.length, 3);
});

test('irreversible modes require every opening confirmation and retry a lost reply with the same request ID', async () => {
  let agreed = false;
  let opened = 0;
  const app = host('modes', ({ path }) => {
    if (path === '/library') return library({ modes: [eraseMode] });
    if (++opened === 1) throw new Error('receipt lost');
    return ok({ id: 'run-' + opened });
  }, {}, { confirm: () => agreed });
  await app.page.refresh();
  app.page.savedModeChanged(input(eraseMode.id));

  await app.page.launch();
  assert.equal(app.requests.filter(item => item.path === '/runs').length, 0);

  agreed = true;
  await app.page.launch();
  assert.equal(app.paths.length, 0);
  assert.ok(app.page.data.error);
  await app.page.launch();
  const requests = app.requests.filter(item => item.path === '/runs');
  assert.deepEqual(requests[0].body, requests[1].body);
  assert.equal(requests[0].body.accept_irreversible, true);
  assert.equal(requests[0].body.mode_id, 'mode1');
  assert.match(app.confirmations[0].content, /历史.*导出.*外部副本/);
  assert.equal(app.confirmations.length, 3);
  assert.equal(app.paths[0].url, '/pages/write/index?id=run-2');

  await app.page.launch();
  assert.equal(app.confirmations.length, 4);
  assert.notEqual(app.requests.at(-1).body.request_id, requests[0].body.request_id);
});

test('friend can read a card without login and independently chooses the same fixed rules', async () => {
  let revoked = false;
  let accepted = false;
  const app = host('card', ({ path, method }) => {
    if (method === 'GET') return revoked ? fail(404, '已撤回') : ok(pageCard);
    assert.equal(path, '/runs');
    return ok({ id: 'independent' });
  }, { id: pageCard.id }, { profile: 'friend-b', confirm: () => accepted });
  await app.page.refresh();
  assert.equal(app.page.data.card.text, pageCard.text);
  assert.equal(app.page.data.opening, pageCard.opening);
  assert.equal(app.page.data.rules, pageCard.rules);
  assert.deepEqual(app.requests.map(item => [item.path, item.token]), [['/cards/card1', undefined]]);

  await app.page.openSamePrompt();
  assert.equal(app.requests.length, 1);
  accepted = true;
  await app.page.openSamePrompt();
  const opening = app.requests.at(-1);
  assert.equal(opening.token, 'Bearer token-friend-b');
  assert.deepEqual(opening.body, {
    theme: 'detective', mode: 'custom', card_id: 'card1', accept_irreversible: true, request_id: opening.body.request_id,
  });
  assert.equal(app.paths[0].url, '/pages/write/index?id=independent');

  revoked = true;
  await app.page.refresh();
  assert.equal(app.page.data.card, null);
  assert.match(app.page.data.error, /撤回/);
  assert.equal(app.page.onShareAppMessage().path, '/pages/home/index');
});

test('a high-intensity peer card only sends acceptance after confirmation, and a normal card omits it', async () => {
  let agreed = false;
  let mode = 'high';
  const app = host('card', ({ method }) => method === 'GET'
    ? ok({ ...pageCard, mode, requires_consent: false })
    : ok({ id: 'independent' }), { id: pageCard.id }, { confirm: () => agreed });
  await app.page.refresh();
  await app.page.openSamePrompt();
  assert.deepEqual(app.requests.map(item => item.path), ['/cards/card1']);
  assert.equal(app.paths.length, 0);

  agreed = true;
  await app.page.openSamePrompt();
  assert.equal(app.requests.at(-1).body.card_id, pageCard.id);
  assert.equal(app.requests.at(-1).body.accept_high, true);

  agreed = false;
  await app.page.openSamePrompt();
  assert.equal(app.requests.filter(item => item.path === '/runs').length, 1);
  assert.equal(app.confirmations.length, 3);

  mode = 'normal';
  await app.page.refresh();
  await app.page.openSamePrompt();
  assert.equal(app.requests.at(-1).body.mode, 'normal');
  assert.equal(Object.hasOwn(app.requests.at(-1).body, 'accept_high'), false);
  assert.equal(app.confirmations.length, 3);
});

test('library, modes, work and card refresh their reading font size on foreground entry', async () => {
  let scale = 1.5;
  const api = ({ path }) => {
    if (path === '/library') return library();
    if (path === '/cards/card1') return ok(pageCard);
    if (path.endsWith('/cards')) return ok({ cards: [] });
    return ok(work);
  };
  for (const route of ['library', 'modes', 'work', 'card']) {
    scale = 1.5;
    const id = route === 'card' ? pageCard.id : work.id;
    const app = host(route, api, { id }, { wx: { getAppBaseInfo: () => ({ fontSizeScaleFactor: scale }) } });
    app.page.onShow();
    assert.equal(app.page.data.fontSize, 25.5, route);
    await tick();

    scale = 1;
    app.page.onShow();
    assert.equal(app.page.data.fontSize, 17, route);
    await tick();
  }
});

test('private edits and saved text survive a conflict, followed by an explicitly based save', async () => {
  let current = work;
  const app = host('work', ({ path, method, body }) => {
    if (path.endsWith('/cards')) return ok({ cards: [] });
    if (method === 'GET') return ok(current);
    assert.equal(method, 'PUT');
    if (body.version !== current.version) return fail(409, '新版本');
    current = { ...current, ...body, version: current.version + 1 };
    return ok(current);
  }, { id: work.id });
  await app.page.refresh();
  app.page.titleChanged(input('我的中篇'));
  app.page.textChanged(input('我的未保存修改'));
  current = { ...work, text: '另一台设备已保存的正文', version: 4 };
  await app.page.save();
  assert.equal(app.page.data.text, '我的未保存修改');
  assert.equal(app.page.data.latest.text, '另一台设备已保存的正文');
  await app.page.copy();
  assert.deepEqual(app.clipboard, ['我的中篇\n\n我的未保存修改']);

  await app.page.save();
  assert.equal(app.requests.filter(item => item.method === 'PUT').length, 1);
  app.page.useCurrentEdits();
  await app.page.save();
  assert.equal(app.requests.at(-1).body.version, 4);
  assert.equal(current.text, '我的未保存修改');
  assert.equal(app.page.data.dirty, false);
  assert.equal(app.page.data.status, '作品已保存。');
});

test('unknown save acknowledgement is checked against the durable revision', async () => {
  let current = work;
  const app = host('work', ({ method, body, path }) => {
    if (path.endsWith('/cards')) return ok({ cards: [] });
    if (method === 'GET') return ok(current);
    current = { ...current, ...body, version: current.version + 1 };
    throw new Error('reply lost after commit');
  }, { id: work.id });
  await app.page.refresh();
  app.page.textChanged(input('确实保存了的文字'));
  await app.page.save();
  assert.equal(app.page.data.dirty, false);
  assert.equal(app.page.data.base.version, 4);
  assert.equal(app.page.data.status, '已核对，作品已保存。');
});

test('only explicit publication creates a fixed card with a static cover and retry-safe receipt', async () => {
  let agreed = false;
  let committed;
  const app = host('work', ({ method, path, body }) => {
    if (method === 'POST') {
      assert.equal(body.version, work.version);
      if (!committed) {
        committed = { ...pageCard, title: work.title, text: work.text };
        throw new Error('response lost');
      }
      return ok(committed);
    }
    if (method === 'DELETE') {
      committed = undefined;
      return { status: 204 };
    }
    if (path.endsWith('/cards')) return ok({ cards: [] });
    return ok(work);
  }, { id: work.id }, { confirm: () => agreed });
  await app.page.refresh();
  await tick();
  app.page.previewShare();
  assert.equal(app.page.data.preview.text, work.text);
  app.page.closePreview();
  assert.equal(app.requests.filter(item => item.method === 'POST' && item.path.endsWith('/cards')).length, 0);
  assert.equal(app.page.onShareAppMessage({ from: 'menu' }).path, '/pages/home/index');
  await tick();

  app.page.previewShare();
  await app.page.publish();
  assert.equal(app.page.data.cards.length, 0);
  assert.ok(app.page.data.error);
  await app.page.publish();
  const publishes = app.requests.filter(item => item.method === 'POST' && item.path.endsWith('/cards'));
  assert.equal(publishes[0].body.request_id, publishes[1].body.request_id);
  assert.equal(app.page.data.cards[0].snippet, work.text);
  app.page.textChanged(input('未公开的最新稿'));
  const share = app.page.onShareAppMessage({ from: 'button', target: { dataset: { id: pageCard.id } } });
  assert.deepEqual(share, {
    title: '读一篇故事，试试同题续写', path: '/pages/card/index?id=card1', imageUrl: '/pages/work/share-cover.png',
  });
  assert.ok(!JSON.stringify(share).includes(work.title));
  await app.page.withdraw(dataset(pageCard.id));
  assert.equal(app.requests.filter(item => item.method === 'DELETE').length, 0);
  agreed = true;
  await app.page.withdraw(dataset(pageCard.id));
  assert.equal(app.page.data.cards.length, 0);
  assert.equal(app.page.data.text, '未公开的最新稿');
});

test('work preview shows the fixed public rules and only the applicable friend consent', async () => {
  for (const [mode, requires_consent, expectedNotice] of [
    ['custom', true, /不可恢复删除/],
    ['high', false, /高强度模式/],
    ['normal', false, /^$/],
  ]) {
    const current = { ...work, mode, requires_consent, rules: `固定的${mode}规则说明` };
    const app = host('work', ({ path }) => path.endsWith('/cards') ? ok({ cards: [] }) : ok(current), { id: work.id });
    await app.page.refresh();
    await tick();
    app.page.previewShare();
    assert.equal(app.page.data.preview.rules, current.rules);
    assert.match(app.page.data.preview.consentNotice, expectedNotice);
    assert.equal(app.page.data.preview.opening, current.opening);
    assert.equal(app.requests.filter(item => item.method === 'POST' && item.path.endsWith('/cards')).length, 0);
  }
});

test('TXT export hands the selected title and text to native sharing as UTF-8 and removes the temporary file', async () => {
  const writes = [];
  const shares = [];
  const unlinked = [];
  const app = host('work', ({ path }) => path.endsWith('/cards') ? ok({ cards: [] }) : ok({ ...work, title: '篇：早/晚' }), { id: work.id }, {
    wx: {
      env: { USER_DATA_PATH: 'wxfile://usr' },
      getFileSystemManager: () => ({
        writeFile(args) { writes.push(args); args.success(); },
        unlink(args) { unlinked.push(args.filePath); },
      }),
      shareFileMessage(args) { shares.push(args); args.success(); args.complete(); },
    },
  });
  await app.page.refresh();
  app.page.textChanged(input('第一段。\n\n第二段。'));
  await app.page.exportTxt();
  assert.equal(writes[0].encoding, 'utf8');
  assert.equal(writes[0].data, '篇：早/晚\n\n第一段。\n\n第二段。');
  assert.equal(shares[0].fileName, '篇：早 晚.txt');
  assert.match(shares[0].filePath, /^wxfile:\/\/usr\/story-.*\.txt$/);
  assert.deepEqual(unlinked, [shares[0].filePath]);
});

test('foreground identity changes clear the previous private work and cannot replay its local draft', async () => {
  const app = host('work', ({ path, token }) => {
    if (token === 'Bearer token-owner-b') return fail(404, '作品不存在');
    return path.endsWith('/cards') ? ok({ cards: [] }) : ok(work);
  }, { id: work.id });
  await app.page.refresh();
  app.page.textChanged(input('仅之前身份可读'));
  await tick();
  invalidateSession();
  app.setProfile('owner-b');
  await app.page.refresh();
  assert.equal(app.page.data.base, null);
  assert.equal(app.page.data.text, '');
  assert.match(app.page.data.error, /无法打开/);
  assert.ok([...app.storage.keys()].every(key => key.includes('owner-a')));
});
