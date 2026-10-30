// Run with Electron. Uses only synthetic messages and the supplied release renderer.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=process.argv.find(x=>x.startsWith('--source='))?.slice(9)||path.join(root,'src');
const appearance=require(path.join(source,'appearance.js'));
const output=path.join(root,'docs/media/v0.2.7');fs.mkdirSync(output,{recursive:true});
const label='기능 설명용 재구성 · 가상 메시지';
app.setPath('userData',path.join(root,'artifacts/media-profile'));
async function render(file,html,width,height,transparent=false){
 const win=new BrowserWindow({width,height,frame:false,show:false,transparent,backgroundColor:transparent?'#00000000':'#111827',webPreferences:{offscreen:true}});
 const htmlFile=path.join(root,'artifacts','media-render.html');fs.writeFileSync(htmlFile,html);await win.loadFile(htmlFile);
 await win.webContents.executeJavaScript('document.fonts.ready');
 await new Promise(r=>setTimeout(r,180));
 fs.writeFileSync(path.join(output,file),(await win.webContents.capturePage()).toPNG());win.destroy();
}
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 for(const base of ['mochi','goth'])for(const size of [512,64])await render(`${base}-${size}.png`,`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${appearance.svg(appearance.presets[base],base)}`,size,size,true);
 for(const multiple of [false,true]){
 const messages=multiple?[['가상 디자인 팀','새 시안 검토를 부탁드려요.'],['가상 프로젝트방','내일 회의는 오후 2시예요.'],['가상 공지방','오늘 작업 파일을 공유했어요.']]:[['가상 디자인 팀','새 시안 검토를 부탁드려요.']];
 await render(multiple?'multiple-notifications.png':'single-notification.png',`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#111827;color:#f4f3ff;font:20px 'Malgun Gothic',sans-serif;padding:28px}h1{font-size:24px;margin:0}.stage{position:absolute;bottom:65px;left:145px;width:290px}.bubble{background:white;color:#214c52;border:2px solid #337f87;border-radius:14px;padding:12px 15px;font-size:16px;line-height:1.5;margin:0 0 10px}.bubble strong{display:block;font-size:13px;margin-bottom:4px}.pet{position:relative;margin:0 auto;width:116px;height:116px}.pet svg{width:100%;height:100%}.badge{position:absolute;top:0;right:0;border-radius:50%;background:#ca5366;font-size:15px;width:25px;height:25px;text-align:center;padding-top:2px}footer{position:absolute;bottom:20px;left:0;width:100%;text-align:center;color:#b3bacb;font-size:15px}.floor{position:absolute;bottom:65px;left:28px;right:28px;border-bottom:1px solid #4b5262}</style><h1>${multiple?'여러 알림을 한눈에':'새 메시지가 도착했어요'}</h1><div class="floor"></div><div class="stage">${messages.map(([room,text])=>`<div class="bubble"><strong>${room}</strong>${text}</div>`).join('')}<div class="pet">${appearance.svg(appearance.presets.mochi,'demo')}<span class="badge">${messages.length}</span></div></div><footer>${label}</footer>`,580,650);
 }
 const capture=process.argv.find(x=>x.startsWith('--capture='))?.slice(10)||path.join(root,'artifacts/customize.png');
 if(fs.existsSync(capture)){const png=fs.readFileSync(capture).toString('base64');await render('customization.png',`<meta charset="utf-8"><style>*{box-sizing:border-box}html,body{overflow:hidden}body{margin:0;background:#f6f7f9;font:16px 'Malgun Gothic',sans-serif}img{display:block;width:780px;height:740px;object-fit:contain}footer{height:40px;background:#172039;color:white;text-align:center;padding-top:9px}</style><img src="data:image/png;base64,${png}"><footer>${label} · 테스트 프로필 화면</footer>`,780,780);}
 fs.writeFileSync(path.join(output,'README.txt'),'Rocket Snail v0.2.7 / itsyennie\nAI 개발 도구 활용\nmochi: 말랑이 / goth: 시크\n캐릭터 PNG: 동일한 배포 렌더링 코드, 투명 배경\n알림 화면: 기능 설명용 재구성 · 가상 메시지\n꾸미기 화면: 테스트 프로필 실제 UI 캡처에 재구성 표시\n개인용·업무용 무료 사용. LICENSE.md 및 THIRD_PARTY_NOTICES.md 적용.\n');
 console.log(output);app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
