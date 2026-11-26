const assert = require('node:assert/strict');
const test = require('node:test');

const pagePath = '../.build/pages/home/index.js';

function loadHome({ api, session, subject, storage = new Map(), navigate, wx } = {}) {
  const Module = require('node:module');
  const load = Module._load;
  const calls = [];
  const paths = [];
  let activeSubject = subject ?? '';
  let nextRequest = 0;
  let definition;
  const previousPage = global.Page;
  const previousWx = global.wx;
  global.Page = (options) => {
    definition = options;
  };
  global.wx = {
    navigateTo: (options) => {
      paths.push(options.url);
      if (navigate) {
        navigate(options);
      } else {
        options.success?.();
      }
    },
    ...wx,
  };
  Module._load = function (name, parent, isMain) {
    if (parent?.filename.endsWith('/pages/home/index.js')) {
      if (name === '../../lib/api' && !wx) {
        const ensureSession = async () => {
          activeSubject = session ? await session() : activeSubject || 'author-a';
          return activeSubject;
        };
        return {
          api: async (path, method = 'GET', body) => {
            calls.push({ path, method, body, subject: activeSubject });
            return api?.(path, method, body) ?? { runs: [], works: [] };
          },
          requestId: () => `request-${++nextRequest}`,
          currentSubject: () => activeSubject,
          ensureSession,
          verifySession() {
            const subject = ensureSession();
            return { subject, ownerProof: subject.catch(() => undefined) };
          },
        };
      }
      if (name === '../../lib/storage' && !wx) {
        return {
          getPrivate: (key) => storage.get(`${activeSubject}/${key}`),
          putPrivate: (key, value) => storage.set(`${activeSubject}/${key}`, structuredClone(value)),
          removePrivate: (key) => storage.delete(`${activeSubject}/${key}`),
        };
      }
      if (name === '../../lib/perf') {
        return { markReady() {}, beginAction() {}, markFeedback() {} };
      }
    }
    return load.call(this, name, parent, isMain);
  };
  try {
    delete require.cache[require.resolve(pagePath)];
    require(pagePath);
  } finally {
    Module._load = load;
    global.Page = previousPage;
  }
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  return {
    page,
    calls,
    paths,
    storage,
    setSubject: (value) => {
      activeSubject = value;
    },
    clean: () => {
      global.wx = previousWx;
    },
  };
}

const input = (value) => ({ detail: { value } });
const choice = (index) => ({ currentTarget: { dataset: { index } } });
const run = (id) => ({ id, mode: 'normal', theme: 'letter', status: 'active', opening: '题句', turns: 0 });

test('a first unconfirmed draft and launch stay hidden from another account until the original owner returns', async (context) => {
  const { invalidateSession } = require('../.build/lib/api');
  const storage = new Map();
  const requests = [];
  let profile = 'author-a';
  let firstExchange;
  invalidateSession();
  const home = loadHome({
    wx: {
      login({ success }) { success({ code: profile }); },
      request(request) {
        const path = new URL(request.url).pathname.replace('/api/wechat', '');
        const answer = (data) => request.success({ statusCode: 200, data });
        if (path === '/session') {
          const subject = request.data.code;
          const authenticated = () => answer({ subject, token: `token-${subject}` });
          if (subject === 'author-a' && !firstExchange) firstExchange = authenticated;
          else authenticated();
        } else if (path === '/runs') {
          requests.push({ token: request.header.Authorization, opening: request.data.opening });
          answer({ ...run('resume-a'), segments: [{ id: 'opening', text: request.data.opening }] });
        } else {
          answer({ runs: [], works: [] });
        }
      },
      getStorageSync(key) { return storage.get(key) ?? ''; },
      setStorageSync(key, value) { storage.set(key, structuredClone(value)); },
      removeStorageSync(key) { storage.delete(key); },
    },
  });
  context.after(home.clean);
  context.after(invalidateSession);
  const showA = home.page.onShow();
  await new Promise(resolve => setImmediate(resolve));
  home.page.updateOpening(input('这是甲尚未归属的题句。'));
  home.page.updateDraft(input('这是甲尚未归属的正文。'));
  const start = home.page.submitDraft();
  home.page.onHide();

  profile = 'author-b';
  invalidateSession();
  await home.page.onShow();
  firstExchange();
  await Promise.all([showA, start]);
  assert.deepEqual(requests, []);
  assert.equal(home.page.data.draft, '');
  assert.equal(home.page.data.opening, '十年后，你收到一封自己寄出的信');
  assert.equal([...storage.keys()].some(key => key.includes('author-b')), false);

  home.page.onHide();
  profile = 'author-a';
  invalidateSession();
  await home.page.onShow();
  assert.deepEqual(requests, [{ token: 'Bearer token-author-a', opening: '这是甲尚未归属的题句。' }]);
  assert.equal(storage.get('il:wechat:v1:author-a:first:resume-a')?.text, '这是甲尚未归属的正文。');
  assert.deepEqual(home.paths, ['/pages/write/index?id=resume-a']);
});

