import * as T from 'three';
import {addCollider} from './collision.js';
import {createArchitecture} from './architecture.js';
export const RADII=[1200,2700,4500];
export const towers=[],solids=[];
const playerCells=new Map(),roofCells=new Map(),CELL=64;
let seed=742;export function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
function index(map,item,x,z,w,d){for(let i=Math.floor((x-w)/CELL);i<=Math.floor((x+w)/CELL);i++)for(let j=Math.floor((z-d)/CELL);j<=Math.floor((z+d)/CELL);j++){const key=i+','+j;if(!map.has(key))map.set(key,[]);map.get(key).push(item);}}
const nearby=(map,p)=>map.get(Math.floor(p.x/CELL)+','+Math.floor(p.z/CELL))||[];
export function createWorld(scene){
const loader=new T.TextureLoader();
function tex(name){const t=loader.load('img/'+name+'.jpg');t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;}
const maps={stone:tex('stone'),plaster:tex('plaster'),tiles:tex('tiles'),timber:tex('timber')};
const mat=(c,map=null)=>{const m=new T.MeshStandardMaterial({color:c,map,roughness:.94});if(map)m.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
#ifdef USE_MAP
vec4 surfacePosition=vec4(position,1.0);
vec3 surfaceNormal=normal;
#ifdef USE_INSTANCING
surfacePosition=instanceMatrix*surfacePosition;
surfaceNormal=mat3(instanceMatrix)*surfaceNormal;
#endif
surfacePosition=modelMatrix*surfacePosition;
surfaceNormal=normalize(mat3(modelMatrix)*surfaceNormal);
vec3 surfaceAxis=abs(surfaceNormal);
vMapUv=(surfaceAxis.y>surfaceAxis.x&&surfaceAxis.y>surfaceAxis.z?surfacePosition.xz:surfaceAxis.x>surfaceAxis.z?surfacePosition.zy:surfacePosition.xy)*.35;
#endif`);};return m;};
const stone=mat('#a8a89a',maps.stone),lightStone=mat('#d1ceba',maps.stone),roof=mat('#a39282',maps.tiles),plaster=mat('#e0d3b5',maps.plaster),wood=mat('#a09079',maps.timber),dark=mat('#27363a'),grass=mat('#718166'),metal=mat('#424a49');
const box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(1,1,1,8);
// A real gabled prism, not a four-sided cone perched on a solid building.
const shape=new T.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(0,1);shape.closePath();const roofGeo=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1});roofGeo.translate(0,0,-.5);
const batches=new Map(),dummy=new T.Object3D();
function inst(geo,material,x,y,z,sx,sy,sz,ry=0,physical=false,rough=false){const key=geo.uuid+material.uuid;if(!batches.has(key))batches.set(key,{geo,material,data:[]});batches.get(key).data.push([x,y,z,sx,sy,sz,ry,physical,rough]);}
function cube(material,x,y,z,sx,sy,sz,ry=0,physical=false){inst(box,material,x,y,z,sx,sy,sz,ry,physical);}
function solid(material,x,y,z,sx,sy,sz){cube(material,x,y,z,sx,sy,sz,0,true);const b={x,z,w:sx/2,d:sz/2,minY:y-sy/2,h:y+sy/2};solids.push(b);index(playerCells,b,x,z,b.w+.8,b.d+.8);}
function roofSolid(x,z,w,d,y,h){const b={x,z,w,d,y,h};index(roofCells,b,x,z,w+.6,d+.6);}
const ground=new T.Mesh(new T.PlaneGeometry(40000,40000),grass);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.grappleSurface=true;scene.add(ground);
RADII.forEach((r,ring)=>{const n=[120,200,300][ring],h=80+ring*5;
for(let j=0;j<n;j++){const a=j/n*Math.PI*2,gate=Math.abs(Math.sin(a))<.009;if(gate)continue;const x=Math.sin(a)*r,z=Math.cos(a)*r;
cube(stone,x,h/2,z,r*Math.PI*2/n+2,h,15,a,true);cube(lightStone,x,h+1,z,r*Math.PI*2/n+3,3,19,a,true);
for(let k=-2;k<=2;k++)cube(lightStone,x+Math.cos(a)*k*6,h+4,z-Math.sin(a)*k*6,3.3,5,20,a);
if(j%2===1){inst(cyl,stone,x,51,z,14,102,14,a,true);inst(cyl,lightStone,x,101,z,17,6,17,a,true);for(let k=0;k<8;k++){const t=k/8*Math.PI*2;cube(lightStone,x+Math.sin(t)*15,107,z+Math.cos(t)*15,4,7,4,t);}towers.push(new T.Vector3(x,105,z));}}
// Both ends of the boulevard are sealed with massive reinforced gate leaves.
for(const pole of [-1,1]){const z=pole*r;
solid(stone,0,(h+30)/2,z,120,h-30,18);solid(metal,0,15,z,120,30,7);
for(const side of [-1,1]){solid(stone,side*72,55,z,30,110,30);cube(lightStone,side*72,111,z,36,5,36,0,true);towers.push(new T.Vector3(side*72,115,z));
for(const face of [-1,1]){for(let f=14;f<103;f+=15){cube(dark,side*72,f,z+face*15.1,2.5,5,.2);cube(lightStone,side*72,f-4,z+face*15.5,7,1,1);}for(let k=-2;k<=2;k++)cube(lightStone,side*72+k*7,116,z+face*16,4,6,4);}}
for(const face of [-1,1]){for(let k=-10;k<=10;k++)cube(wood,k*5.5,14.7,z+face*3.6,4.9,29,.22);for(let y=3;y<30;y+=7)cube(metal,0,y,z+face*3.85,118,.8,.28);cube(metal,0,15,z+face*4,.6,30,.4);for(const side of [-1,1])cube(lightStone,side*59,15,z+face*5,2,30,3);}
}
});
// Raised, non-overlapping road sections eliminate coplanar ground/intersection flicker.
const road=mat('#b4aa92',maps.stone);road.polygonOffset=true;road.polygonOffsetFactor=-1;road.polygonOffsetUnits=-2;
cube(road,0,.09,0,43,.18,9500);for(const s of [-1,1])cube(road,s*(4500+21.5)/2,.09,0,4500-21.5,.18,30);
const mats={stone,plaster,wood,roof,dark,trim:lightStone,gold:mat('#b49b54'),cloth:mat('#887a65'),poorPlaster:mat('#a9987c',maps.plaster),poorRoof:mat('#78685a',maps.tiles),slate:mat('#647078',maps.tiles),rug:mat('#693b3a'),glass:mat('#4d6850')};
const house=createArchitecture({cube,inst,solid,roofSolid,box,roofGeo,cyl,mats});
const footprints=[];
function home(x,z,w,d,region,royal=false){house(x,z,w,d,region,royal);footprints.push({x,z,w:w/2+7,d:d/2+7});}
// Wealth changes with distance: estates, merchant streets, then small patched cottages.
for(let z=-4290;z<=4290;z+=145)for(let x=-4290;x<=4290;x+=145){const dist=Math.hypot(x,z);if(dist>4330||dist<180||Math.abs(x)<65||Math.abs(z)<55||RADII.some(r=>Math.abs(dist-r)<95)||rand()>.7)continue;
const region=dist<1200?0:dist<2700?1:2,px=x+(rand()-.5)*20,pz=z+(rand()-.5)*20;
if(Math.abs(px)<95&&pz>980&&pz<1140)continue;
const w=region===0?28+rand()*12:region===1?19+rand()*8:11+rand()*6,d=region===0?30+rand()*12:region===1?23+rand()*7:15+rand()*5;
home(px,pz,w,d,region,region===0&&rand()>.72);
if(region===2&&rand()>.55)home(px+40,pz+24,11+rand()*3,15+rand()*3,2);
}
// Furnished training courtyard homes remain at their original locations.
home(37,1045,24,27,0);home(-39,1085,26,30,0);home(40,1100,26,28,0);
// Central royal residence: a grand receiving hall and two enterable wings.
home(140,140,64,70,0,true);home(86,152,32,42,0,true);home(194,152,32,42,0,true);
for(const s of [-1,1]){cube(lightStone,140+s*85,1.2,140,2,2.4,116);cube(lightStone,140+s*51,1.2,80,66,2.4,2);}
const rock=mat('#7b8074'),rockGeo=new T.IcosahedronGeometry(1,0);
const boulder=(x,z,sx,sy,sz)=>{inst(rockGeo,rock,x,sy*.62,z,sx,sy,sz,rand()*6,true,true);const b={x,z,w:sx*.65,d:sz*.65,minY:0,h:sy*1.5};solids.push(b);index(playerCells,b,x,z,b.w+.8,b.d+.8);};
for(const side of [-1,1]){boulder(side*24,1071,1.5,1.2,2);boulder(side*26.6,1072,1.3,1.7,1.6);boulder(side*23,1105,1.8,1.8,1.5);boulder(side*26,1104,1.1,1.5,1.8);}
for(let i=0;i<300;i++){const a=rand()*Math.PI*2,r=4580+rand()*2600;boulder(Math.sin(a)*r,Math.cos(a)*r,1+rand()*3,.6+rand()*2.6,1+rand()*3);}
const bark=mat('#615f4c'),leaves=mat('#4d6856'),leafGeo=new T.IcosahedronGeometry(1,1);
for(let i=0;i<1100;i++){const a=rand()*Math.PI*2,r=500+rand()*6500,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<65||RADII.some(v=>Math.abs(v-r)<65)||footprints.some(b=>Math.abs(x-b.x)<b.w&&Math.abs(z-b.z)<b.d))continue;const h=9+rand()*10;inst(cyl,bark,x,h*.35,z,.65,h*.7,.65,0,true);inst(leafGeo,leaves,x,h,z,4+rand()*3,6,4+rand()*3);}
const mountain=mat('#7e9193'),mountainGeo=new T.ConeGeometry(1,1,6);for(let i=0;i<72;i++){const a=i/72*Math.PI*2;inst(mountainGeo,mountain,Math.sin(a)*13500,500,Math.cos(a)*13500,1300+rand()*1000,1000+rand()*1500,1300,rand()*6);}
// Spatially chunked instancing: distant neighborhoods can be frustum culled.
for(const {geo,material,data}of batches.values()){
const chunks=new Map();for(const a of data){const key=Math.floor(a[0]/1200)+','+Math.floor(a[2]/1200);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(a);}
for(const group of chunks.values()){const mesh=new T.InstancedMesh(geo,material,group.length);group.forEach((a,i)=>{dummy.position.set(a[0],a[1],a[2]);dummy.scale.set(a[3],a[4],a[5]);dummy.rotation.set(0,a[6],0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(a[7])addCollider(geo,...a.slice(0,7),a[8]);});mesh.userData.grappleSurface=material!==mountain;mesh.receiveShadow=true;mesh.castShadow=material===stone||material===wood||geo===cyl;mesh.computeBoundingSphere();scene.add(mesh);}}
const beacon=new T.Group(),bm=new T.MeshBasicMaterial({color:0xffcf83,transparent:true,opacity:.7}),ring=new T.Mesh(new T.TorusGeometry(2.3,.085,6,48),bm);ring.rotation.x=-Math.PI/2;beacon.add(ring);const diamond=new T.Mesh(new T.OctahedronGeometry(.5),bm);diamond.position.y=3;beacon.add(diamond);beacon.position.set(0,.2,1060);scene.add(beacon);return{beacon};
}
export function terrainHeight(p){let y=0;const dist=Math.hypot(p.x,p.z);RADII.forEach((r,i)=>{const top=83+i*5;if(Math.abs(dist-r)<9&&p.y>=top+1.7)y=Math.max(y,top);});
for(const b of nearby(playerCells,p))if(Math.abs(p.x-b.x)<b.w+.1&&Math.abs(p.z-b.z)<b.d+.1&&p.y>=b.h+1.7)y=Math.max(y,b.h);
for(const b of nearby(roofCells,p)){if(Math.abs(p.x-b.x)>b.w||Math.abs(p.z-b.z)>b.d)continue;const top=b.y+b.h*(1-Math.abs(p.x-b.x)/b.w);if(p.y>=top+1.7)y=Math.max(y,top);}
for(const t of towers)if(Math.hypot(p.x-t.x,p.z-t.z)<15&&p.y>=107)y=Math.max(y,105);
// Boulevard top is physically walkable, including its intersection.
if((Math.abs(p.x)<21.5&&Math.abs(p.z)<4750)||(Math.abs(p.z)<15&&Math.abs(p.x)<4500))y=Math.max(y,.18);
return y;}
export function ceilingHeight(p,oldY){let ceiling=Infinity;for(const b of nearby(playerCells,p))if(Math.abs(p.x-b.x)<b.w+.45&&Math.abs(p.z-b.z)<b.d+.45&&oldY+.25<=b.minY+.02)ceiling=Math.min(ceiling,b.minY-.25);return ceiling;}
export function blocked(p){const dist=Math.hypot(p.x,p.z);for(let i=0;i<RADII.length;i++)if(Math.abs(dist-RADII[i])<9&&p.y-1.8<80+i*5)return true;
for(const b of nearby(playerCells,p))if(p.y-1.8<b.h-.02&&p.y+.25>b.minY+.02&&Math.abs(p.x-b.x)<b.w+.45&&Math.abs(p.z-b.z)<b.d+.45)return true;
for(const t of towers)if(p.y<102&&Math.hypot(p.x-t.x,p.z-t.z)<15)return true;return false;}
