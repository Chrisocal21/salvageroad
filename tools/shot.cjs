const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const url = args[0] || 'http://localhost:3000/tools/vehicle-review.html';
const output = path.resolve(args[1] || 'dist/review/el-cajon-front.png');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = path.resolve('dist/review/chrome-profile-' + Date.now());
fs.mkdirSync(path.dirname(output), { recursive: true });
const child = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--remote-debugging-port=9337', '--remote-allow-origins=*', '--user-data-dir=' + profile, '--window-size=1280,860', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let target;
  for (let i = 0; i < 60; i++) {
    try { target = (await (await fetch('http://localhost:9337/json')).json()).find(t => t.type === 'page'); if (target) break; } catch {}
    await delay(250);
  }
  if (!target) throw Error('Chrome debugging endpoint did not start');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const pending = new Map(); const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); if (p) { pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result); } }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(a=>a.value || a.description).join(' '));
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, {resolve, reject}); socket.send(JSON.stringify({id:key,method,params})); });
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {width:1280,height:860,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate', {url});
  const isReview = url.includes('vehicle-review.html');
  let ready = false;
  for (let i=0;i<100;i++) {
    await delay(250);
    const r=await call('Runtime.evaluate',{expression:isReview?'Boolean(window.__reviewReady)':'document.readyState === "complete"',returnByValue:true});
    if(r.result.value){ready=true;break;} if(errors.length) break;
  }
  if (!ready) throw Error('Page failed: '+errors.join('\n'));
  if (!isReview) await delay(2500);
  if (args[2]) {
    const evaluation = await call('Runtime.evaluate', {expression:fs.readFileSync(args[2],'utf8'),awaitPromise:true});
    if (evaluation.exceptionDetails) throw Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text);
  }
  await delay(500);
  const result = await call('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
  fs.writeFileSync(output, Buffer.from(result.data,'base64'));
  const stats=await call('Runtime.evaluate',{expression:'JSON.stringify(window.__review || {})',returnByValue:true});
  console.log(JSON.stringify({output,errors,stats:stats.result.value}));
  await call('Browser.close');
  await delay(500);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();child.kill();});
