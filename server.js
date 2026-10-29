export const schema = `
CREATE TABLE IF NOT EXISTS characters (
 user_id TEXT PRIMARY KEY, username TEXT, x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 2,
 z REAL NOT NULL DEFAULT 1030, yaw REAL NOT NULL DEFAULT 0, pitch REAL NOT NULL DEFAULT .08,
 hp REAL NOT NULL DEFAULT 100, gas REAL NOT NULL DEFAULT 100, step INTEGER NOT NULL DEFAULT 0,
 kills INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
);`;
export function titanSpecs(){let seed=8917;const rnd=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};return Array.from({length:24},(_,id)=>{const height=70+rnd()*50,a=id<5?(id-2)*.035:rnd()*Math.PI*2,r=4800+rnd()*1900;return{id,height,s:height/20,x:Math.sin(a)*r,z:Math.cos(a)*r,phase:rnd()*6,style:id%4};});}
// Deterministic plots are shared by the server and the rendered city.
let cityCache;
export function cityLayout(){
 if(cityCache)return cityCache;
 let state=37019;const random=()=>{state=state*16807%2147483647;return(state-1)/2147483646;},out=[];
 const add=(x,z,w,d,region,angle=0,royal=false)=>{const variant=Math.floor(random()*6);if(!royal&&(variant===1||variant===4))w=Math.min(w,(region===0?39:region===1?28:21)/1.28);const height=(region===0?(royal?12:8):region===1?7:5.3)*( .85+random()*.7);out.push({id:out.length,x,z,w,d,region,angle,royal,height,variant,roof:3+random()*4});};
 add(37,1045,24,27,0);add(-39,1085,26,30,0);add(40,1100,26,28,0);
 add(140,140,64,70,0,0,true);add(86,152,32,42,0,0,true);add(194,152,32,42,0,0,true);
 for(let radius=210;radius<4460;radius+=44){
 const region=radius<1200?0:radius<2700?1:2;
 if([1200,2700,4500].some(r=>Math.abs(radius-r)<40))continue;
 const step=region===0?43:region===1?32:25,n=Math.floor(2*Math.PI*radius/step),phase=random()*.1;
 for(let j=0;j<n;j++){
 const a=j/n*Math.PI*2+phase,x=Math.sin(a)*radius,z=Math.cos(a)*radius;
 // Main avenues, narrow radial connectors and occasional market courtyards.
 if(Math.abs(x)<34||Math.abs(z)<23||Math.abs(x)<100&&z>975&&z<1150||Math.abs(x-140)<110&&Math.abs(z-140)<105)continue;
 const sector=(a%(Math.PI/4))/(Math.PI/4);if(sector<.018||sector>.982)continue;
 if((Math.floor(radius/186)+Math.floor(a*12))%19===0&&j%8<2)continue;
 const w=region===0?26+random()*12:region===1?18+random()*9:12+random()*9;
 const d=region===0?25+random()*9:region===1?23+random()*10:18+random()*11;
 const r=radius+(random()-.5)*3;
 add(Math.sin(a)*r,Math.cos(a)*r,w,d,region,a+(random()-.5)*.045,region===0&&random()>.93);
 }
 }
 // Small frontier settlements outside the sealed outer gate can be trampled.
 for(const pole of [-1,1])for(let z=4670;z<5080;z+=45)for(let x=-400;x<=400;x+=34){if(Math.abs(x)<33||random()<.16)continue;add(x+(random()-.5)*5,pole*(z+random()*6),13+random()*8,18+random()*10,2,pole===1?0:Math.PI);}
 return cityCache=out;
}
const ruinsState=new Map();let buildingGrid;
function smashBuildings(room,x,z,radius,kind,seed){
 if(!buildingGrid){buildingGrid=new Map();for(const b of cityLayout()){const key=Math.floor(b.x/128)+','+Math.floor(b.z/128);if(!buildingGrid.has(key))buildingGrid.set(key,[]);buildingGrid.get(key).push(b);}}
 const now=Date.now();let hit=0;
 for(let ix=Math.floor((x-radius-50)/128);ix<=Math.floor((x+radius+50)/128);ix++)for(let iz=Math.floor((z-radius-50)/128);iz<=Math.floor((z+radius+50)/128);iz++)for(const b of buildingGrid.get(ix+','+iz)||[]){
 const c=Math.cos(b.angle),s=Math.sin(b.angle),dx=x-b.x,dz=z-b.z,lx=dx*c-dz*s,lz=dx*s+dz*c;
 if(Math.hypot(Math.max(0,Math.abs(lx)-b.w*.65),Math.max(0,Math.abs(lz)-b.d/2))>radius)continue;
 const history=ruinsState.get(b.id)||[],previous=history[history.length-1];if(previous&&(previous.level>=3||now-previous.at<1400))continue;
 const event={type:'buildingDamage',id:b.id,level:(previous?.level||0)+1,x:q(x),y:2,z:q(z),radius:q(radius),kind,seed:(seed+b.id*971)%2147483646+1,at:now};history.push(event);ruinsState.set(b.id,history);room.broadcast(event);if(++hit>=12)return;
 }
}
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
conn.send({type:'welcome',id:conn.id,signedIn:p.signedIn,character:character(p),players:[...players.values()].filter(v=>v.joined).map(identity),titans:giants.map(titanState),ruins:[...ruinsState.values()].flat(),time:Date.now()});
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
const validateCable=c=>{
if(!c||!['flying','loose','returning','snagged','latched'].includes(c.mode)||!Array.isArray(c.points)||c.points.length<2||c.points.length>13)return null;
const pts=c.points;let length=0;
for(let i=0;i<pts.length;i++){const a=pts[i];if(!Array.isArray(a)||a.length!==3||!a.every(Number.isFinite)||Math.hypot(a[0]-p.x,a[1]-p.y,a[2]-p.z)>1100)return null;if(i)length+=Math.hypot(a[0]-pts[i-1][0],a[1]-pts[i-1][1],a[2]-pts[i-1][2]);}
return length<1400?{mode:c.mode,points:pts.map(a=>a.map(q))}:null;
};
p.cable=validateCable(m.cable);
if(m.cable&&typeof m.cable==='object'&&('left' in m.cable||'right' in m.cable)){const left=validateCable(m.cable.left),right=validateCable(m.cable.right);p.cable=left||right?{...(left||right),left,right}:null;}
let old=p.step;if(p.step===0&&distance(p,{x:0,y:2,z:1060})<7)p.step=1;else if(p.step===1&&p.y>4)p.step=2;else if(p.step===2&&p.hook&&p.y>=22&&p.hookFor>=.5)p.step=3;
if(old!==p.step){privateStats(p);p.lastSave=0;}return;}
if(m.type==='slash'){if(p.step<3||now-p.lastSlash<400)return;p.lastSlash=now;room.broadcast({type:'slash',id:p.id});
const fx=Math.sin(p.yaw)*Math.cos(p.pitch),fy=-Math.sin(p.pitch),fz=Math.cos(p.yaw)*Math.cos(p.pitch);
for(const t of giants){if(t.dead)continue;const nape={x:t.x-Math.sin(t.yaw)*1.3*t.s,y:16.2*t.s,z:t.z-Math.cos(t.yaw)*1.3*t.s},body={x:t.x,y:10*t.s,z:t.z},leg={x:t.x,y:4*t.s,z:t.z};
const lethal=distance(p,nape)<3+1.3*t.s;if(!lethal&&distance(p,body)>3+3.2*t.s&&distance(p,leg)>3+2.5*t.s)continue;
const len=distance(p,body)||1;if(((body.x-p.x)*fx+(body.y-p.y)*fy+(body.z-p.z)*fz)/len<-.3)continue;
t.hp--;t.stagger=2;t.attack=0;if(lethal||t.hp<=0){t.dead=true;t.fell=false;t.fallAt=now+650;t.respawn=now+90000;p.kills++;p.dirty=true;p.lastSave=0;privateStats(p);}
room.broadcast({type:'hit',id:p.id,titan:t.id,dead:t.dead,at:lethal?nape:{x:p.x+fx*2,y:p.y+fy*2,z:p.z+fz*2}});break;}
}
},
async onTick(room,env){const now=Date.now(),dt=lastTick?Math.min(.25,(now-lastTick)/1000):.1;lastTick=now;const active=[...players.values()].filter(p=>p.joined);
for(const p of active){if(p.hook){p.hookFor+=dt;p.gas=Math.max(0,p.gas-dt*(p.boost?8:3));if(!p.gas)p.hook=null;}else{p.hookFor=0;p.gas=Math.min(100,p.gas+dt*(p.y<=2.2?16:7));}}
for(const t of giants){if(t.dead){if(!t.fell&&now>(t.fallAt||0)){t.fell=true;for(let k=0;k<5;k++){const length=k*t.height*.16;smashBuildings(room,t.x-Math.cos(t.yaw)*length,t.z+Math.sin(t.yaw)*length,3*t.s,'fall',t.id*6001+k);}}if(now>t.respawn)Object.assign(t,{dead:false,fell:false,hp:3,x:t.homeX,z:t.homeZ,attack:0});continue;}
t.cooldown-=dt;t.stagger=Math.max(0,t.stagger-dt);let target=null,near=210;for(const p of active){if(Math.hypot(p.x,p.z)<4510)continue;const d=distance(p,{x:t.x,y:0,z:t.z});if(d<near){near=d;target=p;}}
t.moving=!!target&&near>12&&!t.stagger;
if(t.moving){const d=Math.hypot(target.x-t.x,target.z-t.z)||1;t.yaw=Math.atan2(target.x-t.x,target.z-t.z);t.x+=(target.x-t.x)/d*dt*(t.style===1?14:7);t.z+=(target.z-t.z)/d*dt*(t.style===1?14:7);const r=Math.hypot(t.x,t.z);if(r<4550){t.x*=4550/r;t.z*=4550/r;}}
else if(!target){t.yaw=Math.sin(now*.00007+t.phase)*2;t.x=t.homeX+Math.sin(now*.00015+t.phase)*12;t.z=t.homeZ+Math.cos(now*.00012+t.phase)*12;}
if(t.moving&&now>(t.nextCrush||0)){t.nextCrush=now+450;for(const side of [-1,1])smashBuildings(room,t.x+Math.cos(t.yaw)*side*1.2*t.s,t.z-Math.sin(t.yaw)*side*1.2*t.s,1.2*t.s,'step',t.id*10007+Math.floor(now/450));}
if(target&&near<25*t.s&&t.cooldown<=0&&!t.stagger){t.attack=1.25;t.cooldown=3+(t.id%3)*.6;}
if(t.attack>0){const previous=t.attack;t.attack=Math.max(0,t.attack-dt);if(previous>.35&&t.attack<=.35){const at={x:t.x+Math.sin(t.yaw)*8*t.s,y:2,z:t.z+Math.cos(t.yaw)*8*t.s};smashBuildings(room,at.x,at.z,8*t.s,'smash',t.id*1987+Math.floor(now/100));room.broadcast({type:'slam',titan:t.id,at});for(const p of active){if(distance(p,at)>17*t.s)continue;p.hp-=45;p.dirty=true;const d=Math.hypot(p.x-t.x,p.z-t.z)||1;const knock={x:(p.x-t.x)/d*32,y:18,z:(p.z-t.z)/d*32};let rescued=false;if(p.hp<=0){reset(p);rescued=true;}connections.get(p.id)?.send({type:'hurt',character:character(p),knock,rescued});}}}}
const snapshot={type:'snapshot',time:now,players:active.map(p=>({id:p.id,x:q(p.x),y:q(p.y),z:q(p.z),yaw:q(p.yaw),hp:p.hp,gas:q(p.gas),hook:p.hook,cable:p.cable})),titans:giants.map(titanState)};
// Keep a heartbeat for spectators; skip identical idle frames.
const signature=JSON.stringify([snapshot.players,snapshot.titans]);if(signature!==roomSignature||now-lastSnapshot>2000){roomSignature=signature;lastSnapshot=now;if(snapshot.players.length<=60)room.broadcast(snapshot);else for(let i=0;i<snapshot.players.length;i+=60)room.broadcast({...snapshot,players:snapshot.players.slice(i,i+60),titans:i===0?snapshot.titans:null});}
const saves=active.filter(p=>p.signedIn&&p.dirty&&now-p.lastSave>15000).slice(0,20);if(saves.length){for(const p of saves){p.dirty=false;p.lastSave=now;}try{await env.DB.batch(saves.map(p=>saveStatement(env,p)));for(const p of saves)connections.get(p.id)?.send({type:'saved'});}catch(error){for(const p of saves){p.dirty=true;p.lastSave=now-12000;}console.error('Character save failed',error);for(const p of saves)connections.get(p.id)?.send({type:'saveError'});}}
},
async onClose(conn,room,env){const p=players.get(conn.id);players.delete(conn.id);connections.delete(conn.id);if(p?.joined)room.broadcast({type:'left',id:p.id});if(p?.signedIn&&p.joined)await saveStatement(env,p).run();}
};
let roomSignature='';
