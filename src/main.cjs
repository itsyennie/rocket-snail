const {app,BrowserWindow,ipcMain,shell,safeStorage,screen,Tray,Menu,nativeImage}=require('electron');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const {Store}=require('./store.cjs');const {RocketClient}=require('./rocket.cjs');
const {openDesktopMessage}=require('./desktop-link.cjs');const {validateSettings}=require('./settings.cjs');const {layout,beginDrag,moveDrag,savedPosition,restorePosition}=require('./desktop.cjs');
const {normalize:normalizeAppearance}=require('./appearance.js');
const {normalizePlacement,chooseDisplay,snapToEdge,advanceAlongEdge,orientation}=require('./placement.cjs');
const smoke=process.argv.includes('--smoke-test');const artifacts=path.join(__dirname,'..','artifacts');
const smokeTimeout=smoke?setTimeout(()=>{console.error('Smoke verification timed out');app.exit(1);},45000):null;
app.setName('Rocket Pet');
if(!smoke&&!app.requestSingleInstanceLock())app.exit(0);
app.on('second-instance',()=>{if(panelWindow)panel(true);});
if(smoke)app.setPath('userData',path.join(artifacts,'smoke-profile'));
else app.setPath('userData',path.join(app.getPath('appData'),'DexterRocketPet'));
let petWindow,panelWindow,tray,store,client,token='',status='계정 연결을 기다리고 있어요',x,y=null,displayId,drag=null,petHovered=false,direction=1,timer,smokeDesktopLink,smokePanelOpens=0,mouseIgnored,settingsOpen=false;
function credentials(){return path.join(app.getPath('userData'),'credential.bin');}
function availableDisplays(){const primary=screen.getPrimaryDisplay().id;return screen.getAllDisplays().map((d,i)=>({id:String(d.id),label:d.label||`모니터 ${i+1}`,number:i+1,primary:d.id===primary,width:Math.round(d.size.width*d.scaleFactor),height:Math.round(d.size.height*d.scaleFactor)}));}
function state(){return {...store.data,rooms:Object.values(client?.rooms||{}),displays:availableDisplays(),activeDisplayId:String(display().id),status,hasToken:!!token};}
function emit(){for(const win of [petWindow,panelWindow])if(win&&!win.isDestroyed())win.webContents.send('state',state());}
function configure(win){win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());}
function panel(show=true){settingsOpen=!!show;if(show){emit();if(smoke){smokePanelOpens++;frame();return;}panelWindow.show();panelWindow.focus();}else panelWindow.hide();frame();}
function display(){return chooseDisplay(screen.getAllDisplays(),screen.getPrimaryDisplay().id,displayId);}
function area(){return display().workArea;}
function startDrag(){const a=area(),g=layout(a,x,store.data.settings.size,y);drag=beginDrag({x:g.bounds.x+g.petLeft,y:g.bounds.y+g.petTop},screen.getCursorScreenPoint());frame();return {started:true};}
function updateDrag(pointer){if(!drag)return;const distance=Math.hypot(pointer.x-drag.start.x,pointer.y-drag.start.y);if(drag.moved||distance>=5)displayId=screen.getDisplayNearestPoint(pointer).id;const next=moveDrag(drag,pointer,area(),store.data.settings.size);x=next.x;if(drag.moved)y=next.y;}
function finishDrag(pointer=screen.getCursorScreenPoint()){if(!drag)return {moved:false};updateDrag(pointer);const moved=drag.moved;drag=null;if(moved){({x,y}=snapToEdge(area(),{x,y},store.data.settings.size,store.data.desktopPlacement.edge));store.data.desktopPlacement.displayId=String(display().id);store.data.desktopPosition=savedPosition(area(),{x,y},display().id,store.data.settings.size);store.save();emit();}frame();return {moved};}
function setPlacement(value){
  const next=normalizePlacement(value,true);if(next.displayId!=='primary'&&!availableDisplays().some(d=>d.id===next.displayId))throw Error('선택한 모니터가 연결되어 있지 않습니다.');
  const ratio=savedPosition(area(),{x,y:y??area().y+area().height-Math.round(90*store.data.settings.size)},display().id,store.data.settings.size);
  displayId=next.displayId==='primary'?screen.getPrimaryDisplay().id:Number(next.displayId);drag=null;petHovered=false;
  const restored=restorePosition(area(),ratio,store.data.settings.size);({x,y}=snapToEdge(area(),restored,store.data.settings.size,next.edge));
  store.data.desktopPlacement=next;store.data.desktopPosition=savedPosition(area(),{x,y},display().id,store.data.settings.size);store.save();emit();frame();return {placement:next};
}
function refreshDisplays(){if(!store||!petWindow)return;const selected=store.data.desktopPlacement;displayId=selected.displayId==='primary'?screen.getPrimaryDisplay().id:Number(selected.displayId);drag=null;petHovered=false;({x,y}=restorePosition(area(),store.data.desktopPosition,store.data.settings.size));({x,y}=snapToEdge(area(),{x,y},store.data.settings.size,selected.edge));frame();emit();}
function frame(){return renderFrame(screen.getCursorScreenPoint());}
function renderFrame(cursor){
  if(!petWindow||petWindow.isDestroyed())return;
  if(drag)updateDrag(cursor);
  const a=area(),size=store.data.settings.size,edge=store.data.desktopPlacement.edge;
  if(!drag&&edge!=='free')({x,y}=snapToEdge(a,{x,y},size,edge));
  const current=layout(a,x,size,y);
  const local={x:cursor.x-current.bounds.x,y:cursor.y-current.bounds.y};
  const hasMessages=Object.keys(store.data.items).length>0;
  const overPet=local.x>=current.petLeft-5&&local.x<=current.petLeft+current.petSize+5&&local.y>=current.petTop-5&&local.y<=current.petTop+current.petSize+5;
  if(!overPet)petHovered=false;
  const overBubble=hasMessages&&local.x>=current.bubbleLeft&&local.x<=current.bubbleLeft+260&&local.y>=current.bubbleTop&&local.y<=current.bubbleTop+72;
  const ignoreMouse=!(drag||overPet||overBubble);if(mouseIgnored!==ignoreMouse){petWindow.setIgnoreMouseEvents(ignoreMouse,{forward:true});mouseIgnored=ignoreMouse;}
  const paused=!!drag||petHovered||store.data.settings.motionEnabled===false||overPet||overBubble||settingsOpen;
  if(!drag)({x,y,direction}=advanceAlongEdge(a,{x,y},size,edge,direction,paused));
  const next=layout(a,x,size,y);x=next.bounds.x+next.petLeft;if(y!==null)y=next.bounds.y+next.petTop;const actual=petWindow.getBounds();if(['x','y','width','height'].some(key=>actual[key]!==next.bounds[key]))petWindow.setBounds(next.bounds);petWindow.webContents.send('geometry',{...next,...orientation(edge,direction),edge,direction,paused});
}
function icon(){const n=24,b=Buffer.alloc(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const shell=(x-11)**2+(y-10)**2<65,foot=y>17&&x>2&&x<22;if(shell||foot){const i=(y*n+x)*4;b[i]=shell?100:160;b[i+1]=shell?164:180;b[i+2]=shell?240:70;b[i+3]=255;}}return nativeImage.createFromBitmap(b,{width:n,height:n});}
function handler(name,fn){ipcMain.handle(name,(event,...args)=>{if(![petWindow,panelWindow].some(w=>w?.webContents===event.sender))throw Error('허용되지 않은 화면');return fn(...args);});}
function setMotion(enabled){if(typeof enabled!=='boolean')throw Error('움직임 설정을 확인하세요.');store.data.settings.motionEnabled=enabled;store.save();updateTrayMenu();emit();frame();return {motionEnabled:enabled};}
function updateTrayMenu(){if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate([{label:'메시지와 설정',click:()=>panel(true)},{label:'캐릭터 움직이기',type:'checkbox',checked:store.data.settings.motionEnabled!==false,click:item=>{try{setMotion(item.checked)}catch{status='움직임 설정을 저장하지 못했습니다.';emit();}}},{type:'separator'},{label:'종료',click:()=>app.quit()}]));}
app.whenReady().then(async()=>{
  store=new Store(path.join(app.getPath('userData'),'state.json'));
  if(!smoke)try{const saved=JSON.parse(safeStorage.decryptString(fs.readFileSync(credentials())));if(saved.baseUrl===store.data.settings.baseUrl&&saved.userId===store.data.settings.userId)token=saved.token;}catch{}
  client=new RocketClient(store,()=>token);client.on('change',emit);client.on('status',s=>{status=s;emit();});
  const webPreferences={preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:!smoke};
  const placement=store.data.desktopPlacement;displayId=placement.displayId==='primary'?screen.getPrimaryDisplay().id:Number(placement.displayId);({x,y}=restorePosition(area(),store.data.desktopPosition,store.data.settings.size));if(placement.edge!=='free')({x,y}=snapToEdge(area(),{x,y},store.data.settings.size,placement.edge));
  petWindow=new BrowserWindow({...layout(area(),x,store.data.settings.size,y).bounds,frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false,show:!smoke,webPreferences});
  panelWindow=new BrowserWindow({width:780,height:740,minWidth:650,minHeight:540,title:'Rocket Pet · 메시지 확인 도우미',backgroundColor:'#f6f7f9',show:false,autoHideMenuBar:true,webPreferences});
  configure(petWindow);configure(panelWindow);
  panelWindow.on('close',e=>{if(!app.quitting){e.preventDefault();panel(false);}});
  panelWindow.on('show',()=>{settingsOpen=true;frame();});panelWindow.on('hide',()=>{settingsOpen=false;frame();});
  handler('state',()=>state());handler('interactive',on=>panel(!!on));handler('quit',()=>app.quit());
  handler('set-motion',setMotion);
  handler('set-placement',setPlacement);
  handler('drag-start',startDrag);handler('drag-end',()=>finishDrag());
  handler('hover',hovered=>{if(typeof hovered!=='boolean')return;petHovered=hovered;frame();});
  handler('set-appearance',appearance=>{const next=normalizeAppearance(appearance,true);store.data.settings.appearance=next;store.save();emit();return {appearance:next};});
  handler('save',async({settings,newToken})=>{
    const next=validateSettings({...settings,appearance:store.data.settings.appearance}),old=store.data.settings;
    if(old.userId&&(old.userId!==next.userId||old.baseUrl!==next.baseUrl))throw Error('이 초기 버전은 한 서버·한 계정만 지원합니다. 기존 계정 정보를 유지하세요.');
    const candidate=String(newToken||'').trim()||token;
    if(candidate&&!next.userId)throw Error('사용자 ID를 입력하세요.');
    if(newToken&&newToken.trim()&&!safeStorage.isEncryptionAvailable())throw Error('Windows 암호화 저장을 사용할 수 없습니다.');
    if(next.startup!==old.startup&&!smoke)app.setLoginItemSettings({openAtLogin:next.startup,path:process.execPath,args:app.isPackaged?['--startup']:[app.getAppPath(),'--startup']});
    if(newToken&&newToken.trim()) {fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(credentials(),safeStorage.encryptString(JSON.stringify({baseUrl:next.baseUrl,userId:next.userId,token:candidate})));}
    store.data.settings=next;store.save();token=candidate;emit();if(token&&!smoke)void client.start();return {saved:true};
  });
  handler('probe',async()=>{const result=await client.probe();status=`Rocket.Chat ${result.version} · 서버 접근 확인`;emit();return result;});
  handler('open-message',async id=>{const item=store.data.items[id]||store.data.archive.find(i=>i.id===id);if(!item)throw Error('메시지를 찾을 수 없습니다.');await openDesktopMessage(store.data.settings.baseUrl,item,smoke?async link=>{smokeDesktopLink=link;}:shell.openExternal);});
  handler('restore',id=>{const item=store.data.archive.find(i=>i.id===id);store.restore(id,client.subs[item?.rid]?.ls);emit();});
  handler('refresh',()=>{if(!token||!store.data.settings.userId)throw Error('연결·캐릭터 화면에서 사용자 ID와 개인 접근 토큰을 입력하세요.');return client.running?client.sync():client.start();});
  if(!smoke){tray=new Tray(icon());tray.setToolTip('Rocket Pet');updateTrayMenu();tray.on('double-click',()=>panel(true));}
  const panelQuery={view:'panel'};if(process.argv.includes('--customize'))panelQuery.tab='customize';if(process.argv.includes('--placement'))panelQuery.tab='connection';
  await Promise.all([petWindow.loadFile(path.join(__dirname,'ui.html')),panelWindow.loadFile(path.join(__dirname,'ui.html'),{query:panelQuery})]);
  emit();timer=setInterval(frame,50);for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,refreshDisplays);
  if(smoke){await smokeTest();return;}
  if(token)void client.start();
  if(process.argv.includes('--settings')||!token&&!process.argv.includes('--startup'))panel(true);
}).catch(e=>{console.error(e.message);app.exit(1);});
app.on('before-quit',()=>{app.quitting=true;clearTimeout(smokeTimeout);clearInterval(timer);client?.stop();tray?.destroy();});
app.on('window-all-closed',()=>app.quit());
async function smokeTest(){
  console.log('Smoke: existing UI and message behavior');
  fs.mkdirSync(artifacts,{recursive:true});const errors=[];
  store.data.desktopPlacement={displayId:'primary',edge:'free'};displayId=screen.getPrimaryDisplay().id;
  for(const win of [petWindow,panelWindow])win.webContents.on('console-message',(_event,_level,message)=>{if(message?.includes('Error'))errors.push(message);});
  await panelWindow.webContents.executeJavaScript("document.querySelector('[data-tab=connection]').click()");
  const checks=await panelWindow.webContents.executeJavaScript("({bridge:!!window.pet,server:document.querySelector('[name=baseUrl]').value,passwordType:document.querySelector('[name=token]').type,heading:document.querySelector('h1').textContent,size:document.querySelector('input[type=range]').value})");
  if(!checks.bridge||checks.server!==store.data.settings.baseUrl||checks.passwordType!=='password')throw Error('UI 검증 실패');
  if(Number(checks.size)!==store.data.settings.size)throw Error('크기 슬라이더 검증 실패');
  fs.writeFileSync(path.join(artifacts,'connection.png'),(await panelWindow.webContents.capturePage()).toPNG());
  clearInterval(timer);
  const a=area(),cursor=screen.getCursorScreenPoint();x=cursor.x>a.x+a.width/2?a.x+20:a.x+a.width-200;
  await panelWindow.webContents.executeJavaScript("const motion=document.querySelector('[name=motionEnabled]');motion.checked=false;motion.onchange()");
  const stoppedX=x;for(let i=0;i<5;i++)frame();
  const stoppedPosition=x===stoppedX,persistedPause=new Store(store.file).data.settings.motionEnabled===false;
  const motionChecks=await petWindow.webContents.executeJavaScript("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r({animationPaused:getComputedStyle(document.querySelector('.shell')).animationPlayState==='paused'}))))");
  const removedButton=await panelWindow.webContents.executeJavaScript("!document.getElementById('hide')&&!document.body.textContent.includes('바탕화면으로')");
  await panelWindow.webContents.executeJavaScript("document.querySelector('[name=motionEnabled]').checked=true;document.querySelector('[name=motionEnabled]').onchange()");
  const resumedX=x;frame();const resumedMovement=x!==resumedX;
  await panelWindow.webContents.executeJavaScript("document.querySelector('[name=motionEnabled]').checked=false;document.querySelector('[name=motionEnabled]').onchange()");
  if(!stoppedPosition||!persistedPause||!motionChecks.animationPaused||!removedButton||!resumedMovement)throw Error('캐릭터 정지·재개 검증 실패');
  checks.motion={stoppedPosition,persistedPause,animationPaused:motionChecks.animationPaused,removedButton,resumedMovement};
  await panelWindow.webContents.executeJavaScript("document.querySelector('[name=motionEnabled]').scrollIntoView({block:'center'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
  fs.writeFileSync(path.join(artifacts,'motion.png'),(await panelWindow.webContents.capturePage()).toPNG());
  store.data.items.demo={id:'demo',rid:'r1',room:'디자인 팀',roomName:'design',roomType:'c',text:'미리보기용 메시지 · 회사 데이터가 아닙니다.',reason:'mention-all',ts:new Date().toISOString()};emit();frame();
  await petWindow.webContents.executeJavaScript("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
  fs.writeFileSync(path.join(artifacts,'pet.png'),(await petWindow.webContents.capturePage()).toPNG());
  client.rooms={sample1:{rid:'sample1',name:'공지방',t:'c'},sample2:{rid:'sample2',name:'디자인 팀',t:'p'}};
  store.data.settings.rooms={};store.data.settings.keywords=[];emit();
  await panelWindow.webContents.executeJavaScript("document.querySelector('[data-tab=rules]').click()");
  const ruleChecks=await panelWindow.webContents.executeJavaScript(`(async()=>{
    const sectionNames=[...document.querySelectorAll('[data-section] h2')].map(n=>n.textContent);
    const roomMode=document.querySelector('[data-room-mode=sample1]');roomMode.value='all';roomMode.dispatchEvent(new Event('change'));
    const keywordScope=document.querySelector('[name=keywordScope]');keywordScope.value='sample2';keywordScope.dispatchEvent(new Event('change'));
    const independent=roomMode.value==='all';
    const term=document.querySelector('[name=keywordTerm]');term.value='검토';await [...document.querySelectorAll('button')].find(b=>b.textContent==='키워드 추가').onclick();
    await document.querySelector('.rules-save-bar button').onclick();
    document.querySelector('.room-rules').open=true;
    const ids=[...document.querySelectorAll('.form-row input,.form-row select')].map(n=>n.id);
    return {sectionNames,independent,uniqueFieldIds:new Set(ids).size===ids.length,legacyLabels:document.body.textContent.includes('선택한 방 모드')||document.body.textContent.includes('규칙 적용 범위')};
  })()`);
  if(!ruleChecks.independent||!ruleChecks.uniqueFieldIds||ruleChecks.legacyLabels||store.data.settings.rooms.sample1.mode!=='all'||store.data.settings.rooms.sample2.mode!==undefined||store.data.settings.rooms.sample2.keywords[0].term!=='검토')throw Error('방과 키워드 분리 검증 실패');
  await panelWindow.webContents.executeJavaScript("document.getElementById('toast').hidden=true;document.querySelector('[data-section=rooms]').scrollIntoView({block:'start'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
  fs.writeFileSync(path.join(artifacts,'rules.png'),(await panelWindow.webContents.capturePage()).toPNG());
  await panelWindow.webContents.executeJavaScript("document.querySelector('[data-section=keywords]').scrollIntoView({block:'start'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
  fs.writeFileSync(path.join(artifacts,'keywords.png'),(await panelWindow.webContents.capturePage()).toPNG());
  checks.rules=ruleChecks;
  await panelWindow.webContents.executeJavaScript("document.querySelector('[data-tab=inbox]').click();document.querySelector('article .actions button').onclick()");
  const desktopLink=new URL(smokeDesktopLink);
  if(desktopLink.protocol!=='rocketchat:'||desktopLink.hostname!=='room'||!desktopLink.searchParams.get('path').endsWith('?msg=demo')||!store.data.items.demo)throw Error('데스크톱 메시지 열기 검증 실패');
  checks.desktopMessage={protocol:desktopLink.protocol,action:desktopLink.hostname,messageRemainsPending:!!store.data.items.demo,registeredApplication:app.getApplicationNameForProtocol(desktopLink.href)};
  const previousAppearance=JSON.stringify(store.data.settings.appearance),staleSettings=structuredClone(store.data.settings);
  await panelWindow.webContents.executeJavaScript(`document.querySelector('[data-tab=customize]').click();
    document.querySelector('[data-shell-pattern=stars].appearance-choice').onclick();
    document.querySelector('[data-eye-style=happy].appearance-choice').onclick();
    for(const [name,value] of [['shellColor','#b4a0df'],['patternColor','#76609e'],['bodyColor','#eaa9b7']]){const input=document.querySelector('[name='+name+']');input.value=value;input.dispatchEvent(new Event('input'));}
    new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));`);
  const previewOnly=JSON.stringify(store.data.settings.appearance)===previousAppearance;
  const previewChecks=await panelWindow.webContents.executeJavaScript("({pattern:document.querySelector('#appearance-preview-art svg').dataset.shellPattern,eyes:document.querySelector('#appearance-preview-art svg').dataset.eyeStyle,body:document.querySelector('#appearance-preview-art .snail-body').getAttribute('fill')})");
  await panelWindow.webContents.executeJavaScript("document.querySelector('[data-apply-appearance]').onclick()");
  const customized=new Store(store.file).data.settings.appearance;
  await panelWindow.webContents.executeJavaScript(`pet.save({settings:${JSON.stringify(staleSettings)}})`);
  const preserved=JSON.stringify(new Store(store.file).data.settings.appearance)===JSON.stringify(customized);
  const desktopAppearance=await petWindow.webContents.executeJavaScript("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r({pattern:document.querySelector('#snail-art svg').dataset.shellPattern,eyes:document.querySelector('#snail-art svg').dataset.eyeStyle,body:document.querySelector('#snail-art .snail-body').getAttribute('fill'),paused:document.getElementById('character').classList.contains('paused')}))))");
  if(!previewOnly||!preserved||previewChecks.pattern!=='stars'||previewChecks.eyes!=='happy'||previewChecks.body!=='#eaa9b7'||desktopAppearance.pattern!=='stars'||desktopAppearance.eyes!=='happy'||desktopAppearance.body!=='#eaa9b7'||!desktopAppearance.paused)throw Error('달팽이 꾸미기 미리보기·저장 검증 실패');
  checks.appearance={previewOnly,preview:previewChecks,desktop:desktopAppearance,persisted:customized,preservedAfterOtherSettingsSave:preserved};
  await panelWindow.webContents.executeJavaScript("document.getElementById('toast').hidden=true;document.querySelector('main').scrollTop=0;new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
  fs.writeFileSync(path.join(artifacts,'customize.png'),(await panelWindow.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(artifacts,'custom-pet.png'),(await petWindow.webContents.capturePage()).toPNG());
  const scrollChecks=await panelWindow.webContents.executeJavaScript(`(async()=>{
    const controls=document.querySelector('.appearance-controls'),main=document.querySelector('main'),preview=document.querySelector('.appearance-preview'),bar=document.querySelector('.appearance-save-bar'),title=document.getElementById('title');
    const before={preview:preview.getBoundingClientRect().top,bar:bar.getBoundingClientRect().top,title:title.getBoundingClientRect().top};
    controls.scrollTop=controls.scrollHeight;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return {rightScrolled:controls.scrollTop>0,previewFixed:Math.abs(preview.getBoundingClientRect().top-before.preview)<1,saveFixed:Math.abs(bar.getBoundingClientRect().top-before.bar)<1,titleFixed:Math.abs(title.getBoundingClientRect().top-before.title)<1,outerNotScrolled:main.scrollTop===0,outerHasNoOverflow:main.scrollHeight<=main.clientHeight+1};
  })()`);
  if(Object.values(scrollChecks).some(v=>!v))throw Error('꾸미기 오른쪽 영역 스크롤 검증 실패: '+JSON.stringify(scrollChecks));
  checks.customizeScroll=scrollChecks;
  fs.writeFileSync(path.join(artifacts,'customize-eyes.png'),(await panelWindow.webContents.capturePage()).toPNG());
  const desktopArea=area(),g=layout(desktopArea,x,store.data.settings.size,y),origin={x:g.bounds.x+g.petLeft,y:g.bounds.y+g.petTop};
  const goal={x:desktopArea.x+Math.round(desktopArea.width*.25),y:desktopArea.y+Math.round(desktopArea.height*.3)};
  const press={x:origin.x+g.petSize/2,y:origin.y+g.petSize/2};drag=beginDrag(origin,press);
  const dropped=finishDrag({x:press.x+goal.x-origin.x,y:press.y+goal.y-origin.y});
  const newGeometry=layout(area(),x,store.data.settings.size,y),storedDesktop=new Store(store.file).data.desktopPosition,restored=restorePosition(area(),storedDesktop,store.data.settings.size);
  const panelOpensBefore=smokePanelOpens;
  await petWindow.webContents.executeJavaScript("document.getElementById('character').onclick({detail:1});window.pet.state()");
  const noDragClick=smokePanelOpens===panelOpensBefore;
  await petWindow.webContents.executeJavaScript("document.getElementById('character').onclick({detail:0})");
  const clickOpens=smokePanelOpens>panelOpensBefore;
  const caption=await panelWindow.webContents.executeJavaScript("document.querySelector('.brand small').textContent");
  const positionRestored=Math.abs(restored.x-x)<1&&Math.abs(restored.y-y)<1;
  if(!dropped.moved||Math.abs(newGeometry.bounds.x+newGeometry.petLeft-goal.x)>1||Math.abs(newGeometry.bounds.y+newGeometry.petTop-goal.y)>1||!positionRestored||!noDragClick||!clickOpens||caption!=='메시지를 놓치지 않는 작은 달팽이')throw Error('달팽이 드래그·클릭·위치 저장 검증 실패');
  checks.drag={moved:dropped.moved,positionRestored,noDragClick,clickOpens,caption};
  panel(false);
  store.data.settings.motionEnabled=true;
  const hoverPoint={x:x+newGeometry.petSize/2,y:y+newGeometry.petSize/2},hoverX=x,hoverY=y;
  for(let i=0;i<20;i++)renderFrame(hoverPoint);
  const hoverStopped=x===hoverX&&y===hoverY;
  const hoverAnimationPaused=await petWindow.webContents.executeJavaScript("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(getComputedStyle(document.querySelector('.shell')).animationPlayState==='paused'))))");
  const beforeLeave=x;renderFrame({x:area().x-1000,y:area().y-1000});const leaveResumes=x!==beforeLeave;
  store.data.settings.motionEnabled=false;frame();
  if(!hoverStopped||!hoverAnimationPaused||!leaveResumes)throw Error('호버 정지·해제 검증 실패');
  checks.hover={stopped:hoverStopped,animationPaused:hoverAnimationPaused,leaveResumes};
  const originalSize=store.data.settings.size,originalMotion=store.data.settings.motionEnabled,hoverSizes=[];
  store.data.settings.motionEnabled=true;
  for(const scale of [.7,.71,.75,.9,1,1.1,1.5]){
    store.data.settings.size=scale;x=Math.round(area().x+area().width*.35);y=area().y+200;
    const anchor={x,y},g=layout(area(),x,scale,y),hover={x:x+g.petSize/2,y:y+g.petSize/2};
    renderFrame(hover);const windowBefore=petWindow.getBounds();for(let i=0;i<40;i++)renderFrame(hover);const windowAfter=petWindow.getBounds();
    const stable=x===anchor.x&&y===anchor.y&&JSON.stringify(windowBefore)===JSON.stringify(windowAfter);hoverSizes.push({scale,stable});
    if(!stable)throw Error('크기별 호버 위치 고정 실패: '+scale);
  }
  panel(true);store.data.settings.size=.7;x=Math.round(area().x+area().width*.35);y=area().y+200;
  const settingAnchor={x,y};for(let i=0;i<80;i++)renderFrame({x:area().x-1000,y:area().y-1000});
  const settingsStable=x===settingAnchor.x&&y===settingAnchor.y;
  if(!settingsStable)throw Error('설정 창 조작 중 위치 고정 실패');
  checks.stationaryRegression={hoverSizes,settingsWindowPaused:settingsStable};
  panel(false);store.data.settings.size=originalSize;store.data.settings.motionEnabled=originalMotion;frame();
  await panelWindow.webContents.executeJavaScript("document.querySelector('[data-tab=connection]').click()");
  const placementChecks=[];store.data.settings.motionEnabled=true;panel(false);
  for(const edge of ['bottom','left','right','top','free']){
    console.log('Smoke: placement '+edge);
    await panelWindow.webContents.executeJavaScript(`document.querySelector('[name=displayId]').value='primary';document.querySelector('[name=placementEdge]').value='${edge}';document.querySelector('[name=placementEdge]').onchange();[...document.querySelectorAll('[data-placement-form] button')].find(b=>b.textContent==='위치 적용').onclick()`);
    const anchor={x,y},off={x:area().x-1000,y:area().y-1000};for(let i=0;i<15;i++)renderFrame(off);
    const vertical=edge==='left'||edge==='right',normalStable=vertical?x===anchor.x:y===anchor.y,moved=vertical?y!==anchor.y:x!==anchor.x;
    const image=await petWindow.webContents.executeJavaScript("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r({edge:document.getElementById('character').dataset.edge,transform:document.getElementById('snail-art').style.transform}))))");
    const saved=new Store(store.file).data.desktopPlacement,persisted=saved.edge===edge&&saved.displayId==='primary';
    if(!normalStable||!moved||!persisted||image.edge!==edge)throw Error('모니터·가장자리 이동 검증 실패: '+edge);
    panel(true);const pausedAt={x,y};for(let i=0;i<10;i++)renderFrame(off);const paused=x===pausedAt.x&&y===pausedAt.y;panel(false);if(!paused)throw Error('가장자리 설정 창 정지 검증 실패: '+edge);
    placementChecks.push({edge,normalStable,moved,persisted,paused,transform:image.transform});
    if(edge==='top'||edge==='left')fs.writeFileSync(path.join(artifacts,`pet-${edge}.png`),(await petWindow.webContents.capturePage()).toPNG());
    if(edge==='top'){
      await panelWindow.webContents.executeJavaScript("document.getElementById('toast').hidden=true;document.querySelector('main').scrollTop=0;new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
      fs.writeFileSync(path.join(artifacts,'placement.png'),(await panelWindow.webContents.capturePage()).toPNG());
    }
  }
  const secondary=availableDisplays().find(d=>!d.primary);let monitorSwitch=null;
  if(secondary){
    setPlacement({displayId:secondary.id,edge:'bottom'});
    const a=area(),actual=String(display().id),saved=new Store(store.file).data.desktopPlacement;
    const withinBounds=x>=a.x&&x<a.x+a.width&&y>=a.y&&y<a.y+a.height;
    monitorSwitch={requested:secondary.id,actual,withinBounds,persisted:saved.displayId===secondary.id};
    if(actual!==secondary.id||!withinBounds||!monitorSwitch.persisted)throw Error('보조 모니터 전환 검증 실패');
    setPlacement({displayId:'primary',edge:'free'});
  }
  store.data.settings.motionEnabled=originalMotion;frame();checks.placement={displays:availableDisplays(),edges:placementChecks,monitorSwitch};
  fs.writeFileSync(path.join(artifacts,'smoke-result.json'),JSON.stringify({passed:!errors.length,...checks,errors},null,2));
  app.quit();
}
