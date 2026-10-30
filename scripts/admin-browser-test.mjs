// Run with npm run dev already serving localhost:8788. Uses system Chromium.
// Only local test content is created; temporary pages and uploads are removed.
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const profile=mkdtempSync(tmpdir()+'/stavby-browser-');
const chrome=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=9223','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws;
try {
  let target;
  for(let i=0;i<60;i++){try{target=await(await fetch('http://127.0.0.1:9223/json/new?http://localhost:8788/admin',{method:'PUT'})).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
  assert.ok(target);
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pending=new Map();const exceptions=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  await send('Runtime.enable');
  const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async(expr)=>{for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout '+expr);};
  await wait('document.querySelector("#login-view") && !document.querySelector("#login-view").hidden');
  await evaluate('document.querySelector("#pw").value="heslo";document.querySelector("#login-form").requestSubmit()');
  await wait('!document.querySelector("#app").hidden && document.querySelector("#view").children.length > 0');
  assert.equal(await evaluate('localStorage.getItem("admin_token")'),null);
  assert.equal(await evaluate('document.cookie.includes("stavby_admin")'),false);
  console.log('Browser login and HttpOnly session OK');
  await send('Page.reload');await wait('document.querySelector("#app") && !document.querySelector("#app").hidden && document.querySelector("#view").children.length > 0');
  console.log('Session survives reload OK');
  const result=await evaluate(`(async()=>{
    const api=async(path,method='GET',body)=>{const r=await fetch('/api/admin/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
    const content=await api('content');const siteSave=await api('site','PUT',content.data.site);
    const slug='audit-browser-'+Date.now();const next=slug+'-renamed';
    const created=await api('pages','POST',{slug,title:'Audit test'});
    const draft=(await api('content')).data.pages.find(p=>p.slug===slug);
    const renamed=await api('pages/'+slug,'PUT',{...draft,slug:next});
    const after=(await api('content')).data.pages.find(p=>p.slug===next);
    const deleted=await api('pages/'+next,'DELETE');
    const file=await(await fetch('/assets/img/logo.webp')).blob();const form=new FormData();form.set('file',file,'logo.webp');
    const up=await fetch('/api/admin/images',{method:'POST',body:form});const upload=await up.json();
    const image=upload.key?await fetch('/img/'+upload.key):null;
    if(upload.key)await api('images/'+upload.key,'DELETE');
    return {site:siteSave.status,created:created.status,renamed:renamed.status,alias:after?.aliases.includes('/'+slug),deleted:deleted.status,upload:up.status,image:image?.status};
  })()`);
  assert.deepEqual(result,{site:200,created:200,renamed:200,alias:true,deleted:200,upload:200,image:200});
  console.log('Browser site save, draft rename/alias, image upload/read/delete OK');
  await evaluate('document.querySelector("#logout").click()');await wait('!document.querySelector("#login-view").hidden');
  assert.equal(await evaluate('(async()=> (await fetch("/api/admin/content")).status)()'),401);
  assert.deepEqual(exceptions,[]);
  console.log('Browser logout and revocation OK; no JavaScript exceptions');
}finally{ws?.close();chrome.kill();await new Promise(r=>chrome.once('exit',r));rmSync(profile,{recursive:true,force:true});}
