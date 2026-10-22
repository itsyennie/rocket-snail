function layout(area, petX, scale=1,petY=null) {
  const petSize=Math.round(90*scale),width=Math.min(340,area.width),height=Math.min(Math.max(230,petSize+160),area.height);
  const left=Math.round(Math.max(area.x,Math.min(petX,area.x+area.width-petSize)));
  const windowX=Math.round(Math.max(area.x,Math.min(left-(width-petSize)/2,area.x+area.width-width)));
  const petLeft=left-windowX;
  const top=Math.round(Math.max(area.y,Math.min(petY??area.y+area.height-petSize,area.y+area.height-petSize)));
  const windowY=Math.round(Math.max(area.y,Math.min(top-(height-petSize),area.y+area.height-height))),petTop=top-windowY;
  return {bounds:{x:Math.round(windowX),y:Math.round(windowY),width,height},petLeft:Math.round(petLeft),petTop:Math.round(petTop),petSize,bubbleLeft:Math.round(Math.max(4,Math.min(width-264,petLeft+petSize/2-130))),bubbleTop:Math.round(Math.max(0,Math.min(height-72,petTop>=80?petTop-80:petTop+petSize+8)))};
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
