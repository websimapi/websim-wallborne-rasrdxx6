import * as T from 'three';
import {cityLayout} from './server.js';
import {createArchitecture} from './architecture.js';
import {addCollider,removeCollider,setColliderProvider} from './collision.js';
import {InstancePool} from './instance-pool.js';
import {Debris} from './debris.js';
const up=new T.Vector3(0,1,0),matrix=new T.Matrix4(),zero=new T.Matrix4().makeScale(0,0,0),CELL=96;
export function createCity(scene,{box,roofGeo,cyl,mats}){
 const buildings=cityLayout().map(s=>({...s,parts:null,lod:[],broken:new Set(),history:[],lastUsed:0,damage:0})),grid=new Map(),pools=new Map(),loaded=new Set(),ruins=new Set(),debris=new Debris(scene,box);
 let clock=0,scanAt=-1,current=null,focusPoint=new T.Vector3(0,2,1030);
 function getPool(geo,mat){const key=geo.uuid+mat.uuid;if(!pools.has(key))pools.set(key,new InstancePool(scene,geo,mat,512));return pools.get(key);}
 const key=(x,z)=>Math.floor(x/CELL)+','+Math.floor(z/CELL);
 for(const b of buildings){const k=key(b.x,b.z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(b);}
 function query(x,z,r){const found=[];for(let ix=Math.floor((x-r)/CELL);ix<=Math.floor((x+r)/CELL);ix++)for(let iz=Math.floor((z-r)/CELL);iz<=Math.floor((z+r)/CELL);iz++)for(const b of grid.get(ix+','+iz)||[])if(Math.abs(b.x-x)<r+40&&Math.abs(b.z-z)<r+40)found.push(b);return found;}
 function transform(b,x,y,z,ry=0){const c=Math.cos(b.angle),s=Math.sin(b.angle);return {position:new T.Vector3(b.x+x*c+z*s,y,b.z-x*s+z*c),quaternion:new T.Quaternion().setFromAxisAngle(up,b.angle+ry)};}
 function lodPart(b,geo,mat,x,y,z,sx,sy,sz,ry=0){const t=transform(b,x,y,z,ry);matrix.compose(t.position,t.quaternion,new T.Vector3(sx,sy,sz));const pool=getPool(geo,mat);b.lod.push(pool.add(matrix));}
 const farMaterials=new Map();
 function farFacade(source){if(farMaterials.has(source))return farMaterials.get(source);const material=source.clone();material.onBeforeCompile=shader=>{source.onBeforeCompile(shader);shader.vertexShader='varying vec3 facadeLocal;varying vec3 facadeNormal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfacadeLocal=position;facadeNormal=normal;');shader.fragmentShader='varying vec3 facadeLocal;varying vec3 facadeNormal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
 '#include <map_fragment>\nif(abs(facadeNormal.y)<0.5){vec2 cell=fract((vec2(abs(facadeNormal.x)>0.5?facadeLocal.z:facadeLocal.x,facadeLocal.y)+0.5)*vec2(3.0,2.0));float windowPane=step(0.36,cell.x)*step(cell.x,0.64)*step(0.27,cell.y)*step(cell.y,0.66);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.115,0.145,0.135),windowPane*0.88);}');};material.customProgramCacheKey=()=>source.uuid+'-distant-facade';farMaterials.set(source,material);return material;}
 const wallFor=b=>farFacade(b.region===0?mats.stone:b.region===1?mats.plaster:mats.poorPlaster);
 const tileFor=b=>b.region===0?mats.slate:b.region===1?mats.roof:mats.poorRoof;
 // Distant blocks use the same dimensions and roof profiles as the enterable version.
 for(const b of buildings){lodPart(b,box,wallFor(b),0,b.height/2,0,b.w,b.height,b.d);lodPart(b,roofGeo,tileFor(b),0,b.height+.16,0,b.w+1.8,b.roof,b.d+1.8);
 if(b.variant===1||b.variant===4){const side=b.variant===1?1:-1;lodPart(b,box,wallFor(b),side*b.w*.64,b.height*.38,b.d*.1,b.w*.28,b.height*.76,b.d*.38);lodPart(b,roofGeo,tileFor(b),side*b.w*.64,b.height*.76,b.d*.1,b.w*.28+1,b.roof*.7,b.d*.38+1,Math.PI/2);}
 if(b.royal)for(const s of [-1,1])lodPart(b,box,mats.trim,s*b.w*.5,b.height+2,b.d*.25,4,5,4);
 }
 function collect(geo,material,x,y,z,sx,sy,sz,ry=0,physical=false){const b=current,t=transform(b,x,y,z,ry),scale=new T.Vector3(Math.max(.03,sx),Math.max(.03,sy),Math.max(.03,sz)),part={geometry:geo,material,...t,scale,physical,broken:false,collider:null,index:b.parts.length};
 matrix.compose(part.position,part.quaternion,scale);part.matrix=matrix.clone();part.bounds=new T.Box3().setFromBufferAttribute(geo.attributes.position).applyMatrix4(part.matrix);b.parts.push(part);
 if(b.broken.has(part.index)){part.broken=true;return;}
 part.handle=getPool(geo,material).add(part.matrix);if(physical)part.collider=addCollider(geo,0,0,0,1,1,1,0,false,part.matrix);
 }
 const architecture=createArchitecture({box,roofGeo,cyl,mats,inst:collect,cube:(m,x,y,z,sx,sy,sz,ry=0)=>collect(box,m,x,y,z,sx,sy,sz,ry),solid:(m,x,y,z,sx,sy,sz)=>collect(box,m,x,y,z,sx,sy,sz,0,true),roofSolid:()=>{}});
 function load(b){b.lastUsed=clock;if(b.parts)return;b.parts=[];current=b;architecture(0,0,b.w,b.d,b.region,b.royal,b);current=null;loaded.add(b);b.lod.forEach(h=>h.pool.hide(h));if(b.pending?.length){const pending=b.pending;b.pending=[];for(const event of pending)damage(event);}}
 function unload(b){if(!b.parts||b.damage)return;for(const p of b.parts){if(p.handle)p.handle.pool.hide(p.handle,true);removeCollider(p.collider);debris.removeStatic(p);}b.parts=null;loaded.delete(b);
 // Restore exact original LOD transforms, including attached wings.
 const c=Math.cos(b.angle),s=Math.sin(b.angle);let i=0;
 const restore=(x,y,z,sx,sy,sz,ry=0)=>{const h=b.lod[i++];const t=transform(b,x,y,z,ry);matrix.compose(t.position,t.quaternion,new T.Vector3(sx,sy,sz));h.pool.set(h.index,matrix);};
 restore(0,b.height/2,0,b.w,b.height,b.d);restore(0,b.height+.16,0,b.w+1.8,b.roof,b.d+1.8);
 if(b.variant===1||b.variant===4){const side=b.variant===1?1:-1;restore(side*b.w*.64,b.height*.38,b.d*.1,b.w*.28,b.height*.76,b.d*.38);restore(side*b.w*.64,b.height*.76,b.d*.1,b.w*.28+1,b.roof*.7,b.d*.38+1,Math.PI/2);}
 if(b.royal)for(const s of [-1,1])restore(s*b.w*.5,b.height+2,b.d*.25,4,5,4);
 }
 function localDistance(part,point){const local=point.clone().sub(part.position).applyQuaternion(part.quaternion.clone().invert());return Math.sqrt(Math.max(0,Math.abs(local.x)-part.scale.x/2)**2+Math.max(0,Math.abs(local.y)-part.scale.y/2)**2+Math.max(0,Math.abs(local.z)-part.scale.z/2)**2);}
 function breakPart(b,p,impact,seed,delay=0){if(p.broken||p.position.y<.1)return;p.broken=true;b.broken.add(p.index);removeCollider(p.collider);debris.removeStatic(p);debris.fracture(p,impact,seed+p.index*977,delay);}
 function damage(event){const b=buildings[event.id];if(!b||event.level<=b.damage)return;
 if(!b.parts&&Math.hypot(b.x-focusPoint.x,b.z-focusPoint.z)>600){
 if(event.level<=(b.farDamage||0))return;b.farDamage=event.level;b.pending??=[];b.pending.push(event);ruins.add(b);
 b.lod.forEach(h=>h.pool.hide(h));const t=transform(b,0,.65,0);matrix.compose(t.position,t.quaternion,new T.Vector3(b.w,1.3,b.d));b.lod[0].pool.set(b.lod[0].index,matrix);return;
 }
 load(b);b.damage=event.level;ruins.add(b);b.history.push(event);const impact=new T.Vector3(event.x,event.y,event.z),radius=event.radius||8;let supports=0,lost=0;
 for(const p of b.parts){if(p.physical&&p.position.y>1&&p.position.y<b.height*.7){supports++;if(p.broken)lost++;}if(!p.broken&&localDistance(p,impact)<radius){if(p.physical)lost++;breakPart(b,p,impact,event.seed);}}
 // Lost supports cause a delayed, gravity-driven roof and upper-wall collapse.
 const collapse=lost>Math.max(3,supports*.28)||event.level>=2;
 if(collapse)for(const p of b.parts)if(!p.broken&&p.position.y>1.6)breakPart(b,p,impact,event.seed,.2+Math.max(0,p.position.y-3)*.035);
 // Nearby standing walls become collision obstacles for the falling fragments.
 for(const neighbor of query(b.x,b.z,55)){load(neighbor);for(const p of neighbor.parts)if(!p.broken&&p.geometry.type==='BoxGeometry'&&localDistance(p,impact)<26)debris.addStatic(p);}
 }
 function ensureAlong(a,b,r){const dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;if(len2<.0001)return;const mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2};for(const house of query(mid.x,mid.z,Math.sqrt(len2)/2+30)){const t=T.MathUtils.clamp(((house.x-a.x)*dx+(house.z-a.z)*dz)/len2,0,1),distance=Math.hypot(house.x-(a.x+dx*t),house.z-(a.z+dz*t));if(distance<Math.max(house.w,house.d)*.85+r)load(house);}}
 setColliderProvider(ensureAlong);
 function partsAt(p){const result=[];for(const b of query(p.x,p.z,44)){const t=transform(b,0,0,0);const rel=new T.Vector3(p.x-b.x,0,p.z-b.z).applyAxisAngle(up,-b.angle);if(Math.abs(rel.x)>b.w*.9+3||Math.abs(rel.z)>b.d*.6+3)continue;load(b);result.push(...b.parts.filter(part=>part.physical&&!part.broken));}return result;}
 function floor(p){let y=debris.floor(p);for(const part of partsAt(p)){if(part.geometry.type==='ExtrudeGeometry'){const local=new T.Vector3(p.x-part.position.x,0,p.z-part.position.z).applyQuaternion(part.quaternion.clone().invert());if(Math.abs(local.x)<part.scale.x/2&&Math.abs(local.z)<part.scale.z/2){const top=part.position.y+part.scale.y*(1-Math.abs(local.x)/(part.scale.x/2));if(p.y>=top+1.7)y=Math.max(y,top);}}else{const local=new T.Vector3(p.x-part.position.x,0,p.z-part.position.z).applyQuaternion(part.quaternion.clone().invert());if(Math.abs(local.x)<part.scale.x/2+.08&&Math.abs(local.z)<part.scale.z/2+.08&&p.y>=part.bounds.max.y+1.7)y=Math.max(y,part.bounds.max.y);}}return y;}
 function blocked(p){if(debris.blocked(p))return true;for(const part of partsAt(p)){if(part.geometry.type!=='BoxGeometry')continue;const local=new T.Vector3(p.x-part.position.x,0,p.z-part.position.z).applyQuaternion(part.quaternion.clone().invert());if(Math.abs(local.x)<part.scale.x/2+.43&&Math.abs(local.z)<part.scale.z/2+.43&&p.y-1.8<part.bounds.max.y-.02&&p.y+.25>part.bounds.min.y+.02)return true;}return false;}
 function ceiling(p,oldY){let y=Infinity;for(const part of partsAt(p)){const local=new T.Vector3(p.x-part.position.x,0,p.z-part.position.z).applyQuaternion(part.quaternion.clone().invert());if(Math.abs(local.x)<part.scale.x/2+.4&&Math.abs(local.z)<part.scale.z/2+.4&&oldY+.25<=part.bounds.min.y+.02)y=Math.min(y,part.bounds.min.y-.25);}return y;}
 function update(dt,focus){focusPoint.copy(focus);clock+=dt;if(clock>scanAt){scanAt=clock+.2;const close=query(focus.x,focus.z,155).filter(b=>Math.hypot(focus.x-b.x,focus.z-b.z)<180).sort((a,b)=>Math.hypot(focus.x-a.x,focus.z-a.z)-Math.hypot(focus.x-b.x,focus.z-b.z));let added=0;for(const b of close){if(b.parts)b.lastUsed=clock;else if(added++<(clock<.1?80:14))load(b);}for(const b of loaded)if(!b.damage&&clock-b.lastUsed>3&&Math.hypot(focus.x-b.x,focus.z-b.z)>260)unload(b);}
 debris.update(dt);
 }
 return{buildings,damage,update,floor,blocked,ceiling,stats:()=>({buildings:buildings.length,interiors:loaded.size,ruins:ruins.size,fragments:debris.pieces.length})};
}
