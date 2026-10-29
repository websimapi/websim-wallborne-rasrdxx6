export const schema = `
CREATE TABLE IF NOT EXISTS characters (
 user_id TEXT PRIMARY KEY, username TEXT, x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 2,
 z REAL NOT NULL DEFAULT 1030, yaw REAL NOT NULL DEFAULT 0, pitch REAL NOT NULL DEFAULT .08,
 hp REAL NOT NULL DEFAULT 100, gas REAL NOT NULL DEFAULT 100, step INTEGER NOT NULL DEFAULT 0,
 kills INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
);`;
export function titanSpecs(){let seed=8917;const rnd=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};return Array.from({length:24},(_,id)=>{const height=17+rnd()*19,a=id<5?(id-2)*.035:rnd()*Math.PI*2,r=4800+rnd()*1900;return{id,height,s:height/20,x:Math.sin(a)*r,z:Math.cos(a)*r,phase:rnd()*6,style:id%4};});}
const players=new Map(),connections=new Map();
const giants=titanSpecs().map(t=>({...t,yaw:0,hp:3,dead:false,attack:0,cooldown:0,stagger:0,moving:false,respawn:0,homeX:t.x,homeZ:t.z}));
let lastTick=0,lastSnapshot=0;
const q=n=>Math.round(n*100)/100;
const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y||0)-(b.y||0),a.z-b.z);
const spawn=()=>({x:0,y:2,z:1030,yaw:0,pitch:.08,hp:100,gas:100,step:0,kills:0});
const character=p=>({x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,hp:p.hp,gas:p.gas,step:p.step,kills:p.kills});
const identity=p=>({id:p.id,username:p.username,joined:p.joined,...character(p)});
const titanState=t=>({id:t.id,x:q(t.x),z:q(t.z),yaw:q(t.yaw),hp:t.hp,dead:t.dead,attack:q(t.attack),moving:t.moving});
function saveStatement(env,p){return env.DB.prepare(`INSERT INTO characters (user_id,username,x,y,z,yaw,pitch,hp,gas,step,kills,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,x=excluded.x,y=excluded.y,z=excluded.z,yaw=excluded.yaw,pitch=excluded.pitch,hp=excluded.hp,gas=excluded.gas,step=MAX(characters.step,excluded.step),kills=MAX(characters.kills,excluded.kills),updated_at=excluded.updated_at`).bind(p.userId,p.username,p.x,p.y,p.z,p.yaw,p.pitch,p.hp,p.gas,p.step,p.kills,Date.now());}
function privateStats(p){connections.get(p.id)?.send({type:'stats',character:character(p)});}
function reset(p){Object.assign(p,{x:0,y:2,z:1030,hp:100,gas:100,hook:null,cable:null});p.lastMove=Date.now();}
export default {async fetch(request,env){const path=new URL(request.url).pathname;
if(path==='/api/character'&&request.method==='GET'){const id=request.headers.get('x-websim-user-id');if(!id||request.headers.get('x-websim-user-is-anonymous')==='true')return Response.json({signedIn:false,character:null});const row=await env.DB.prepare('SELECT x,y,z,yaw,pitch,hp,gas,step,kills,updated_at FROM characters WHERE user_id=?').bind(id).first();return Response.json({signedIn:true,character:row});}
return Response.json({error:'Not found'},{status:404});}};
export const room={tickMs:100,
async onConnect(conn,room,env){const p={...spawn(),id:conn.id,userId:conn.userId,username:conn.username?room.censor(conn.username):null,signedIn:conn.identity==='user',joined:false,lastMove:Date.now(),lastInput:0,lastSlash:0,lastSave:Date.now(),dirty:false,hook:null,cable:null,hookFor:0};connections.set(conn.id,conn);players.set(conn.id,p);
if(p.signedIn){const row=await env.DB.prepare('SELECT x,y,z,yaw,pitch,hp,gas,step,kills FROM characters WHERE user_id=?').bind(p.userId).first();if(row)Object.assign(p,row);}
if(!players.has(conn.id))return;
conn.send({type:'welcome',id:conn.id,signedIn:p.signedIn,character:character(p),players:[...players.values()].filter(v=>v.joined).map(identity),titans:giants.map(titanState),time:Date.now()});
},
async onMessage(conn,message,room,env){const p=players.get(conn.id);if(!p)return;let m;try{m=JSON.parse(message);}catch{return;}const now=Date.now();
if(m.type==='join'){if(p.joined){conn.send({type:'joined',character:character(p)});return;}
// Only one active character per signed-in account; other tabs remain spectators.
if(p.signedIn)for(const other of players.values()){if(other!==p&&other.userId===p.userId&&other.joined){Object.assign(p,character(other));other.joined=false;connections.get(other.id)?.send({type:'spectate'});room.broadcast({type:'left',id:other.id});}}
p.joined=true;p.lastMove=now;p.dirty=true;conn.send({type:'joined',character:character(p)});room.broadcast({type:'join',player:identity(p)},{except:[p.id]});return;}
if(!p.joined)return;
if(m.type==='move'){if(now-p.lastInput<40)return;p.lastInput=now;
if(![m.x,m.y,m.z,m.yaw,m.pitch].every(Number.isFinite)||Math.abs(m.x)>18000||Math.abs(m.z)>18000||m.y<1.7||m.y>1800)return;
const elapsed=Math.min(.6,Math.max(.04,(now-p.lastMove)/1000));if(distance(p,m)>150*elapsed+4){conn.send({type:'correct',character:character(p)});return;}
p.x=m.x;p.y=m.y;p.z=m.z;p.yaw=m.yaw%(Math.PI*2);p.pitch=Math.max(-1.45,Math.min(1.45,m.pitch));p.lastMove=now;p.dirty=true;
const validHook=m.hook&&[m.hook.x,m.hook.y,m.hook.z].every(Number.isFinite)&&distance(p,m.hook)<875&&p.step>=2&&p.gas>0;
p.hook=validHook?{x:q(m.hook.x),y:q(m.hook.y),z:q(m.hook.z)}:null;p.boost=!!m.boost;
p.cable=null;
if(m.cable&&['flying','loose','returning','snagged','latched'].includes(m.cable.mode)&&Array.isArray(m.cable.points)&&m.cable.points.length>=2&&m.cable.points.length<=13){
const pts=m.cable.points;let length=0,valid=true;
for(let i=0;i<pts.length;i++){const a=pts[i];if(!Array.isArray(a)||a.length!==3||!a.every(Number.isFinite)||Math.hypot(a[0]-p.x,a[1]-p.y,a[2]-p.z)>1100){valid=false;break;}if(i)length+=Math.hypot(a[0]-pts[i-1][0],a[1]-pts[i-1][1],a[2]-pts[i-1][2]);}
if(valid&&length<1400)p.cable={mode:m.cable.mode,points:pts.map(a=>a.map(q))};
}
let old=p.step;if(p.step===0&&distance(p,{x:0,y:2,z:1060})<7)p.step=1;else if(p.step===1&&p.y>4)p.step=2;else if(p.step===2&&p.hook&&p.y>=22&&p.hookFor>=.5)p.step=3;
if(old!==p.step){privateStats(p);p.lastSave=0;}return;}
if(m.type==='slash'){if(p.step<3||now-p.lastSlash<400)return;p.lastSlash=now;room.broadcast({type:'slash',id:p.id});
const fx=Math.sin(p.yaw)*Math.cos(p.pitch),fy=-Math.sin(p.pitch),fz=Math.cos(p.yaw)*Math.cos(p.pitch);
for(const t of giants){if(t.dead)continue;const nape={x:t.x-Math.sin(t.yaw)*1.3*t.s,y:16.2*t.s,z:t.z-Math.cos(t.yaw)*1.3*t.s},body={x:t.x,y:10*t.s,z:t.z},leg={x:t.x,y:4*t.s,z:t.z};
const lethal=distance(p,nape)<7*t.s;if(!lethal&&distance(p,body)>9*t.s&&distance(p,leg)>7*t.s)continue;
const len=distance(p,body)||1;if(((body.x-p.x)*fx+(body.y-p.y)*fy+(body.z-p.z)*fz)/len<-.3)continue;
t.hp--;t.stagger=2;t.attack=0;if(lethal||t.hp<=0){t.dead=true;t.respawn=now+90000;p.kills++;p.dirty=true;p.lastSave=0;privateStats(p);}
room.broadcast({type:'hit',id:p.id,titan:t.id,dead:t.dead,at:lethal?nape:{x:p.x+fx*2,y:p.y+fy*2,z:p.z+fz*2}});break;}
}
},
async onTick(room,env){const now=Date.now(),dt=lastTick?Math.min(.25,(now-lastTick)/1000):.1;lastTick=now;const active=[...players.values()].filter(p=>p.joined);
for(const p of active){if(p.hook){p.hookFor+=dt;p.gas=Math.max(0,p.gas-dt*(p.boost?8:3));if(!p.gas)p.hook=null;}else{p.hookFor=0;p.gas=Math.min(100,p.gas+dt*(p.y<=2.2?16:7));}}
for(const t of giants){if(t.dead){if(now>t.respawn)Object.assign(t,{dead:false,hp:3,x:t.homeX,z:t.homeZ,attack:0});continue;}
t.cooldown-=dt;t.stagger=Math.max(0,t.stagger-dt);let target=null,near=210;for(const p of active){if(Math.hypot(p.x,p.z)<4510)continue;const d=distance(p,{x:t.x,y:0,z:t.z});if(d<near){near=d;target=p;}}
t.moving=!!target&&near>12&&!t.stagger;
if(t.moving){const d=Math.hypot(target.x-t.x,target.z-t.z)||1;t.yaw=Math.atan2(target.x-t.x,target.z-t.z);t.x+=(target.x-t.x)/d*dt*(t.style===1?14:7);t.z+=(target.z-t.z)/d*dt*(t.style===1?14:7);const r=Math.hypot(t.x,t.z);if(r<4550){t.x*=4550/r;t.z*=4550/r;}}
else if(!target){t.yaw=Math.sin(now*.00007+t.phase)*2;t.x=t.homeX+Math.sin(now*.00015+t.phase)*12;t.z=t.homeZ+Math.cos(now*.00012+t.phase)*12;}
if(target&&near<25*t.s&&t.cooldown<=0&&!t.stagger){t.attack=1.25;t.cooldown=3+(t.id%3)*.6;}
if(t.attack>0){const previous=t.attack;t.attack=Math.max(0,t.attack-dt);if(previous>.35&&t.attack<=.35){const at={x:t.x+Math.sin(t.yaw)*8*t.s,y:2,z:t.z+Math.cos(t.yaw)*8*t.s};room.broadcast({type:'slam',titan:t.id,at});for(const p of active){if(distance(p,at)>17*t.s)continue;p.hp-=45;p.dirty=true;const d=Math.hypot(p.x-t.x,p.z-t.z)||1;const knock={x:(p.x-t.x)/d*32,y:18,z:(p.z-t.z)/d*32};let rescued=false;if(p.hp<=0){reset(p);rescued=true;}connections.get(p.id)?.send({type:'hurt',character:character(p),knock,rescued});}}}}
const snapshot={type:'snapshot',time:now,players:active.map(p=>({id:p.id,x:q(p.x),y:q(p.y),z:q(p.z),yaw:q(p.yaw),hp:p.hp,gas:q(p.gas),hook:p.hook,cable:p.cable})),titans:giants.map(titanState)};
// Keep a heartbeat for spectators; skip identical idle frames.
const signature=JSON.stringify([snapshot.players,snapshot.titans]);if(signature!==roomSignature||now-lastSnapshot>2000){roomSignature=signature;lastSnapshot=now;if(snapshot.players.length<=60)room.broadcast(snapshot);else for(let i=0;i<snapshot.players.length;i+=60)room.broadcast({...snapshot,players:snapshot.players.slice(i,i+60),titans:i===0?snapshot.titans:null});}
const saves=active.filter(p=>p.signedIn&&p.dirty&&now-p.lastSave>15000).slice(0,20);if(saves.length){for(const p of saves){p.dirty=false;p.lastSave=now;}try{await env.DB.batch(saves.map(p=>saveStatement(env,p)));for(const p of saves)connections.get(p.id)?.send({type:'saved'});}catch(error){for(const p of saves){p.dirty=true;p.lastSave=now-12000;}console.error('Character save failed',error);for(const p of saves)connections.get(p.id)?.send({type:'saveError'});}}
},
async onClose(conn,room,env){const p=players.get(conn.id);players.delete(conn.id);connections.delete(conn.id);if(p?.joined)room.broadcast({type:'left',id:p.id});if(p?.signedIn&&p.joined)await saveStatement(env,p).run();}
};
let roomSignature='';
