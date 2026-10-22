(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SnailAppearance=factory();})(globalThis,()=>{
  const defaults=Object.freeze({shellPattern:'spiral',shellColor:'#f7aa65',patternColor:'#bd6d64',bodyColor:'#5ac8ba',eyeStyle:'round'});
  const patterns=Object.freeze([['spiral','소용돌이'],['dots','물방울'],['stripes','줄무늬'],['stars','별무늬'],['plain','민무늬']]);
  const eyes=Object.freeze([['round','동그란 눈'],['happy','웃는 눈'],['sleepy','졸린 눈'],['sparkle','반짝이는 눈']]);
  function normalize(value={},strict=false){
    const result={...defaults};if(!value||typeof value!=='object'||Array.isArray(value)){if(strict)throw Error('꾸미기 설정을 확인하세요.');return result;}
    for(const key of ['shellColor','patternColor','bodyColor'])if(value[key]!==undefined){if(/^#[0-9a-f]{6}$/i.test(value[key]))result[key]=value[key].toLowerCase();else if(strict)throw Error('색상 값을 확인하세요.');}
    for(const [key,choices] of [['shellPattern',patterns],['eyeStyle',eyes]])if(value[key]!==undefined){if(choices.some(([id])=>id===value[key]))result[key]=value[key];else if(strict)throw Error('무늬와 눈 모양을 확인하세요.');}
    return result;
  }
  const shellPath='M31 69 Q15 57 23 33 Q30 12 54 16 Q79 21 80 45 Q79 64 60 69Z';
  function star(x,y,r){const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.44:r;points.push(`${(x+Math.cos(a)*s).toFixed(2)},${(y+Math.sin(a)*s).toFixed(2)}`);}return `<polygon points="${points.join(' ')}"/>`;}
  function svg(value,id='snail'){
    const a=normalize(value),clip='snail-shell-'+String(id).replace(/[^a-z0-9_-]/gi,'');
    const designs={
      spiral:'<path d="M49 60 Q68 61 69 44 Q69 29 54 28 Q40 28 38 42 Q36 53 47 52 Q55 51 55 43" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
      dots:[[35,32,4],[53,28,5],[68,38,4],[32,48,5],[49,44,4],[62,57,5],[44,61,3]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/>`).join(''),
      stripes:'<path d="M15 35 L58 8 M17 51 L74 14 M22 65 L85 24 M37 76 L93 41" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
      stars:[[39,33,7],[61,38,8],[45,56,8],[68,58,5]].map(([x,y,r])=>star(x,y,r)).join(''),
      plain:''
    };
    let eyeMarkup='';
    for(const [x,y] of [[72,22],[87,18]]){
      if(a.eyeStyle==='happy')eyeMarkup+=`<path d="M${x-4} ${y+1} Q${x} ${y-5} ${x+4} ${y+1}" fill="none" stroke="#225e68" stroke-width="2.5" stroke-linecap="round"/>`;
      else if(a.eyeStyle==='sleepy')eyeMarkup+=`<path d="M${x-4} ${y} Q${x} ${y+4} ${x+4} ${y}" fill="none" stroke="#225e68" stroke-width="2.5" stroke-linecap="round"/>`;
      else if(a.eyeStyle==='sparkle')eyeMarkup+=`<g fill="#225e68">${star(x+1,y,4)}</g>`;
      else eyeMarkup+=`<circle cx="${x+2}" cy="${y}" r="2.4" fill="#225e68"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 85 79" role="img" aria-label="꾸민 달팽이" data-shell-pattern="${a.shellPattern}" data-eye-style="${a.eyeStyle}"><defs><clipPath id="${clip}"><path d="${shellPath}"/></clipPath></defs><path class="snail-body" d="M16 78 Q26 64 53 66 Q78 67 85 80 L85 88 L18 88Z" fill="${a.bodyColor}" stroke="#225e68" stroke-width="3"/><g class="shell"><path d="${shellPath}" fill="${a.shellColor}" stroke="#874c56" stroke-width="4"/><g clip-path="url(#${clip})" fill="${a.patternColor}" color="${a.patternColor}">${designs[a.shellPattern]}</g></g><path d="M72 69 L72 27 M86 69 L86 23" stroke="#225e68" stroke-width="4" stroke-linecap="round"/><circle cx="72" cy="22" r="7" fill="#fff" stroke="#225e68" stroke-width="3"/><circle cx="87" cy="18" r="7" fill="#fff" stroke="#225e68" stroke-width="3"/>${eyeMarkup}</svg>`;
  }
  return {defaults,patterns,eyes,normalize,svg};
});
