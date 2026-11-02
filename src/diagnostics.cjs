const fs=require('node:fs'),path=require('node:path');
const allowed=new Set(['phase','reason','type','code','errorName','visible','tokenRestored','registered','enabled','count','startup','version','pid','parentPid','uptimeSeconds','exitCode','site','delayMs']);
function errorDetails(error){
 // Do not record error messages or full stacks: those can include chat, URLs or tokens.
 const match=String(error?.stack||'').match(/[\\/]src[\\/]([a-z0-9_-]+\.(?:cjs|js)):(\d+):(\d+)/i);
 return {errorName:error?.name,code:error?.code,...(match?{site:`${match[1]}:${match[2]}:${match[3]}`}:{})};
}
function createDiagnostics(file){
 return (event,details={})=>{try{
  const entry={time:new Date().toISOString(),event};
  for(const [key,value] of Object.entries(details))if(allowed.has(key)&&['string','number','boolean'].includes(typeof value))entry[key]=typeof value==='string'?value.slice(0,100):value;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  if(fs.existsSync(file)&&fs.statSync(file).size>256*1024)fs.renameSync(file,file+'.previous');
  fs.appendFileSync(file,JSON.stringify(entry)+'\n',{mode:0o600});
 }catch{/* Diagnostics must never prevent startup or recovery. */}};
}
function diagnosticReport(profile,version){
 const events=[];
 for(const name of ['app.log.previous','app.log','recovery.log.previous','recovery.log']){
  try{for(const line of fs.readFileSync(path.join(profile,name),'utf8').split('\n')){
   try{const item=JSON.parse(line);if(!/^\d{4}-\d{2}-\d{2}T/.test(item.time)||!/^[-a-z]+$/.test(item.event))continue;
    const clean={time:item.time,event:item.event};for(const key of allowed)if(['string','number','boolean'].includes(typeof item[key]))clean[key]=item[key];events.push(clean);
   }catch{}
  }}catch{}
 }
 events.sort((a,b)=>a.time.localeCompare(b.time));
 return `Rocket Snail ${version} · ${process.platform} ${process.arch}\n`+
 '진단 기록: 오류 종류·앱 코드 위치·프로세스 종료·복구 결과\n'+
 '오류 직전 기록만 남은 경우 강제 종료/OS 종료/외부 프로그램 종료를 이 기록만으로 구분할 수 없습니다.\n'+
 'uncaught-error / unhandled-rejection: 앱 오류, renderer-gone: 화면 프로세스 종료\n'+
 'recovery-parent-gone: 주 프로세스 사라짐, recovery-cooldown: 반복 오류 후 대기, recovery-launched: 재실행\n'+
 'quit-requested: 직접 종료, session-ending: Windows 세션 종료\n\n'+events.slice(-400).map(e=>JSON.stringify(e)).join('\n')+'\n';
}
module.exports={createDiagnostics,errorDetails,diagnosticReport};
