const {test, beforeEach} = require('node:test')
const assert = require('node:assert/strict')
const api = require('../.build/lib/api')
const storage = require('../.build/lib/storage')
let requests, memory
beforeEach(() => {
  api.invalidateSession()
  requests = []
  memory = new Map()
  global.wx = {
    login(opts) { opts.success({code: 'single-use-code'}) },
    request(opts) { requests.push(opts) },
    getStorageSync(k) { return memory.get(k) ?? '' },
    setStorageSync(k, v) { memory.set(k, v) },
    removeStorageSync(k) { memory.delete(k) },
  }
})
function response(index, statusCode, data) { requests[index].success({statusCode, data}) }
async function tick() { await new Promise(r => setImmediate(r)) }
async function confirm(sub) {
  const wait = api.ensureSession()
  await tick()
  response(requests.length - 1, 200, {token:'live-token', subject:sub})
  await wait
}
test('private requests share login; public cards send no token', async () => {
  const a = api.api('/library'), b = api.api('/runs/r')
  await tick()
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0].data, {code:'single-use-code'})
  response(0, 200, {token:'T', subject:'person'})
  await tick()
  assert.equal(requests[1].header.Authorization, 'Bearer T')
  response(1, 200, {}); response(2, 200, {})
  await Promise.all([a, b])
  const card = api.api('/cards/abc')
  await tick()
  assert.equal(requests[3].header.Authorization, undefined)
  response(3, 200, {title:'card'})
  assert.equal((await card).title, 'card')
})
test('late private responses are discarded after foreground identity resets', async () => {
  await confirm('A')
  const pending = api.api('/works/A')
  await tick()
  api.invalidateSession()
  response(1, 200, {text:'private A'})
  await assert.rejects(pending, /身份/)
})
test('storage becomes available only to its confirmed owner', async () => {
  assert.equal(storage.getPrivate('draft'), undefined)
  await confirm('A')
  storage.putPrivate('draft', {text:'A'})
  api.invalidateSession()
  assert.equal(storage.getPrivate('draft'), undefined)
  await confirm('B')
  assert.equal(storage.getPrivate('draft'), undefined)
  assert.ok(!JSON.stringify([...memory]).includes('live-token'))
})
test('401 pauses requests, does not replay a mutation; error detail stays readable', async () => {
  await confirm('A')
  const write = api.api('/runs', 'POST', {request_id:'stable'})
  await tick()
  response(1, 401, {detail:'会话过期'})
  await assert.rejects(write, e => e.status===401 && e.message.includes('会话过期'))
  assert.equal(requests.length,2)
  assert.equal(api.currentSubject(), '')
})
test('native work updates use supported PUT and show the API domain error', async () => {
  await confirm('A')
  const write = api.api('/works/w', 'PATCH', {version:3, title:'t', text:'v'})
  await tick()
  assert.equal(requests[1].method, 'PUT')
  assert.equal(requests[1].data.version, 3)
  response(1, 409, {error:{code:'STALE',message:'已保存的作品版本比当前版本新。'}})
  await assert.rejects(write,e=>e.status===409 && e.message==='已保存的作品版本比当前版本新。')
})
test('a finish conflict carries the pending request IDs for its confirmed owner', async () => {
  await confirm('A')
  const finish = api.api('/runs/r/actions', 'POST', {kind:'finish'})
  await tick()
  response(1, 409, {error:{code:'STORY_FINISH_INPUT_PENDING',message:'请先核对输入',details:{request_ids:['turn-1']}}})
  await assert.rejects(finish, error => {
    assert.equal(error.code, 'STORY_FINISH_INPUT_PENDING')
    assert.deepEqual(error.details, {request_ids:['turn-1']})
    return true
  })
})
test('developer timing sample contains only durations and is empty for release', () => {
  const perf = require('../.build/lib/perf')
  wx.getAccountInfoSync = () => ({miniProgram:{envVersion:'develop'}})
  perf.markLaunch(); perf.markReady(); perf.beginAction(); perf.markFeedback(); perf.markCommitted()
  const sample = perf.getFirstStoryTimings()
  assert.deepEqual(Object.keys(sample).sort(), ['action_committed_ms','action_feedback_ms','first_screen_ready_ms'])
  assert.ok(Object.values(sample).every(n=>Number.isFinite(n) && n>=0))
  wx.getAccountInfoSync = () => ({miniProgram:{envVersion:'release'}})
  perf.markLaunch(); perf.markReady(); perf.beginAction(); perf.markCommitted()
  assert.deepEqual(perf.getFirstStoryTimings(), {})
})
test('a late session exchange proves the old owner without authorizing any old requests', async () => {
  const old = api.verifySession()
  const invalidated = assert.rejects(old.subject, /身份/)
  await tick()
  api.invalidateSession()
  const current = api.ensureSession()
  await tick()
  response(1, 200, {token:'current-token', subject:'B'})
  await current
  response(0, 200, {token:'old-token', subject:'A'})
  assert.equal(await old.ownerProof, 'A')
  await invalidated
  assert.equal(api.currentSubject(), 'B')
  const library = api.api('/library')
  await tick()
  assert.equal(requests[2].header.Authorization, 'Bearer current-token')
  response(2, 200, {})
  await library
})
test('a wx.login that had not dispatched an exchange cannot prove the owner of hidden input', async () => {
  let resolveLogin
  wx.login = ({success}) => { resolveLogin = success }
  const old = api.verifySession()
  const invalidated = assert.rejects(old.subject, /身份/)
  assert.equal(old.ownerProof, undefined)
  api.invalidateSession()
  resolveLogin({code:'late-code'})
  await invalidated
  assert.deepEqual(requests, [])
})
