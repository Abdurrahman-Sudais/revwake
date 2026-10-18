import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
const pause=()=>new Promise(resolve=>setTimeout(resolve,25));
async function launch(html,url,source){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',(...args)=>errors.push(args.join(' ')));
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 w.structuredClone=structuredClone;w.Blob=Blob;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){w.lastScroll=this.id;};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.URL.createObjectURL=b=>{w.exportBlob=b;return 'blob:sample';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){w.downloadName=this.download;};
 w.eval('"use strict";\n'+source);await pause();
 const d=w.document;
 const click=async el=>{assert.ok(el,'click target');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));await pause();};
 const button=t=>[...d.querySelectorAll('button')].find(b=>b.textContent.includes(t));
 const change=async(el,value)=>{assert.ok(el);el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));await pause();};
 const input=async(el,value)=>{assert.ok(el);const klass=el.tagName==='TEXTAREA'?w.HTMLTextAreaElement:w.HTMLInputElement;Object.getOwnPropertyDescriptor(klass.prototype,'value').set.call(el,value);el.dispatchEvent(new w.Event('input',{bubbles:true}));await pause();};
 return {dom,w,d,errors,click,button,change,input};
}
async function workflow(ctx){const {w,d,click,button,change,input}=ctx;
 assert.match(d.querySelector('h1').textContent,/The specification changed/);
 await click(d.querySelector('[aria-label="Open menu"]'));assert.equal(d.querySelector('.menu').getAttribute('aria-expanded'),'true');
 await click(d.querySelector('#navigation a[href="/#leadership"]'));assert.equal(d.querySelector('.menu').getAttribute('aria-expanded'),'false');
 assert.match(d.querySelector('#leadership').textContent,/Femi Adebisi/);assert.match(d.querySelector('#leadership').textContent,/Ridwan Adisa/);
 await click(button('Orders'));assert.equal(d.querySelectorAll('tbody tr').length,4);
 await input(d.querySelector('[aria-label="Search records"]'),'WO-221');assert.equal(d.querySelectorAll('tbody tr').length,1);
 await input(d.querySelector('[aria-label="Search records"]'),'no-such-record');assert.ok(d.querySelector('.empty'));
 await click(button('Review Tasks'));assert.equal(d.querySelectorAll('tbody tr').length,5);
 await change(d.querySelector('[aria-label="Filter record type"]'),'Inspection');assert.match(d.querySelector('tbody').textContent,/QC-07/);assert.equal(d.querySelectorAll('tbody tr').length,1);
 await click(button('Changes'));assert.match(d.querySelector('.revision').textContent,/Zinc plating/);assert.match(d.querySelector('.revision').textContent,/Powder coating/);
 await click(d.querySelector('[aria-label="Open WO-218"]'));assert.ok(d.querySelector('dialog').open);assert.match(d.querySelector('.dependency').textContent,/SP-204 Rev C.*WO-218/);
 await change(d.querySelector('dialog select'),'Alex Morgan · Engineering (fictional)');assert.match(d.querySelector('dialog').textContent,/Assigned for review/);
 await input(d.querySelector('dialog textarea'),'Check coating instructions');await click(button('Add note'));assert.match(d.querySelector('.note').textContent,/Check coating instructions/);
 await click(button('Record acknowledgement'));assert.match(d.querySelector('dialog').textContent,/Acknowledged/);assert.match(d.querySelector('.safety').textContent,/not verified/);
 await click(d.querySelector('[aria-label="Close record"]'));await change(d.querySelector('[aria-label="Filter review status"]'),'Acknowledged');assert.equal(d.querySelectorAll('tbody tr').length,1);
 await click(button('Export sample report'));assert.equal(w.downloadName,'revwake-sample-impact-report.json');const exported=JSON.parse(await w.exportBlob.text());assert.equal(exported.records[0].status,'Acknowledged');assert.equal(exported.records[0].implemented,false);assert.match(exported.records[3].impact,/unknown/);assert.equal(exported.records[4].status,'Impact identified');
 await click(button('Reset'));assert.equal(d.querySelectorAll('tbody tr').length,6);assert.match(d.querySelector('tbody').textContent,/WO-229/);
}
test('Final standalone module executes and its workflow and routes work (emulated DOM)',async()=>{
 const html=fs.readFileSync('Revwake-review.html','utf8');const parsed=new JSDOM(html);const source=parsed.window.document.querySelector('script[type="module"]').textContent;
 const ctx=await launch(html,'file:///Revwake-review.html',source);try{await workflow(ctx);const {d,click,w}=ctx;assert.equal(w.lastScroll,'leadership');
 for(const [path,heading] of [['privacy','Privacy notice'],['terms','Terms of use'],['brand','A revision.']]){await click(d.querySelector(`footer a[href="/${path}"]`));assert.match(d.querySelector('h1').textContent,new RegExp(heading));}
 assert.equal(d.querySelectorAll('a[download]').length,14);for(const a of d.querySelectorAll('a[download]'))assert.match(a.href,/^data:image\//);
 const missing=d.createElement('a');missing.href='/missing-review-page';d.body.append(missing);await click(missing);assert.match(d.querySelector('.not-found').textContent,/404/);await click(d.querySelector('.not-found a'));assert.ok(d.querySelector('#demo'));
 assert.deepEqual(ctx.errors,[],'No captured JS runtime errors');
 }finally{ctx.dom.window.close();}
});
test('Production client hydrates independently and its workflow works (emulated DOM)',async()=>{
 const html=fs.readFileSync('dist/index.html','utf8');const parsed=new JSDOM(html);const src=parsed.window.document.querySelector('script[type="module"]').getAttribute('src');const ctx=await launch(html,'https://revwake.space/',fs.readFileSync('dist'+src,'utf8'));try{await workflow(ctx);assert.deepEqual(ctx.errors,[]);}finally{ctx.dom.window.close();}
});
test('Production client hydrates Privacy, Terms, Brand and genuine 404 content independently',async()=>{
 for(const [file,path,heading] of [['privacy/index.html','/privacy','Privacy notice'],['terms/index.html','/terms','Terms of use'],['brand/index.html','/brand','A revision.'],['404.html','/not-a-real-page','This page isn’t']]){const html=fs.readFileSync('dist/'+file,'utf8');const parsed=new JSDOM(html);const src=parsed.window.document.querySelector('script[type="module"]').getAttribute('src');const ctx=await launch(html,'https://revwake.space'+path,fs.readFileSync('dist'+src,'utf8'));try{assert.ok(ctx.d.querySelector('h1').textContent.includes(heading));assert.deepEqual(ctx.errors,[],path);}finally{ctx.dom.window.close();}}
});
