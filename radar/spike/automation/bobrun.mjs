// Bob IDE automation over CDP (fase 01 spike 16). Bob IDE must run with --remote-debugging-port=9223.
// Drive one Bob IDE task over CDP.
// usage: node bobrun.mjs --mode "<mode label substring>" --prompt "<text>" [--approve all|none] [--timeout 300] [--no-new]
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); const v = i > -1 ? args[i + 1] : undefined; return v === undefined || v.startsWith('--') ? d : v; };
const mode = opt('--mode', '');
const prompt = opt('--prompt', '');
const approve = opt('--approve', 'all');
const timeoutS = Number(opt('--timeout', '300')) || 300;
const newTask = !args.includes('--no-new');

async function target(kind) {
  let list;
  try {
    list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  } catch (err) {
    console.error(`bobrun: cannot reach CDP on :9223 (start Bob IDE with --remote-debugging-port=9223): ${err.message}`);
    process.exit(2);
  }
  const t = list.find((t) => (kind === 'page' ? t.type === 'page' : t.type === 'iframe' && t.url.startsWith('vscode-webview://')));
  if (!t) { console.error(`bobrun: no ${kind} target (Bob panel closed or workspace untrusted?)`); process.exit(2); }
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
  return res.result?.result?.value ?? JSON.stringify(res.result?.exceptionDetails ?? res);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

if (newTask) {
  log('new task:', await evalIn('page', `const b=[...document.querySelectorAll('[aria-label="New Task"]')][0]; if(!b) return 'no new-task button'; b.click(); return 'ok';`));
  await sleep(1500);
}
if (mode) {
  log('mode:', await evalIn('webview', `
    const trig = doc.querySelector('[data-testid="mode-selector-trigger"]');
    if (!trig) return 'no mode trigger';
    if (trig.innerText.trim().toLowerCase().includes(${JSON.stringify(mode.toLowerCase())})) return 'already ' + trig.innerText.trim();
    trig.click(); await new Promise(r=>setTimeout(r,700));
    const opts = [...doc.querySelectorAll('[role=option],[role=menuitem],[role=menuitemradio],[cmdk-item]')].filter(e => (e.innerText||'').trim().split('\\n')[0].trim().toLowerCase() === ${JSON.stringify(mode.toLowerCase())});
    if (!opts.length) { const all=[...doc.querySelectorAll('[role=option],[cmdk-item]')].map(e=>e.innerText.trim().split('\\n')[0]); doc.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'mode not found; options: ' + all.join(', '); }
    opts[opts.length-1].click(); await new Promise(r=>setTimeout(r,500));
    return 'now ' + doc.querySelector('[data-testid="mode-selector-trigger"]').innerText.trim();`));
}
log('type:', await evalIn('webview', `const ed=doc.querySelector('[contenteditable=true]'); if(!ed) return 'no editor'; ed.focus(); doc.execCommand('insertText', false, ${JSON.stringify(prompt)}); await new Promise(r=>setTimeout(r,300)); const b=doc.querySelector('button[aria-label="Send message"]'); b.click(); return 'sent ' + ed.innerText.length;`));

const t0 = Date.now();
let last = '';
while (Date.now() - t0 < timeoutS * 1000) {
  await sleep(5000);
  const r = await evalIn('webview', `
    const t = doc.body.innerText;
    const pend = (t.match(/Tools awaiting approval:[\\s\\S]{0,240}/)||[''])[0].replace(/\\n/g,' | ');
    const ap = [...doc.querySelectorAll('button')].find(b=>b.innerText.trim()==='Approve once');
    const rj = [...doc.querySelectorAll('button')].find(b=>b.innerText.trim()==='Reject');
    if (ap && ${JSON.stringify(approve)} === 'all') { ap.click(); return 'APPROVED ' + pend; }
    if (rj && ${JSON.stringify(approve)} === 'none') { rj.click(); return 'REJECTED ' + pend; }
    return (/esc to cancel/.test(t) ? 'RUNNING' : 'IDLE');`);
  if (r !== last || !r.startsWith('RUNNING')) log(r.slice(0, 300));
  last = r;
  if (r === 'IDLE') break;
}
const final = await evalIn('webview', `return doc.body.innerText;`);
const i = final.lastIndexOf(prompt.slice(0, 40));
console.log('\n===== TRANSCRIPT (after prompt) =====\n' + (i > -1 ? final.slice(i + prompt.length) : final.slice(-3000)).slice(0, 4000));
