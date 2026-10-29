import * as T from 'three';
import {GLTFLoader} from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'https://esm.sh/three@0.170.0/examples/jsm/utils/SkeletonUtils.js';
const loader=new GLTFLoader();
export const humanTemplates=Promise.all(['knight','rogue','mage'].map(name=>loader.loadAsync('models/'+name+'.glb')));
const unwanted=/^(1H_|2H_|Knife|Throwable|Spellbook|Badge_Shield|Rectangle_Shield|Round_Shield|Spike_Shield|Mage_Hat)/;
export function visibleBounds(model){model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const box=new T.Box3();model.traverseVisible(o=>{if(o.isMesh)box.union(new T.Box3().setFromObject(o,true));});return box;}
export function fitHuman(model,height){
 // This wrapper is NEVER an animation target. Imported root-scale keys cannot undo sizing.
 const fit=new T.Group();fit.name='HumanSize';fit.add(model);const bounds=visibleBounds(model),size=bounds.getSize(new T.Vector3());if(!Number.isFinite(size.y)||size.y<.001)throw new Error('Invalid human mesh bounds');
 const scale=height/size.y;fit.scale.setScalar(scale);model.position.add(new T.Vector3(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2));fit.updateMatrixWorld(true);return fit;
}
export function createHuman(templates,spec){
 const rich=['Noble','Royal official'].includes(spec.kind),template=templates[spec.rank?0:rich?2:1],model=cloneSkeleton(template.scene);
 model.traverse(o=>{if(unwanted.test(o.name))o.visible=false;if(o.isMesh){o.frustumCulled=false;o.castShadow=true;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(o.material)?o.material:[o.material]){m.roughness=.85;}}});
 const mixer=new T.AnimationMixer(model),actions={};for(const [key,name] of Object.entries({idle:'Idle',walk:'Walking_A',run:'Running_A',work:'Interact'})){const clip=template.animations.find(c=>c.name===name);if(clip){actions[key]=mixer.clipAction(clip);actions[key].setEffectiveWeight(key==='idle'?1:0).play();}}
 mixer.update(0);const height=1.65+(spec.id%9)*.025,fit=fitHuman(model,height);
 const root=new T.Group();root.name='Resident '+spec.id;root.add(fit);root.userData.height=height;
 if(spec.rank){const steel=new T.MeshStandardMaterial({color:'#7c8b89',metalness:.7,roughness:.45}),leather=new T.MeshStandardMaterial({color:'#443c31'});for(const side of [-1,1]){const can=new T.Mesh(new T.CylinderGeometry(.07,.07,.25,8),steel);can.rotation.z=Math.PI/2;can.position.set(side*.28,height*.44,-.12);can.userData.localGeometry=true;root.add(can);const strap=new T.Mesh(new T.BoxGeometry(.035,.45,.025),leather);strap.rotation.z=side*.25;strap.position.set(side*.1,height*.65,.18);strap.userData.localGeometry=true;root.add(strap);}}
 let activity='idle';function setActivity(next){if(!actions[next])next='idle';if(activity===next)return;activity=next;for(const [key,action] of Object.entries(actions))action.setEffectiveWeight(key===next?1:0);}
 return{root,model,mixer,actions,setActivity,height,face:[],eyeHeight:height*.85};
}
