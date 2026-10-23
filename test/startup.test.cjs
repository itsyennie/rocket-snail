const test=require('node:test'),assert=require('node:assert/strict');const startup=require('../src/startup.cjs');
function fake(items=[]){const calls=[];return {isPackaged:true,calls,getLoginItemSettings(){return {openAtLogin:items.some(i=>i.name==='RocketSnail'&&i.enabled),executableWillLaunchAtLogin:items.some(i=>i.enabled),launchItems:items}},setLoginItemSettings(o){calls.push(o);items=items.filter(i=>i.name!==o.name);if(o.openAtLogin)items.push({name:o.name,path:o.path,args:o.args,scope:'user',enabled:o.enabled})}}}
test('dedicated startup entry migrates only matching legacy executable and leaves other apps alone',async()=>{
 const app=fake([{name:'electron.app.Electron',path:'C:\\Pet.exe',args:['--startup'],scope:'user',enabled:true},{name:'OtherApp',path:'C:\\Else.exe',args:[],scope:'user',enabled:true}]);
 assert.equal((await startup.apply(app,'C:\\Pet.exe',true)).enabled,true);assert.equal(app.calls[0].name,'RocketSnail');assert.equal(app.calls[1].name,'electron.app.Electron');
 await startup.apply(app,'C:\\Pet.exe',false);assert.equal(startup.registration(app,'C:\\Pet.exe').registered,false);
 const other=fake([{name:'electron.app.Electron',path:'C:\\Different.exe',args:['--startup'],scope:'user',enabled:true}]);await startup.apply(other,'C:\\Pet.exe',true);assert.equal(other.calls.length,1);
});
test('failed or disabled startup registration is reported instead of silently succeeding',async()=>{
 const app=fake();app.setLoginItemSettings=()=>{};await assert.rejects(startup.apply(app,'C:\\Pet.exe',true),/등록/);
});
test('development app path with spaces is quoted and packaged startup needs only the startup flag',()=>{
 assert.deepEqual(startup.options({isPackaged:false,getAppPath:()=> 'C:\\My Pet'},'electron.exe').args,['"C:\\My Pet"','--startup']);assert.deepEqual(startup.options({isPackaged:true},'Pet.exe').args,['--startup']);
});
