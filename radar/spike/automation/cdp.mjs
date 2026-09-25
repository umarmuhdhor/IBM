// Bob IDE automation over CDP (fase 01 spike 16). Bob IDE must run with --remote-debugging-port=9223.
// usage: node cdp.mjs <page|webview> <js-expression-or-@file>
// Evaluates JS in the Bob IDE workbench page or in the Bob chat webview (inner active-frame document as `doc`).
import { readFileSync } from 'node:fs';
const [which, exprArg] = process.argv.slice(2);
const expr = exprArg.startsWith('@') ? readFileSync(exprArg.slice(1), 'utf8') : exprArg;
const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const target = list.find((t) => (which === 'page' ? t.type === 'page' : t.type === 'iframe' && t.url.startsWith('vscode-webview://')));
if (!target) { console.error('target not found', list.map((t) => t.type + ' ' + t.url.slice(0, 60))); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wrapped = which === 'page' ? expr : `(async () => { const f = document.querySelector('iframe'); const doc = f ? f.contentDocument : document; const win = f ? f.contentWindow : window; ${expr} })()`;
const res = await send('Runtime.evaluate', { expression: wrapped, awaitPromise: true, returnByValue: true });
const out = res.result?.result?.value ?? res.result?.exceptionDetails ?? res;
console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
ws.close();