test('the latest pre-login choice resumes once after returning to the foreground', async (context) => {
  const verifications = [];
  const home = loadHome({
    session: () => new Promise((resolve) => verifications.push(resolve)),
    api: (path) => path === '/library' ? { runs: [], works: [] } : run('resumed'),
  });
  context.after(home.clean);

  const firstShow = home.page.onShow();
  home.page.toggleOpening();
  home.page.updateOpening(input('雨停时，窗边出现一封信。'));
  const selection = home.page.chooseAction(choice(1));
  home.page.onHide();
  const secondShow = home.page.onShow();
  assert.deepEqual(home.calls, []);
  assert.equal(home.storage.size, 0);

  verifications.forEach((verify) => verify('author-a'));
  await Promise.all([firstShow, selection, secondShow]);
  const openingCalls = home.calls.filter((entry) => entry.path === '/runs');
  assert.equal(openingCalls.length, 1);
  assert.equal(openingCalls[0].body.opening, '雨停时，窗边出现一封信。');
  assert.deepEqual(home.paths, ['/pages/write/index?id=resumed']);
  assert.equal(home.storage.get('author-a/first:resumed').text, '把信封递给女儿，问她认不认得这个笔迹');
});

test('editing only the opening while identity is pending keeps the selected action', async (context) => {
  let verify;
  const home = loadHome({
    session: () => new Promise((resolve) => { verify = resolve; }),
    api: () => run('choice-after-edit'),
  });
  context.after(home.clean);
  const selection = home.page.chooseAction(choice(0));
  home.page.toggleOpening();
  home.page.updateOpening(input('黄昏时，我在门枕下发现一封信。'));
  verify('author-a');
  await selection;
  const openings = home.calls.filter(request => request.path === '/runs');
  assert.equal(openings.length, 1);
  assert.equal(openings[0].body.opening, '黄昏时，我在门枕下发现一封信。');
  assert.equal(home.storage.get('author-a/first:choice-after-edit')?.text, '把信封翻过来，找寄件地址');
});

test('first background verification stores an unsubmitted draft under the confirmed author', async (context) => {
  let author = 'author-a';
  let verify;
  let first = true;
  const home = loadHome({
    session: () => {
      if (!first) return author;
      first = false;
      return new Promise((resolve) => { verify = resolve; });
    },
  });
  context.after(home.clean);

  const show = home.page.onShow();
  home.page.toggleOpening();
  home.page.updateOpening(input('我在车站等信。'));
  home.page.toggleWrite();
  home.page.updateDraft(input('我收好伞，望向来人。'));
  assert.equal(home.storage.size, 0);
  verify(author);
  await show;
  assert.equal(home.storage.get('author-a/home:draft')?.draft, '我收好伞，望向来人。');

  home.page.onHide();
  home.setSubject('');
  author = 'author-b';
  await home.page.onShow();
  assert.equal(home.page.data.draft, '');
  assert.equal(home.page.data.opening, '十年后，你收到一封自己寄出的信');
  assert.equal(home.storage.has('author-b/home:draft'), false);

  home.page.onHide();
  home.setSubject('');
  author = 'author-a';
  await home.page.onShow();
  assert.equal(home.page.data.opening, '我在车站等信。');
  assert.equal(home.page.data.draft, '我收好伞，望向来人。');
});

