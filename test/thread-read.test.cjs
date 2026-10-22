const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Store}=require('../src/store.cjs');const {readDecision}=require('../src/rules.cjs');const {RocketClient}=require('../src/rocket.cjs');
function fixture(fn){const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{const store=new Store(path.join(dir,'state.json'));store.add({_id:'reply',rid:'room',tmid:'parent',ts:{$date:1000},msg:'@me review'},{rid:'room',t:'c'},{reason:'mention'});return fn(store)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
const unread={room:{tunread:['parent'],tunreadUser:['parent'],tunreadGroup:[]}},clear={room:{tunread:[],tunreadUser:[],tunreadGroup:[]}};
test('personal mention thread clears after observed unread-to-clear transition, without room ls',()=>fixture(store=>{
 store.observeThreadReads(unread,2000);assert.equal(store.reconcile(unread,readDecision),false);
 const reopened=new Store(store.file);reopened.observeThreadReads(clear,3000);assert.equal(reopened.reconcile(clear,readDecision),true);assert.equal(reopened.data.archive[0].id,'reply');
}));
test('already clear, missing or malformed thread fields and room ls alone never prove reading',()=>fixture(store=>{
 for(const subs of [clear,{room:{ls:{$date:5000}}},{room:{tunread:'parent'}},{}]){store.observeThreadReads(subs,2000);assert.equal(store.reconcile(subs,readDecision),false)}
 store.observeThreadReads(unread,2000);store.observeThreadReads({room:{ls:{$date:5000}}},3000);assert.equal(store.reconcile({room:{ls:{$date:5000}}},readDecision),false);
}));
test('stale snapshots, group mentions still pending and different threads do not clear replies',()=>fixture(store=>{
 store.observeThreadReads({room:{tunread:['other']}},2000);store.observeThreadReads(clear,3000);assert.equal(store.reconcile(clear,readDecision),false);
 store.observeThreadReads(unread,4000);store.observeThreadReads(clear,4000);assert.equal(store.reconcile(clear,readDecision),false);
 const pendingGroup={room:{tunread:[],tunreadGroup:['parent']}};store.observeThreadReads(pendingGroup,5000);assert.equal(store.reconcile(pendingGroup,readDecision),false);
 store.observeThreadReads(clear,6000);assert.equal(store.reconcile(clear,readDecision),true);
}));
test('local thread confirmation persists, restores and requires fresh read evidence',()=>fixture(store=>{
 store.observeThreadReads(unread,2000);assert.equal(store.confirm('reply'),true);assert.equal(store.confirm('reply'),false);
 const reopened=new Store(store.file);assert.equal(reopened.data.archive[0].archiveReason,'manual');assert.equal(reopened.restore('reply'),true);
 reopened.observeThreadReads(clear,3000);assert.equal(reopened.reconcile(clear,readDecision),false);
 reopened.observeThreadReads(unread,4000);reopened.observeThreadReads(clear,5000);assert.equal(reopened.reconcile(clear,readDecision),true);
}));
test('thread read mutation endpoints stay forbidden',async()=>{
 const client=new RocketClient({data:{settings:{}}},()=>'',{fetchImpl:()=>{throw Error('must not fetch')}});
 for(const endpoint of ['chat.readThread','subscriptions.read'])await assert.rejects(client.api(endpoint),/읽기 전용/);
});
test('user subscription stream updates thread evidence and reconciles immediately',()=>fixture(store=>{
 const client=new RocketClient(store,()=>'',{});store.data.settings.userId='me';
 client.acceptSubscription('updated',{...unread.room,rid:'room',u:{_id:'other'}});assert.equal(store.data.items.reply.threadUnreadObservedAt,undefined);
 client.acceptSubscription('updated',{...unread.room,rid:'room',u:{_id:'me'}});assert(store.data.items.reply.threadUnreadObservedAt);
 store.data.items.reply.threadUnreadObservedAt-=1;
 client.acceptSubscription('updated',{...clear.room,rid:'room',u:{_id:'me'}});assert.equal(store.data.items.reply,undefined);assert.equal(store.data.archive.length,1);
}));
test('REST snapshot cannot overwrite a newer realtime subscription update',async()=>{
 const observations=[],store={data:{settings:{userId:'me',defaultMode:'ignore',rooms:{}}},observeThreadReads:s=>observations.push(s.room),reconcile:()=>false};
 const client=new RocketClient(store,()=>'',{});client.running=true;
 let release;const response=new Promise(r=>release=r);
 client.api=async endpoint=>endpoint==='rooms.get'?{update:[{_id:'room',t:'c'}]}:response;
 const polling=client.sync();const latest={rid:'room',tunread:['parent'],tunreadUser:['parent'],u:{_id:'me'}};
 client.acceptSubscription('updated',latest);release({update:[{rid:'room',tunread:[],t:'c'}]});await polling;
 assert.equal(client.subs.room,latest);assert.equal(observations.at(-1),latest);
});
