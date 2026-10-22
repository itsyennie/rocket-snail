const {timestamp}=require('./protocol.cjs');
const {runInNewContext}=require('node:vm');
function compileRule(rule) {
  if (!rule?.term) return null;
  if (rule.kind === 'regex') {
    if (rule.term.length > 200) throw new Error('정규식은 200자 이내로 입력하세요.');
    return new RegExp(rule.term, rule.caseSensitive ? 'u' : 'iu');
  }
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const term = escape(rule.term.normalize('NFC'));
  const body = rule.kind === 'word' ? `(?<![\\p{L}\\p{N}_])${term}(?![\\p{L}\\p{N}_])` : term;
  return new RegExp(body, rule.caseSensitive ? 'u' : 'iu');
}
function mentionApplies(message, userId) {
  return Array.isArray(message.mentions) && message.mentions.some(m => {
    if (m?._id === userId && (m.type === 'user' || !m.type)) return true;
    // Rocket.Chat 8.5 MentionsServer emits {_id:'all'|'here', username:'all'|'here'}.
    // notifyUsersOnMessage increments the subscribed members' group-mention queue for both.
    return ['all', 'here'].includes(m?._id) && m.username === m._id && !m.type;
  });
}
function matchMessage(message, room, settings, userId) {
  if (!message?._id || !message?.rid || message.u?._id === userId) return null;
  const mode = settings.rooms?.[room.rid]?.mode || (room.t === 'd' ? settings.dmMode : settings.defaultMode) || 'mentions';
  if (mode === 'ignore') return null;
  const rules = [...(settings.keywords || []), ...(settings.rooms?.[room.rid]?.keywords || [])].filter(r => r.enabled !== false).sort((a,b)=>(b.priority||0)-(a.priority||0));
  const content = String(message.msg || '').normalize('NFC');
  const keyword = rules.find(r => {
    try {
      const regex=compileRule(r);
      const matched=r.kind==='regex'?runInNewContext('new RegExp(pattern, flags).test(text)',{pattern:regex.source,flags:regex.flags,text:content},{timeout:25,contextCodeGeneration:{strings:false,wasm:false}}):regex?.test(content);
      if(!matched)return false;
      return !(r.exclude || []).some(e => e && new RegExp(e.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),r.caseSensitive?'u':'iu').test(content));
    } catch { return false; }
  });
  const mentioned = mentionApplies(message, userId);
  if (mode !== 'all' && !mentioned && !keyword) return null;
  const special=message.mentions?.find(m=>['all','here'].includes(m._id)&&m.username===m._id&&!m.type)?._id;
  return {reason: mode === 'all' ? 'all' : mentioned ? special ? `mention-${special}` : 'mention' : 'keyword', keyword: keyword?.term || null};
}
function readDecision(item, subscription) {
  if (!subscription || !subscription.ls || !item.ts) return 'hold';
  const seen = timestamp(subscription.ls);
  const sent = timestamp(item.ts);
  if (!Number.isFinite(seen) || !Number.isFinite(sent)) return 'hold';
  if(item.tmid) return 'hold'; // Room ls alone cannot prove a thread reply was read.
  if(item.restoredAfterLs!=null && seen<=item.restoredAfterLs) return 'hold';
  // ls is room-level last-seen activity. Equal timestamps may be ambiguous.
  return seen > sent ? 'archive' : 'hold';
}
module.exports = {compileRule, mentionApplies, matchMessage, readDecision};