test('first confirmation preserves author input across failed navigation', async (context) => {
  let verify;
  const home = loadHome({
    session: () => new Promise((resolve) => { verify = resolve; }),
    api: () => run('draft'),
    navigate: ({ fail }) => fail(new Error('cannot open page')),
  });
  context.after(home.clean);

  home.page.toggleWrite();
  home.page.updateDraft(input('我回屋拆信。'));
  const start = home.page.submitDraft();
  verify('author-a');
  await start;
  assert.equal(home.storage.get('author-a/home:draft')?.draft, '我回屋拆信。');
  assert.equal(home.storage.get('author-a/first:draft')?.text, '我回屋拆信。');
});

test('an in-flight opening is reused for a changed prompt and author-written first turn', async (context) => {
  let deliver;
  const initial = { ...run('ongoing'), version: 2, segments: [{ id: 'opening', text: '我在门口收到来信。' }] };
  const home = loadHome({
    api: (path, _method, body) => path === '/runs'
      ? new Promise((resolve) => { deliver = resolve; })
      : { ...initial, version: 3, segments: [{ id: 'opening', text: body.text }] },
  });
  context.after(home.clean);

  home.page.toggleOpening();
  home.page.updateOpening(input(initial.segments[0].text));
  const original = home.page.chooseAction(choice(0));
  await new Promise((resolve) => setImmediate(resolve));
  home.page.updateOpening(input('回乡那天，我在车站收到来信。'));
  home.page.toggleWrite();
  home.page.updateDraft(input('我将信放回挎包里。'));
  await home.page.submitDraft();
  deliver(initial);
  await original;

  assert.deepEqual(home.calls.map(({ path }) => path), ['/runs', '/runs/ongoing/actions']);
  assert.equal(home.calls[0].body.opening, initial.segments[0].text);
  assert.equal(home.calls[1].body.text, '回乡那天，我在车站收到来信。');
  assert.equal(home.calls[1].body.target, 'opening');
  assert.equal(home.calls[1].body.version, 2);
  assert.deepEqual(home.paths, ['/pages/write/index?id=ongoing']);
  assert.equal(home.storage.get('author-a/first:ongoing')?.source, 'keyboard');
  assert.equal(home.storage.get('author-a/first:ongoing')?.text, '我将信放回挎包里。');
});

test('entering the composer during opening prevents the abandoned choice from being handed off', async (context) => {
  let deliver;
  const home = loadHome({
    api: () => new Promise((resolve) => { deliver = resolve; }),
  });
  context.after(home.clean);

  const start = home.page.chooseAction(choice(0));
  await new Promise((resolve) => setImmediate(resolve));
  home.page.toggleWrite();
  home.page.updateDraft(input('我打算自己续写。'));
  deliver(run('abandoned'));
  await start;

  assert.deepEqual(home.paths, []);
  assert.equal(home.storage.has('author-a/first:abandoned'), false);
  assert.equal(home.storage.get('author-a/home:draft')?.draft, '我打算自己续写。');
  assert.equal(home.storage.get('author-a/home:launch')?.first, undefined);
});

