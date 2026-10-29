import * as T from 'three';
import {citizens,citizenPose,isShop} from './server.js';
import {createTownLife} from './town-life.js';
import {blocked as townBlocked,terrainHeight} from './world.js';
import {createStall} from './town-props.js';
import {humanTemplates,createHuman} from './human-model.js';
import {createResidentAI} from './resident-ai.js';
const UP=new T.Vector3(0,1,0);
export function createPeople(scene){
 const specs=citizens(),actors=new Map(),flights=new Map(),grid=new Map(),frustum=new T.Frustum(),projection=new T.Matrix4(),sphere=new T.Sphere(new T.Vector3(),2.1);let models=null,time=0,scanAt=-1,lastFocus=new T.Vector3(0,2,1030),budget=28;
 const town=createTownLife(specs,actors);
 for(const spec of specs){const key=Math.floor(spec.x/96)+','+Math.floor(spec.z/96);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(spec);}
 humanTemplates.then(loaded=>models=loaded).catch(e=>console.warn('Humanoids:',e.message));
 const intelligence=createResidentAI(actors);
 function spawn(spec){if(!models)return null;const human=createHuman(models,spec),root=human.root;root.position.set(spec.x,spec.y,spec.z);root.rotation.y=spec.angle;scene.add(root);const label=document.createElement('div');label.className='npcSpeaker';label.hidden=true;document.body.append(label);const stall=isShop(spec)?createStall(scene,spec):null;const actor={...human,spec,stall,label,until:0,lookAt:null,lastWanted:time,animationAcc:0};actors.set(spec.id,actor);return actor;}
 function remove(id){const a=actors.get(id);if(!a)return;scene.remove(a.root);a.label.remove();a.stall?.remove();a.mixer?.stopAllAction();a.root.traverse(o=>{if(o.isMesh){if(o.userData.localGeometry)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();}});actors.delete(id);}
 function engage(event){for(const [id,flight]of flights)if(flight.post===event.post){scene.remove(flight.cable);flight.cable?.geometry.dispose();flight.cable?.material.dispose();flights.delete(id);}const spec=specs.find(n=>n.post===event.post);if(!spec||Math.hypot(spec.x-lastFocus.x,spec.z-lastFocus.z)>650)return;flights.set(spec.id,{...event,started:performance.now(),actor:actors.get(spec.id)||spawn(spec)});}
 function update(dt,camera,position,active,serverTime,titans,allowInitiate=true){
 time+=dt;lastFocus.copy(position);budget=T.MathUtils.damp(budget,dt>.032?18:28,.5,dt);projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
 if(models&&time>scanAt){scanAt=time+.45;const found=[];for(let ix=Math.floor((position.x-145)/96);ix<=Math.floor((position.x+145)/96);ix++)for(let iz=Math.floor((position.z-145)/96);iz<=Math.floor((position.z+145)/96);iz++)for(const n of grid.get(ix+','+iz)||[]){const p=citizenPose(n,serverTime||Date.now()),dist=Math.hypot(p.x-position.x,p.z-position.z,p.y+1-position.y);sphere.center.set(p.x,p.y+1,p.z);if(dist<125&&(dist<18||frustum.intersectsSphere(sphere)))found.push({n,dist});}
 found.sort((a,b)=>a.dist-b.dist);const chosen=found.slice(0,Math.round(budget)),wanted=new Set(chosen.map(v=>v.n.id));let spawned=0;for(const {n}of chosen){const a=actors.get(n.id);if(a)a.lastWanted=time;else if(spawned<2&&actors.size<36){spawn(n);spawned++;}}
 for(const [id,a]of actors)if(!wanted.has(id)&&!flights.has(id)&&a.until<time&&time-a.lastWanted>1.8)remove(id);
 }
 for(const [id,actor]of actors){const distance=actor.root.position.distanceTo(position);sphere.center.copy(actor.root.position).add(new T.Vector3(0,1,0));actor.root.visible=distance<12||actor.until>time||frustum.intersectsSphere(sphere);actor.flying=flights.has(id);actor.stall?.update?.(position,camera);
 actor.animationAcc+=dt;if(actor.root.visible&&(distance<30||actor.animationAcc>(distance<70?.065:.12))){actor.mixer?.update(actor.animationAcc);actor.animationAcc=0;}
 const projected=actor.root.position.clone().add(new T.Vector3(0,2.1,0)).project(camera),visible=actor.until>time&&projected.z>0&&projected.z<1&&Math.abs(projected.x)<1&&Math.abs(projected.y)<1;actor.label.hidden=!visible;if(visible){actor.label.textContent=actor.spec.name+' · '+(actor.spec.rank||actor.spec.kind);actor.label.style.left=(projected.x*.5+.5)*innerWidth+'px';actor.label.style.top=(-projected.y*.5+.5)*innerHeight+'px';}
 const flight=flights.get(id);if(flight){const elapsed=(performance.now()-flight.started)/1000,t=elapsed/(flight.duration/1000),target=titans[flight.titan];if(target){const start=new T.Vector3(flight.from.x,flight.from.y,flight.from.z),dest=target.root.position.clone().add(new T.Vector3(-Math.sin(target.root.rotation.y)*target.s*1.3,target.s*16.2,-Math.cos(target.root.rotation.y)*target.s*1.3)),p=t<.45?t/.45:1-(t-.45)/.55;actor.root.position.copy(start).lerp(dest,T.MathUtils.smoothstep(p,0,1));actor.root.position.y+=Math.sin(Math.max(0,Math.min(1,p))*Math.PI)*18;actor.root.lookAt(dest);if(!flight.cable){const geo=new T.BufferGeometry().setFromPoints([start,actor.root.position,start,actor.root.position]);flight.cable=new T.LineSegments(geo,new T.LineBasicMaterial({color:'#314448'}));flight.cable.frustumCulled=false;scene.add(flight.cable);}const anchor=t<.45?dest:start;flight.cable.geometry.setFromPoints([actor.root.position.clone().add(new T.Vector3(-.3,.9,0)),anchor.clone().add(new T.Vector3(-.35,1,0)),actor.root.position.clone().add(new T.Vector3(.3,.9,0)),anchor.clone().add(new T.Vector3(.35,1,0))]);}if(t>=1){actor.root.position.set(actor.spec.x,actor.spec.y,actor.spec.z);actor.root.rotation.set(0,actor.spec.angle,0);scene.remove(flight.cable);flight.cable?.geometry.dispose();flight.cable?.material.dispose();flights.delete(id);}continue;}
 const talking=actor.until>time;
 if(!talking){const before=actor.root.position.clone();intelligence.move(actor,dt,time,titans,residentBlocked,terrainHeight);const speed=before.distanceTo(actor.root.position)/Math.max(.001,dt);actor.setActivity(speed>2?'run':speed>.1?'walk':actor.intent?.action==='work'?'work':'idle');if(speed>.02)actor.root.rotation.y=turnAngle(actor.root.rotation.y,Math.atan2(actor.root.position.x-before.x,actor.root.position.z-before.z),dt*5);}
 else{actor.setActivity('idle');if(actor.lookAt)actor.root.rotation.y=turnAngle(actor.root.rotation.y,Math.atan2(actor.lookAt.x-actor.root.position.x,actor.lookAt.z-actor.root.position.z),dt*5);}

 }
 intelligence.update(dt,position,active&&!town.focused(),time,titans);
 town.update(dt,camera,position,active,titans.some(t=>!t.dead&&t.root.position.distanceTo(position)<220));
 }
 return{update,engage,isTyping:town.isTyping,dialogueOpen:town.focused,directCamera:town.directCamera};
}
function turnAngle(a,b,t){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*Math.min(1,t);}
function residentBlocked(p){return townBlocked({x:p.x,y:p.y+1.8,z:p.z});}
