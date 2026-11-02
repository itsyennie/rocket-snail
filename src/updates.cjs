const fs=require('node:fs'),path=require('node:path');
const REPO='https://github.com/itsyennie/rocket-snail';
const API='https://api.github.com/repos/itsyennie/rocket-snail/releases?per_page=100';
const INTERVAL=6*60*60*1000;
function version(value){
 if(typeof value!=='string'||value.length>100)return null;
 const m=value.match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/);
 if(!m||m.slice(1,4).some(n=>!Number.isSafeInteger(Number(n))))return null;
 const pre=m[4]?.split('.')||[];if(pre.some(p=>/^\d+$/.test(p)&&p.length>1&&p[0]==='0'))return null;
 return {parts:m.slice(1,4).map(Number),pre};
}
function compare(a,b){
 const x=version(a),y=version(b);if(!x||!y)return null;
 for(let i=0;i<3;i++)if(x.parts[i]!==y.parts[i])return x.parts[i]>y.parts[i]?1:-1;
 if(!x.pre.length||!y.pre.length)return x.pre.length===y.pre.length?0:x.pre.length?-1:1;
 for(let i=0;i<Math.max(x.pre.length,y.pre.length);i++){
  const l=x.pre[i],r=y.pre[i];if(l===r)continue;if(l===undefined)return -1;if(r===undefined)return 1;
  const ln=/^\d+$/.test(l),rn=/^\d+$/.test(r);
  if(ln&&rn)return BigInt(l)>BigInt(r)?1:-1;if(ln!==rn)return ln?-1:1;return l>r?1:-1;
 }return 0;
}
function release(row){
 if(!row||row.draft!==false||!version(row.tag_name)||!Array.isArray(row.assets))return null;
 const tag=row.tag_name,name=`rocket-snail-${tag.replace(/^v/,'')}-windows-x64.zip`;
 const url=`${REPO}/releases/tag/${encodeURIComponent(tag)}`;
 const download=`${REPO}/releases/download/${encodeURIComponent(tag)}/${name}`;
 if(row.html_url!==url||!row.assets.some(a=>a.name===name&&a.state==='uploaded'&&a.size>0&&a.browser_download_url===download))return null;
 return {tag,url,download,prerelease:row.prerelease===true};
}
function newest(rows,current){
 if(!Array.isArray(rows))throw Error('Invalid release response');
 return rows.map(release).filter(r=>r&&compare(r.tag,current)>0).sort((a,b)=>compare(b.tag,a.tag))[0]||null;
}
class UpdateChecker {
 constructor({current,file,fetchImpl=fetch,now=Date.now,onChange=()=>{},notify=()=>false,record=()=>{}}){
  Object.assign(this,{current,file,fetchImpl,now,onChange,notify,record});this.data={};this.latest=null;this.busy=false;this.error=false;this.stopped=false;
  try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));for(const k of ['notified','dismissed'])if(version(saved[k]))this.data[k]=saved[k];}catch{}
 }
 view(){return {current:this.current,latest:this.latest,available:!!this.latest&&this.data.dismissed!==this.latest.tag,busy:this.busy,error:this.error,lastChecked:this.lastChecked||null};}
 save(){try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.data),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);}catch{this.record('update-preference-save-failed');}}
 emit(){if(!this.stopped)this.onChange(this.view());}
 dismiss(){if(this.latest){this.data.dismissed=this.latest.tag;this.save();this.emit();}return this.view();}
 async check(manual=false){
  if(this.stopped)return this.view();
  if(this.busy)return this.pending;
  if(this.lastAttempt!==undefined&&this.now()-this.lastAttempt<60000){if(manual&&this.latest){delete this.data.dismissed;this.save();this.emit();}return this.view();}
  this.busy=true;this.lastAttempt=this.now();this.emit();
  this.pending=this.run(manual);return this.pending;
 }
 async run(manual){
  try{
   const response=await this.fetchImpl(API,{method:'GET',redirect:'error',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Release request failed');
   const latest=newest(await response.json(),this.current);if(this.stopped)return this.view();
   this.latest=latest;this.error=false;this.lastChecked=this.now();
   if(manual)delete this.data.dismissed;
   if(latest&&this.data.notified!==latest.tag&&this.data.dismissed!==latest.tag){
    try{if(this.notify(latest))this.data.notified=latest.tag;}catch{this.record('update-notification-failed');}
   }
   this.save();this.record('update-check-complete',{count:latest?1:0});
  }catch{if(!this.stopped){this.error=true;this.record('update-check-failed');}}
  finally{this.busy=false;this.emit();}
  return this.view();
 }
 start(){this.startTimer=setTimeout(()=>void this.check(),15000);this.startTimer.unref();this.timer=setInterval(()=>void this.check(),INTERVAL);this.timer.unref();}
 stop(){this.stopped=true;clearTimeout(this.startTimer);clearInterval(this.timer);}
}
module.exports={UpdateChecker,compare,newest,release,API,REPO};
