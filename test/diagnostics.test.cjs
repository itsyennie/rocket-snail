const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createDiagnostics}=require('../src/diagnostics.cjs');
const {errorDetails,diagnosticReport}=require('../src/diagnostics.cjs');
test('error sites and reports retain useful context without messages, full paths or profile secrets',()=>{
 const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{
  const error={name:'TypeError',code:'EPIPE',message:'secret-message',stack:'Error: private-token\n at C:\\Users\\private-user\\app\\src\\rocket.cjs:12:34'};
  const details=errorDetails(error);assert.equal(details.site,'rocket.cjs:12:34');
  createDiagnostics(path.join(dir,'app.log'))('uncaught-error',{...details,pid:42,phase:'running',token:'private-token'});
  fs.writeFileSync(path.join(dir,'state.json'),'company-message');
  const report=diagnosticReport(dir,'test');assert(report.includes('rocket.cjs:12:34'));assert(report.includes('42'));assert(!/secret-message|private-token|private-user|company-message/.test(report));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('persistent diagnostics exclude token, message text, URL and error contents',()=>{
 const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{
  const file=path.join(dir,'app.log'),record=createDiagnostics(file);record('startup-failed',{phase:'ready',errorName:'Error',code:'EACCES',token:'private-token',message:'company-message',url:'https://secret.example'});
  const text=fs.readFileSync(file,'utf8'),entry=JSON.parse(text);assert.equal(entry.code,'EACCES');assert.equal(entry.event,'startup-failed');assert(!/private-token|company-message|secret.example/.test(text));
  fs.writeFileSync(file,'x'.repeat(256*1024+1));record('running',{visible:true});assert(fs.existsSync(file+'.previous'));assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).event,'running');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('diagnostics failure never prevents the application from running',()=>{
 const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));try{fs.writeFileSync(path.join(dir,'not-a-folder'),'x');assert.doesNotThrow(()=>createDiagnostics(path.join(dir,'not-a-folder','app.log'))('running'));}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
