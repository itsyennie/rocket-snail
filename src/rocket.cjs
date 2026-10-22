const {EventEmitter}=require('node:events');
const {matchMessage,readDecision}=require('./rules.cjs');
const {READ_ENDPOINTS,serverUrl,timestamp,modernHistory,historyRequest}=require('./protocol.cjs');
class RocketClient extends EventEmitter {
  constructor(store,getToken,{fetchImpl=fetch,WebSocketImpl=WebSocket}={}) {
    super();Object.assign(this,{store,getToken,fetchImpl,WebSocketImpl});
    this.rooms={};this.subs={};this.running=false;this.generation=0;this.jobs=new Map();this.subscribed=new Set();this.retry=1000;this.subscriptionRevision=0;this.subscriptionUpdates=new Map();
  }
  get settings(){return this.store.data.settings;}
  status(text){this.emit('status',text);}
  async api(endpoint,params={}) {
    if(!READ_ENDPOINTS.has(endpoint))throw Error('읽기 전용 API가 아닙니다.');
    const url=new URL(`/api/v1/${endpoint}`,serverUrl(this.settings.baseUrl));
    for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
    const res=await this.fetchImpl(url,{method:'GET',redirect:'error',headers:{'X-Auth-Token':this.getToken(),'X-User-Id':this.settings.userId},signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw Error(`${endpoint}: HTTP ${res.status}`);
    const data=await res.json();if(data.success===false)throw Error(`${endpoint}: 서버에서 요청을 거절했습니다.`);return data;
  }
  async probe() {
    const res=await this.fetchImpl(new URL('/api/info',serverUrl(this.settings.baseUrl)),{redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw Error(`서버 정보: HTTP ${res.status}`);
    const info=await res.json();if(!/^\d+\.\d+(\.\d+)?/.test(info.version))throw Error('서버 버전을 확인할 수 없습니다.');
    this.version=info.version;return {version:info.version};
  }
  async start() {
    this.stop();this.running=true;const generation=this.generation;
    try {
      await this.probe();const me=await this.api('me');
      if(generation!==this.generation)return;
      if(me._id!==this.settings.userId)throw Error('사용자 ID와 토큰의 계정이 일치하지 않습니다.');
      this.status(`Rocket.Chat ${this.version} · 연결 중`);this.connect(generation);await this.sync();
      if(generation===this.generation)this.timer=setInterval(()=>void this.sync(),30000);
    }catch(e){if(generation===this.generation){this.stop();this.status(`연결 보류: ${e.message}`);}}
  }
  async sync() {
    if(this.syncing||!this.running)return;
    this.syncing=true;const generation=this.generation,revision=this.subscriptionRevision;let warnings=[];
    try {
      const [rooms,subscriptions]=await Promise.all([this.api('rooms.get'),this.api('subscriptions.get')]);
      if(generation!==this.generation)return;
      const roomById=Object.fromEntries((rooms.update||[]).map(r=>[r._id,r]));
      this.subs=Object.fromEntries((subscriptions.update||[]).map(s=>[s.rid,s]));this.rooms={};
      for(const [rid,entry] of this.subscriptionUpdates)if(entry.revision>revision){if(entry.subscription)this.subs[rid]=entry.subscription;else delete this.subs[rid];}
      for(const sub of Object.values(this.subs)) {
        const room=roomById[sub.rid]||sub;
        this.rooms[sub.rid]={rid:sub.rid,t:room.t||sub.t,name:sub.name||room.name||sub.rid,displayName:sub.fname||room.fname||sub.name||room.name||sub.rid};
      }
      this.store.observeThreadReads(this.subs);this.subscribeRooms();this.emit('change');
      for(const room of Object.values(this.rooms)) {
        const mode=this.settings.rooms?.[room.rid]?.mode||(room.t==='d'?this.settings.dmMode:this.settings.defaultMode);
        if(mode==='ignore'||!['c','p','d'].includes(room.t))continue;
        try {const done=await this.backfill(room,generation);if(!done)warnings.push('이전 메시지 보충 중');}
        catch(e){warnings.push(e.message);}
        if(generation!==this.generation)return;
      }
      this.store.reconcile(this.subs,readDecision);this.emit('change');
      this.status(warnings.length?`동기화 보류: ${[...new Set(warnings)].join(' / ')}`:`Rocket.Chat ${this.version} · ${this.authenticated?'실시간 연결됨':'이력 연결됨 · 실시간 재연결 중'}`);
    }catch(e){if(generation===this.generation)this.status(`동기화 보류: ${e.message}`);}
    finally{this.syncing=false;}
  }
  async backfill(room,generation) {
    const sub=this.subs[room.rid];let job=this.jobs.get(room.rid);
    if(!job) {
      const seen=timestamp(sub.ls);const lower=Number.isFinite(seen)?seen:Date.now()-86400000;
      job={oldest:new Date(lower).toISOString(),latest:new Date().toISOString(),offset:0,cursor:null};this.jobs.set(room.rid,job);
    }
    // Bounded work per poll; continue an unfinished cursor on the next poll.
    for(let page=0;page<5;page++) {
      const {endpoint,params}=historyRequest(this.version,room,job,job);
      const data=await this.api(endpoint,params);if(generation!==this.generation)return false;
      const messages=data.messages||[];
      for(const m of messages)if(timestamp(m.ts)>=timestamp(job.oldest))this.accept(m);
      if(modernHistory(this.version)) {
        const oldest=Math.min(...messages.map(m=>timestamp(m.ts)));const cursor=data.cursor?.previous;
        if(!messages.length||!cursor||oldest<timestamp(job.oldest)){this.jobs.delete(room.rid);return true;}
        if(cursor===job.cursor)throw Error('서버의 이력 커서가 진행하지 않습니다.');job.cursor=cursor;
      } else {
        if(!messages.length){this.jobs.delete(room.rid);return true;}job.offset+=messages.length;
      }
    }
    return false;
  }
  accept(message) {
    const room=this.rooms[message?.rid];if(!room)return;
    const match=matchMessage(message,room,this.settings,this.settings.userId);
    if(match&&this.store.add(message,room,match)){this.store.observeThreadReads?.(this.subs);this.emit('change');}
  }
  acceptSubscription(action,subscription) {
    if(!['inserted','updated','removed'].includes(action)||!subscription?.rid||subscription.u?._id&&subscription.u._id!==this.settings.userId)return;
    const rid=subscription.rid;
    this.subscriptionUpdates.set(rid,{revision:++this.subscriptionRevision,subscription:action==='removed'?null:subscription});
    if(action==='removed')delete this.subs[rid];else this.subs[rid]=subscription;
    this.store.observeThreadReads(this.subs);this.store.reconcile(this.subs,readDecision);this.emit('change');
  }
  send(value){if(this.ws?.readyState===1)this.ws.send(JSON.stringify(value));}
  subscribeRooms() {
    if(!this.authenticated)return;
    for(const rid of this.subscribed)if(!this.rooms[rid]){this.send({msg:'unsub',id:`room:${rid}`});this.subscribed.delete(rid);}
    for(const room of Object.values(this.rooms))if(!this.subscribed.has(room.rid)){
      this.send({msg:'sub',id:`room:${room.rid}`,name:'stream-room-messages',params:[room.rid,false]});this.subscribed.add(room.rid);
    }
  }
  connect(generation) {
    if(!this.running||generation!==this.generation)return;
    const url=new URL('/websocket',serverUrl(this.settings.baseUrl));url.protocol='wss:';
    const ws=new this.WebSocketImpl(url);this.ws=ws;this.authenticated=false;this.subscribed.clear();
    let lastTraffic=Date.now();this.heartbeat=setInterval(()=>{if(Date.now()-lastTraffic>65000)ws.close();},15000);
    ws.onopen=()=>this.send({msg:'connect',version:'1',support:['1']});
    ws.onmessage=e=>{
      if(generation!==this.generation)return;lastTraffic=Date.now();let packet;try{packet=JSON.parse(e.data)}catch{return}
      if(packet.msg==='ping')this.send({msg:'pong',...(packet.id?{id:packet.id}:{})});
      if(packet.msg==='connected')this.send({msg:'method',method:'login',id:'login',params:[{resume:this.getToken()}]});
      if(packet.msg==='result'&&packet.id==='login') {
        if(packet.error){this.stop();this.status('실시간 인증 실패 · 토큰과 API 권한을 확인하세요.');return;}
        this.authenticated=true;this.retry=1000;this.send({msg:'sub',id:'user-subscriptions',name:'stream-notify-user',params:[`${this.settings.userId}/subscriptions-changed`,false]});this.subscribeRooms();void this.sync();
      }
      if(packet.msg==='nosub'&&packet.error)this.status('일부 방의 실시간 구독을 서버가 거절했습니다.');
      if(packet.msg==='changed'&&packet.collection==='stream-room-messages')this.accept(packet.fields?.args?.[0]);
      if(packet.msg==='changed'&&packet.collection==='stream-notify-user'&&packet.fields?.eventName===`${this.settings.userId}/subscriptions-changed`)this.acceptSubscription(...(packet.fields.args||[]));
    };
    ws.onerror=()=>this.status('실시간 연결 오류 · 재연결 대기');
    ws.onclose=()=>{clearInterval(this.heartbeat);this.authenticated=false;if(!this.running||generation!==this.generation)return;
      this.status('실시간 재연결 중');this.reconnect=setTimeout(()=>this.connect(generation),this.retry);this.retry=Math.min(this.retry*2,60000);
    };
  }
  stop(){this.generation++;this.running=false;this.authenticated=false;clearInterval(this.timer);clearInterval(this.heartbeat);clearTimeout(this.reconnect);if(this.ws){this.ws.onclose=null;this.ws.close();this.ws=null;}this.jobs.clear();this.subscribed.clear();}
}
module.exports={RocketClient};
