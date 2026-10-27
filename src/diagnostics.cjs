const fs=require('node:fs'),path=require('node:path');
const allowed=new Set(['phase','reason','type','code','errorName','visible','tokenRestored','registered','enabled','count','startup','version']);
function createDiagnostics(file){
 return (event,details={})=>{try{
  const entry={time:new Date().toISOString(),event};
  for(const [key,value] of Object.entries(details))if(allowed.has(key)&&['string','number','boolean'].includes(typeof value))entry[key]=typeof value==='string'?value.slice(0,100):value;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  if(fs.existsSync(file)&&fs.statSync(file).size>256*1024)fs.renameSync(file,file+'.previous');
  fs.appendFileSync(file,JSON.stringify(entry)+'\n',{mode:0o600});
 }catch{/* Diagnostics must never prevent startup or recovery. */}};
}
module.exports={createDiagnostics};