test('a lost opening update reply is recovered without repeating the edit or first turn', async (context) => {
  let deliver;
  let latest = { ...run('recovered'), version: 1, segments: [{ id: 'opening', text: '十年后，你收到一封自己寄出的信' }] };
  const home = loadHome({
    api: (path, _method, body) => {
      if (path.endsWith('/actions')) {
        latest = { ...latest, version: 2, segments: [{ id: 'opening', text: body.text }] };
        throw new Error('update reply lost');
      }
      return latest.version === 1 ? new Promise((resolve) => { deliver = resolve; }) : latest;
    },
  });
  context.after(home.clean);

  const original = home.page.chooseAction(choice(0));
  await new Promise((resolve) => setImmediate(resolve));
  home.page.updateOpening(input('我回到了寄信的地方。'));
  await home.page.chooseAction(choice(1));
  deliver(latest);
  await original;
  assert.deepEqual(home.paths, []);
  const savedFirst = home.storage.get('author-a/home:launch')?.first;
  assert.equal(home.storage.has('author-a/first:recovered'), false);

  await home.page.continueLaunch();
  assert.deepEqual(home.calls.map(({ path }) => path), ['/runs', '/runs/recovered/actions', '/runs']);
  assert.deepEqual(home.calls[0].body, home.calls[2].body);
  assert.deepEqual(home.paths, ['/pages/write/index?id=recovered']);
  assert.deepEqual(home.storage.get('author-a/first:recovered'), savedFirst);
  assert.equal(savedFirst.text, '把信封递给女儿，问她认不认得这个笔迹');
});

test('first choice waits for verified identity, then forwards exactly one marked first turn', async (context) => {
  let verify;
  const home = loadHome({
    session: () => new Promise((resolve) => {
      verify = resolve;
    }),
    api: () => run('new'),
  });
  context.after(home.clean);

  const start = home.page.chooseAction(choice(0));
  await home.page.chooseAction(choice(0));
  assert.deepEqual(home.calls, []);
  assert.equal(home.storage.size, 0);
  verify('author-a');
  await start;

  assert.equal(home.calls.length, 1);
  assert.equal(home.calls[0].path, '/runs');
  assert.equal(home.calls[0].body.mode, 'normal');
  assert.equal(home.calls[0].body.theme, 'letter');
  assert.deepEqual(home.paths, ['/pages/write/index?id=new']);
  const pendingTurn = home.storage.get('author-a/first:new');
  assert.equal(pendingTurn.source, 'choice');
  assert.equal(pendingTurn.text, '把信封翻过来，找寄件地址');
  assert.notEqual(pendingTurn.request_id, home.calls[0].body.request_id);
});

test('reopening an already committed first keyboard turn does not present the same text as a new draft', async (context) => {
  const first = { request_id: 'first-sent', source: 'keyboard', text: '我把信撕开。' };
  const storage = new Map([
    ['author-a/home:launch', { owner: 'author-a', requestId: 'start-sent', opening: '题句', compose: false, first }],
    ['author-a/first:committed', first],
  ]);
  const home = loadHome({
    subject: 'author-a',
    storage,
    api(path) {
      if (path === '/library') return { runs: [], works: [] };
      if (path === '/runs') return { ...run('committed'), turns: 1, version: 2 };
      if (path === '/runs/committed/receipts/first-sent') return { status: 'committed', run_version: 2 };
      throw new Error(`Unexpected path: ${path}`);
    },
  });
  context.after(home.clean);
  await home.page.onShow();
  await home.page.continueLaunch();
  assert.deepEqual(home.paths, ['/pages/write/index?id=committed']);
  assert.equal(storage.has('author-a/draft:committed'), false);
  assert.equal(storage.has('author-a/first:committed'), false);
});

test('keyboard draft stays visible if identity fails and uses the edited opening on explicit retry', async (context) => {
  let attempts = 0;
  const home = loadHome({
    session: () => {
      if (++attempts === 1) throw new Error('offline');
      return 'author-a';
    },
    api: () => run('keyboard'),
  });
  context.after(home.clean);

  home.page.toggleOpening();
  home.page.updateOpening(input('搬家那天，我收到一封信。'));
  home.page.toggleWrite();
  home.page.updateDraft(input('我把信放在门边。'));
  await home.page.submitDraft();
  assert.equal(home.page.data.draft, '我把信放在门边。');
  assert.ok(home.page.data.launchError);
  assert.equal(home.storage.size, 0);
  assert.equal(home.calls.length, 0);

  await home.page.continueLaunch();
  assert.equal(home.calls[0].body.opening, '搬家那天，我收到一封信。');
  assert.deepEqual(home.storage.get('author-a/first:keyboard'), {
    request_id: 'request-2',
    source: 'keyboard',
    text: '我把信放在门边。',
  });
});

