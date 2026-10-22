const {serverUrl}=require('./protocol.cjs');
const {compileRule}=require('./rules.cjs');
const {normalize:normalizeAppearance}=require('./appearance.js');
const modes=new Set(['all','mentions','ignore']);
function rules(input=[]) {
  if(!Array.isArray(input)||input.length>100)throw Error('키워드는 범위별 100개까지 설정할 수 있습니다.');
  return input.map(r=>{
    if(typeof r.term!=='string'||!r.term.trim()||r.term.length>200||!['contains','word','regex'].includes(r.kind))throw Error('키워드와 일치 방식을 확인하세요.');
    const rule={term:r.term.normalize('NFC'),kind:r.kind,caseSensitive:!!r.caseSensitive,enabled:r.enabled!==false,exclude:(r.exclude||[]).map(x=>String(x).normalize('NFC')).filter(Boolean).slice(0,50),priority:Math.max(-1000,Math.min(1000,Number(r.priority)||0))};compileRule(rule);return rule;
  });
}
function validateSettings(next) {
  if(!modes.has(next.defaultMode)||!modes.has(next.dmMode))throw Error('방 모드가 올바르지 않습니다.');
  const rooms={};for(const [id,r] of Object.entries(next.rooms||{})){if(r.mode!==undefined&&!modes.has(r.mode))throw Error('방별 모드가 올바르지 않습니다.');rooms[id]={...(r.mode?{mode:r.mode}:{}),keywords:rules(r.keywords)};}
  return {baseUrl:serverUrl(next.baseUrl),userId:String(next.userId||'').trim(),defaultMode:next.defaultMode,dmMode:next.dmMode,rooms,keywords:rules(next.keywords),size:Math.max(.7,Math.min(1.5,Number(next.size)||1)),startup:!!next.startup,motionEnabled:next.motionEnabled!==false,appearance:normalizeAppearance(next.appearance,true)};
}
module.exports={validateSettings};
