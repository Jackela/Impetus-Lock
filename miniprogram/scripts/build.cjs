const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { TmplGroup } = require('glass-easel-template-compiler');

const root = path.resolve(__dirname, '..');
const test = process.argv.includes('--test');
const out = path.join(root, test ? '.build' : 'dist');
const rawOrigin = process.env.WECHAT_API_ORIGIN || (test ? 'https://example.invalid' : '');
let origin = '';
if (rawOrigin) {
  const value = new URL(rawOrigin);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(value.hostname);
  if ((value.protocol !== 'https:' && !(value.protocol === 'http:' && loopback))
      || value.username || value.password || value.search || value.hash || value.pathname !== '/') {
    throw new Error('WECHAT_API_ORIGIN must be an HTTPS origin, or an HTTP loopback origin for local development.');
  }
  origin = value.origin;
}
const compiler = require.resolve('typescript/bin/tsc');
const compiled = spawnSync(process.execPath, [compiler, '--outDir', out], { cwd: root, stdio: 'inherit' });
if (compiled.status !== 0) process.exit(compiled.status ?? 1);
const timings = process.env.WECHAT_DEV_TIMINGS === '1' || test;
fs.writeFileSync(path.join(out, 'lib/config.js'), [
  '"use strict";',
  'exports.API_ORIGIN = ' + JSON.stringify(origin) + ';',
  'exports.ENABLE_DEV_TIMINGS = ' + JSON.stringify(timings) + ';',
  '',
].join('\n'));

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
if (process.env.WECHAT_SPEECH_ENABLED === '1') {
  app.plugins = { WechatSI: { version: '0.0.7', provider: 'wx069ba97219f66d99' } };
}
const group = new TmplGroup();
function copy(relative) {
  fs.mkdirSync(path.dirname(path.join(out, relative)), { recursive: true });
  fs.copyFileSync(path.join(root, relative), path.join(out, relative));
}
for (const page of app.pages) {
  const dir = path.dirname(page);
  const template = fs.readFileSync(path.join(root, page + '.wxml'), 'utf8');
  const result = group.addTmpl(page, template);
  if (result.length > 0) throw new Error(page + ': ' + JSON.stringify(result));
  if (!group.getTmplGenObject(page)) throw new Error('Empty WXML compilation for ' + page);
  for (const ext of ['wxml', 'wxss', 'json']) copy(page + '.' + ext);
  JSON.parse(fs.readFileSync(path.join(root, page + '.json'), 'utf8'));
  for (const file of fs.readdirSync(path.join(root, dir))) {
    if (/\.(png|jpg|jpeg|webp)$/i.test(file)) copy(path.join(dir, file));
  }
}
group.free();
copy('app.wxss');
copy('sitemap.json');
fs.writeFileSync(path.join(out, 'app.json'), JSON.stringify(app, null, 2));
console.log('Compiled TypeScript and ' + app.pages.length + ' WXML pages into ' + path.relative(root, out) + '.');
if (!origin) console.log('Public API origin is unset. Network actions will report the missing configuration.');