test('an unknown opening receipt is resumed explicitly with the original request after re-entry', async (context) => {
  let launches = 0;
  const home = loadHome({
    api: (path) => {
      if (path === '/library') return { runs: [run('kept')], works: [] };
      if (++launches === 1) throw new Error('reply lost');
      return run('kept');
    },
  });
  context.after(home.clean);

  await home.page.chooseAction(choice(1));
  assert.equal(home.paths.length, 0);
  assert.ok(home.storage.get('author-a/home:launch'));
  home.page.onHide();
  await home.page.onShow();
  assert.equal(home.calls.filter((entry) => entry.path === '/runs').length, 1);
  assert.equal(home.page.data.pendingLaunch, true);
  assert.equal(home.page.data.resumeId, 'kept');

  await home.page.continueLaunch();
  const openingCalls = home.calls.filter((entry) => entry.path === '/runs');
  assert.equal(openingCalls.length, 2);
  assert.deepEqual(openingCalls[0].body, openingCalls[1].body);
  assert.deepEqual(home.paths, ['/pages/write/index?id=kept']);
  assert.equal(home.storage.get('author-a/first:kept').text, '把信封递给女儿，问她认不认得这个笔迹');
  assert.equal(home.storage.has('author-a/home:launch'), false);
});

test('switching identity during verification discards the former author input', async (context) => {
  const home = loadHome({
    subject: 'author-a',
    session: () => 'author-b',
    api: () => run('unexpected'),
  });
  context.after(home.clean);

  home.page.toggleWrite();
  home.page.updateDraft(input('旧身份的未提交文字'));
  await home.page.submitDraft();

  assert.equal(home.page.data.draft, '');
  assert.ok(home.page.data.launchError);
  assert.deepEqual(home.calls, []);
  assert.deepEqual(home.paths, []);
  assert.equal(home.storage.get('author-a/home:draft').draft, '旧身份的未提交文字');
  assert.equal(home.storage.has('author-b/home:draft'), false);
});

test('a late result after leaving the foreground creates no handoff or navigation', async (context) => {
  let deliver;
  const home = loadHome({
    api: () => new Promise((resolve) => {
      deliver = resolve;
    }),
  });
  context.after(home.clean);

  const start = home.page.chooseAction(choice(0));
  await new Promise((resolve) => setImmediate(resolve));
  home.page.onHide();
  deliver(run('late'));
  await start;
  assert.deepEqual(home.paths, []);
  assert.ok(home.storage.get('author-a/home:launch'));
  assert.equal(home.storage.has('author-a/first:late'), false);
});

test('voice entry only opens the writing controls and never stages an automatic submission', async (context) => {
  const home = loadHome({ api: () => run('voice') });
  context.after(home.clean);

  home.page.toggleWrite();
  await home.page.openVoice();
  assert.deepEqual(home.paths, ['/pages/write/index?id=voice&compose=1']);
  assert.equal(home.storage.has('author-a/first:voice'), false);
});

test('opening editing and a new keyboard submission replace the choice while login is pending', async (context) => {
  let verify;
  const identity = new Promise((resolve) => { verify = resolve; });
  const home = loadHome({ session: () => identity, api: () => run('latest') });
  context.after(home.clean);

  const first = home.page.chooseAction(choice(0));
  home.page.toggleOpening();
  home.page.updateOpening(input('今天，我收到一封信。'));
  home.page.toggleOpening();
  home.page.toggleWrite();
  home.page.updateDraft(input('我把信放进木盒。'));
  const latest = home.page.submitDraft();

  assert.equal(home.calls.length, 0);
  verify('author-a');
  await Promise.all([first, latest]);

  assert.equal(home.calls.length, 1);
  assert.equal(home.calls[0].body.opening, '今天，我收到一封信。');
  const pendingTurn = home.storage.get('author-a/first:latest');
  assert.equal(pendingTurn.source, 'keyboard');
  assert.equal(pendingTurn.text, '我把信放进木盒。');
});

