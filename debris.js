import * as T from 'three';
import * as C from './vendor/cannon-es.js';
import {InstancePool} from './instance-pool.js';
import {addCollider,removeCollider} from './collision.js';
const matrix=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3();
export class Debris {
 constructor(scene,box){this.scene=scene;this.box=box;this.world=new C.World({gravity:new C.Vec3(0,-9.81,0),allowSleep:true});this.world.broadphase=new C.SAPBroadphase(this.world);this.world.solver.iterations=5;this.world.defaultContactMaterial.friction=.72;this.world.defaultContactMaterial.restitution=.06;
 const floor=new C.Body({mass:0,shape:new C.Plane()});floor.quaternion.setFromEuler(-Math.PI/2,0,0);this.world.addBody(floor);
 this.pools=new Map();this.pieces=[];this.queue=[];this.delayed=[];this.staticParts=new Map();this.age=0;
 const positions=new Float32Array(768*3);positions.fill(-1e5);const opacity=new Float32Array(768),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('alpha',new T.BufferAttribute(opacity,1));this.dust=[];this.dustNext=0;
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{tint:{value:new T.Color('#b7aa8e')}},vertexShader:'#include <common>\n#include <logdepthbuf_pars_vertex>\nattribute float alpha; varying float a; void main(){a=alpha;vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(65.0,220.0/max(1.0,-p.z));gl_Position=projectionMatrix*p;\n#include <logdepthbuf_vertex>\n}',fragmentShader:'#include <common>\n#include <logdepthbuf_pars_fragment>\nuniform vec3 tint;varying float a;void main(){float d=length(gl_PointCoord-0.5)*2.0;gl_FragColor=vec4(tint,a*(1.0-smoothstep(0.0,1.0,d))*0.35);\n#include <logdepthbuf_fragment>\n}'});this.cloud=new T.Points(geo,material);this.cloud.frustumCulled=false;scene.add(this.cloud);
 }
 pool(material){if(!this.pools.has(material.uuid))this.pools.set(material.uuid,new InstancePool(this.scene,this.box,material,512));return this.pools.get(material.uuid);}
 addStatic(part){if(this.staticParts.has(part)||part.broken||!part.physical||part.bounds.max.y<.25||part.scale.x*part.scale.y*part.scale.z<1.5)return;const body=new C.Body({mass:0,shape:new C.Box(new C.Vec3(part.scale.x/2,part.scale.y/2,part.scale.z/2))});body.position.copy(part.position);body.quaternion.copy(part.quaternion);this.world.addBody(body);this.staticParts.set(part,body);}
 removeStatic(part){const body=this.staticParts.get(part);if(body){this.world.removeBody(body);this.staticParts.delete(part);}}
 dustBurst(position,seed){let state=seed||1;const random=()=>{state=state*16807%2147483647;return(state-1)/2147483646;};for(let i=0;i<30;i++){const id=this.dustNext++%768;this.dust[id]={p:position.clone(),v:new T.Vector3((random()-.5)*5,1+random()*3,(random()-.5)*5),life:2+random()*3,max:5};}}
 fracture(part,impact,seed,delay=0){
 this.delayed.push({at:this.age+delay,part});
 let state=seed||1;const random=()=>{state=state*16807%2147483647;return(state-1)/2147483646;};
 const s=part.scale,roof=part.geometry.type==='ExtrudeGeometry',area=s.x*s.y+s.y*s.z+s.x*s.z;
 // Stone becomes blocks; timber stays splinter-like, roofs become thin tile sections.
 const target=area>150?3.4:2.6,nx=Math.min(12,Math.max(1,Math.ceil(s.x/target))),ny=roof?1:Math.min(6,Math.max(1,Math.ceil(s.y/target))),nz=Math.min(12,Math.max(1,Math.ceil(s.z/target)));
 for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++){
 let size=new T.Vector3(s.x/nx*.96,Math.max(.12,s.y/ny*.96),s.z/nz*.96),offset=new T.Vector3((ix+.5)/nx*s.x-s.x/2,(iy+.5)/ny*s.y-s.y/2,(iz+.5)/nz*s.z-s.z/2),rotation=part.quaternion.clone();
 if(roof){const xx=(ix+.5)/nx*s.x-s.x/2,side=xx>0?1:-1,angle=Math.atan2(s.y,s.x/2);offset.set(xx,s.y*(1-Math.abs(xx)/(s.x/2)),offset.z);size.set(s.x/nx/Math.cos(angle)*.96,.18,size.z);rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-side*angle));}
 const position=offset.applyQuaternion(part.quaternion).add(part.position),dir=position.clone().sub(impact);dir.y=0;if(dir.lengthSq()<.01)dir.set(random()-.5,0,random()-.5);dir.normalize();
 const entry={size,position,rotation,physical:part.physical,material:part.material,velocity:dir.multiplyScalar(1.5+random()*4),spin:new T.Vector3((random()-.5)*3,(random()-.5)*3,(random()-.5)*3),at:this.age+delay+random()*.18};entry.velocity.y=random()*1.5;this.queue.push(entry);
 }
 this.dustBurst(part.position,seed);
 }
 spawn(e){const mass=Math.max(.2,e.size.x*e.size.y*e.size.z*(e.material.map?.image?.src?.includes('timber')?45:160)),body=new C.Body({mass,shape:new C.Box(new C.Vec3(e.size.x/2,e.size.y/2,e.size.z/2)),linearDamping:.12,angularDamping:.18,sleepSpeedLimit:.35,sleepTimeLimit:1.2});body.position.copy(e.position);body.quaternion.copy(e.rotation);body.velocity.copy(e.velocity);body.angularVelocity.copy(e.spin);if(e.physical)this.world.addBody(body);else body.light=true;const pool=this.pool(e.material);matrix.compose(e.position,e.rotation,e.size);const handle=pool.add(matrix);this.pieces.push({body,handle,size:e.size,born:this.age,collider:null,bounds:null});}
 update(dt){this.age+=dt;for(let i=this.delayed.length-1;i>=0;i--)if(this.delayed[i].at<=this.age){const {part}=this.delayed[i];part.handle.pool.hide(part.handle);this.delayed.splice(i,1);}let awake=this.pieces.reduce((n,p)=>n+(!p.body.light&&p.body.sleepState!==C.Body.SLEEPING),0),spawned=0;
 for(let i=0;i<this.queue.length&&spawned<64&&awake<220;){const e=this.queue[i];if(e.at>this.age){i++;continue;}this.queue.splice(i,1);this.spawn(e);spawned++;if(e.physical)awake++;}
 this.world.step(1/60,Math.min(dt,.05),3);
 for(const p of this.pieces){const body=p.body;
 if(body.light&&body.sleepState!==C.Body.SLEEPING){body.velocity.y-=9.81*dt;body.position.x+=body.velocity.x*dt;body.position.y+=body.velocity.y*dt;body.position.z+=body.velocity.z*dt;body.quaternion.integrate(body.angularVelocity,dt,new C.Vec3(1,1,1),body.quaternion);body.quaternion.normalize();q.set(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w);matrix.makeRotationFromQuaternion(q);const e=matrix.elements,base=Math.max(.04,(Math.abs(e[1])*p.size.x+Math.abs(e[5])*p.size.y+Math.abs(e[9])*p.size.z)/2);if(body.position.y<base){body.position.y=base;body.velocity.y*=-.15;body.velocity.x*=.5;body.velocity.z*=.5;body.angularVelocity.scale(.4,body.angularVelocity);if(Math.abs(body.velocity.y)<.35)body.sleep();}}
 if(p.collider){if(body.sleepState===C.Body.SLEEPING)continue;removeCollider(p.collider);p.collider=null;p.bounds=null;}if(this.age-p.born>7)body.sleep();v.set(body.position.x,body.position.y,body.position.z);q.set(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w);matrix.compose(v,q,p.size);p.handle.pool.set(p.handle.index,matrix);
 if(body.sleepState===C.Body.SLEEPING){p.collider=addCollider(this.box,0,0,0,1,1,1,0,true,matrix.clone());const b=new T.Box3().setFromCenterAndSize(new T.Vector3(),p.size).applyMatrix4(new T.Matrix4().compose(v,q,new T.Vector3(1,1,1)));p.bounds=b;}}
 const pos=this.cloud.geometry.attributes.position,alpha=this.cloud.geometry.attributes.alpha;
 for(let i=0;i<this.dust.length;i++){const d=this.dust[i];if(!d||d.life<=0){alpha.setX(i,0);continue;}d.life-=dt;d.v.y+=dt*.2;d.p.addScaledVector(d.v,dt);d.v.multiplyScalar(Math.exp(-dt*.5));pos.setXYZ(i,d.p.x,d.p.y,d.p.z);alpha.setX(i,Math.max(0,d.life/d.max));}pos.needsUpdate=true;alpha.needsUpdate=true;
 }
 floor(p){let top=0;for(const e of this.pieces){const b=e.bounds;if(b&&p.x>=b.min.x&&p.x<=b.max.x&&p.z>=b.min.z&&p.z<=b.max.z&&p.y>=b.max.y+1.7)top=Math.max(top,b.max.y);}return top;}
 blocked(p){for(const e of this.pieces){const b=e.bounds;if(b&&p.x>b.min.x-.4&&p.x<b.max.x+.4&&p.z>b.min.z-.4&&p.z<b.max.z+.4&&p.y-1.8<b.max.y&&p.y+.2>b.min.y)return true;}return false;}
}
