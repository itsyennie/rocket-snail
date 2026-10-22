const test=require('node:test'),assert=require('node:assert/strict');
const {historyRequest,messageUrl,serverUrl}=require('../src/protocol.cjs');
const {RocketClient}=require('../src/rocket.cjs');const {layout}=require('../src/desktop.cjs');
const {validateSettings}=require('../src/settings.cjs');const {matchMessage}=require('../src/rules.cjs');
test('room-only keywords preserve inherited message defaults and existing explicit modes',()=>{
  const s=validateSettings({baseUrl:'https://chat.example.com',defaultMode:'ignore',dmMode:'all',rooms:{a:{keywords:[{term:'검토',kind:'contains'}]},b:{mode:'all',keywords:[]}}});
  assert.equal(s.rooms.a.mode,undefined);assert.equal(s.rooms.a.keywords[0].term,'검토');assert.equal(s.rooms.b.mode,'all');
  const message={_id:'m1',rid:'a',msg:'검토 요청',u:{_id:'other'}};
  assert.equal(matchMessage(message,{rid:'a',t:'c'},s,'me'),null);
  s.defaultMode='mentions';assert.equal(matchMessage(message,{rid:'a',t:'c'},s,'me').reason,'keyword');
});
test('8.5 uses public/private/DM legacy GET history; 8.9 uses cursor API',()=>{
  for(const [t,endpoint] of [['c','channels.history'],['p','groups.history'],['d','im.history']]){const q=historyRequest('8.5',{rid:'r',t},{oldest:'a',latest:'b'},{offset:37});assert.equal(q.endpoint,endpoint);assert.equal(q.params.offset,37);assert.equal(q.params.showThreadMessages,true)}
  assert.equal(historyRequest('8.9.0',{rid:'r'},{},{cursor:'123'}).params.previous,'123');
});
test('legacy backfill survives API page caps and resumes after bounded work',async()=>{
  const seen=[];const messages=Array.from({length:12},(_,i)=>({_id:`m${i}`,rid:'r',msg:'hello',ts:new Date(2000+i*1000).toISOString(),u:{_id:'other'}}));
  const store={data:{settings:{baseUrl:'https://example.com',userId:'me',defaultMode:'all'},items:{}},add:m=>{seen.push(m._id);return true}};
  const requests=[];const c=new RocketClient(store,()=>'',{fetchImpl:async(url,options)=>{requests.push({url,options});const offset=Number(url.searchParams.get('offset'));return {ok:true,json:async()=>({messages:messages.slice(offset,offset+2)})}}});
  c.version='8.5';c.rooms={r:{rid:'r',t:'c',name:'test'}};c.subs={r:{ls:new Date(0).toISOString()}};
  assert.equal(await c.backfill(c.rooms.r,0),false);assert.equal(c.jobs.get('r').offset,10);
  assert.equal(await c.backfill(c.rooms.r,0),true);assert.equal(new Set(seen).size,12);assert.equal(c.jobs.size,0);
  assert(requests.every(r=>r.options.method==='GET'&&r.options.redirect==='error'));
  assert.equal(new Set(requests.map(r=>r.url.searchParams.get('latest'))).size,1);
});
test('write endpoints and credential-bearing addresses are rejected',async()=>{
  const c=new RocketClient({data:{settings:{}}},()=>'',{fetchImpl:()=>{throw Error('must not fetch')}});
  await assert.rejects(c.api('subscriptions.read'),/읽기 전용/);assert.throws(()=>serverUrl('https://user:password@example.com'));assert.throws(()=>serverUrl('http://example.com'));
});
test('original message URLs encode channel name; DM uses stable room ID',()=>{
  const channel=new URL(messageUrl('https://chat.example.com',{id:'m1',roomType:'c',roomName:'team name',rid:'r'}));assert.equal(channel.pathname,'/channel/team%20name');assert.equal(channel.searchParams.get('msg'),'m1');
  assert.match(messageUrl('https://chat.example.com',{id:'m1',roomType:'d',rid:'userid1userid2',room:'표시 이름'}),/\/direct\/userid1userid2\?msg=m1$/);
});
test('pet touches both work-area edges even on a negative-coordinate monitor',()=>{
  const area={x:-1920,y:0,width:1920,height:1040};
  for(const size of [.7,1,1.5]){const left=layout(area,area.x,size),right=layout(area,0,size);assert.equal(left.bounds.x+left.petLeft,area.x);assert.equal(right.bounds.x+right.petLeft+right.petSize,0);assert.equal(left.bounds.y+left.bounds.height,1040);}
});
