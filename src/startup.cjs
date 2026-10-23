const NAME='RocketSnail';
function options(app,executable){return {path:executable,args:app.isPackaged?['--startup']:[`"${app.getAppPath()}"`,'--startup']};}
function registration(app,executable){
 const o=options(app,executable),s=app.getLoginItemSettings(o),item=s.launchItems?.find(i=>i.name===NAME&&i.path?.toLowerCase()===executable.toLowerCase());
 return {registered:!!item,enabled:!!item?.enabled&&s.executableWillLaunchAtLogin,name:NAME};
}
async function apply(app,executable,enabled){
 const o=options(app,executable),previous=app.getLoginItemSettings(o);
 app.setLoginItemSettings({...o,name:NAME,openAtLogin:enabled,enabled});
 // Remove only this app's legacy entry, never another Electron app's registration.
 for(const item of previous.launchItems||[])if(item.name==='electron.app.Electron'&&item.scope==='user'&&item.path?.toLowerCase()===executable.toLowerCase()&&app.isPackaged)app.setLoginItemSettings({...o,name:item.name,openAtLogin:false});
 let result=registration(app,executable);for(let attempt=0;enabled&&(!result.registered||!result.enabled)&&attempt<5;attempt++){await new Promise(resolve=>setTimeout(resolve,50));result=registration(app,executable);}
 if(enabled&&(!result.registered||!result.enabled))throw Error('Windows 자동 실행 등록을 확인하지 못했습니다. Windows 시작 앱 설정을 확인하세요.');
 return result;
}
module.exports={NAME,options,registration,apply};
