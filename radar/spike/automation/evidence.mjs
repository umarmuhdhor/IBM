// Bob IDE automation over CDP (fase 01 spike 16). Bob IDE must run with --remote-debugging-port=9223.
// Opens Tasks → newest task → task header (the consumption summary), brings Bob to the front and runs
// radar/scripts/bob-evidence.sh. usage: node evidence.mjs <nama> <NN> <slug> [--title <task title prefix>] [--force]
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [name, num, slug] = process.argv.slice(2);
const ti = process.argv.indexOf('--title');
const title = ti > -1 ? process.argv[ti + 1] : '';
if (!name || !num || !slug) {
  console.error('usage: node evidence.mjs <nama> <NN> <slug>');
  process.exit(1);
}
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

async function target(kind) {
  let list;
  try {
    list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  } catch (err) {
    console.error(`evidence: cannot reach CDP on :9223: ${err.message}`);
    process.exit(2);
  }
  const t = list.find((x) => (kind === 'page' ? x.type === 'page' : x.type === 'iframe' && x.url.startsWith('vscode-webview://')));
  if (!t) {
    console.error(`evidence: no ${kind} target`);
    process.exit(2);
  }
  return t;
}
async function evalIn(kind, body) {
  const t = await target(kind);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const expr = kind === 'page' ? `(async () => { ${body} })()` :
    `(async () => { const f = document.querySelector('iframe'); const doc = f ? f.contentDocument : document; ${body} })()`;
  const res = await new Promise((r) => { ws.addEventListener('message', (e) => r(JSON.parse(e.data))); ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); });
  ws.close();
  return res.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 0. widen the Bob panel so the summary values are not cut off
await evalIn('page', `document.querySelector('[aria-label="Maximize Secondary Side Bar"]')?.click(); return 1;`);
await sleep(2000);
// 1. Tasks list (toggle it open if closed)
const listOpen = await evalIn('webview', `return /Today\\(\\d+\\)|Search tasks/.test(doc.body.innerText);`);
if (!listOpen) await evalIn('page', `document.querySelector('[aria-label="Tasks"]')?.click(); return 1;`);
await sleep(1500);
// 2. newest task row (first row under the first date group)
console.log('task:', await evalIn('webview', `
  const rows = [...doc.querySelectorAll('div')].filter(e => e.children.length < 8 && /^(just now|\\d+ (sec|min|hour)s? ago)$/m.test(e.innerText || '') && (e.innerText || '').length < 400);
  const want = ${JSON.stringify(title)};
  // smallest element per task row, in document order (the list is newest first)
  const leaves = rows.filter(r => !rows.some(o => o !== r && r.contains(o)) && r.innerText.split('\\n').length >= 2);
  const row = want ? leaves.find(e => e.innerText.startsWith(want)) : leaves[0];
  if (!row) return 'no task row';
  row.click();
  return row.innerText.split('\\n')[0].slice(0, 80);`));
await sleep(1500);
// 3. task header → summary panel (Context Length, Task Id, Workspace, Bobcoins)
console.log('header:', await evalIn('webview', `
  if (/Context Length/.test(doc.body.innerText)) return 'summary already open';
  const s = [...doc.querySelectorAll('span')].find(e => /^[\\d.]+k \\/ [\\d.]+k$/.test(e.innerText || ''));
  const h = s && s.closest('div.cursor-pointer');
  if (!h) return 'no header';
  h.click();
  await new Promise(r => setTimeout(r, 1000));
  return /Context Length/.test(doc.body.innerText) ? 'summary open' : 'summary not visible';`));
const bobcoins = await evalIn('webview', `const m = doc.body.innerText.match(/Bobcoins\\s*\\n?\\s*([\\d.]+)/); return m ? m[1] : '?';`);
console.log('bobcoins:', bobcoins);
// 4. front + capture
execFileSync('osascript', ['-e', 'tell application "IBM Bob" to activate']);
await sleep(1500);
const extra = process.argv.includes('--force') ? ['--force'] : [];
console.log(execFileSync(resolve(repo, 'radar/scripts/bob-evidence.sh'), [name, num, slug, ...extra], { cwd: repo, encoding: 'utf8' }).trim());
