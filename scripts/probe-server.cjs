const fs=require('node:fs'),path=require('node:path');
const {serverUrl}=require('../src/protocol.cjs');
const DEFAULT_SERVER=serverUrl(process.argv[2]||'');
(async()=>{
  const result={checkedAt:new Date().toISOString(),server:DEFAULT_SERVER};
  const response=await fetch(`${DEFAULT_SERVER}/api/info`,{redirect:'error',signal:AbortSignal.timeout(15000)});
  const data=await response.json();result.httpStatus=response.status;result.version=data.version;
  result.websocket=await new Promise(resolve=>{
    const ws=new WebSocket(DEFAULT_SERVER.replace('https:','wss:')+'/websocket');
    let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);ws.close();resolve(value)};
    const timer=setTimeout(()=>finish('timeout'),15000);
    ws.onopen=()=>ws.send(JSON.stringify({msg:'connect',version:'1',support:['1']}));
    ws.onmessage=e=>{let packet;try{packet=JSON.parse(e.data)}catch{return}if(packet.msg==='connected')finish('DDP connected (unauthenticated)');};
    ws.onerror=()=>finish('connection error');
  });
  const dir=path.join(__dirname,'..','artifacts');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'server-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
