import * as T from 'three';
// Shop counters are streamed with their resident and removed on despawn.
export function createStall(scene,spec){
 const root=new T.Group();root.position.set(spec.x,spec.y,spec.z);root.rotation.y=spec.angle;
 const wood=new T.MeshStandardMaterial({color:'#69513b',roughness:.92}),cloth=new T.MeshStandardMaterial({color:spec.kind==='Artisan'?'#9b8058':'#63786c',roughness:1,side:T.DoubleSide});
 const box=new T.BoxGeometry(1,1,1);function part(x,y,z,w,h,d,mat){const m=new T.Mesh(box,mat);m.position.set(x,y,z);m.scale.set(w,h,d);root.add(m);}
 part(0,.85,-1.4,2.4,.12,1,wood);for(const x of [-1,1]){part(x,.42,-1.4,.12,.84,.7,wood);part(x,1.5,-1.75,.08,3,.08,wood);}part(0,2.95,-1.4,2.7,.07,1.5,cloth);scene.add(root);
 return{remove(){scene.remove(root);box.dispose();wood.dispose();cloth.dispose();}};
}
