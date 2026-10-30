// Run: node --experimental-vm-modules scripts/legal-test.mjs
import {readFileSync} from 'node:fs';
import {SourceTextModule,SyntheticModule} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const seed=JSON.parse(readFileSync(new URL('../functions/_lib/seed.json',import.meta.url)));
async function load(file) {
  const source=new SourceTextModule(readFileSync(file,'utf8'));
  await source.link(name=>{
    const data=JSON.parse(readFileSync(new URL(name,file),'utf8'));
    return new SyntheticModule(['default'],function(){this.setExport('default',data);});
  });
  await source.evaluate();return source.namespace;
}
const render=await load(new URL('../functions/_lib/render.js',import.meta.url));
async function setup(legal) {
  const sql=new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE site (id INTEGER PRIMARY KEY, data TEXT, updated_at TEXT); CREATE TABLE pages (slug TEXT PRIMARY KEY, position INTEGER, data TEXT, updated_at TEXT)');
  sql.prepare('INSERT INTO site VALUES (1,?,null)').run(JSON.stringify({...seed.site,name:'Production custom name'}));
  sql.prepare('INSERT INTO pages VALUES (?,0,?,null)').run('custom',JSON.stringify({title:'Existing production page',published:true}));
  if(legal)sql.prepare('INSERT INTO pages VALUES (?,1,?,null)').run('pravni-informace',JSON.stringify(legal));
  const DB={prepare(query){let args=[];return {bind(...values){args=values;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return sql.prepare(query).run(...args);}};},async batch(stmts){for(const stmt of stmts)await stmt.run();}};
  const db=await load(new URL('../functions/_lib/db.js',import.meta.url));
  await db.ensureDb({DB});return {sql,db,env:{DB}};
}
test('populated production DB receives only the missing legal page and working links',async()=>{
  const {sql,db,env}=await setup();
  assert.equal(JSON.parse(sql.prepare('SELECT data FROM site').get().data).name,'Production custom name');
  assert.equal(JSON.parse(sql.prepare("SELECT data FROM pages WHERE slug='custom'").get().data).title,'Existing production page');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM pages').get().n,2);
  const pages=await db.getPages(env);const site=await db.getSite(env);
  const ctx={site,pages,assets:{},base:'https://example.test',origin:'https://example.test',noindex:false};
  const home=render.renderHome(ctx);
  assert.match(home,/href="\/pravni-informace#osobni-udaje"/);
  assert.match(home,/<nav aria-label="Patička">[\s\S]*href="\/pravni-informace"/);
  const legal=pages.find(p=>p.slug==='pravni-informace');
  assert.match(render.renderPage(ctx,legal),/id="osobni-udaje"/);
});
test('existing edited legal content survives initialization',async()=>{
  const original={...seed.pages.find(p=>p.slug==='pravni-informace'),title:'Custom legal title'};
  const {sql,db,env}=await setup(original);
  assert.equal((await db.getPages(env)).find(p=>p.slug==='pravni-informace').title,'Custom legal title');
  assert.deepEqual(JSON.parse(sql.prepare("SELECT data FROM pages WHERE slug='pravni-informace'").get().data),original);
});
test('unpublished legal draft stays private while existing seed policy is available',async()=>{
  const draft={...seed.pages.find(p=>p.slug==='pravni-informace'),published:false,title:'PRIVATE DRAFT'};
  const {db,env}=await setup(draft);
  const publicLegal=(await db.getPages(env)).find(p=>p.slug==='pravni-informace');
  assert.ok(publicLegal.published);assert.notEqual(publicLegal.title,draft.title);
  const adminLegal=(await db.getPages(env,{includeDrafts:true})).find(p=>p.slug==='pravni-informace');
  assert.equal(adminLegal.title,draft.title);assert.equal(adminLegal.published,false);
});
