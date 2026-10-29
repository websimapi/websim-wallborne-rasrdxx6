import * as T from 'three';
const LIMIT=20000,STEP=256,SCALE=.2,ROAD_HEIGHT=.18;
export function boulevard(x,z){return(Math.abs(x)<21.5&&Math.abs(z)<5150)||(Math.abs(z)<15&&Math.abs(x)<4950);}
function axis(extra){const values=[-LIMIT,LIMIT,...extra];for(let p=-LIMIT;p<LIMIT;p+=STEP)values.push(p);return [...new Set(values)].sort((a,b)=>a-b);}
// Both the visible mesh and the walking surface use the same fixed road height.
export function streetHeight(x,z){return boulevard(x,z)?ROAD_HEIGHT:0;}
export function createTerrain(scene,paving,road){
 const xs=axis([-4950,-21.5,0,21.5,4950]),zs=axis([-5150,-15,0,15,5150]);
 const data=[{positions:[],uvs:[]},{positions:[],uvs:[]}];
 function triangle(out,a,b,c){for(const p of [a,b,c]){out.positions.push(...p);out.uvs.push(p[0]*SCALE,-p[2]*SCALE);}}
 function quad(out,a,b,c,d){triangle(out,a,b,c);triangle(out,a,c,d);}
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
 const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1],x=(x0+x1)/2,z=(z0+z1)/2,isRoad=boulevard(x,z),y=isRoad?ROAD_HEIGHT:0,out=data[isRoad?1:0];
 // Upward-facing cells share exact edges. No ground exists underneath a road.
 quad(out,[x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0]);
 if(!isRoad)continue;
 // Close the shallow road curb without introducing coplanar top faces.
 if(!boulevard(x0-.001,z))quad(out,[x0,0,z0],[x0,0,z1],[x0,y,z1],[x0,y,z0]);
 if(!boulevard(x1+.001,z))quad(out,[x1,0,z1],[x1,0,z0],[x1,y,z0],[x1,y,z1]);
 if(!boulevard(x,z0-.001))quad(out,[x1,0,z0],[x0,0,z0],[x0,y,z0],[x1,y,z0]);
 if(!boulevard(x,z1+.001))quad(out,[x0,0,z1],[x1,0,z1],[x1,y,z1],[x0,y,z1]);
 }
 return data.map((out,i)=>{const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(out.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(out.uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,i?road:paving);mesh.name=i?'Boulevard surface':'Terrain surface';mesh.receiveShadow=true;mesh.userData.grappleSurface=true;scene.add(mesh);return mesh;});
}
