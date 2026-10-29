import * as T from 'three';
import {applyTitanSnapshot,hitEffect,slamEffect} from './titans.js';
const $=id=>document.getElementById(id);
const cloth=new T.MeshStandardMaterial({color:'#536454',roughness:1}),shirt=new T.MeshStandardMaterial({color:'#c3ba9c'}),boots=new T.MeshStandardMaterial({color:'#494745'}),skin=new T.MeshStandardMaterial({color:'#bd987e'}),metal=new T.MeshStandardMaterial({color:'#87989d',metalness:.65,roughness:.4});
function soldier(scene){const root=new T.Group(),parts={};function mesh(geo,mat,x,y,z){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);root.add(m);return m;}
mesh(new T.CapsuleGeometry(.24,.45,3,8),shirt,0,1.15,0);mesh(new T.SphereGeometry(.17,10,8),skin,0,1.78,0);mesh(new T.SphereGeometry(.18,8,6),boots,0,1.86,-.025).scale.set(1,.5,1);const cape=mesh(new T.BoxGeometry(.65,.85,.08),cloth,0,1.15,-.23);cape.rotation.x=-.14;mesh(new T.BoxGeometry(.6,.13,.35),boots,0,.83,0);
parts.legs=[];parts.arms=[];for(const s of [-1,1]){const leg=mesh(new T.CapsuleGeometry(.105,.55,2,6),boots,s*.15,.4,0);parts.legs.push(leg);const arm=mesh(new T.CapsuleGeometry(.09,.4,2,6),cloth,s*.34,1.12,0);parts.arms.push(arm);const can=mesh(new T.CylinderGeometry(.095,.095,.35,6),metal,s*.34,.8,-.1);can.rotation.z=Math.PI/2;const blade=mesh(new T.BoxGeometry(.04,.035,.9),metal,s*.4,.95,.5);blade.position.set(0,-.18,.5);root.remove(blade);arm.add(blade);}
const cableGeometry=new T.BufferGeometry();cableGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(13*3),3));cableGeometry.setDrawRange(0,0);const cable=new T.Line(cableGeometry,new T.LineBasicMaterial({color:'#35474c'}));const hookHead=new T.Mesh(new T.ConeGeometry(.17,.55,5),metal);hookHead.visible=false;scene.add(hookHead);cable.visible=false;cable.frustumCulled=false;scene.add(cable);const cable2=new T.Line(cableGeometry.clone(),cable.material);cable2.visible=false;cable2.frustumCulled=false;scene.add(cable2);const hookHead2=hookHead.clone();hookHead2.geometry=hookHead.geometry.clone();scene.add(hookHead2);scene.add(root);
const label=document.createElement('div');label.className='playerLabel';label.hidden=true;document.body.append(label);return{root,cable,hookHead,cables:[cable,cable2],hookHeads:[hookHead,hookHead2],label,parts,samples:[],last:new T.Vector3(),swing:0};}
export function createMultiplayer(scene,handlers){let socket=null,selfId=null,ready=false,joined=false,connecting=false,sendAt=0,offset=0,desiredJoin=false;const remotes=new Map();
function status(text){$('connection').textContent=text;}
function roster(p){if(p.id===selfId)return;let r=remotes.get(p.id);if(!r){r=soldier(scene);remotes.set(p.id,r);if(p.username){const link=document.createElement('a');link.href='https://websim.com/@'+encodeURIComponent(p.username);link.target='_blank';link.rel='noopener';const avatar=document.createElement('img');avatar.src='https://images.websim.com/avatar/'+encodeURIComponent(p.username);link.append(avatar,document.createTextNode('@'+p.username));r.label.append(link);}else r.label.textContent='Scout';}r.root.position.set(p.x,p.y-2,p.z);r.samples=[{...p,at:performance.now()}];count();}
function remove(id){const r=remotes.get(id);if(r){scene.remove(r.root,...r.cables,...r.hookHeads);r.hookHeads.forEach(h=>h.geometry.dispose());r.cables[1].geometry.dispose();r.root.traverse(o=>o.geometry?.dispose());r.cable.geometry.dispose();r.label.remove();remotes.delete(id);}count();}
function count(){$('online').textContent=remotes.size+(joined?1:0);}
function send(m){if(!socket||!ready)return;try{socket.send(m);}catch{ready=false;status('Reconnecting');handlers.disconnected?.();}}
function receive(event){let m;try{m=JSON.parse(event.data);}catch{return;}
if(m.type==='buildingDamage'){handlers.buildingDamage?.(m);return;}
if(m.type==='welcome'){for(const event of m.ruins||[])handlers.buildingDamage?.(event);selfId=m.id;offset=m.time-Date.now();for(const id of [...remotes.keys()])remove(id);ready=true;joined=false;applyTitanSnapshot(m.titans);for(const p of m.players)roster(p);handlers.loaded(m.character,m.signedIn);status('Live');$('start').disabled=false;$('start').textContent='Tap to join';if(desiredJoin)send({type:'join'});}
else if(m.type==='joined'){joined=true;desiredJoin=true;handlers.joined(m.character);count();}
else if(m.type==='join')roster(m.player);
else if(m.type==='left')remove(m.id);
else if(m.type==='spectate'){joined=false;desiredJoin=false;handlers.spectate();count();}
else if(m.type==='snapshot'){offset=T.MathUtils.lerp(offset,m.time-Date.now(),.05);if(m.titans)applyTitanSnapshot(m.titans);const now=performance.now();for(const p of m.players){if(p.id===selfId){if(joined)handlers.resources(p);continue;}const r=remotes.get(p.id);if(!r)continue;r.samples.push({...p,at:now});if(r.samples.length>7)r.samples.shift();}}
else if(m.type==='stats')handlers.stats(m.character);
else if(m.type==='correct')handlers.correct(m.character);
else if(m.type==='hurt')handlers.hurt(m);
else if(m.type==='saved')handlers.saved(true);
else if(m.type==='saveError')handlers.saved(false);
else if(m.type==='hit'){hitEffect(scene,m.at,m.titan,m.dead);if(m.id===selfId)handlers.hit(m.dead);}
else if(m.type==='slam')slamEffect(scene,m.at);
else if(m.type==='slash'){const r=remotes.get(m.id);if(r)r.swing=.42;}
}
async function connect(){if(connecting)return;connecting=true;status('Connecting');$('start').disabled=true;try{if(typeof WebsimSocket==='undefined')throw new Error('Multiplayer unavailable');socket=await WebsimSocket.joinRoom();socket.onmessage=receive;socket.onreconnect=()=>{status('Reconnecting');if(desiredJoin){try{socket.send({type:'join'});}catch{}}};socket.onclose=event=>{ready=false;joined=false;connecting=false;status(event.reason?.includes('editor')?'Preview is editors only':'Connection lost');$('start').disabled=false;$('start').textContent='Retry connection';handlers.disconnected();};}catch(error){ready=false;connecting=false;status('Connection unavailable');$('start').disabled=false;$('start').textContent='Retry connection';console.warn('Room connection:',error.message);}}
connect();
return{join(){desiredJoin=true;if(ready)send({type:'join'});else connect();},get joined(){return joined;},get ready(){return ready;},get time(){return(Date.now()+offset)/1000;},slash(){send({type:'slash'});},move(dt,p,yaw,pitch,hook,boost,cable){sendAt+=dt;if(!joined||sendAt<.08)return;sendAt=0;send({type:'move',x:p.pos.x,y:p.pos.y,z:p.pos.z,yaw,pitch,hook:hook?{x:hook.x,y:hook.y,z:hook.z}:null,boost,cable});},
update(dt,camera,playing){const now=performance.now()-110;for(const r of remotes.values()){const samples=r.samples;if(!samples.length)continue;let a=samples[0],b=a;for(let i=1;i<samples.length;i++){b=samples[i];if(b.at>=now)break;a=b;}const f=b.at>a.at?T.MathUtils.clamp((now-a.at)/(b.at-a.at),0,1):1;r.last.copy(r.root.position);r.root.position.set(T.MathUtils.lerp(a.x,b.x,f),T.MathUtils.lerp(a.y,b.y,f)-2,T.MathUtils.lerp(a.z,b.z,f));r.root.rotation.y=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*f;const speed=Math.min(1,r.root.position.distanceTo(r.last)/Math.max(dt,.001)/8),air=b.y>3;for(let i=0;i<2;i++)r.parts.legs[i].rotation.x=air?(i===0?.6:-.9):Math.sin(performance.now()*.012+i*Math.PI)*speed*.65;r.swing=Math.max(0,r.swing-dt);r.parts.arms[0].rotation.x=r.swing?Math.sin(r.swing/.42*Math.PI)*-2:air?-1.2:0;r.parts.arms[1].rotation.x=r.parts.arms[0].rotation.x;
const dual=b.cable&&('left' in b.cable||'right' in b.cable);
for(let side=0;side<2;side++){
const line=r.cables[side],hookHead=r.hookHeads[side],c=dual?(side===0?b.cable.left:b.cable.right):(side===0?b.cable:null),oldCable=dual?(side===0?a.cable?.left:a.cable?.right):a.cable;
line.visible=!!c||(!dual&&side===0&&!!b.hook);hookHead.visible=line.visible;
if(c){const data=line.geometry.attributes.position,points=c.points,previous=oldCable?.points;line.geometry.setDrawRange(0,points.length);for(let i=0;i<points.length;i++){const p=points[i],old=previous?.length===points.length?previous[i]:p;data.setXYZ(i,T.MathUtils.lerp(old[0],p[0],f),T.MathUtils.lerp(old[1],p[1],f),T.MathUtils.lerp(old[2],p[2],f));}data.needsUpdate=true;hookHead.position.fromBufferAttribute(data,points.length-1);
}else if(line.visible&&b.hook){const data=line.geometry.attributes.position;line.geometry.setDrawRange(0,2);data.setXYZ(0,r.root.position.x,r.root.position.y+1,r.root.position.z);data.setXYZ(1,b.hook.x,b.hook.y,b.hook.z);data.needsUpdate=true;hookHead.position.set(b.hook.x,b.hook.y,b.hook.z);}
}
const head=r.root.position.clone().add(new T.Vector3(0,2.3,0)),distance=head.distanceTo(camera.position),v=head.clone().project(camera);r.label.hidden=!(distance<160&&v.z>0&&v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1);if(!r.label.hidden){r.label.style.left=(v.x*.5+.5)*innerWidth+'px';r.label.style.top=(-v.y*.5+.5)*innerHeight+'px';r.label.style.opacity=String(T.MathUtils.clamp((160-distance)/70,.2,1));}}},
focus(t){const list=[...remotes.values()];if(!list.length)return null;return list[Math.floor(t/14)%list.length].root.position.clone();}
};}
