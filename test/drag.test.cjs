const test=require('node:test'),assert=require('node:assert/strict');
const {layout,beginDrag,moveDrag,savedPosition,restorePosition}=require('../src/desktop.cjs');
const area={x:0,y:0,width:1920,height:1040};

test('multiple bubbles grow upward, stay separate from pet and fit all monitor edges',()=>{
 for(const count of [2,5,20])for(const scale of [.7,1,1.5])for(const top of [0,400,1040]){
  const g=layout(area,600,scale,top,count);
  assert(g.bubbleHeight>0&&g.bubbleHeight<=392);
  assert(g.bubbleTop>=0&&g.bubbleTop+g.bubbleHeight<=g.bounds.height);
  assert(g.bubbleTop+g.bubbleHeight<=g.petTop||g.bubbleTop>=g.petTop+g.petSize);
  assert(g.bounds.y>=0&&g.bounds.y+g.bounds.height<=1040);
 }
 const bottom=layout(area,600,1,null,5);assert.equal(bottom.bubbleHeight,392);assert(bottom.bubbleTop<bottom.petTop);
 const top=layout(area,600,1,0,5);assert(top.bubbleTop>=top.petTop+top.petSize);
});
test('stationary coordinates never accumulate rounding drift at every size from 70% to 150%',()=>{
  for(let percent=70;percent<=150;percent++)for(const a of [area,{x:-1919,y:-200,width:1919,height:1080}]){
    const scale=percent/100;let x=a.x+500.5,y=a.y+300.5;
    const first=layout(a,x,scale,y);x=first.bounds.x+first.petLeft;y=first.bounds.y+first.petTop;const expected={x,y};
    for(let frame=0;frame<120;frame++){const g=layout(a,x,scale,y);x=g.bounds.x+g.petLeft;y=g.bounds.y+g.petTop;assert.deepEqual({x,y},expected,`size ${percent}%, frame ${frame}`);}
  }
});
test('small click jitter does not start a drag or move the snail',()=>{const drag=beginDrag({x:100,y:900},{x:120,y:920});assert.deepEqual(moveDrag(drag,{x:122,y:922},area),{x:100,y:900});assert.equal(drag.moved,false);});
test('drag preserves grab offset and moves on both axes, including when motion is off',()=>{const drag=beginDrag({x:100,y:900},{x:120,y:920});assert.deepEqual(moveDrag(drag,{x:420,y:420},area),{x:400,y:400});assert.equal(drag.moved,true);assert.deepEqual(moveDrag(drag,{x:120,y:920},area),{x:100,y:900});assert.equal(drag.moved,true);});
test('drag clamps to monitor work area and supports negative monitor coordinates',()=>{const drag=beginDrag({x:100,y:900},{x:120,y:920});assert.deepEqual(moveDrag(drag,{x:5000,y:5000},area,1.5),{x:1785,y:905});const other={x:-1920,y:-200,width:1920,height:1080};assert.deepEqual(moveDrag(drag,{x:-5000,y:-5000},other,1.5),{x:-1920,y:-200});});
test('bubble remains visible above or below a snail placed at screen edges',()=>{for(const scale of [.7,1,1.5])for(const top of [-100,0,400,2000]){const g=layout(area,600,scale,top);assert(g.bounds.y+g.petTop>=area.y);assert(g.bounds.y+g.petTop+g.petSize<=1040);assert(g.bubbleTop>=0);assert(g.bubbleTop+72<=g.bounds.height);assert(g.bubbleTop+72<=g.petTop||g.bubbleTop>=g.petTop+g.petSize);}});
test('drop position restores across screen-size and scale changes',()=>{const stored=savedPosition(area,{x:400,y:500},77,1);assert.equal(stored.displayId,77);assert.deepEqual(restorePosition(area,stored,1),{x:400,y:500});const smaller={x:-1440,y:0,width:1440,height:800};const restored=restorePosition(smaller,stored,1.5);assert(restored.x>=smaller.x&&restored.x<=-135);assert(restored.y>=0&&restored.y<=665);assert.deepEqual(restorePosition(area,null),{x:960,y:null});});
