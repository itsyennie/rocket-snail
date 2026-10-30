const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {defaults,normalize,patterns,eyes,svg}=require('../src/appearance.js');const {Store}=require('../src/store.cjs');const {validateSettings}=require('../src/settings.cjs');
test('appearance migrates old settings and persists a custom snail across reloads',()=>{
  const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{
    const file=path.join(dir,'state.json');fs.writeFileSync(file,JSON.stringify({settings:{size:.7,motionEnabled:false,rooms:{room:{mode:'all'}}}}));
    const store=new Store(file);assert.deepEqual(store.data.settings.appearance,defaults);
    const custom={base:'mochi',shellPattern:'stars',shellColor:'#b4a0df',patternColor:'#76609e',bodyColor:'#eaa9b7',eyeStyle:'happy'};
    store.data.settings.appearance=normalize(custom,true);store.save();const reopened=new Store(file);assert.deepEqual(reopened.data.settings.appearance,custom);assert.equal(reopened.data.settings.size,.7);assert.equal(reopened.data.settings.motionEnabled,false);assert.equal(reopened.data.settings.rooms.room.mode,'all');
    assert.deepEqual(validateSettings({...reopened.data.settings,baseUrl:"https://chat.example.com"}).appearance,custom);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('appearance accepts only known patterns, eyes and hex colors; unsafe saved values recover',()=>{
  for(const value of [{shellColor:'red" onload="bad'},{shellPattern:'<script>'},{eyeStyle:'unknown'}]){assert.throws(()=>normalize(value,true));assert.deepEqual(normalize(value),defaults);}
  assert.deepEqual(normalize(undefined,true),defaults);assert.equal(normalize({bodyColor:'#ABCDEF'},true).bodyColor,'#abcdef');assert.equal('unexpected' in normalize({unexpected:'bad'}),false);
});
test('all shell and eye designs produce self-contained SVGs with requested colors',()=>{
  for(const [shellPattern] of patterns)for(const [eyeStyle] of eyes){const a={shellPattern,eyeStyle,shellColor:'#b4a0df',patternColor:'#76609e',bodyColor:'#eaa9b7'},id=`${shellPattern}-${eyeStyle}`,markup=svg(a,id);assert.match(markup,new RegExp(`data-shell-pattern="${shellPattern}"`));assert.match(markup,new RegExp(`data-eye-style="${eyeStyle}"`));assert(markup.includes('fill="#b4a0df"'));assert(markup.includes('fill="#eaa9b7"'));assert(markup.includes(`id="snail-shell-${id}"`));assert(markup.includes(`url(#snail-shell-${id})`));assert(!/script|onload=|https?:\/\//.test(markup.replace('http://www.w3.org/2000/svg','')));}
});

test('both pixel bases preserve independent customization and reject unknown bases',()=>{for(const base of ['mochi','goth']){const a=normalize({base,bodyColor:'#123456',shellColor:'#abcdef',eyeStyle:'happy',shellPattern:'stripes'},true);assert.equal(a.base,base);assert.equal(a.bodyColor,'#123456');assert.equal(a.eyeStyle,'happy');assert.match(svg(a),/shape-rendering="crispEdges"/);assert.match(svg(a),new RegExp('data-base="'+base+'"'));}assert.throws(()=>normalize({base:'unknown'},true));assert.equal(normalize({bodyColor:'#123456'}).base,'mochi');});

test('legacy appearance without base preserves account, rules, queues and colors',()=>{const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{const file=path.join(dir,'state.json'),legacy={settings:{baseUrl:'https://chat.example.com',userId:'fictional-user',rooms:{demo:{mode:'all'}},keywords:[{term:'검토',kind:'contains'}],size:.85,startup:true,appearance:{shellColor:'#abcdef',bodyColor:'#fedcba',patternColor:'#123456',shellPattern:'dots',eyeStyle:'happy'}},items:{demo:{id:'demo',text:'가상 메시지'}},archive:[]};fs.writeFileSync(file,JSON.stringify(legacy));fs.writeFileSync(path.join(dir,'credential.bin'),'opaque-fixture');const store=new Store(file);store.save();const reread=new Store(file);assert.equal(reread.data.settings.appearance.base,'mochi');for(const [key,value] of Object.entries(legacy.settings.appearance))assert.equal(reread.data.settings.appearance[key],value);for(const key of ['baseUrl','userId','rooms','keywords','size','startup'])assert.deepEqual(reread.data.settings[key],legacy.settings[key]);assert.deepEqual(reread.data.items,legacy.items);assert.equal(fs.readFileSync(path.join(dir,'credential.bin'),'utf8'),'opaque-fixture');}finally{fs.rmSync(dir,{recursive:true,force:true});}});
