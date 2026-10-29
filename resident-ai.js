import * as T from 'three';
import {isShop} from './server.js';
export function createResidentAI(actors){
 let clock=0,nextThink=3,busy=false,enabled=false;
 async function think(position,time,threat){
 const nearby=[...actors.values()].filter(a=>!a.flying&&a.root.visible&&a.until<time&&a.root.position.distanceTo(position)<45).sort((a,b)=>(a.lastThink||0)-(b.lastThink||0)||a.root.position.distanceTo(position)-b.root.position.distanceTo(position)).slice(0,3);
 if(!nearby.length)return;busy=true;
 try{const residents=nearby.map(a=>{const home=new T.Vector3(a.spec.x,a.spec.y,a.spec.z),radius=a.spec.post!==undefined?0:isShop(a.spec)?1.5:9,waypoints=[[home.x,home.y,home.z]];for(let k=0;k<6&&radius;k++){const angle=k*Math.PI/3+a.spec.angle;waypoints.push([home.x+Math.cos(angle)*radius,home.y,home.z+Math.sin(angle)*radius]);}return{id:a.spec.id,x:a.root.position.x,y:a.root.position.y,z:a.root.position.z,waypoints,previous:a.intent?.goal||''};});
 const r=await fetch('/api/town/think',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:position.x,y:position.y,z:position.z,threat,residents})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Resident AI unavailable');if(!enabled)return;
 for(const d of data.decisions||[]){const a=actors.get(d.id);if(!a)continue;a.lastThink=clock;a.intent={...d,expires:clock+55};}
 }catch(e){console.warn('Resident AI:',e.message);nextThink=clock+45;}finally{busy=false;}
 }
 function update(dt,position,active,time,titans){clock+=dt;enabled=active&&!document.hidden;if(!enabled||busy||clock<nextThink)return;nextThink=clock+24;think(position.clone(),time,titans.some(t=>!t.dead&&t.root.position.distanceTo(position)<220));}
 function move(a,dt,time,titans,blocked,floor){
 const p=a.root.position,home=new T.Vector3(a.spec.x,a.spec.y,a.spec.z);let target=home,speed=1.15;
 const threat=titans.find(t=>!t.dead&&t.root.position.distanceTo(p)<190);
 if(threat&&!a.spec.rank){const away=p.clone().sub(threat.root.position);away.y=0;away.normalize();target=p.clone().addScaledVector(away,12);speed=3.2;}else if(a.intent&&a.intent.expires>clock){target=new T.Vector3(...a.intent.destination);speed=a.intent.action==='flee'?3.2:1.15;if(['work','watch','social'].includes(a.intent.action)&&p.distanceTo(target)<.4)return;}
 else return;
 if(a.spec.post!==undefined)return;
 const direction=target.clone().sub(p);direction.y=0;const length=direction.length();if(length<.25)return;direction.multiplyScalar(1/length);
 // Small collision-tested steps, with local steering around walls and other people.
 for(const angle of [0,.55,-.55,1.15,-1.15]){const step=direction.clone().applyAxisAngle(new T.Vector3(0,1,0),angle).multiplyScalar(Math.min(length,speed*dt)),candidate=p.clone().add(step);if(!threat&&candidate.distanceTo(home)>17)continue;if(blocked(candidate))continue;let occupied=false;for(const other of actors.values())if(other!==a&&!other.flying&&other.root.position.distanceTo(candidate)<.48){occupied=true;break;}if(occupied)continue;const ground=floor({x:candidate.x,y:p.y+2,z:candidate.z});if(ground-p.y>.25||p.y-ground>.5)continue;candidate.y=ground;p.copy(candidate);break;}
 if(a.intent?.action==='social'){const other=actors.get(a.intent.target);if(other)a.lookAt=other.root.position;}
 }
 return{update,move};
}
