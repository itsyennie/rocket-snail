const DEFAULT_SERVER = '';
const READ_ENDPOINTS = new Set(['me', 'rooms.get', 'subscriptions.get', 'channels.history', 'groups.history', 'im.history', 'rooms.history']);
function serverUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || !['', '/'].includes(u.pathname)) throw Error('HTTPS 서버의 기본 주소만 입력하세요.');
  return u.origin;
}
function timestamp(value) {
  const v = value && typeof value === 'object' && '$date' in value ? value.$date : value;
  return typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : NaN;
}
function modernHistory(version) {
  const [major, minor] = String(version).split('.').map(Number);
  return major > 8 || major === 8 && minor >= 9;
}
function historyRequest(version, room, range, position = {}) {
  if (modernHistory(version)) return {endpoint:'rooms.history', params:{roomId:room.rid,count:100,showThreadMessages:true,...(position.cursor?{previous:position.cursor}:{})}};
  const endpoint = {c:'channels.history',p:'groups.history',d:'im.history'}[room.t];
  if (!endpoint) throw Error('지원하지 않는 방 종류입니다.');
  return {endpoint,params:{roomId:room.rid,count:100,offset:position.offset||0,oldest:range.oldest,latest:range.latest,inclusive:true,showThreadMessages:true}};
}
function messageUrl(base, item) {
  const prefix = {c:'channel',p:'group',d:'direct'}[item.roomType];
  if (!prefix) throw Error('메시지의 방 종류를 확인할 수 없습니다.');
  const url = new URL(`${serverUrl(base)}/${prefix}/${encodeURIComponent(item.roomType==='d'?item.rid:item.roomName||item.room)}`);
  url.searchParams.set('msg',item.id);
  return url.toString();
}
function desktopMessageUrl(base,item) {
  if(typeof item?.id!=='string'||!item.id||typeof item.rid!=='string'||!item.rid)throw Error('메시지와 채팅방 정보를 확인할 수 없습니다.');
  const origin=serverUrl(base),message=new URL(messageUrl(origin,item));
  let route=message.pathname.slice(1);
  // Desktop 4.18.2 validates the first path-segment character as ASCII.
  // A normal URL dot segment also permits percent-encoded Korean room names;
  // its URL resolver removes the dot and keeps the original message route.
  if(/^(channel|group)\/%/.test(route))route=route.replace(/^(channel|group)\//,'$1/./');
  if(!/^\/?(direct|group|channel)\/[0-9a-zA-Z-_.]+/.test(route))throw Error('데스크톱 앱에서 열 수 없는 방 경로입니다.');
  const link=new URL('rocketchat://room');
  link.searchParams.set('host',origin);link.searchParams.set('rid',item.rid);link.searchParams.set('path',route+message.search);
  return link.toString();
}
module.exports={DEFAULT_SERVER,READ_ENDPOINTS,serverUrl,timestamp,modernHistory,historyRequest,messageUrl,desktopMessageUrl};
