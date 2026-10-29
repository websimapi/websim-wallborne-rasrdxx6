import * as T from 'three';
const faces=new Map();
export function prepareFace(model){
 model.updateMatrixWorld(true);const head=model.getObjectByName('mixamorigHead')||model.getObjectByName('mixamorig:Head'),top=model.getObjectByName('mixamorigHeadTop_End')||model.getObjectByName('mixamorig:HeadTop_End');if(!head)return[];
 const h=head.getWorldPosition(new T.Vector3()),t=top?.getWorldPosition(new T.Vector3()),height=Math.max(.2,t?t.y-h.y:.28),mouthY=h.y+height*.32,meshes=[];
 model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const source=mesh.geometry;let geometry=faces.get(source.uuid);if(!geometry){geometry=source.clone();const p=geometry.attributes.position,a=new Float32Array(p.count*3),v=new T.Vector3(),local=new T.Vector3();const inverse=mesh.matrixWorld.clone().invert();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);const dx=(v.x-h.x)/.085,dy=(v.y-mouthY)/.042;if(Math.abs(dx)>1.5||Math.abs(dy)>2||v.z<h.z+.025)continue;const weight=Math.exp(-dx*dx*2-dy*dy*1.3);local.copy(v);local.y-=.022*weight;local.applyMatrix4(inverse);a[i*3]=local.x-p.getX(i);a[i*3+1]=local.y-p.getY(i);a[i*3+2]=local.z-p.getZ(i);}geometry.morphTargetsRelative=true;geometry.morphAttributes.position=[new T.Float32BufferAttribute(a,3)];faces.set(source.uuid,geometry);}mesh.geometry=geometry;mesh.updateMorphTargets();meshes.push(mesh);});return meshes;
}
export class TownSpeech{
 constructor(){this.current=null;this.serial=0;this.unlocked=false;for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{this.unlocked=true;window.speechSynthesis?.resume();},{passive:true});}
 stop(){this.serial++;window.speechSynthesis?.cancel();this.current?.finish?.();this.current=null;}
 speak(id,text,voice='en-female'){this.stop();const serial=this.serial;if(!this.unlocked||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return new Promise(r=>setTimeout(r,Math.min(6500,1400+text.length*35)));
 return new Promise(resolve=>{const utterance=new SpeechSynthesisUtterance(text),voices=speechSynthesis.getVoices();utterance.lang='en-US';utterance.rate=.98;utterance.volume=.85;const english=voices.filter(v=>v.lang.startsWith('en'));utterance.voice=english[(id+(voice.includes('female')?1:0))%Math.max(1,english.length)]||null;
 let timer;const state={id,text,utterance,playing:false,index:0,at:performance.now(),finish:()=>{clearTimeout(timer);if(this.current===state)this.current=null;resolve();}};this.current=state;utterance.onstart=()=>{state.playing=true;state.at=performance.now();};utterance.onboundary=e=>{state.index=e.charIndex;state.at=performance.now();};utterance.onend=state.finish;utterance.onerror=state.finish;timer=setTimeout(()=>{if(serial===this.serial)speechSynthesis.cancel();state.finish();},Math.min(18000,3500+text.length*65));speechSynthesis.speak(utterance);});
 }
 mouth(id){const s=this.current;if(!s||s.id!==id||!s.playing||speechSynthesis.paused)return 0;const index=Math.min(s.text.length-1,s.index+Math.floor((performance.now()-s.at)*.012)),letter=s.text[index]?.toLowerCase();return /[mbps.,!?]/.test(letter)?0.05:/[aou]/.test(letter)?.9:/[ei]/.test(letter)?.5:.3;}
 update(actor,dt){actor.mouth=T.MathUtils.damp(actor.mouth||0,this.mouth(actor.spec.id),22,dt);for(const mesh of actor.face||[])if(mesh.morphTargetInfluences)mesh.morphTargetInfluences[0]=actor.mouth;}
}
