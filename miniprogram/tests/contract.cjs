// Actual FastAPI endpoints and SQLite. Only the WeChat/provider boundaries are test doubles.
const { spawn, spawnSync } = require('node:child_process');
const { createInterface } = require('node:readline');
const { once } = require('node:events');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const server = path.resolve(root, '../server');
const { api, requestId, invalidateSession } = require('../.build/lib/api');

async function run() {
  const env = spawnSync('poetry', ['env', 'info', '-p'], {cwd:server, encoding:'utf8'});
  if (env.status !== 0) throw new Error('Install the server Poetry environment first.');
  const processHost = spawn(path.join(env.stdout.trim(), 'bin', 'python'), [path.join(__dirname, 'contract_host.py')], {
    cwd: server, env: {...process.env, PYTHONPATH:server, PYTHONDONTWRITEBYTECODE:'1'},
    stdio: ['ignore','pipe','inherit'],
  });
  const exited = once(processHost,'exit');
  const lines = createInterface({input:processHost.stdout});
  try {
    const port = await Promise.race([
      new Promise(resolve=>lines.on('line',line=>{if (/^READY \d+$/.test(line)) resolve(Number(line.slice(6)));})),
      exited.then(()=>{throw new Error('Test backend exited before startup');}),
    ]);
    let person = 'author';
    global.wx = {
      login(options) {options.success({code: person + '.' + requestId()});},
      async request(opts) {
        try {
          const reply = await fetch('http://127.0.0.1:' + port + new URL(opts.url).pathname,
            { method:opts.method, headers:opts.header, body:opts.data ? JSON.stringify(opts.data) : undefined });
          const body = await reply.text();
          opts.success({statusCode:reply.status, data:body ? JSON.parse(body) : null});
        } catch (error) { opts.fail(error); }
      },
    };
    const initial = await api('/library');
    assert.deepEqual(initial.runs, []);
    const start = {request_id:requestId(), theme:'letter', mode:'normal', opening:'家门口有一封信。'};
    const first = await api('/runs','POST',start);
    assert.equal(first.id,(await api('/runs','POST',start)).id);
    assert.equal(first.segments[0].text,start.opening);
    const actionUrl = '/runs/' + first.id + '/actions';
    const firstTurn = { request_id:requestId(),version:first.version,kind:'turn',source:'choice',text:first.choices[0] };
    let run = await api(actionUrl,'POST',firstTurn);
    assert.equal(run.turns,1);
    assert.ok(run.segments.some(s=>s.locked));
    assert.equal((await api(actionUrl,'POST',firstTurn)).turns,1);
    run = await api(actionUrl,'POST',{request_id:requestId(),version:run.version,kind:'finish'});
    const workUrl = '/works/' + run.work_id;
    let work = await api(workUrl);
    work = await api(workUrl,'PATCH',{version:work.version,title:'私稿',text:'自己保存的独立文字。'});
    const pub = await api(workUrl + '/cards','POST',{request_id:requestId(),version:work.version});
    assert.equal(pub.text,work.text);
    assert.equal((await api('/library')).progress.detective,true);
    invalidateSession();
    person = 'friend';
    const cardUrl = '/cards/' + pub.id;
    const friendCard = await api(cardUrl);
    assert.equal(friendCard.text,work.text);
    assert.equal(friendCard.opening,'十年后，你收到一封自己寄出的信');
    await assert.rejects(api(workUrl), error=>[403,404].includes(error.status));
    const friend = await api('/runs','POST',{request_id:requestId(),theme:'letter',mode:'normal',card_id:pub.id});
    assert.notEqual(friend.id,first.id);
    assert.equal(friend.segments[0].text,friendCard.opening);
    invalidateSession();
    person = 'author';
    await api(workUrl + '/cards/' + pub.id,'DELETE');
    await assert.rejects(api(cardUrl), error=>[404,410].includes(error.status));
    console.log('PASS native transport ↔ real routes: verified sessions, first turn, idempotency, work PUT, immutable share, independent friend, revocation.');
  } finally {
    lines.close();
    processHost.kill('SIGTERM');
    await exited;
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
