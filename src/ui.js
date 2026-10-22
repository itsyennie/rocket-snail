const panelMode=new URLSearchParams(location.search).get('view')==='panel';
let state,tab='inbox',editing=false,toastTimer,fieldSequence=0,appearanceKey='';
const $=id=>document.getElementById(id),el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n};
if(panelMode){document.body.classList.add('panel-mode');$('panel').hidden=false;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,7000);}
async function action(fn){try{return await fn()}catch(e){toast(e.message.replace(/^Error invoking remote method '[^']+': Error: /,''));}}
const character=$('character');let dragGesture=null;
character.onpointerenter=()=>{character.classList.add('hovered');void action(()=>pet.hover(true));};
character.onpointerleave=()=>{character.classList.remove('hovered');void action(()=>pet.hover(false));};
character.onclick=e=>{if(e.detail===0)return pet.interactive(true);};
character.ondragstart=e=>e.preventDefault();
character.onpointerdown=e=>{if(e.button!==0||dragGesture)return;e.preventDefault();const gesture={pointerId:e.pointerId,ending:false,ready:action(()=>pet.beginDrag())};dragGesture=gesture;character.classList.add('dragging');try{character.setPointerCapture(e.pointerId)}catch{}};
async function finishPointerDrag(openIfClick){const gesture=dragGesture;if(!gesture||gesture.ending)return;gesture.ending=true;try{if(!await gesture.ready)return;const result=await action(()=>pet.endDrag());if(result&&!result.moved&&openIfClick)await pet.interactive(true);}finally{if(dragGesture===gesture)dragGesture=null;character.classList.remove('dragging');try{character.releasePointerCapture(gesture.pointerId)}catch{}}}
character.onpointerup=()=>finishPointerDrag(true);character.onpointercancel=()=>finishPointerDrag(false);character.onlostpointercapture=()=>finishPointerDrag(false);window.addEventListener('blur',()=>finishPointerDrag(false));
$('quit').onclick=()=>pet.quit();$('refresh').onclick=()=>action(()=>pet.refresh());
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;editing=false;renderPanel();});
const reasons={all:'모든 메시지',mention:'내 멘션','mention-all':'@all 전체 멘션','mention-here':'@here 그룹 멘션',keyword:'키워드 일치'};
function items(){return Object.values(state?.items||{}).sort((a,b)=>new Date(a.ts)-new Date(b.ts));}
let bubbleKey='';
function renderChrome(){
 const list=items(),stack=$('bubble');$('badge').textContent=list.length||'';$('count').textContent=list.length;$('status').textContent=state.status||'';stack.hidden=!list.length;
 const nextKey=JSON.stringify(list.map(i=>[i.id,i.room,i.text]));
 if(nextKey!==bubbleKey){
  const previous=stack.scrollTop,atBottom=stack.scrollHeight-stack.clientHeight-previous<8;
  stack.replaceChildren();
  for(const i of [...list].reverse()){
   const b=button('',()=>pet.open(i.id));b.className='message-bubble';b.dataset.messageId=i.id;
   const room=el('strong',i.room),text=el('span',i.text||'(첨부 메시지)');b.append(room,text);b.title=`${i.room} · ${i.text||'(첨부 메시지)'}`;stack.append(b);
  }
  bubbleKey=nextKey;requestAnimationFrame(()=>{stack.scrollTop=atBottom?stack.scrollHeight:previous});
 }
 const look=SnailAppearance.normalize(state.settings.appearance),key=JSON.stringify(look);if(key!==appearanceKey){$('snail-art').innerHTML=SnailAppearance.svg(look,'desktop');appearanceKey=key;}
}
function title(heading,description){$('title').replaceChildren(el('h1',heading),el('p',description));}
function input(value='',type='text'){const n=el('input');n.type=type;n.value=value;return n;}
function select(value,options){const n=el('select');for(const [v,t] of options){const o=el('option',t);o.value=v;n.append(o)}n.value=value;return n;}
function row(parent,label,node){const d=el('div');d.className='form-row';const l=el('label',label);node.id=`field-${fieldSequence++}`;l.htmlFor=node.id;d.append(l,node);parent.append(d);return node;}
function button(text,fn,primary=false){const b=el('button',text);if(primary)b.className='primary';b.onclick=()=>action(fn);return b;}
function card(){const c=el('div');c.className='card';return c;}
function renderPanel(){if(!panelMode||!state)return;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));const root=$('content'),main=document.querySelector('main');main.classList.toggle('customize-main',tab==='customize');root.classList.toggle('customize-content',tab==='customize');root.replaceChildren();main.scrollTop=0;editing=['connection','rules','customize'].includes(tab);
 if(tab==='connection'){
  title('서버와 캐릭터 설정','사용하는 Rocket.Chat 서버 주소를 입력하세요. 계정의 개인 접근 토큰은 이 화면에서만 입력하세요.');
  renderPlacement(root);
  const s=structuredClone(state.settings),c=card();root.append(c);
  const url=row(c,'서버 주소',input(s.baseUrl));url.name='baseUrl';
  const user=row(c,'사용자 ID',input(s.userId));user.autocomplete='off';
  const token=row(c,'개인 접근 토큰',input('','password'));token.name='token';token.autocomplete='new-password';token.placeholder=state.hasToken?'저장된 토큰 사용 중 · 변경할 때만 입력':'발급된 토큰을 여기에 붙여넣기';
  c.append(el('p','회사 Rocket.Chat의 내 계정에서 발급한 사용자 ID와 개인 접근 토큰을 사용합니다. 토큰은 Windows 암호화 저장소로 보호합니다.'));
  const size=row(c,'캐릭터 크기',input(s.size,'range'));size.min='.7';size.max='1.5';size.step='.01';size.value=s.size;const sizeValue=el('p',`${Math.round(s.size*100)}% · 1%씩 조절`);c.append(sizeValue);size.oninput=()=>sizeValue.textContent=`${Math.round(size.value*100)}% · 저장하면 적용됩니다`;
  const motion=row(c,'캐릭터 움직이기',input('','checkbox'));motion.name='motionEnabled';motion.checked=s.motionEnabled!==false;
  motion.onchange=async()=>{motion.disabled=true;const result=await action(()=>pet.setMotion(motion.checked));if(!result)motion.checked=state.settings.motionEnabled!==false;motion.disabled=false;};
  c.append(el('p','끄면 캐릭터가 그 자리에서 멈춥니다. 움직임 설정은 즉시 저장됩니다.'));
  const startup=row(c,'Windows 시작 시 실행',input('','checkbox'));startup.checked=s.startup;
  const actions=el('div');actions.className='actions';actions.append(button('저장하고 연결',async()=>{await pet.save({settings:{...s,baseUrl:url.value,userId:user.value,size:Number(size.value),startup:startup.checked,motionEnabled:state.settings.motionEnabled!==false},newToken:token.value});token.value='';toast('설정을 저장했습니다. 계정이 입력되어 있으면 연결을 시작합니다.');},true),button('서버 접근 확인',async()=>{const r=await pet.probe();toast(`Rocket.Chat ${r.version} · 공개 서버 정보 접근 성공`)}));c.append(actions);
  const note=el('p','말풍선이나 메시지의 열기 버튼을 누르면 설치된 Rocket.Chat 데스크톱 앱에서 원본 메시지가 열립니다. 자동 정리는 서버의 읽음 정보를 받은 뒤에 이루어집니다.');note.className='note';root.append(note);
  root.append(button('달팽이 꾸미기',()=>document.querySelector('[data-tab=customize]').click()));
 } else if(tab==='rules'){
  renderRules(root);
 } else if(tab==='customize'){
  renderCustomization(root);
 } else {
  const history=tab==='history';title(history?'최근 정리':'확인 대기',history?'7일 이내, 최근 100개를 복구할 수 있습니다. 복구 후에는 새로운 읽음 변화를 확인할 때까지 유지됩니다.':'서버의 읽음 정보를 확인하면 자동 정리합니다. 이미 읽은 스레드가 남아 있다면 직접 확인 완료를 누르세요.');
  const list=history?state.archive:items();if(!list.length){const empty=el('div',history?'아직 정리된 메시지가 없습니다.':'대기 중인 메시지가 없습니다.');empty.className='empty';root.append(empty)}
  for(const i of list){
    const a=el('article'),meta=el('div',`${i.room} · ${reasons[i.reason]||i.reason}${i.tmid?' · 스레드 답글':''}${i.restoredAfterLs?' · 복구됨':''}${history&&i.archiveReason==='manual'?' · 직접 확인 완료':''}`);meta.className='message-meta';
    const text=el('div',i.text||'(첨부 메시지)');text.className='message-text';const actions=el('div');actions.className='actions';actions.append(button('데스크톱 앱에서 열기',()=>pet.open(i.id)));
    if(history)actions.append(button('확인 대기로 복구',()=>pet.restore(i.id)));
    else if(i.tmid){const confirm=button('직접 확인 완료',()=>pet.confirm(i.id));confirm.title='이 앱의 확인 대기에서 정리합니다. Rocket.Chat 읽음 상태는 변경하지 않습니다.';actions.append(confirm);}
    a.dataset.messageId=i.id;a.append(meta,text,actions);root.append(a);
  }
 }
}
function renderPlacement(root){
 const c=card();c.dataset.placementForm='';c.append(el('h2','캐릭터 배치'),el('p','표시할 모니터와 달팽이가 걸어 다닐 가장자리를 고르세요.'));root.append(c);
 const monitor=row(c,'표시할 모니터',select('',[]));monitor.name='displayId';
 const edge=row(c,'이동 위치',select(state.desktopPlacement?.edge||'bottom',[['bottom','하단 · 좌우로 걷기'],['left','좌측 · 위아래로 걷기'],['right','우측 · 위아래로 걷기'],['top','상단 · 거꾸로 매달려 좌우로 걷기'],['free','자유 위치 · 드래그한 높이에서 좌우로 걷기']]));edge.name='placementEdge';
 const diagram=el('div');diagram.className='placement-map';diagram.setAttribute('aria-hidden','true');const path=el('span');path.className='placement-path';const snail=el('span');snail.className='placement-snail';diagram.append(path,snail);c.append(diagram);
 const hint=el('p');hint.className='placement-hint';c.append(hint);
 const notes={bottom:'화면 아래에서 좌우로 걷습니다.',left:'화면 왼쪽 벽을 따라 위아래로 걷습니다.',right:'화면 오른쪽 벽을 따라 위아래로 걷습니다.',top:'화면 위에 거꾸로 매달려 좌우로 걷습니다.',free:'드래그로 자유롭게 배치하고, 놓은 높이에서 좌우로 걷습니다.'};
 function preview(){const e=edge.value;diagram.dataset.edge=e;snail.innerHTML=SnailAppearance.svg(state.settings.appearance,'placement');snail.firstElementChild.style.transform=`rotate(${{bottom:0,left:90,right:-90,top:180,free:0}[e]}deg) scaleX(${['right','top'].includes(e)?-1:1})`;hint.textContent=notes[e]+(monitor.value!=='primary'&&!state.displays?.some(d=>d.id===monitor.value)?' 선택한 모니터가 연결되어 있지 않아 주 모니터에 임시 표시 중입니다.':'');}
 c.syncDisplays=()=>{
  const desired=c.dataset.dirty==='true'?monitor.value:(state.desktopPlacement?.displayId||'primary');
  const options=[['primary','주 모니터 자동 선택'],...(state.displays||[]).map(d=>[d.id,`${d.number}. ${d.label} · ${d.width} × ${d.height}${d.primary?' (주 모니터)':''}`])];
  if(desired!=='primary'&&!options.some(([id])=>id===desired))options.push([desired,'연결되지 않은 모니터 · 주 모니터에 임시 표시']);
  const signature=JSON.stringify(options);if(monitor.dataset.options!==signature){monitor.replaceChildren(...options.map(([id,name])=>{const o=el('option',name);o.value=id;return o}));monitor.dataset.options=signature;}
  monitor.value=desired;if(c.dataset.dirty!=='true')edge.value=state.desktopPlacement?.edge||'bottom';preview();
 };
 for(const node of [monitor,edge])node.onchange=()=>{c.dataset.dirty='true';preview();};
 c.append(button('위치 적용',async()=>{await pet.setPlacement({displayId:monitor.value,edge:edge.value});c.dataset.dirty='false';c.syncDisplays();toast('표시 모니터와 이동 위치를 저장했습니다.');},true));
 c.syncDisplays();
}
function renderCustomization(root){
 title('달팽이 꾸미기','껍데기 무늬부터 몸통 색과 표정까지, 마음에 드는 모습으로 꾸며보세요.');
 let draft=SnailAppearance.normalize(state.settings.appearance),savedKey=JSON.stringify(draft);
 const layout=el('div');layout.className='appearance-layout';root.append(layout);
 const preview=card();preview.className+=' appearance-preview';preview.append(el('h2','미리보기'));
 const art=el('div');art.id='appearance-preview-art';preview.append(art,el('b','나의 달팽이'));
 const previewNote=el('p','선택한 모습이 여기에서 바로 보여요.');preview.append(previewNote);layout.append(preview);
 const controls=el('div');controls.className='appearance-controls';layout.append(controls);
 function section(name,description){const c=card();c.append(el('h2',name),el('p',description));controls.append(c);return c;}
 const shell=section('껍데기','무늬와 색을 조합해 나만의 등을 만들어보세요.');
 const patternChoices=el('div');patternChoices.className='appearance-choices patterns';patternChoices.setAttribute('role','group');patternChoices.setAttribute('aria-label','껍데기 무늬');shell.append(patternChoices);
 const shellPalette=[['살구','#f7aa65'],['라벤더','#b4a0df'],['하늘','#86bddd'],['민트','#8ac9b4'],['레몬','#edd582'],['장미','#e5a3bd']];
 const bodyPalette=[['민트','#5ac8ba'],['크림','#f4dba4'],['분홍','#eaa9b7'],['보라','#b7a3df'],['하늘','#88bddf'],['살구','#edb181']];
 const colorInputs={},colorChips={};
 function colorControl(parent,label,key,palette){
  const wrapper=el('div');wrapper.className='color-controls';const picker=input(draft[key],'color');picker.name=key;picker.title=label+' 직접 선택';picker.setAttribute('aria-label',label+' 직접 선택');colorInputs[key]=picker;
  const chips=el('div');chips.className='color-chips';colorChips[key]=[];
  for(const [name,color] of palette){const chip=button('',()=>{draft[key]=color;refresh();});chip.className='color-chip';chip.style.backgroundColor=color;chip.title=name;chip.setAttribute('aria-label',`${label} ${name}`);chip.dataset.color=color;colorChips[key].push(chip);chips.append(chip);}
  picker.oninput=()=>{draft[key]=picker.value;refresh();};wrapper.append(picker,chips);row(parent,label,wrapper);picker.id=wrapper.id+'-picker';wrapper.parentElement.querySelector('label').htmlFor=picker.id;return picker;
 }
 colorControl(shell,'껍데기 색','shellColor',shellPalette);
 colorControl(shell,'무늬 색','patternColor',[['코랄','#bd6d64'],['보라','#76609e'],['파랑','#477a9f'],['초록','#427e68'],['브라운','#9d7542'],['화이트','#fff8ef']]);
 const body=section('몸통','좋아하는 색을 고르거나 색상 선택기를 눌러 직접 골라보세요.');colorControl(body,'몸통 색','bodyColor',bodyPalette);
 const eyeCard=section('눈 모양','동그란 눈, 웃는 눈, 졸린 눈, 반짝이는 눈 중에서 골라보세요.');
 const eyeChoices=el('div');eyeChoices.className='appearance-choices eyes';eyeChoices.setAttribute('role','group');eyeChoices.setAttribute('aria-label','눈 모양');eyeCard.append(eyeChoices);
 const patternButtons=[],eyeButtons=[];
 for(const [value,name] of SnailAppearance.patterns){const b=button('',()=>{draft.shellPattern=value;refresh();});b.className='appearance-choice';b.dataset.shellPattern=value;b.setAttribute('aria-label',name);patternButtons.push({b,value,name});patternChoices.append(b);}
 for(const [value,name] of SnailAppearance.eyes){const b=button('',()=>{draft.eyeStyle=value;refresh();});b.className='appearance-choice';b.dataset.eyeStyle=value;b.setAttribute('aria-label',name);eyeButtons.push({b,value,name});eyeChoices.append(b);}
 const bar=el('div');bar.className='appearance-save-bar';const note=el('small');
 const apply=button('적용하고 저장',async()=>{const result=await pet.setAppearance(draft);draft=SnailAppearance.normalize(result.appearance);savedKey=JSON.stringify(draft);refresh();toast('달팽이 모습을 적용하고 저장했습니다.');},true);apply.dataset.applyAppearance='';
 bar.append(note,button('기본 모습으로',()=>{draft={...SnailAppearance.defaults};refresh();}),apply);root.append(bar);
 function refresh(){
  art.innerHTML=SnailAppearance.svg(draft,'preview');
  for(const {b,value,name} of patternButtons){b.replaceChildren();const thumbnail=el('span');thumbnail.innerHTML=SnailAppearance.svg({...draft,shellPattern:value},`pattern-${value}`);b.append(thumbnail,el('small',name));b.setAttribute('aria-pressed',String(draft.shellPattern===value));}
  for(const {b,value,name} of eyeButtons){b.replaceChildren();const thumbnail=el('span');thumbnail.innerHTML=SnailAppearance.svg({...draft,eyeStyle:value},`eyes-${value}`);b.append(thumbnail,el('small',name));b.setAttribute('aria-pressed',String(draft.eyeStyle===value));}
  for(const key of Object.keys(colorInputs)){colorInputs[key].value=draft[key];for(const b of colorChips[key])b.setAttribute('aria-pressed',String(b.dataset.color===draft[key]));}
  note.textContent=JSON.stringify(draft)===savedKey?'현재 저장된 모습입니다.':'미리보기 중 · 적용하고 저장을 누르면 캐릭터에 반영됩니다.';
 }
 refresh();
}
function renderRules(root){
 title('방과 키워드','방에서 받을 메시지와 키워드를 각각 설정하세요.');
 const s=structuredClone(state.settings),rooms=state.rooms||[];s.rooms??={};s.keywords??=[];
 const modes=[['all','모든 메시지'],['mentions','멘션 또는 키워드'],['ignore','무시']];
 function section(name,heading,description){const c=card();c.dataset.section=name;c.classList.add('rules-card');c.append(el('h2',heading),el('p',description));root.append(c);return c;}
 const defaults=section('defaults','기본 메시지 설정','개별 규칙을 지정하지 않은 방에 적용됩니다.');
 const def=row(defaults,'일반 채팅방',select(s.defaultMode,modes)),dm=row(defaults,'DM',select(s.dmMode,modes));
 def.name='defaultMode';dm.name='dmMode';def.onchange=()=>{s.defaultMode=def.value;drawRooms()};dm.onchange=()=>{s.dmMode=dm.value;drawRooms()};

 const perRoom=section('rooms','방마다 개별 규칙 적용하기','기본 설정과 다르게 받고 싶은 방을 선택해 설정하세요.');
 const details=el('details');details.className='room-rules';perRoom.append(details);
 const summary=el('summary'),summaryText=el('span','방별 설정 펼치기'),summaryCount=el('small');summary.append(summaryText,summaryCount);details.append(summary);
 details.ontoggle=()=>summaryText.textContent=details.open?'방별 설정 접기':'방별 설정 펼치기';
 const search=input();search.name='roomSearch';search.placeholder='방 이름으로 검색';search.setAttribute('aria-label','개별 규칙을 적용할 방 검색');details.append(search);
 const roomList=el('div');roomList.className='room-mode-list';details.append(roomList);
 function drawRooms(){
  roomList.replaceChildren();const count=Object.values(s.rooms).filter(r=>r.mode).length;summaryCount.textContent=count?`${count}개 방에 개별 규칙 적용 중`:'모든 방이 기본 설정 사용 중';
  const matching=rooms.filter(r=>(r.displayName||r.name||r.rid).toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
  if(!matching.length){roomList.append(el('p',rooms.length?'검색한 방이 없습니다.':'계정을 연결하면 방 목록이 나타납니다.'));return;}
  for(const room of matching){
   const name=room.displayName||room.name||room.rid,base=room.t==='d'?s.dmMode:s.defaultMode;
   const chosen=select(s.rooms[room.rid]?.mode||'',[['',`기본 설정 따르기 · ${modes.find(m=>m[0]===base)?.[1]}`],...modes]);chosen.dataset.roomMode=room.rid;chosen.setAttribute('aria-label',`${name}의 메시지 수신 방식`);
   chosen.onchange=()=>{if(chosen.value){s.rooms[room.rid]??={keywords:[]};s.rooms[room.rid].mode=chosen.value;}else if(s.rooms[room.rid]){delete s.rooms[room.rid].mode;if(!s.rooms[room.rid].keywords?.length)delete s.rooms[room.rid];}const count=Object.values(s.rooms).filter(r=>r.mode).length;summaryCount.textContent=count?`${count}개 방에 개별 규칙 적용 중`:'모든 방이 기본 설정 사용 중';};
   row(roomList,`${room.t==='d'?'DM · ':''}${name}`,chosen);
  }
 }
 search.oninput=drawRooms;drawRooms();

 const keywords=section('keywords','키워드 설정','설정한 단어가 포함된 메시지를 모읍니다. 키워드를 적용할 곳은 아래에서 따로 선택하세요.');
 const scope=row(keywords,'키워드를 적용할 곳',select('',[['','모든 방에 공통 적용'],...rooms.map(r=>[r.rid,`${r.displayName||r.name||r.rid}에서만 적용`]) ]));scope.name='keywordScope';
 const scopeNote=el('p');scopeNote.className='keyword-scope-note';keywords.append(scopeNote);
 const list=el('div');list.className='keyword-list';keywords.append(list);
 function listRules(){return scope.value?(s.rooms[scope.value]?.keywords||[]):s.keywords;}
 function drawKeywords(){
  list.replaceChildren();scopeNote.textContent=scope.value?'이 방 전용 키워드입니다. 공통 키워드도 함께 적용됩니다.':'무시로 설정한 방을 제외한 모든 방에 적용됩니다.';
  for(const [i,r] of listRules().entries()){const d=el('div');d.className='keyword-row';const text=el('span',r.term);text.append(el('small',`${{contains:'포함',word:'단어',regex:'정규식'}[r.kind]} · 우선순위 ${r.priority||0} · ${r.caseSensitive?'대소문자 구분':'대소문자 무시'}${r.exclude?.length?' · 제외: '+r.exclude.join(', '):''}`));d.append(text,button(r.enabled===false?'켜기':'끄기',()=>{r.enabled=r.enabled===false;drawKeywords()}),button('삭제',()=>{listRules().splice(i,1);drawKeywords()}));list.append(d)}
  if(!listRules().length)list.append(el('p','이곳에 적용할 키워드가 없습니다.'));
 }
 scope.onchange=drawKeywords;
 const form=el('div');form.className='keyword-create';form.append(el('h3','새 키워드 추가'));keywords.append(form);
 const term=row(form,'키워드',input()),kind=row(form,'일치 방식',select('contains',[['contains','포함'],['word','단어 경계'],['regex','정규식']]));term.name='keywordTerm';term.placeholder='예: 긴급, 검토 요청';
 const advanced=el('details');advanced.className='keyword-advanced';advanced.append(el('summary','키워드 세부 조건'));form.append(advanced);
 const sensitive=row(advanced,'대소문자 구분',input('','checkbox')),exclude=row(advanced,'제외어',input()),priority=row(advanced,'우선순위',input('0','number'));exclude.placeholder='쉼표로 구분 · 해당 키워드에만 적용';
 form.append(button('키워드 추가',()=>{if(!term.value.trim())return;const r={term:term.value.trim(),kind:kind.value,caseSensitive:sensitive.checked,exclude:exclude.value.split(',').map(v=>v.trim()).filter(Boolean),priority:Number(priority.value)||0};if(r.kind==='regex')new RegExp(r.term,'u');if(scope.value){s.rooms[scope.value]??={keywords:[]};s.rooms[scope.value].keywords??=[];s.rooms[scope.value].keywords.push(r);}else s.keywords.push(r);term.value='';drawKeywords();}));drawKeywords();
 const saveBar=el('div');saveBar.className='rules-save-bar';saveBar.append(el('small','방 설정과 키워드 변경사항을 함께 저장합니다.'),button('변경사항 저장',async()=>{await pet.save({settings:{...s,motionEnabled:state.settings.motionEnabled!==false}});toast('방 설정과 키워드를 저장했습니다.');},true));root.append(saveBar);
}
pet.onState(v=>{state=v;renderChrome();const motion=document.querySelector('[name=motionEnabled]');if(motion)motion.checked=state.settings.motionEnabled!==false;document.querySelector('[data-placement-form]')?.syncDisplays?.();if(!editing)renderPanel();});
pet.onGeometry(g=>{const p=$('character');p.style.left=`${g.petLeft}px`;p.style.top=`${g.petTop}px`;p.style.bottom='auto';p.style.width=p.style.height=`${g.petSize}px`;p.classList.remove('reverse');$('snail-art').style.transform=`rotate(${g.rotation||0}deg) scaleX(${g.mirror||1})`;p.dataset.edge=g.edge||'free';p.classList.toggle('paused',g.paused);$('bubble').style.left=`${g.bubbleLeft}px`;$('bubble').style.top=`${g.bubbleTop}px`;$('bubble').style.height=`${g.bubbleHeight}px`;$('bubble').style.bottom='auto';});
pet.state().then(v=>{state=v;const requested=new URLSearchParams(location.search).get('tab');if(['customize','connection'].includes(requested))tab=requested;else if(!v.hasToken)tab='connection';renderChrome();renderPanel();});
