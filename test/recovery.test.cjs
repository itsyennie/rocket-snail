const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {supervise,recentHistory}=require('../src/recovery.cjs');
function fixture(){const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));const marker=path.join(dir,'running');fs.writeFileSync(marker,'');return {dir,marker,logFile:path.join(dir,'recovery.log'),pid:123,executable:process.execPath};}
test('guardian waits for a live app and does not restart after intentional quit/session end',()=>{
 const f=fixture();try{
  const guard=supervise(f,{manual:true,alive:()=>true,spawn:()=>assert.fail('Unexpected restart')});
  assert.equal(guard.check(),'waiting');fs.unlinkSync(f.marker);assert.equal(guard.check(),'stopped');
 }finally{fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('guardian restarts only the app, preserves profile, and limits repeated failures',()=>{
 const f=fixture(),calls=[];try{
  const guard=supervise({...f,args:['app with spaces']},{manual:true,alive:()=>false,spawn:(...args)=>{calls.push(args);return {on(){},unref(){}};}});
  assert.equal(guard.check(),'restarted');assert.equal(guard.check(),'stopped');assert.equal(calls.length,1);
  assert.deepEqual(calls[0][1].slice(0,2),['app with spaces','--startup']);assert.equal(calls[0][2].env.ELECTRON_RUN_AS_NODE,undefined);
  fs.writeFileSync(f.marker,'');assert.equal(supervise({...f,history:Array(3).fill(Date.now())},{manual:true,alive:()=>false,spawn:()=>assert.fail('Restart loop')}).check(),'limited');
  assert.deepEqual(recentHistory('invalid'),[]);assert.deepEqual(recentHistory(JSON.stringify([1,Date.now()+10000])),[]);
 }finally{fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('separate guardian survives parent termination and launches replacement process',{timeout:15000},async()=>{
 const f=fixture();let parent,guardian;try{
  const report=path.join(f.dir,'restarted'),script=path.join(f.dir,'replacement.cjs');
  fs.writeFileSync(script,`require('node:fs').writeFileSync(${JSON.stringify(report)},'ok');`);
  parent=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  await new Promise((resolve,reject)=>{parent.once('spawn',resolve);parent.once('error',reject);});
  guardian=spawn(process.execPath,[path.resolve(__dirname,'../src/recovery.cjs'),JSON.stringify({...f,pid:parent.pid,args:[script],interval:50})],{stdio:'ignore'});
  await new Promise((resolve,reject)=>{guardian.once('spawn',resolve);guardian.once('error',reject);});
  parent.kill();
  const deadline=Date.now()+8000;while(!fs.existsSync(report)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
  assert.equal(fs.readFileSync(report,'utf8'),'ok');assert(!fs.existsSync(f.marker));
 }finally{parent?.kill();guardian?.kill();await new Promise(r=>setTimeout(r,100));fs.rmSync(f.dir,{recursive:true,force:true});}
});
