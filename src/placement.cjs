const edges=['bottom','left','right','top','free'];
function normalizePlacement(value={},strict=false){
  const edge=value?.edge??'bottom',displayId=value?.displayId==null?'primary':String(value.displayId);
  if(strict&&(!edges.includes(edge)||!/^primary$|^-?\d+$/.test(displayId)))throw Error('표시할 모니터와 이동 위치를 확인하세요.');
  return {displayId:/^primary$|^-?\d+$/.test(displayId)?displayId:'primary',edge:edges.includes(edge)?edge:'bottom'};
}
function chooseDisplay(displays,primaryId,requested){return displays.find(d=>String(d.id)===String(requested))||displays.find(d=>d.id===primaryId)||displays[0];}
function snapToEdge(area,position,scale,edge){
  const size=Math.round(90*scale),maxX=Math.max(area.x,area.x+area.width-size),maxY=Math.max(area.y,area.y+area.height-size);
  let x=Math.round(Math.max(area.x,Math.min(position.x,maxX))),y=Math.round(Math.max(area.y,Math.min(position.y??maxY,maxY)));
  if(edge==='left')x=area.x;if(edge==='right')x=maxX;if(edge==='top')y=area.y;if(edge==='bottom')y=maxY;
  return {x,y};
}
function advanceAlongEdge(area,position,scale,edge,direction,paused,step=1.6){
  const p=snapToEdge(area,position,scale,edge),size=Math.round(90*scale);if(paused)return {...p,direction};
  const vertical=edge==='left'||edge==='right',axis=vertical?'y':'x',lo=vertical?area.y:area.x,hi=lo+Math.max(0,(vertical?area.height:area.width)-size);
  p[axis]+=direction*step;if(p[axis]<=lo){p[axis]=lo;direction=1;}if(p[axis]>=hi){p[axis]=hi;direction=-1;}
  p[axis]=Math.round(p[axis]);return {...p,direction};
}
function orientation(edge,direction){const rotation={bottom:0,free:0,left:90,right:-90,top:180}[edge]??0;const reverse=edge==='top'||edge==='right'?direction>0:direction<0;return {rotation,mirror:reverse?-1:1};}
module.exports={edges,normalizePlacement,chooseDisplay,snapToEdge,advanceAlongEdge,orientation};
