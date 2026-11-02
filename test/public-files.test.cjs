const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
test('public guard accepts clean annotated tags but rejects retired media even after deletion',()=>{
 const dir=fs.mkdtempSync(path.join(__dirname,'tmp-'));
 const git=(...args)=>execFileSync('git',['-c','user.name=Test','-c','user.email=test@example.invalid','-c','commit.gpgSign=false',...args],{cwd:dir,stdio:'pipe'});
 const guard=()=>spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/check-public-files.cjs')],{cwd:dir,encoding:'utf8'});
 try{
  git('init','-q');fs.writeFileSync(path.join(dir,'README.md'),'Synthetic fixture');git('add','.');git('commit','-qm','clean');
  git('-c','tag.gpgSign=false','tag','-a','v1','-m','clean annotated tag');assert.equal(guard().status,0);
  const media=path.join(dir,'docs/media');fs.mkdirSync(media,{recursive:true});const file=path.join(media,'single-notification.png');
  fs.writeFileSync(file,'Synthetic retired-path fixture');git('add','.');git('commit','-qm','retired path');
  fs.unlinkSync(file);git('add','-u');git('commit','-qm','removed');assert.equal(guard().status,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
