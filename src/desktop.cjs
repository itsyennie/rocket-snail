function layout(area, petX, scale=1,petY=null,messageCount=1) {
  const petSize=Math.round(90*scale),width=Math.min(340,area.width);
  const left=Math.round(Math.max(area.x,Math.min(petX,area.x+area.width-petSize)));
  const windowX=Math.round(Math.max(area.x,Math.min(left-(width-petSize)/2,area.x+area.width-width)));
  const petLeft=left-windowX;
  const top=Math.round(Math.max(area.y,Math.min(petY??area.y+area.height-petSize,area.y+area.height-petSize)));
  const desired=Math.max(1,Math.min(5,messageCount))*80-8,above=top-area.y,below=area.y+area.height-top-petSize;
  const upward=above>=desired+8||above>=below,bubbleHeight=Math.max(0,Math.min(desired,(upward?above:below)-8));
  const height=Math.min(Math.max(230,petSize+bubbleHeight+16),area.height);
  const windowY=Math.round(Math.max(area.y,Math.min(upward?top-(height-petSize):top,area.y+area.height-height))),petTop=top-windowY;
  return {bounds:{x:Math.round(windowX),y:Math.round(windowY),width,height},petLeft:Math.round(petLeft),petTop:Math.round(petTop),petSize,bubbleHeight,bubbleLeft:Math.round(Math.max(4,Math.min(width-264,petLeft+petSize/2-130))),bubbleTop:Math.round(upward?petTop-bubbleHeight-8:petTop+petSize+8)};
}
function beginDrag(position,pointer){return {origin:{...position},start:{...pointer},moved:false};}
function moveDrag(drag,pointer,area,scale=1){
  const dx=pointer.x-drag.start.x,dy=pointer.y-drag.start.y;
  if(!drag.moved&&Math.hypot(dx,dy)<5)return {...drag.origin};
  drag.moved=true;const petSize=Math.round(90*scale);
  return {x:Math.max(area.x,Math.min(drag.origin.x+dx,area.x+area.width-petSize)),y:Math.max(area.y,Math.min(drag.origin.y+dy,area.y+area.height-petSize))};
}
function savedPosition(area,position,displayId,scale=1){const size=Math.round(90*scale);return {displayId,x:Math.max(0,Math.min(1,(position.x-area.x)/Math.max(1,area.width-size))),y:Math.max(0,Math.min(1,(position.y-area.y)/Math.max(1,area.height-size)))};}
function restorePosition(area,saved,scale=1){const size=Math.round(90*scale);if(!saved||!Number.isFinite(saved.x)||!Number.isFinite(saved.y))return {x:area.x+area.width/2,y:null};return {x:area.x+Math.max(0,Math.min(1,saved.x))*Math.max(0,area.width-size),y:area.y+Math.max(0,Math.min(1,saved.y))*Math.max(0,area.height-size)};}
module.exports={layout,beginDrag,moveDrag,savedPosition,restorePosition};
