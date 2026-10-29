import * as T from 'three';
const hidden=new T.Matrix4().makeScale(0,0,0);
export class InstancePool {
 constructor(scene,geometry,material,capacity=512){this.scene=scene;this.geometry=geometry;this.material=material;this.capacity=capacity;this.next=0;this.free=[];this.make();}
 make(previous){const mesh=new T.InstancedMesh(this.geometry,this.material,this.capacity);mesh.count=this.next;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);if(previous){for(let i=0;i<this.next;i++){const m=new T.Matrix4();previous.getMatrixAt(i,m);mesh.setMatrixAt(i,m);}this.scene.remove(previous);previous.dispose();}this.mesh=mesh;this.scene.add(mesh);}
 add(matrix){const i=this.free.length?this.free.pop():this.next++;if(this.next>this.capacity){this.capacity*=2;this.make(this.mesh);}this.mesh.count=this.next;this.set(i,matrix);return {pool:this,index:i};}
 set(i,m){this.mesh.setMatrixAt(i,m);this.mesh.instanceMatrix.needsUpdate=true;}
 hide(handle,release=false){this.set(handle.index,hidden);if(release)this.free.push(handle.index);}
}
