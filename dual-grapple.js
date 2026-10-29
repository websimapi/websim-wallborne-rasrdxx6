import * as T from 'three';
import {Grapple} from './grapple.js';
export class DualGrapple {
 constructor(scene,onSnag){this.hooks=[new Grapple(scene,()=>onSnag('Left'),-1),new Grapple(scene,()=>onSnag('Right'),1)];this.yaw=0;this.center=new T.Vector3();}
 get active(){return this.hooks.some(h=>h.active);}
 get latched(){return this.hooks.some(h=>h.latched);}
 get tip(){const latched=this.hooks.filter(h=>h.latched);this.center.set(0,0,0);for(const h of latched)this.center.add(h.tip);if(latched.length)this.center.divideScalar(latched.length);return this.center;}
 hand(origin,index){return origin.clone().add(new T.Vector3(-Math.cos(this.yaw),0,Math.sin(this.yaw)).multiplyScalar(index===0?-.38:.38)).add(new T.Vector3(0,-.2,0));}
 reset(){this.hooks.forEach(h=>h.reset());}
 release(selection=[0,1]){selection.forEach(i=>this.hooks[i].release());}
 fire(origin,direction,velocity,selection=[0,1]){let fired=0;for(const i of selection)if(this.hooks[i].fire(this.hand(origin,i),direction,velocity))fired++;return fired;}
 update(dt,origin,dynamic,allowTitan,boost){this.hooks.forEach((h,i)=>{h.update(dt,this.hand(origin,i),dynamic,allowTitan,boost);if(h.latched&&h.tip.distanceTo(origin)<5)h.release();});}
 pull(dt,player){const count=this.hooks.filter(h=>h.latched).length;for(const h of this.hooks)if(h.latched)h.pull(dt/Math.max(1,count),player);}
 render(origin,right){this.hooks.forEach((h,i)=>h.render(this.hand(origin,i),right));}
 networkData(){const cables=this.hooks.map(h=>h.networkData());if(!cables.some(Boolean))return null;return {...(cables[0]||cables[1]),left:cables[0],right:cables[1]};}
}
