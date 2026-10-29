import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshRecords,updateReview,filterRecords,report} from '../src/model.js';
import {JSDOM,VirtualConsole} from 'jsdom';
import React,{act} from 'react';
import {App} from '../.ssr/entry-server.js';
test('Confirmed dependencies, mapping gaps, review safety and export',()=>{
 let r=freshRecords();for(const id of ['WO-218','WO-221','PO-731','QC-07'])assert.equal(r.find(x=>x.id===id).impact,'Review required');
 assert.equal(r.find(x=>x.id==='WO-229').impact,'Unaffected');assert.match(r.find(x=>x.id==='WO-235').impact,/unknown/);
 r=updateReview(r,'WO-218','assign','Alex Morgan · Engineering (fictional)');assert.equal(r[0].status,'Assigned for review');
 r=updateReview(r,'WO-218','note','Review coating source');r=updateReview(r,'WO-218','acknowledge');assert.equal(r[0].status,'Acknowledged');assert.equal(r[0].implemented,false);
 r=updateReview(r,'WO-218','decision','Purchasing review needed');assert.equal(r[0].status,'Decision recorded');assert.equal(r[0].implemented,false);
 r=updateReview(r,'WO-235','acknowledge');assert.match(r.find(x=>x.id==='WO-235').impact,/unknown/);
 assert.equal(filterRecords(r,'Orders','WO-221','All types','All statuses').length,1);
 assert.equal(filterRecords(r,'Review Tasks','','All types','All statuses').length,5);
 const exported=report(r);assert.match(exported.title,/SAMPLE/);assert.equal(exported.records.length,6);assert.match(exported.records[3].impact,/unknown/);assert.equal(exported.records[4].status,'Impact identified');assert.ok(exported.records.every(x=>!x.implemented));assert.equal(freshRecords()[0].owner,'');
});
test('Prerendered content, routes, metadata, favicon assets and review indexing',()=>{
 for(const path of ['index.html','privacy/index.html','terms/index.html','brand/index.html','404.html']){const html=fs.readFileSync('dist/'+path,'utf8');assert.match(html,/noindex,nofollow/);assert.match(html,/https:\/\/revwake.space/);assert.match(html,/femi@revwake.space/);assert.match(html,/canonical/);}
 const html=fs.readFileSync('dist/index.html','utf8');for(const text of ['The specification changed.','Femi Adebisi','Ridwan Adisa','Founder &amp; CEO','Co-founder &amp; CTO','The People Building Revwake','Zinc plating','Powder coating'])assert.ok(html.includes(text),text);
 const dom=new JSDOM(fs.readFileSync('dist/brand/index.html','utf8'));for(const a of dom.window.document.querySelectorAll('a[download]'))assert.ok(fs.statSync('dist'+a.getAttribute('href')).size>0);
 assert.match(fs.readFileSync('dist/robots.txt','utf8'),/Disallow: \//);
 for(const [name,w,h] of [['favicon-16.png',16,16],['favicon-32.png',32,32],['apple-touch-icon.png',180,180],['social-preview.png',1200,630]]){const b=fs.readFileSync('dist/brand/'+name);assert.equal(b.readUInt32BE(16),w);assert.equal(b.readUInt32BE(20),h);}
 assert.match(fs.readFileSync('dist/404.html','utf8'),/404 \/ RECORD NOT FOUND/);
});
test('React DOM interactions: menu, tabs, searches, filters, details, review, export, reset and contact',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://revwake.space/',virtualConsole:new VirtualConsole()});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.FormData=dom.window.FormData;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});let copied='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{copied=t;}}});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let downloaded='';let payload;globalThis.URL.createObjectURL=b=>{payload=b;return 'blob:sample';};globalThis.URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};
 const {createRoot}=await import('react-dom/client');
 const root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(App,{path:'/'})));
 const click=async el=>{assert.ok(el,'click target exists');await act(async()=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}))); };
 const button=t=>[...document.querySelectorAll('button')].find(x=>x.textContent.includes(t));
 const change=async(el,value)=>{await act(async()=>{el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});};
 await click(document.querySelector('[aria-label="Open menu"]'));assert.equal(document.querySelector('.menu').getAttribute('aria-expanded'),'true');await click(document.querySelector('#navigation a[href="/#leadership"]'));assert.equal(document.querySelector('.menu').getAttribute('aria-expanded'),'false');
 await click(button('Orders'));assert.equal(document.querySelectorAll('tbody tr').length,4);
 await change(document.querySelector('[aria-label="Filter record type"]'),'Material');assert.match(document.querySelector('.empty').textContent,/No matching/);
 await click(button('Materials'));assert.equal(document.querySelectorAll('tbody tr').length,1);assert.match(document.querySelector('tbody').textContent,/PO-731/);
 await click(button('Review Tasks'));assert.equal(document.querySelectorAll('tbody tr').length,5);
 await click(document.querySelector('[aria-label="Open WO-218"]'));assert.ok(document.querySelector('dialog').open);assert.match(document.querySelector('.dependency').textContent,/SP-204 Rev C.*WO-218/);
 await change(document.querySelector('dialog select'),'Alex Morgan · Engineering (fictional)');assert.match(document.querySelector('dialog').textContent,/Assigned for review/);
 // Textareas use native value setter + input to exercise React controlled fields.
 async function input(el,value){await act(async()=>{const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
 await input(document.querySelector('dialog textarea'),'Check revised coating');await click(button('Add note'));assert.match(document.querySelector('.note').textContent,/Check revised coating/);
 await click(button('Record acknowledgement'));assert.match(document.querySelector('dialog').textContent,/Acknowledged/);assert.match(document.querySelector('.safety').textContent,/not verified/);
 await click(document.querySelector('[aria-label="Close record"]'));assert.ok(!document.querySelector('dialog'));
 await click(button('Export sample report'));assert.equal(downloaded,'revwake-sample-impact-report.json');const data=JSON.parse(await payload.text());assert.equal(data.records[0].status,'Acknowledged');assert.match(data.records[3].impact,/unknown/);assert.ok(data.records.every(x=>!x.implemented));
 await click(document.querySelector('[aria-label="Open WO-218"]'));await input(document.querySelectorAll('dialog textarea')[1],'Purchasing must review the coating order');await click(button('Record review decision'));assert.match(document.querySelector('dialog').textContent,/Decision recorded/);await click(document.querySelector('[aria-label="Close record"]'));
 await change(document.querySelector('[aria-label="Filter review status"]'),'Decision recorded');assert.equal(document.querySelectorAll('tbody tr').length,1);assert.match(document.querySelector('tbody').textContent,/WO-218/);
 await click(button('Reset'));assert.equal(document.querySelectorAll('tbody tr').length,6);assert.match(document.querySelector('[role="status"]').textContent,/reset/);
 const search=document.querySelector('[aria-label="Search records"]');await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(search,'WO-221');search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});assert.equal(document.querySelectorAll('tbody tr').length,1);assert.match(document.querySelector('tbody').textContent,/WO-221/);
 const form=document.querySelector('form');form.elements.name.value='Sample reviewer';form.elements.email.value='reviewer@example.com';form.elements.company.value='Sample manufacturing';form.elements.challenge.value='Finish revisions';await click(button('Copy message'));assert.match(copied,/Sample reviewer/);assert.equal(form.elements.name.value,'Sample reviewer');assert.match(document.querySelector('.email-link').href,/mailto:femi@revwake.space/);
 await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.match(form.querySelector('.form-error').textContent,/agree/);assert.doesNotMatch(form.querySelector('[role="status"]').textContent,/Email draft prepared/);form.elements.consent.checked=true;await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.match(form.querySelector('[role="status"]').textContent,/Email draft prepared/);assert.equal(form.elements.name.value,'Sample reviewer');
 navigator.clipboard.writeText=async()=>{throw new Error('Clipboard unavailable')};await click(button('Copy message'));assert.match(form.querySelector('[role="status"]').textContent,/Select and copy/);assert.match(form.querySelector('textarea[readonly]').value,/Sample reviewer/);
 await act(async()=>root.unmount());dom.window.close();
});
