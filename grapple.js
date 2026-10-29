import * as T from 'three';
import {sweepWorld,resolveParticle} from './collision.js';
const COUNT=41,MAX_CABLE=850,GRAVITY=9.81,HEAD_RADIUS=.14,RECALL_SPEED=360,READY_RADIUS=3;
const up=new T.Vector3(0,1,0);
export class Grapple {
 constructor(scene,onSnag){
 this.scene=scene;this.onSnag=onSnag;this.mode='idle';this.tip=new T.Vector3();this.velocity=new T.Vector3();this.hand=new T.Vector3();this.previousHand=new T.Vector3();this.points=Array.from({length:COUNT},()=>new T.Vector3());this.previous=this.points.map(p=>p.clone());this.ropeLength=0;this.age=0;this.object=null;this.localAnchor=new T.Vector3();this.contactNormal=new T.Vector3();this.lastContact=null;this.snagNormals=[];this.previousDt=1/60;
 const mat=new T.MeshStandardMaterial({color:'#9ba9ac',metalness:.85,roughness:.3});this.head=new T.Group();const stem=new T.Mesh(new T.CylinderGeometry(.045,.065,.55,6),mat);this.head.add(stem);
 for(let i=0;i<3;i++){const claw=new T.Mesh(new T.TorusGeometry(.18,.03,5,10,Math.PI*1.25),mat);claw.rotation.y=i*Math.PI*2/3;claw.position.y=.13;this.head.add(claw);}
 this.head.visible=false;scene.add(this.head);this.lines=[];for(let j=0;j<2;j++){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(COUNT*3),3));const line=new T.Line(geo,new T.LineBasicMaterial({color:'#293b40'}));line.frustumCulled=false;line.visible=false;scene.add(line);this.lines.push(line);}
 }
 get active(){return this.mode!=='idle';}
 get latched(){return this.mode==='latched';}
 reset(){this.mode='idle';this.object=null;this.velocity.set(0,0,0);this.head.visible=false;this.lines.forEach(l=>l.visible=false);}
 fire(origin,direction,inheritedVelocity){if(this.active)return false;this.mode='flying';this.age=0;this.lastContact=null;this.snagNormals=[];this.object=null;this.hand.copy(origin);this.previousHand.copy(origin);this.tip.copy(origin).addScaledVector(direction,.7);this.velocity.copy(direction).multiplyScalar(350).addScaledVector(inheritedVelocity,.2);this.ropeLength=1.2;
 for(let i=0;i<COUNT;i++){this.points[i].copy(origin).lerp(this.tip,i/(COUNT-1));this.previous[i].copy(this.points[i]);}this.head.visible=true;this.lines.forEach(l=>l.visible=true);return true;}
 release(){if(!this.active||this.mode==='returning'||this.mode==='snagged')return;this.mode='returning';this.object=null;this.velocity.multiplyScalar(.12);this.lastContact=null;}
 latch(hit){this.mode='latched';this.tip.copy(hit.point);this.velocity.set(0,0,0);this.contactNormal.copy(hit.normal);this.object=hit.object||null;if(this.object){this.localAnchor.copy(this.tip);this.object.worldToLocal(this.localAnchor);}this.ropeLength=Math.max(4,this.hand.distanceTo(this.tip)+.4);}
 snag(hit){this.mode='snagged';this.tip.copy(hit.point);this.velocity.set(0,0,0);this.snagNormals=[hit.normal.clone()];if(this.lastContact&&this.lastContact.normal.dot(hit.normal)<.55)this.snagNormals.push(this.lastContact.normal.clone());this.snagDirection=this.hand.clone().sub(this.tip).normalize();this.snagAge=0;this.ropeLength=Math.max(this.ropeLength,this.hand.distanceTo(this.tip)+.2);this.onSnag?.();}
 update(dt,origin,dynamic=[],allowTitan=true,boost=false){if(!this.active)return;this.hand.copy(origin);this.age+=dt;
 if(this.mode==='latched'){
 if(this.object){this.object.updateWorldMatrix(true,false);this.tip.copy(this.localAnchor).applyMatrix4(this.object.matrixWorld);}
 this.ropeLength=Math.max(4,this.ropeLength-(boost?125:78)*dt);
 }else{
 const substeps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/substeps;
 for(let s=0;s<substeps&&this.active;s++){
 // Dock within reach, before contact handling can snag a nearly returned hook.
 if((this.mode==='returning'||this.mode==='snagged')&&this.tip.distanceToSquared(this.hand)<=READY_RADIUS*READY_RADIUS){this.reset();break;}
 if(this.mode==='snagged'){
 this.snagAge+=h;const pull=this.hand.clone().sub(this.tip).normalize();
 // A barb only comes free when the pull direction leaves all contact planes.
 const clear=this.snagNormals.every(n=>pull.dot(n)>.32);
 const changed=pull.dot(this.snagDirection)<.6&&this.snagNormals.every(n=>pull.dot(n)>-.025);
 if(this.snagAge>.18&&(clear||changed)){this.mode='returning';this.velocity.copy(pull).multiplyScalar(3);this.tip.addScaledVector(pull,.08);this.lastContact=null;}else continue;
 }
 const recalling=this.mode==='returning';
 if(recalling){let destination=this.hand;
 // Follow the draped cable rather than cutting a straight path through a corner.
 for(let i=COUNT-3;i>0;i--){if(this.points[i].distanceTo(this.tip)>1.8){destination=this.points[i];break;}}
 if(this.tip.distanceTo(this.hand)<5)destination=this.hand;
 const direction=destination.clone().sub(this.tip).normalize();
 const handVelocity=this.hand.clone().sub(this.previousHand).divideScalar(Math.max(dt,.001)).clampLength(0,145);
 // Strong steering removes outbound momentum and keeps up with a moving player.
 const speed=Math.min(RECALL_SPEED,Math.max(120,this.tip.distanceTo(destination)/h));
 const targetVelocity=direction.multiplyScalar(speed).add(handVelocity);
 this.velocity.lerp(targetVelocity,1-Math.exp(-45*h));
 this.ropeLength=Math.max(.4,this.ropeLength-RECALL_SPEED*h);
 }
 this.velocity.y-=GRAVITY*h;this.velocity.multiplyScalar(Math.exp(-(this.mode==='flying'?.035:.16)*h));
 const old=this.tip.clone(),next=old.clone().addScaledVector(this.velocity,h);const hit=sweepWorld(old,next,HEAD_RADIUS,dynamic);
 if(hit){const impact=-this.velocity.dot(hit.normal);this.tip.copy(hit.point);
 if(this.mode==='flying'&&!hit.ground&&impact>25&&hit.normal.y<.8&&(!hit.object||allowTitan)){this.latch(hit);break;}
 if(recalling){const close=this.lastContact&&this.age-this.lastContact.time<.3&&this.lastContact.point.distanceTo(hit.point)<1;
 const wedged=close&&hit.normal.dot(this.lastContact.normal)<.5;
 const bitingRock=hit.rough&&impact>3&&hit.normal.y<.9;
 if(wedged||bitingRock){this.snag(hit);break;}}
 const inward=this.velocity.dot(hit.normal);if(inward<0)this.velocity.addScaledVector(hit.normal,-inward*(this.mode==='flying'?1.18:1));
 // Coulomb-style contact friction: loose metal skids and settles, it never vanishes.
 this.velocity.multiplyScalar(hit.ground||hit.normal.y>.55?.7:.88);
 this.lastContact={normal:hit.normal.clone(),point:hit.point.clone(),time:this.age};if(this.mode==='flying')this.mode='loose';
 }else this.tip.copy(next);
 if(this.tip.y<HEAD_RADIUS){this.tip.y=HEAD_RADIUS;if(this.velocity.y<0)this.velocity.y=0;this.velocity.x*=Math.exp(-8*h);this.velocity.z*=Math.exp(-8*h);if(this.mode==='flying')this.mode='loose';}
 const offset=this.tip.clone().sub(this.hand),distance=offset.length();if(distance>MAX_CABLE){offset.multiplyScalar(1/distance);this.tip.copy(this.hand).addScaledVector(offset,MAX_CABLE);const outward=this.velocity.dot(offset);if(outward>0)this.velocity.addScaledVector(offset,-outward);if(this.mode==='flying')this.mode='loose';}
 if(!recalling)this.ropeLength=Math.min(MAX_CABLE,Math.max(this.ropeLength,this.tip.distanceTo(this.hand)*1.015+.5));
 if(recalling&&this.tip.distanceToSquared(this.hand)<=READY_RADIUS*READY_RADIUS){this.reset();break;}
 }
 }
 if(!this.active)return;
 if(this.mode==='snagged')this.ropeLength=Math.max(this.hand.distanceTo(this.tip)+.1,this.ropeLength-RECALL_SPEED*dt);
 // A spool cannot consume cable faster than the head can get past an obstruction.
 if(this.mode==='returning')this.ropeLength=Math.max(this.ropeLength,this.hand.distanceTo(this.tip));
 this.simulateCable(dt);this.previousHand.copy(this.hand);
 }
 pull(dt,player){if(!this.latched)return;const direction=this.tip.clone().sub(player.pos),distance=direction.length();if(distance<.01)return;direction.multiplyScalar(1/distance);const stretch=Math.max(0,distance-this.ropeLength),radial=player.vel.dot(direction);
 // The cable only pulls when taut. Tangential momentum remains for swinging.
 const tension=T.MathUtils.clamp(stretch*22-radial*3,0,165);player.vel.addScaledVector(direction,tension*dt);
 }
 simulateCable(dt){
 const ratio=T.MathUtils.clamp(dt/this.previousDt,.25,2);this.previousDt=Math.max(.001,dt);const rest=this.ropeLength/(COUNT-1);
 for(let i=1;i<COUNT-1;i++){const p=this.points[i],previous=this.previous[i],v=p.clone().sub(previous).multiplyScalar(.985*ratio);previous.copy(p);p.add(v);p.y-=GRAVITY*dt*dt;}
 for(let pass=0;pass<9;pass++){
 this.points[0].copy(this.hand);this.points[COUNT-1].copy(this.tip);
 for(let i=0;i<COUNT-1;i++){const a=this.points[i],b=this.points[i+1],d=b.clone().sub(a),length=d.length();if(length<=rest||length<1e-6)continue;const correction=d.multiplyScalar((length-rest)/length),wa=i===0?0:1,wb=i+1===COUNT-1?0:1,total=wa+wb;if(total){a.addScaledVector(correction,wa/total);b.addScaledVector(correction,-wb/total);}}
 if(pass%3===2)for(let i=1;i<COUNT-1;i++)if(resolveParticle(this.points[i],.035))this.previous[i].lerp(this.points[i],.5);
 }
 // Segment sweeps stop even sparse long spans passing through masonry or boulders.
 for(let i=0;i<COUNT-2;i++){const a=this.points[i],b=this.points[i+1];if(a.distanceToSquared(b)<.02)continue;const hit=sweepWorld(a,b,.035);if(hit&&!hit.ground){b.copy(hit.point);this.previous[i+1].lerp(b,.6);}}
 this.points[0].copy(this.hand);this.points[COUNT-1].copy(this.tip);
 }
 render(origin,right){if(!this.active)return;this.head.position.copy(this.tip);const dir=this.velocity.lengthSq()>1?this.velocity.clone().normalize():this.hand.clone().sub(this.tip).normalize();if(dir.lengthSq()>.01)this.head.quaternion.setFromUnitVectors(up,dir);
 for(let j=0;j<this.lines.length;j++){const data=this.lines[j].geometry.attributes.position;for(let i=0;i<COUNT;i++){const p=this.points[i],offset=(j===0?-.2:.2)*Math.max(0,1-i/5);const x=i===0?origin.x:p.x,y=i===0?origin.y:p.y,z=i===0?origin.z:p.z;data.setXYZ(i,x+right.x*offset,y-.12*Math.max(0,1-i/3),z+right.z*offset);}data.needsUpdate=true;}
 }
 networkData(){if(!this.active)return null;const points=[];for(let i=0;i<COUNT;i+=4){const p=this.points[i];points.push([Math.round(p.x*100)/100,Math.round(p.y*100)/100,Math.round(p.z*100)/100]);}return{mode:this.mode,points};}
}
