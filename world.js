import * as T from 'three';
import {addCollider} from './collision.js';
export const RADII=[1200,2700,4500];
export const towers=[],solids=[];
let seed=742;export function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
export function createWorld(scene){
const mat=(c,roughness=1)=>new T.MeshStandardMaterial({color:c,roughness});
const stone=mat('#8d948c'),lightStone=mat('#a4a99e'),roof=mat('#606d70'),plaster=mat('#d2c4a8'),wood=mat('#685446'),dark=mat('#2d3e44'),grass=mat('#6e8266');
const box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(1,1,1,8),roofGeo=new T.ConeGeometry(1,1,4);roofGeo.rotateY(Math.PI/4);
const batches=new Map();const dummy=new T.Object3D();
function inst(geo,material,x,y,z,sx,sy,sz,ry=0){const key=geo.uuid+material.uuid;if(!batches.has(key))batches.set(key,{geo,material,data:[]});batches.get(key).data.push([x,y,z,sx,sy,sz,ry]);}
function cube(material,x,y,z,sx,sy,sz,ry=0){inst(box,material,x,y,z,sx,sy,sz,ry);}
const ground=new T.Mesh(new T.PlaneGeometry(40000,40000),grass);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.grappleSurface=true;scene.add(ground);
// Actual world units are meters. Each ring is a complete physical perimeter.
RADII.forEach((r,ring)=>{const n=[120,200,300][ring],h=80+ring*5;for(let j=0;j<n;j++){let a=j/n*Math.PI*2;const gate=Math.abs(Math.sin(a))<.025;if(!gate){const x=Math.sin(a)*r,z=Math.cos(a)*r;cube(stone,x,h/2,z,r*Math.PI*2/n+2,h,15,a);cube(lightStone,x,h+1,z,r*Math.PI*2/n+3,3,19,a);cube(lightStone,x,h/2,z-10,2,h,3,a);for(let k=-2;k<=2;k++)cube(lightStone,x+Math.cos(a)*k*6,h+4,z-Math.sin(a)*k*6,3.3,5,20,a);}
if(j%2===1&&!gate){const x=Math.sin(a)*r,z=Math.cos(a)*r;inst(cyl,stone,x,51,z,14,102,14,a);inst(cyl,lightStone,x,101,z,17,6,17,a);for(let k=0;k<8;k++){const t=k/8*Math.PI*2;cube(lightStone,x+Math.sin(t)*15,107,z+Math.cos(t)*15,4,7,4,t);}for(let f=18;f<95;f+=17)cube(dark,x,f,z-14.05,1.8,4,.2);towers.push(new T.Vector3(x,105,z));}}
// Gate guard towers flank the open boulevard.
for(const side of [-1,1]){const x=side*52,z=r;cube(stone,x,55,z,30,110,30);cube(lightStone,x,111,z,36,5,36);for(let f=14;f<103;f+=15){cube(dark,x,f,z-15.1,2.5,5,.2);cube(lightStone,x,f-4,z-15.5,7,1,1);}towers.push(new T.Vector3(x,115,z));for(let k=-2;k<=2;k++)cube(lightStone,x+k*7,116,z+16,4,6,4);}
});
const road=mat('#b7ad93');cube(road,0,.025,0,43,.05,9500);cube(road,0,.03,0,9000,.05,30);
// Hundreds of meter-scaled blocks, batched into instanced draws.
for(let z=-4350;z<4350;z+=100){for(let x=-4350;x<4350;x+=100){const d=Math.hypot(x,z);if(d>4350||Math.abs(x)<48||Math.abs(z)<40||RADII.some(r=>Math.abs(d-r)<65)||rand()>.67)continue;const px=x+(rand()-.5)*22,pz=z+(rand()-.5)*22;const w=15+rand()*15,dep=17+rand()*19,h=12+rand()*24;cube(plaster,px,h/2,pz,w,h,dep);inst(roofGeo,roof,px,h+4,pz,w*.77,8,dep*.77);cube(wood,px+w*.3,h+6,pz,2,8,2);for(let f=5;f<h-2;f+=5){for(let k=-1;k<=1;k++){cube(dark,px+k*w*.26,f,pz-dep/2-.05,1.5,2.7,.2);cube(dark,px+k*w*.26,f,pz+dep/2+.05,1.5,2.7,.2);}}solids.push({x:px,z:pz,w:w/2,d:dep/2,h:h+5});}}
// Close courtyard buildings have real doors, furnished interiors and separate walls.
function house(x,z,w=18,d=23){const h=12;cube(plaster,x-w/2,h/2,z,1,h,d);cube(plaster,x+w/2,h/2,z,1,h,d);cube(plaster,x,h/2,z+d/2,w,h,1);cube(plaster,x-w*.32,h/2,z-d/2,w*.35,h,1);cube(plaster,x+w*.32,h/2,z-d/2,w*.35,h,1);cube(plaster,x,9,z-d/2,w*.3,6,1);cube(wood,x,.12,z,w,.24,d);cube(wood,x,12,z,w,1,d);for(const side of [-1,1]){cube(wood,x+side*(w/2-.6),6,z-d/2-.6,.45,12,.3);cube(dark,x+side*w*.32,8,z-d/2-.6,2.4,3,.2);cube(wood,x+side*w*.32,8,z-d/2-.8,.15,3.2,.2);}cube(wood,x,4.5,z-d/2-.6,w,.4,.3);inst(roofGeo,roof,x,16,z,w*.8,8,d*.8);cube(wood,x+3,2,z+3,6,.5,3);for(let dx of [-2,2])for(let dz of [-1,1])cube(wood,x+3+dx,1,z+3+dz,.3,2,.3);cube(wood,x-5,1,z+5,3,2,6);cube(lightStone,x-5,2.2,z+5,3,.5,6);cube(wood,x-6,3,z+9,3,6,1.5);for(let f=0;f<3;f++)cube(plaster,x-6,1+f*1.7,z+9,2.7,.25,1.6);solids.push({x:x-w/2,z,w:.5,d:d/2,h},{x:x+w/2,z,w:.5,d:d/2,h},{x,z:z+d/2,w:w/2,d:.5,h},{x:x-w*.32,z:z-d/2,w:w*.175,d:.5,h},{x:x+w*.32,z:z-d/2,w:w*.175,d:.5,h});}
house(37,1045);house(-39,1085);house(40,1100);
// Paired, faceted boulders leave real narrow gaps for loose hooks to catch in.
const rock=mat('#7b8074'),rockGeo=new T.IcosahedronGeometry(1,0);
const boulder=(x,z,sx,sy,sz)=>{inst(rockGeo,rock,x,sy*.62,z,sx,sy,sz,rand()*6);solids.push({x,z,w:sx*.65,d:sz*.65,h:sy*1.5});};
for(const side of [-1,1]){boulder(side*24,1071,1.5,1.2,2);boulder(side*26.6,1072,1.3,1.7,1.6);boulder(side*23,1105,1.8,1.8,1.5);boulder(side*26,1104,1.1,1.5,1.8);}
for(let i=0;i<300;i++){const a=rand()*Math.PI*2,r=4580+rand()*2600;boulder(Math.sin(a)*r,Math.cos(a)*r,1+rand()*3,.6+rand()*2.6,1+rand()*3);}
// Trees, courtyards and the distant mountain rim.
const bark=mat('#615f4c'),leaves=mat('#4d6856'),leafGeo=new T.IcosahedronGeometry(1,1);
for(let i=0;i<1100;i++){const a=rand()*Math.PI*2,r=500+rand()*6500,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<60||RADII.some(v=>Math.abs(v-r)<60))continue;const h=9+rand()*10;inst(cyl,bark,x,h*.35,z,.65,h*.7,.65);inst(leafGeo,leaves,x,h,z,4+rand()*3,6,4+rand()*3);}
const mountain=mat('#7e9193');for(let i=0;i<72;i++){const a=i/72*Math.PI*2;inst(new T.ConeGeometry(1,1,6),mountain,Math.sin(a)*13500,500,Math.cos(a)*13500,1300+rand()*1000,1000+rand()*1500,1300,rand()*6);}
for(const {geo,material,data}of batches.values()){const mesh=new T.InstancedMesh(geo,material,data.length);data.forEach((a,i)=>{dummy.position.set(a[0],a[1],a[2]);dummy.scale.set(a[3],a[4],a[5]);dummy.rotation.set(0,a[6],0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(material!==mountain&&material!==leaves&&material!==dark&&material!==road)addCollider(geo,...a,material===rock);});mesh.userData.grappleSurface=material!==mountain;mesh.receiveShadow=true;mesh.castShadow=geo===cyl||material===plaster;mesh.computeBoundingSphere();scene.add(mesh);}
// Courtyard training beacon.
const beacon=new T.Group();const bm=new T.MeshBasicMaterial({color:0xffcf83,transparent:true,opacity:.7});const ring=new T.Mesh(new T.TorusGeometry(2.3,.085,6,48),bm);ring.rotation.x=-Math.PI/2;beacon.add(ring);const diamond=new T.Mesh(new T.OctahedronGeometry(.5),bm);diamond.position.y=3;beacon.add(diamond);beacon.position.set(0,.15,1060);scene.add(beacon);
return{beacon};
}
export function terrainHeight(p){let y=0;for(const r of RADII){const d=Math.hypot(p.x,p.z);if(Math.abs(d-r)<8&&Math.abs(p.x)>38)y=Math.max(y,83);}for(const b of solids){if(Math.abs(p.x-b.x)<b.w&&Math.abs(p.z-b.z)<b.d&&p.y>b.h-2)y=Math.max(y,b.h);}for(const t of towers){if(Math.hypot(p.x-t.x,p.z-t.z)<15&&p.y>99)y=Math.max(y,105);}return y;}
export function blocked(p){for(const r of RADII){if(Math.abs(Math.hypot(p.x,p.z)-r)<9&&Math.abs(p.x)>38&&p.y<82)return true;}for(const b of solids){if(p.y<b.h&&Math.abs(p.x-b.x)<b.w+.5&&Math.abs(p.z-b.z)<b.d+.5)return true;}for(const t of towers){if(p.y<102&&Math.hypot(p.x-t.x,p.z-t.z)<15)return true;}return false;}
