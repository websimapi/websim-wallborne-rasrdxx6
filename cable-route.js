import * as T from 'three';
import {sweepWorld} from './collision.js';
const radius=.055;
// Persistent corner pins keep topology intact as the player passes a wall.
export class CableRoute {
 constructor(){this.nodes=[];this.length=0;this.blocked=false;}
 clear(){this.nodes=[];this.length=0;this.blocked=false;}
 update(hand,tip){
 let path=[hand.clone(),...this.nodes.map(p=>p.clone()),tip.clone()];
 // Unwrap only when the whole replacement segment is unobstructed.
 for(let i=0;i<path.length-2;i++){for(let j=path.length-1;j>i+1;j--){if(!sweepWorld(path[i],path[j],radius)){path.splice(i+1,j-i-1);break;}}}
 this.blocked=false;
 for(let i=0,attempts=0;i<path.length-1&&attempts<16;){
 const a=path[i],b=path[i+1],hit=sweepWorld(a,b,radius);
 if(!hit||hit.ground){i++;continue;}
 attempts++;const detour=hit.collider?around(a,b,hit.collider):null;
 if(detour?.length&&path.length+detour.length<48){path.splice(i+1,0,...detour);continue;}
 // No valid route: stop at the surface, never draw or pull through it.
 path.splice(i+1,path.length-i-1,hit.point);this.blocked=true;break;
 }
 // A bounded solver must fail closed, including the final head segment.
 for(let i=0;i<path.length-1;i++){const hit=sweepWorld(path[i],path[i+1],radius);if(hit&&!hit.ground){path.splice(i+1,path.length-i-1,hit.point);this.blocked=true;break;}}
 this.nodes=path.slice(1,-1).map(p=>p.clone());this.path=path;this.length=0;
 for(let i=1;i<path.length;i++)this.length+=path[i-1].distanceTo(path[i]);
 return path;
 }
}
function around(a,b,e){
 const bounds=e.bounds.clone().expandByScalar(.16),vertices=[a,b];
 for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)vertices.push(new T.Vector3(x?bounds.max.x:bounds.min.x,Math.max(.11,y?bounds.max.y:bounds.min.y),z?bounds.max.z:bounds.min.z));
 const ray=new T.Raycaster(),dist=Array(10).fill(Infinity),prev=Array(10).fill(-1),done=new Set();dist[0]=0;
 function clear(p,q){const d=q.clone().sub(p),len=d.length();if(len<1e-5)return true;ray.set(p,d.multiplyScalar(1/len));ray.near=0;ray.far=len+.04;const hits=[];e.mesh.raycast(ray,hits);return !hits.length;}
 for(let k=0;k<10;k++){let u=-1;for(let j=0;j<10;j++)if(!done.has(j)&&(u<0||dist[j]<dist[u]))u=j;if(u<0||!Number.isFinite(dist[u]))break;if(u===1)break;done.add(u);
 for(let v=1;v<10;v++){if(v===u||done.has(v)||!clear(vertices[u],vertices[v]))continue;const d=dist[u]+vertices[u].distanceTo(vertices[v]);if(d<dist[v]){dist[v]=d;prev[v]=u;}}
 }
 if(prev[1]<0)return null;const route=[];for(let p=prev[1];p>0;p=prev[p])route.unshift(vertices[p].clone());return route;
}
