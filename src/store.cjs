const fs = require('node:fs');
const path = require('node:path');
const {DEFAULT_SERVER,timestamp}=require('./protocol.cjs');
const {normalize:normalizeAppearance}=require('./appearance.js');
const {normalizePlacement}=require('./placement.cjs');
class Store {
  constructor(file) { this.file=file; this.data={settings:{baseUrl:DEFAULT_SERVER,userId:'',defaultMode:'mentions',dmMode:'all',keywords:[],rooms:{},size:1,startup:false,motionEnabled:true,appearance:normalizeAppearance()},items:{},archive:[]}; this.load(); if(!this.data.settings.baseUrl)this.data.settings.baseUrl=DEFAULT_SERVER;this.data.settings.appearance=normalizeAppearance(this.data.settings.appearance);this.data.desktopPlacement=normalizePlacement(this.data.desktopPlacement||{displayId:this.data.desktopPosition?.displayId??'primary',edge:this.data.desktopPosition?'free':'bottom'}); }
  load() { try { const saved=JSON.parse(fs.readFileSync(this.file,'utf8')); this.data={...this.data,...saved,settings:{...this.data.settings,...saved.settings}}; } catch(e) { if(e.code!=='ENOENT') throw e; } }
  save() { fs.mkdirSync(path.dirname(this.file),{recursive:true}); const tmp=this.file+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(this.data,null,2),{mode:0o600}); fs.renameSync(tmp,this.file); }
  add(message,room,match) { if(this.data.items[message._id]||this.data.archive.some(x=>x.id===message._id)) return false; this.data.items[message._id]={id:message._id,rid:message.rid,room:room.displayName || room.name || room.rid,roomName:room.name,roomType:room.t,tmid:message.tmid,ts:message.ts,text:message.t==='e2e'?'(암호화된 메시지)':String(message.msg||'').slice(0,500),reason:match.reason}; this.save(); return true; }
  observeThreadReads(subscriptions,observedAt=Date.now()) {
    let changed=false;
    for(const item of Object.values(this.data.items)) {
      if(!item.tmid)continue;
      const sub=subscriptions[item.rid],fields=['tunread','tunreadUser','tunreadGroup'];
      const valid=sub&&Array.isArray(sub.tunread)&&fields.every(k=>sub[k]===undefined||Array.isArray(sub[k])&&sub[k].every(id=>typeof id==='string'));
      const sent=timestamp(item.ts);
      if(!valid||!Number.isFinite(sent)||observedAt<=sent) {
        if(item.threadReadConfirmedAt){delete item.threadReadConfirmedAt;changed=true;}continue;
      }
      const unread=fields.some(k=>sub[k]?.includes(item.tmid));
      if(unread) {
        if(!item.threadUnreadObservedAt||item.threadReadConfirmedAt){item.threadUnreadObservedAt=observedAt;delete item.threadReadConfirmedAt;changed=true;}
      } else if(item.threadUnreadObservedAt&&observedAt>item.threadUnreadObservedAt&&!item.threadReadConfirmedAt) {
        item.threadReadConfirmedAt=observedAt;changed=true;
      }
    }
    if(changed)this.save();return changed;
  }
  confirm(id,currentLs) {
    const item=this.data.items[id];if(!item)return false;
    this.data.archive.unshift({...item,archivedAt:new Date().toISOString(),readLs:timestamp(currentLs),archiveReason:'manual'});
    this.data.archive=this.data.archive.filter(x=>Date.now()-Date.parse(x.archivedAt)<7*86400000).slice(0,100);
    delete this.data.items[id];this.save();return true;
  }
  reconcile(subscriptions,readDecision) { const now=Date.now(); let changed=false; for(const [id,item] of Object.entries(this.data.items)) { if(readDecision(item,subscriptions[item.rid])==='archive') { this.data.archive.unshift({...item,archivedAt:new Date(now).toISOString(),readLs:timestamp(subscriptions[item.rid].ls)}); delete this.data.items[id]; changed=true; } } const keep=this.data.archive.filter(x=>now-Date.parse(x.archivedAt)<7*86400000).slice(0,100);if(keep.length!==this.data.archive.length)changed=true;this.data.archive=keep; if(changed)this.save(); return changed; }
  restore(id,currentLs) { const i=this.data.archive.findIndex(x=>x.id===id); if(i<0)return false; const [item]=this.data.archive.splice(i,1);item.restoredAfterLs=Math.max(item.readLs||0,Number.isFinite(timestamp(currentLs))?timestamp(currentLs):0);delete item.archivedAt;delete item.archiveReason;delete item.threadUnreadObservedAt;delete item.threadReadConfirmedAt; this.data.items[id]=item; this.save(); return true; }
}
module.exports={Store};
