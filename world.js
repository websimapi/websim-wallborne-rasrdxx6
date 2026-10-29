import * as T from 'three';
import {addCollider} from './collision.js';
import {createTerrain,streetHeight} from './terrain.js';
import {createCity} from './city.js';
import {wallPaths,wallRadius,wallClearance,cityRegion,guardPosts} from './server.js';
export let city=null;
export function updateWorld(dt,focus,camera){city?.update(dt,focus,camera);}
export function damageBuilding(event){city?.damage(event);}
export const RADII=[1200,2700,4500];
export const towers=[],solids=[];
const playerCells=new Map(),roofCells=new Map(),wallCells=new Map(),CELL=64;
function wallDistance(p,w){const dx=w.b.x-w.a.x,dz=w.b.z-w.a.z,t=T.MathUtils.clamp(((p.x-w.a.x)*dx+(p.z-w.a.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(p.x-w.a.x-dx*t,p.z-w.a.z-dz*t);}
let seed=742;export function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
function index(map,item,x,z,w,d){for(let i=Math.floor((x-w)/CELL);i<=Math.floor((x+w)/CELL);i++)for(let j=Math.floor((z-d)/CELL);j<=Math.floor((z+d)/CELL);j++){const key=i+','+j;if(!map.has(key))map.set(key,[]);map.get(key).push(item);}}
const nearby=(map,p)=>map.get(Math.floor(p.x/CELL)+','+Math.floor(p.z/CELL))||[];
export function createWorld(scene){
const loader=new T.TextureLoader();
function tex(name){const t=loader.load('img/'+name+'.png');t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=16;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;return t;}
const maps={stone:tex('paving-tile'),plaster:tex('plaster-tile'),tiles:tex('roof-tile'),timber:tex('wood-tile')};
const mat=(c,map=null)=>{const m=new T.MeshStandardMaterial({color:c,map,roughness:.94});if(map)m.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
#ifdef USE_MAP
vec4 surfacePosition=vec4(position,1.0);
vec3 tilePosition=position;
vec3 surfaceNormal=normal;
#ifdef USE_INSTANCING
surfacePosition=instanceMatrix*surfacePosition;
tilePosition*=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
mat3 instanceNormalMatrix=mat3(instanceMatrix);
surfaceNormal/=vec3(dot(instanceNormalMatrix[0],instanceNormalMatrix[0]),dot(instanceNormalMatrix[1],instanceNormalMatrix[1]),dot(instanceNormalMatrix[2],instanceNormalMatrix[2]));
surfaceNormal=instanceNormalMatrix*surfaceNormal;
#endif
surfacePosition=modelMatrix*surfacePosition;
surfaceNormal=normalize(mat3(modelMatrix)*surfaceNormal);
vec3 surfaceAxis=abs(normal);
vMapUv=(surfaceAxis.y>surfaceAxis.x&&surfaceAxis.y>surfaceAxis.z?tilePosition.xz:surfaceAxis.x>surfaceAxis.z?tilePosition.zy:tilePosition.xy)*.20;
#endif`);};return m;};
const stone=mat('#b4b1a1',maps.plaster),lightStone=mat('#d4d0bd',maps.plaster),roof=mat('#c8a18a',maps.tiles),plaster=mat('#e0d3b5',maps.plaster),wood=mat('#514338',maps.timber),dark=mat('#27363a'),grass=mat('#718166'),metal=mat('#424a49');
grass.polygonOffset=true;grass.polygonOffsetFactor=1;grass.polygonOffsetUnits=2;
// Continuous mineral paving ties the dense street blocks together without grass gaps.
// One ground surface only: no coplanar grass/paving rings.
const paving=new T.MeshStandardMaterial({color:'#bdb6a5',map:maps.stone,roughness:.94});
paving.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 groundXZ;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngroundXZ=(modelMatrix*vec4(position,1.0)).xz;');shader.fragmentShader='varying vec2 groundXZ;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nvec2 q=abs(groundXZ);float edge=min(length(q)-4490.0,min(length(vec2(q.x,q.y-4600.0))-250.0,length(vec2(q.x-4600.0,q.y))-250.0));edge=min(edge,min(max(q.x-250.0,q.y-4600.0),max(q.y-250.0,q.x-4600.0)));float urban=1.0-smoothstep(-2.0,2.0,edge);diffuseColor.rgb=mix(vec3(0.24,0.29,0.17),diffuseColor.rgb,urban);');};paving.customProgramCacheKey=()=> 'stable-terrain-v4';
const road=new T.MeshStandardMaterial({color:'#b4aa92',map:maps.stone,roughness:.94});
const box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(1,1,1,8);
// A real gabled prism, not a four-sided cone perched on a solid building.
const shape=new T.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(0,1);shape.closePath();const roofGeo=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1});roofGeo.translate(0,0,-.5);
const batches=new Map(),dummy=new T.Object3D();
function inst(geo,material,x,y,z,sx,sy,sz,ry=0,physical=false,rough=false){const key=geo.uuid+material.uuid;if(!batches.has(key))batches.set(key,{geo,material,data:[]});batches.get(key).data.push([x,y,z,sx,sy,sz,ry,physical,rough]);}
function cube(material,x,y,z,sx,sy,sz,ry=0,physical=false){inst(box,material,x,y,z,sx,sy,sz,ry,physical);}
function solid(material,x,y,z,sx,sy,sz){cube(material,x,y,z,sx,sy,sz,0,true);const b={x,z,w:sx/2,d:sz/2,minY:y-sy/2,h:y+sy/2};solids.push(b);index(playerCells,b,x,z,b.w+.8,b.d+.8);}
function roofSolid(x,z,w,d,y,h){const b={x,z,w,d,y,h};index(roofCells,b,x,z,w+.6,d+.6);}
createTerrain(scene,paving,road);
// Three nested walls with four outward-projecting districts per ring.
const paths=wallPaths();
paths.forEach((path,ring)=>{const h=80+ring*5;for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),x=(a.x+b.x)/2,z=(a.z+b.z)/2,angle=Math.atan2(-dz,dx);
 cube(lightStone,x,h/2,z,len+.5,h,15,angle,true);cube(lightStone,x,h+.8,z,len+.6,1.6,18,angle,true);
 if(i%2===0){cube(stone,x,h/2,z,1.5,h+1,19,angle,true);cube(lightStone,x,1.5,z,len+.5,3,19,angle);}
 const wall={a,b,x,z,w:Math.abs(dx)/2+11,d:Math.abs(dz)/2+11,h:h+1.6};index(wallCells,wall,x,z,wall.w,wall.d);
 }
 // Reinforced closed gates sit at the outer noses of the four districts.
 for(let face=0;face<4;face++){const angle=face*Math.PI/2,r=wallRadius(ring,angle),x=Math.sin(angle)*r,z=Math.cos(angle)*r;
 // Gate is a visible sealed surface over the continuous collision wall, not an opening.
 cube(metal,x+Math.sin(angle)*7.7,12,z+Math.cos(angle)*7.7,35,24,.6,angle);
 for(const side of [-1,1])cube(stone,x+Math.cos(angle)*side*19+Math.sin(angle)*8,14,z-Math.sin(angle)*side*19+Math.cos(angle)*8,3,28,3,angle);
 for(let y=3;y<24;y+=5)cube(wood,x+Math.sin(angle)*8.1,y,z+Math.cos(angle)*8.1,34,.55,.3,angle);
 }
});
for(const post of guardPosts()){solid(stone,post.x,post.y/2,post.z,23,post.y,23);cube(lightStone,post.x,post.y-.4,post.z,29,.8,29,0,true);for(const side of [-1,1]){cube(lightStone,post.x+side*14,post.y+.6,post.z,1.2,1.2,29);cube(lightStone,post.x,post.y+.6,post.z+side*14,29,1.2,1.2);}const t=new T.Vector3(post.x,post.y,post.z);t.ring=post.ring;towers.push(t);}
// Boulevard cells are part of the terrain mesh, never overlaid on the ground.
const braceUp=new T.BoxGeometry(1,.055,.22);braceUp.rotateZ(Math.PI/4);const braceDown=new T.BoxGeometry(1,.055,.22);braceDown.rotateZ(-Math.PI/4);
const mats={braceUp,braceDown,stone,plaster,wood,roof,dark,trim:lightStone,gold:mat('#b49b54'),cloth:mat('#887a65'),poorPlaster:mat('#a9987c',maps.plaster),poorRoof:mat('#78685a',maps.tiles),slate:mat('#b29984',maps.tiles),rug:mat('#693b3a'),glass:mat('#4d6850')};
city=createCity(scene,{box,roofGeo,cyl,mats});
const footprints=city.buildings.map(b=>({x:b.x,z:b.z,w:b.w*.8+3,d:b.d*.8+3}));
const rock=mat('#7b8074'),rockGeo=new T.IcosahedronGeometry(1,0);
const boulder=(x,z,sx,sy,sz)=>{inst(rockGeo,rock,x,sy*.62,z,sx,sy,sz,rand()*6,true,true);const b={x,z,w:sx*.65,d:sz*.65,minY:0,h:sy*1.5};solids.push(b);index(playerCells,b,x,z,b.w+.8,b.d+.8);};
for(const side of [-1,1]){boulder(side*24,1071,1.5,1.2,2);boulder(side*26.6,1072,1.3,1.7,1.6);boulder(side*23,1105,1.8,1.8,1.5);boulder(side*26,1104,1.1,1.5,1.8);}
for(let i=0;i<300;i++){const a=rand()*Math.PI*2,r=4580+rand()*2600;boulder(Math.sin(a)*r,Math.cos(a)*r,1+rand()*3,.6+rand()*2.6,1+rand()*3);}
const bark=mat('#615f4c'),leaves=mat('#4d6856'),leafGeo=new T.IcosahedronGeometry(1,1);
for(let i=0;i<1100;i++){const a=rand()*Math.PI*2,r=500+rand()*6500,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<65||RADII.some((_,ring)=>wallClearance(ring,x,z)<25)||footprints.some(b=>Math.abs(x-b.x)<b.w&&Math.abs(z-b.z)<b.d))continue;const h=9+rand()*10;inst(cyl,bark,x,h*.35,z,.65,h*.7,.65,0,true);inst(leafGeo,leaves,x,h,z,4+rand()*3,6,4+rand()*3);}
const mountain=mat('#7e9193'),mountainGeo=new T.ConeGeometry(1,1,6);for(let i=0;i<72;i++){const a=i/72*Math.PI*2;inst(mountainGeo,mountain,Math.sin(a)*13500,500,Math.cos(a)*13500,1300+rand()*1000,1000+rand()*1500,1300,rand()*6);}
// Spatially chunked instancing: distant neighborhoods can be frustum culled.
for(const {geo,material,data}of batches.values()){
const chunks=new Map();for(const a of data){const key=Math.floor(a[0]/1200)+','+Math.floor(a[2]/1200);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(a);}
for(const group of chunks.values()){const mesh=new T.InstancedMesh(geo,material,group.length);group.forEach((a,i)=>{dummy.position.set(a[0],a[1],a[2]);dummy.scale.set(a[3],a[4],a[5]);dummy.rotation.set(0,a[6],0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(a[7])addCollider(geo,...a.slice(0,7),a[8]);});mesh.userData.grappleSurface=material!==mountain;mesh.receiveShadow=true;mesh.castShadow=material===stone||material===wood||geo===cyl;mesh.computeBoundingSphere();scene.add(mesh);}}
const beacon=new T.Group(),bm=new T.MeshBasicMaterial({color:0xffcf83,transparent:true,opacity:.7}),ring=new T.Mesh(new T.TorusGeometry(2.3,.085,6,48),bm);ring.rotation.x=-Math.PI/2;beacon.add(ring);const diamond=new T.Mesh(new T.OctahedronGeometry(.5),bm);diamond.position.y=3;beacon.add(diamond);beacon.position.set(0,.2,1060);scene.add(beacon);return{beacon};
}
export function terrainHeight(p){let y=0;const dist=Math.hypot(p.x,p.z);for(const w of nearby(wallCells,p))if(wallDistance(p,w)<9&&p.y>=w.h+1.7)y=Math.max(y,w.h);
for(const b of nearby(playerCells,p))if(Math.abs(p.x-b.x)<b.w+.1&&Math.abs(p.z-b.z)<b.d+.1&&p.y>=b.h+1.7)y=Math.max(y,b.h);
for(const b of nearby(roofCells,p)){if(Math.abs(p.x-b.x)>b.w||Math.abs(p.z-b.z)>b.d)continue;const top=b.y+b.h*(1-Math.abs(p.x-b.x)/b.w);if(p.y>=top+1.7)y=Math.max(y,top);}
for(const t of towers)if(Math.abs(p.x-t.x)<14.5&&Math.abs(p.z-t.z)<14.5&&p.y>=t.y+1.7)y=Math.max(y,t.y);
// Boulevard top is physically walkable, including its intersection.
y=Math.max(y,streetHeight(p.x,p.z));
return Math.max(y,city?.floor(p)||0);}
export function ceilingHeight(p,oldY){let ceiling=Infinity;for(const b of nearby(playerCells,p))if(Math.abs(p.x-b.x)<b.w+.45&&Math.abs(p.z-b.z)<b.d+.45&&oldY+.25<=b.minY+.02)ceiling=Math.min(ceiling,b.minY-.25);return Math.min(ceiling,city?.ceiling(p,oldY)??Infinity);}
export function blocked(p){const dist=Math.hypot(p.x,p.z);for(const w of nearby(wallCells,p))if(wallDistance(p,w)<9&&p.y-1.8<w.h)return true;
for(const b of nearby(playerCells,p))if(p.y-1.8<b.h-.02&&p.y+.25>b.minY+.02&&Math.abs(p.x-b.x)<b.w+.45&&Math.abs(p.z-b.z)<b.d+.45)return true;
for(const t of towers)if(p.y-1.8<t.y&&Math.abs(p.x-t.x)<12&&Math.abs(p.z-t.z)<12)return true;return city?.blocked(p)||false;}
