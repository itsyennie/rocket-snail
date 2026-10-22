const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {defaults,normalize,patterns,eyes,svg}=require('../src/appearance.js');const {Store}=require('../src/store.cjs');const {validateSettings}=require('../src/settings.cjs');
test('appearance migrates old settings and persists a custom snail across reloads',()=>{
  const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{
    const file=path.join(dir,'state.json');fs.writeFileSync(file,JSON.stringify({settings:{size:.7,motionEnabled:false,rooms:{room:{mode:'all'}}}}));
    const store=new Store(file);assert.deepEqual(store.data.settings.appearance,defaults);
    const custom={shellPattern:'stars',shellColor:'#b4a0df',patternColor:'#76609e',bodyColor:'#eaa9b7',eyeStyle:'happy'};
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
