const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {normalizePlacement,chooseDisplay,snapToEdge,advanceAlongEdge,orientation}=require('../src/placement.cjs');const {Store}=require('../src/store.cjs');
const area={x:-1920,y:40,width:1920,height:1000};
test('selected monitor is used, with primary fallback when disconnected',()=>{const displays=[{id:1},{id:2}];assert.equal(chooseDisplay(displays,1,'2').id,2);assert.equal(chooseDisplay(displays,1,'primary').id,1);assert.equal(chooseDisplay(displays,1,'99').id,1);assert.deepEqual(normalizePlacement({displayId:2,edge:'top'},true),{displayId:'2',edge:'top'});});
test('placement accepts only monitor identifiers and supported edges',()=>{assert.throws(()=>normalizePlacement({displayId:'https://other',edge:'top'},true));assert.throws(()=>normalizePlacement({displayId:'1',edge:'diagonal'},true));assert.deepEqual(normalizePlacement(),{displayId:'primary',edge:'bottom'});});
test('each wall locks the normal axis, moves along the wall and reverses at the endpoint',()=>{
  for(const edge of ['bottom','top','left','right']){
    const start=snapToEdge(area,{x:-1000,y:500},1,edge),next=advanceAlongEdge(area,start,1,edge,1,false),vertical=['left','right'].includes(edge);
    assert.equal(next[vertical?'x':'y'],start[vertical?'x':'y']);assert(next[vertical?'y':'x']>start[vertical?'y':'x']);
    const end=snapToEdge(area,{x:-90,y:950},1,edge),bounce=advanceAlongEdge(area,end,1,edge,1,false);assert.equal(bounce.direction,-1);
  }
});
test('hover/settings pause never drifts along any wall at all sprite sizes',()=>{
  for(let p=70;p<=150;p++)for(const edge of ['bottom','top','left','right','free']){
    let state=snapToEdge(area,{x:-1000.5,y:500.5},p/100,edge);const origin={...state};
    for(let i=0;i<40;i++){state=advanceAlongEdge(area,state,p/100,edge,-1,true);assert.equal(state.x,origin.x);assert.equal(state.y,origin.y);assert.equal(state.direction,-1);}
  }
});
test('rotations put feet on the chosen wall and face the walking direction',()=>{
  const feet={bottom:[0,1],top:[0,-1],left:[-1,0],right:[1,0],free:[0,1]};
  for(const edge of Object.keys(feet))for(const direction of [-1,1]){const o=orientation(edge,direction),r=o.rotation*Math.PI/180,foot=[-Math.sin(r),Math.cos(r)],head=[o.mirror*Math.cos(r),o.mirror*Math.sin(r)],travel=['left','right'].includes(edge)?[0,direction]:[direction,0];assert(foot.every((v,i)=>Math.abs(v-feet[edge][i])<1e-9));assert(head.every((v,i)=>Math.abs(v-travel[i])<1e-9));}
});
test('saved placement survives restart and existing dragged locations migrate to free placement',()=>{
  const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{const file=path.join(dir,'state.json');fs.writeFileSync(file,JSON.stringify({desktopPosition:{displayId:2,x:.3,y:.4}}));const store=new Store(file);assert.deepEqual(store.data.desktopPlacement,{displayId:'2',edge:'free'});store.data.desktopPlacement={displayId:'2',edge:'right'};store.save();assert.deepEqual(new Store(file).data.desktopPlacement,{displayId:'2',edge:'right'});}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
