// A separate Node process survives an unexpected Electron main-process exit.
// Intentional exit/session end removes the marker so it never resurrects Quit.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const WINDOW_MS=10*60*1000,MAX_RESTARTS=3;
function recentHistory(value,now=Date.now()){
 let entries;try{entries=JSON.parse(value||'[]');}catch{entries=[];}
 return Array.isArray(entries)?entries.filter(t=>Number.isFinite(t)&&t<=now&&now-t<WINDOW_MS).slice(-MAX_RESTARTS):[];
}
function alive(pid){try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}}
function remove(file){try{fs.unlinkSync(file);}catch{}}
function supervise({pid,marker,executable,args=[],history=[],logFile,interval=2000},deps={}){
 const record=deps.record||require('./diagnostics.cjs').createDiagnostics(logFile);
 const isAlive=deps.alive||alive,launch=deps.spawn||spawn;
 function check(){
  if(!fs.existsSync(marker))return 'stopped';
  if(isAlive(pid))return 'waiting';
  remove(marker);
  const now=Date.now(),recent=recentHistory(JSON.stringify(history),now);
  if(recent.length>=MAX_RESTARTS){record('recovery-limit',{count:recent.length});return 'limited';}
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  try{
   const child=launch(executable,[...args,'--startup',`--recovery-history=${JSON.stringify([...recent,now])}`],{detached:true,stdio:'ignore',windowsHide:true,env});
   child.on('error',e=>record('recovery-launch-failed',{code:e.code,errorName:e.name}));
   child.unref();record('recovery-launched',{count:recent.length+1});
  }catch(e){record('recovery-launch-failed',{code:e.code,errorName:e.name});}
  return 'restarted';
 }
 if(deps.manual)return {check};
 const timer=setInterval(()=>{if(check()!=='waiting')clearInterval(timer);},interval);
 return {check,stop:()=>clearInterval(timer)};
}
function startRecovery({executable,profile,appPath,packaged,argv=process.argv,record,extraArgs=[]}){
 const directory=path.join(profile,'recovery');fs.mkdirSync(directory,{recursive:true});
 const marker=path.join(directory,crypto.randomUUID()+'.running');fs.writeFileSync(marker,'');
 const history=recentHistory(argv.find(a=>a.startsWith('--recovery-history='))?.slice('--recovery-history='.length));
 const config={pid:process.pid,marker,executable,args:[...(packaged?[]:[appPath]),...extraArgs],history,logFile:path.join(profile,'recovery.log')};
 const worker=spawn(executable,[__filename,JSON.stringify(config)],{detached:true,stdio:'ignore',windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
 worker.on('error',e=>{remove(marker);record('recovery-unavailable',{errorName:e.name,code:e.code});});
 worker.unref();record('recovery-started');
 return ()=>remove(marker);
}
if(require.main===module){
 const config=JSON.parse(process.argv[2]);
 if(!Number.isInteger(config.pid)||config.pid<=0||!path.isAbsolute(config.marker)||!path.isAbsolute(config.executable))throw Error('Invalid recovery configuration');
 supervise(config);
}
module.exports={startRecovery,supervise,recentHistory};
