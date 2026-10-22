const test=require('node:test'),assert=require('node:assert/strict');
const {desktopMessageUrl,messageUrl}=require('../src/protocol.cjs');
const {openDesktopMessage}=require('../src/desktop-link.cjs');
const server='https://chat.example.com';
test('desktop links preserve original channel/private/DM message and contain no credentials',()=>{
  for(const [roomType,roomName] of [['c','general'],['p','design-private'],['d','다른 사용자'],['c','공지사항'],['p','디자인 팀']]){
    const item={id:'message+id&one',rid:'roomid123',roomType,roomName,token:'never-include',userId:'never-include'};
    const link=new URL(desktopMessageUrl(server,item));assert.equal(link.protocol,'rocketchat:');assert.equal(link.hostname,'room');
    assert.equal(link.searchParams.get('host'),server);assert.equal(link.searchParams.get('rid'),item.rid);
    assert.deepEqual([...link.searchParams.keys()],['host','rid','path']);
    const route=link.searchParams.get('path');assert.match(route,/^\/?(direct|group|channel)\/[0-9a-zA-Z-_.]+/);
    // Same parse and URL-resolution rules as Desktop 4.18.2 performOpenRoom.
    assert.equal(new URL(route,link.searchParams.get('host')).href,messageUrl(server,item));
    assert.equal(new URL(route,server).searchParams.get('msg'),item.id);
  }
});
test('desktop launcher uses one custom-protocol call and requests activation',async()=>{
  const calls=[];const item={id:'m1',rid:'r1',roomType:'d'};
  await openDesktopMessage(server,item,async(...args)=>calls.push(args));
  assert.equal(calls.length,1);assert.match(calls[0][0],/^rocketchat:\/\/room\?/);assert.deepEqual(calls[0][1],{activate:true});assert.deepEqual(item,{id:'m1',rid:'r1',roomType:'d'});
});
test('launch failure is reported without falling back to a web browser',async()=>{
  let calls=0;
  await assert.rejects(openDesktopMessage(server,{id:'m1',rid:'r1',roomType:'c',roomName:'general'},async()=>{calls++;throw Error('no handler')}),/데스크톱 앱을 열지 못했습니다/);
  assert.equal(calls,1);
  assert.throws(()=>desktopMessageUrl(server,{rid:'r1',roomType:'c'}),/메시지와 채팅방/);
});