test('skipping a dispatched first turn keeps the original opening key and enters the draft without that turn', async (context) => {
  let launches = 0;
  const home = loadHome({
    api: () => {
      if (++launches === 1) throw new Error('reply lost');
      return run('draft');
    },
  });
  context.after(home.clean);

  await home.page.chooseAction(choice(0));
  await home.page.skipFirstTurn();

  assert.equal(home.calls.length, 2);
  assert.deepEqual(home.calls[0].body, home.calls[1].body);
  assert.deepEqual(home.paths, ['/pages/write/index?id=draft']);
  assert.equal(home.storage.has('author-a/first:draft'), false);
});

test('owned text stays hidden while revalidation fails and restores the latest draft for the same author', async (context) => {
  let online = true;
  const home = loadHome({
    session: () => {
      if (!online) throw new Error('offline');
      return 'author-a';
    },
  });
  context.after(home.clean);
  await home.page.onShow();
  home.page.toggleOpening();
  home.page.updateOpening(input('今早，我在门口捡到一封信。'));
  home.page.toggleWrite();
  home.page.updateDraft(input('我把信放在木盒里。'));

  online = false;
  home.setSubject('');
  home.page.updateDraft(input('我把信放在木盒里，再锁上抽屉。'));
  home.page.onHide();
  await home.page.onShow();
  assert.equal(home.page.data.draft, '');
  assert.equal(home.page.data.opening, '十年后，你收到一封自己寄出的信');
  assert.ok(home.page.data.libraryError);

  online = true;
  await home.page.loadLibrary();
  assert.equal(home.page.data.opening, '今早，我在门口捡到一封信。');
  assert.equal(home.page.data.draft, '我把信放在木盒里，再锁上抽屉。');
  assert.equal(home.page.data.writing, true);
  assert.ok(home.calls.every((call) => call.path === '/library'));
});

test('changing accounts isolates an owned first-screen draft until the original author returns', async (context) => {
  let verifiedAuthor = 'author-a';
  const home = loadHome({ session: () => verifiedAuthor });
  context.after(home.clean);
  await home.page.onShow();
  home.page.toggleOpening();
  home.page.updateOpening(input('甲的题句'));
  home.page.toggleWrite();
  home.page.updateDraft(input('甲的私稿'));
  home.page.onHide();
  home.setSubject('');

  verifiedAuthor = 'author-b';
  await home.page.onShow();
  assert.equal(home.page.data.opening, '十年后，你收到一封自己寄出的信');
  assert.equal(home.page.data.draft, '');
  home.page.toggleWrite();
  home.page.updateDraft(input('乙的私稿'));
  home.page.onHide();
  home.setSubject('');

  verifiedAuthor = 'author-a';
  await home.page.onShow();
  assert.equal(home.page.data.opening, '甲的题句');
  assert.equal(home.page.data.draft, '甲的私稿');
  assert.ok(home.calls.every((call) => call.path === '/library'));
});

test('an owned draft is cleared from the home page only after the first turn has been handed off', async (context) => {
  let openWriter = false;
  const home = loadHome({
    subject: 'author-a',
    api: () => run('owned'),
    navigate: (options) => {
      if (openWriter) options.success();
      else options.fail(new Error('cannot open page'));
    },
  });
  context.after(home.clean);
  home.page.toggleWrite();
  home.page.updateDraft(input('我把木盒放回桌下。'));
  await home.page.submitDraft();
  assert.equal(home.storage.get('author-a/home:draft').draft, '我把木盒放回桌下。');

  openWriter = true;
  await home.page.continueLaunch();
  assert.equal(home.storage.has('author-a/home:draft'), false);
  assert.equal(home.storage.get('author-a/first:owned').text, '我把木盒放回桌下。');
});
