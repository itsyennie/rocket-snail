// Run with Electron; isolated from real credentials, startup registration and chat.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {startRecovery}=require('../src/recovery.cjs');
const profile=path.resolve(__dirname,'../artifacts/recovery-smoke');
app.setPath('userData',profile);let stop=()=>{};
app.on('before-quit',()=>stop());
app.whenReady().then(()=>{
 const record=require('../src/diagnostics.cjs').createDiagnostics(path.join(profile,'app.log'));
 const win=new BrowserWindow({show:false,webPreferences:{sandbox:true}});
 stop=startRecovery({executable:process.execPath,profile,appPath:__filename,packaged:false,record});
 if(process.argv.some(a=>a.startsWith('--recovery-history='))){
  fs.writeFileSync(path.join(profile,'passed.json'),JSON.stringify({restarted:true,windowCreated:!win.isDestroyed()}));
  app.quit();
 }else setTimeout(()=>process.kill(process.pid,'SIGKILL'),1200);
});
