const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {UpdateChecker,compare,newest,REPO,API}=require('../src/updates.cjs');
function row(tag='v0.2.10',extra={}){const name=`rocket-snail-${tag.slice(1)}-windows-x64.zip`;return {tag_name:tag,draft:false,prerelease:true,html_url:`${REPO}/releases/tag/${tag}`,assets:[{name,state:'uploaded',size:10,browser_download_url:`${REPO}/releases/download/${tag}/${name}`}],...extra};}
test('version comparison handles numeric ordering, prereleases and invalid tags',()=>{
 assert.equal(compare('v0.2.10','0.2.9'),1);assert.equal(compare('0.2.10','0.2.10-dev.1'),1);assert.equal(compare('1.0.0-rc.10','1.0.0-rc.2'),1);assert.equal(compare('1.0.0+build','1.0.0'),0);assert.equal(compare('v01.2.3','1.2.3'),null);
});
test('only published newer official Windows packages qualify, including test releases',()=>{
 const malicious=row('v9.0.0',{html_url:'https://evil.example/'});
 const wrongAsset=row('v8.0.0');wrongAsset.assets[0].browser_download_url='https://evil.example/payload';
 assert.equal(newest([row('v0.2.9'),row('v0.2.11',{draft:true}),row('v0.2.12',{assets:[]}),row(),malicious,wrongAsset],'0.2.9').tag,'v0.2.10');
 assert.equal(newest([row('v0.2.9')],'0.2.9'),null);assert.throws(()=>newest({},'0.2.9'));
});
test('checks are unauthenticated GETs, deduplicated and throttled; notifications persist across restart',async()=>{
 const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{
  let requests=0,notifications=0,now=100000;const file=path.join(dir,'updates.json');
  const options={current:'0.2.9',file,now:()=>now,notify:()=>{notifications++;return true;},fetchImpl:async(url,opts)=>{requests++;assert.equal(url,API);assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');assert(!Object.keys(opts.headers).some(k=>/auth|token|user/i.test(k)));return {ok:true,json:async()=>[row()]};}};
  const checker=new UpdateChecker(options);await Promise.all([checker.check(),checker.check()]);assert.equal(requests,1);assert.equal(notifications,1);await checker.check(true);assert.equal(requests,1);
  checker.dismiss();assert.equal(checker.view().available,false);
  const restarted=new UpdateChecker(options);await restarted.check();assert.equal(restarted.view().available,false);assert.equal(notifications,1);
  now+=60001;await restarted.check(true);assert.equal(restarted.view().available,true);assert.equal(notifications,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('new releases notify again; offline/rate-limit failures preserve prior update without crashing',async()=>{
 const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{
  let tag='v0.2.10',now=100000,fail=false,count=0;const checker=new UpdateChecker({current:'0.2.9',file:path.join(dir,'updates.json'),now:()=>now,notify:()=>{count++;return true;},fetchImpl:async()=>{if(fail)throw Error('network');return {ok:true,json:async()=>[row(tag)]};}});
  await checker.check();checker.dismiss();tag='v0.2.11';now+=60001;await checker.check();assert.equal(count,2);assert.equal(checker.view().available,true);
  now+=60001;fail=true;await checker.check();assert.equal(checker.view().error,true);assert.equal(checker.view().latest.tag,'v0.2.11');assert.equal(count,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('stopped checker ignores late responses and does not notify',async()=>{
 let resolve,notifications=0;const checker=new UpdateChecker({current:'0.2.9',file:'unused',notify:()=>{notifications++;return true;},fetchImpl:()=>new Promise(r=>resolve=r)});
 const pending=checker.check();checker.stop();resolve({ok:true,json:async()=>[row()]});await pending;assert.equal(notifications,0);assert.equal(checker.view().latest,null);
});
