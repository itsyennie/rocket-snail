const {desktopMessageUrl}=require('./protocol.cjs');
async function openDesktopMessage(base,item,openExternal) {
  const link=desktopMessageUrl(base,item);
  try{await openExternal(link,{activate:true});}
  catch{throw Error('Rocket.Chat 데스크톱 앱을 열지 못했습니다. 설치된 앱의 rocketchat 링크 연결을 확인하세요.');}
}
module.exports={openDesktopMessage};
