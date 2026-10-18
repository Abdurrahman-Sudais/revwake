import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {insertBefore,scriptElement} from '../scripts/embedding.mjs';
const syntax=source=>{const r=spawnSync(process.execPath,['--check','--input-type=module'],{input:source,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
test('Literal replacement tokens and closing-script strings survive embedding',()=>{
 const source="const tokens = [\"$`\", \"$'\", \"$&\", \"$$\", \"</ScRiPt>\"];";
 const html=insertBefore('<!doctype html><html><body></body></html>','</body>',scriptElement(source));
 assert.equal((html.match(/<!doctype html>/gi)||[]).length,1);
 const dom=new JSDOM(html);const scripts=dom.window.document.querySelectorAll('script');assert.equal(scripts.length,1);
 syntax(scripts[0].textContent);assert.deepEqual(Function(scripts[0].textContent+'return tokens;')(),['$`',"$'",'$&','$$','</ScRiPt>']);
});
test('Final standalone HTML has one document and its extracted module parses',()=>{
 const html=fs.readFileSync('Revwake-review.html','utf8');
 for(const re of [/<!doctype html>/gi,/<html\b/gi,/<head\b/gi,/<body\b/gi])assert.equal((html.match(re)||[]).length,1,String(re));
 const dom=new JSDOM(html);const modules=dom.window.document.querySelectorAll('script[type="module"]');assert.equal(modules.length,1);assert.ok(!modules[0].src);syntax(modules[0].textContent);
 assert.equal(dom.window.document.querySelectorAll('html').length,1);assert.equal(dom.window.document.querySelectorAll('head').length,1);assert.equal(dom.window.document.querySelectorAll('body').length,1);
});
test('Production routes and every emitted JavaScript bundle parse independently',()=>{
 for(const path of ['index.html','privacy/index.html','terms/index.html','brand/index.html','404.html']){const html=fs.readFileSync('dist/'+path,'utf8');assert.equal((html.match(/<!doctype html>/gi)||[]).length,1);const dom=new JSDOM(html);assert.equal(dom.window.document.querySelectorAll('script[type="module"][src]').length,1);assert.equal(dom.window.document.querySelectorAll('script[type="module"]:not([src])').length,0);}
 for(const f of fs.readdirSync('dist/assets').filter(f=>f.endsWith('.js')))syntax(fs.readFileSync('dist/assets/'+f,'utf8'));
});
test('Optional internal QA and setup documents are not public build assets or links',()=>{
 assert.ok(fs.existsSync('internal/QA.md'));
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
 const files=walk('dist');assert.ok(!files.some(p=>/\.(md|zip)$/i.test(p)||p.includes('/internal/')));
 for(const f of files.filter(p=>p.endsWith('.html'))){const dom=new JSDOM(fs.readFileSync(f,'utf8'));for(const a of dom.window.document.querySelectorAll('a[href]'))assert.ok(!/QA\.md|HANDOVER\.md|README\.md|\/internal\//i.test(a.getAttribute('href')));}
});
