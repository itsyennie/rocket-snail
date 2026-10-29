(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SnailAppearance=factory();})(globalThis,()=>{
 const presets=Object.freeze({mochi:Object.freeze({base:'mochi',shellPattern:'spiral',shellColor:'#ffb28e',patternColor:'#cf657b',bodyColor:'#d9b7ed',eyeStyle:'round'}),goth:Object.freeze({base:'goth',shellPattern:'stars',shellColor:'#bbd9bd',patternColor:'#416459',bodyColor:'#624078',eyeStyle:'sleepy'})});
 const defaults=presets.mochi,bases=Object.freeze([['mochi','B · 모찌'],['goth','D · 고스']]);
 const patterns=Object.freeze([['spiral','소용돌이'],['dots','물방울'],['stripes','줄무늬'],['stars','별무늬'],['plain','민무늬']]);
 const eyes=Object.freeze([['round','동그란 눈'],['happy','웃는 눈'],['sleepy','졸린 눈'],['sparkle','반짝이는 눈']]);
 function normalize(value={},strict=false){
  if(!value||typeof value!=='object'||Array.isArray(value)){if(strict)throw Error('꾸미기 설정을 확인하세요.');return {...defaults};}
  const result={...(presets[value.base]||defaults)};
  for(const key of ['shellColor','patternColor','bodyColor'])if(value[key]!==undefined){if(/^#[0-9a-f]{6}$/i.test(value[key]))result[key]=value[key].toLowerCase();else if(strict)throw Error('색상 값을 확인하세요.');}
  for(const [key,choices] of [['base',bases],['shellPattern',patterns],['eyeStyle',eyes]])if(value[key]!==undefined){if(choices.some(([id])=>id===value[key]))result[key]=value[key];else if(strict)throw Error('무늬와 눈 모양을 확인하세요.');}
  return result;
 }
 function tint(hex,n){const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16));return '#'+rgb.map(v=>Math.round(n>0?v+(255-v)*n:v*(1+n)).toString(16).padStart(2,'0')).join('');}
 function svg(value,id='snail'){
  const a=normalize(value),goth=a.base==='goth',ink='#201829',clip='snail-shell-'+String(id).replace(/[^a-z0-9_-]/gi,'');
  const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  const inside=(x,y,p)=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])yes=!yes;return yes;};
  // Integer-pixel masks, a one-pixel outline and palette-derived shading.
  function mask(poly,color){const cells=new Set();for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(inside(x+.5,y+.5,poly))cells.add(x+','+y);let out='';for(const key of cells){const [x,y]=key.split(',').map(Number),edge=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!cells.has((x+dx)+','+(y+dy)));const c=edge?ink:!cells.has(x+','+(y-3))?tint(color,.28):!cells.has(x+','+(y+4))?tint(color,-.22):color;out+=rect(x,y,1,1,c);}return out;}
  const body=goth?[[4,58],[9,54],[33,53],[39,43],[48,41],[55,45],[58,53],[62,53],[61,58],[56,61],[10,61],[4,60]]:[[3,57],[7,53],[29,52],[36,42],[44,39],[53,42],[58,48],[60,55],[57,60],[49,62],[10,62],[3,60]];
  const shell=goth?[[5,37],[9,29],[17,26],[26,27],[33,32],[37,41],[35,51],[29,56],[17,57],[8,52],[4,45]]:[[5,36],[9,28],[17,23],[27,23],[35,27],[39,34],[38,43],[33,50],[24,54],[13,54],[6,49],[3,43]];
  let pattern='';
  if(a.shellPattern==='spiral')pattern=`<path d="M15 47 H25 V44 H30 V34 H26 V30 H18 V33 H14 V40 H18 V43 H23 V37 H20" fill="none" stroke="${a.patternColor}" stroke-width="2"/>`;
  if(a.shellPattern==='dots')for(const [x,y] of [[12,33],[24,29],[29,40],[13,44],[23,49]])pattern+=rect(x,y,3,3,a.patternColor);
  if(a.shellPattern==='stripes')for(let x=-20;x<50;x+=9)pattern+=`<path d="M${x} 60 L${x+30} 20" stroke="${a.patternColor}" stroke-width="3"/>`;
  if(a.shellPattern==='stars')pattern=`<path d="M22 32 H24 V38 H28 V40 H24 V46 H22 V41 H17 V39 H22Z" fill="${a.patternColor}"/>`+rect(11,34,2,2,a.patternColor)+rect(30,47,2,2,a.patternColor);
  const eyePositions=goth?[[40,14],[53,10]]:[[42,23],[55,25]];
  let stalks='',eyeArt='';for(const [x,y] of eyePositions){stalks+=mask([[x-2,y+5],[x+2,y+5],[x+1,44],[x-2,44]],a.bodyColor);eyeArt+=mask([[x-4,y-5],[x+3,y-5],[x+5,y-2],[x+5,y+4],[x+2,y+6],[x-4,y+5],[x-6,y+2],[x-6,y-2]],goth?a.bodyColor:'#f9e7ff');
   if(a.eyeStyle==='round')eyeArt+=rect(x-2,y-1,5,5,ink)+rect(x-2,y-1,2,2,'#fff9ff');
   if(a.eyeStyle==='sleepy')eyeArt+=rect(x-4,y+1,8,3,'#fff2ff')+rect(x,y+1,2,2,ink)+rect(x-5,y,10,1,ink);
   if(a.eyeStyle==='happy')eyeArt+=rect(x-3,y,2,2,ink)+rect(x-1,y-2,3,2,ink)+rect(x+2,y,2,2,ink);
   if(a.eyeStyle==='sparkle')eyeArt+=rect(x-1,y-2,2,7,ink)+rect(x-3,y,6,2,ink)+rect(x-1,y,1,1,'#ffffff');
  }
  const face=rect(44,49,2,1,ink)+rect(46,50,2,1,ink)+rect(48,49,1,1,ink)+(goth?rect(39,46,2,1,ink):rect(38,49,4,2,'#ec8da9')+rect(53,49,4,2,'#ec8da9'));
  const collar=goth?rect(37,45,17,2,tint(a.bodyColor,.45))+rect(38,47,15,1,ink)+rect(39,47,4,4,'#fff0f5')+rect(39,48,1,1,ink)+rect(42,48,1,1,ink)+rect(40,51,2,1,'#fff0f5'):'';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges" role="img" aria-label="${goth?'고스':'모찌'} 픽셀 달팽이" data-base="${a.base}" data-shell-pattern="${a.shellPattern}" data-eye-style="${a.eyeStyle}"><defs><clipPath id="${clip}"><polygon points="${shell.map(p=>p.join(',')).join(' ')}"/></clipPath></defs>${stalks}<g class="snail-body" fill="${a.bodyColor}">${mask(body,a.bodyColor)}</g><g class="shell">${mask(shell,a.shellColor)}<g clip-path="url(#${clip})">${pattern}${rect(11,30,5,1,tint(a.shellColor,.5))}${rect(8,33,2,4,tint(a.shellColor,.4))}</g></g>${eyeArt}${collar}${face}</svg>`;
 }
 return {defaults,presets,bases,patterns,eyes,normalize,svg};
});
