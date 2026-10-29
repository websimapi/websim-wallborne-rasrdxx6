import * as T from 'three';
import {supplyChests} from './server.js';
export function createEquipment(scene,grapple,message){
 let profile=null,busy=false,nearest=null,available=false;
 const guest={signedIn:false,revision:0,state:{bag:{repairKit:3},broken:[false,false],chests:[]}};
 const status=document.createElement('div');status.id='equipmentStatus';status.innerHTML='<span></span><button class="cutCable">C · Cut</button><button class="repairCable">R · Repair</button>';document.getElementById('hud').append(status);
 const label=status.querySelector('span'),cutButton=status.querySelector('.cutCable'),repairButton=status.querySelector('.repairCable');
 const prompt=document.createElement('button');prompt.id='chestPrompt';prompt.hidden=true;document.body.append(prompt);
 const wood=new T.MeshStandardMaterial({color:0x65482e,roughness:.85}),iron=new T.MeshStandardMaterial({color:0x394343,metalness:.7,roughness:.4}),mark=new T.MeshStandardMaterial({color:0xd9ba6c,metalness:.5,roughness:.35});
 const caches=supplyChests().map(spec=>{const root=new T.Group();root.position.set(spec.x,spec.y,spec.z);const base=new T.Mesh(new T.BoxGeometry(1.25,.65,.8),wood);base.position.y=.325;root.add(base);const lid=new T.Group();lid.position.set(0,.65,-.4);const top=new T.Mesh(new T.BoxGeometry(1.28,.16,.84),wood);top.position.set(0,.08,.4);lid.add(top);root.add(lid);for(const x of [-.44,.44]){const band=new T.Mesh(new T.BoxGeometry(.09,.69,.83),iron);band.position.set(x,.34,0);root.add(band);}const lock=new T.Mesh(new T.BoxGeometry(.18,.24,.07),mark);lock.position.set(0,.56,.44);root.add(lock);scene.add(root);return{spec,root,lid};});
 function accept(p){if(!p?.state)return;if(profile&&p.signedIn===profile.signedIn&&p.revision<profile.revision)return;profile=p;for(let i=0;i<2;i++){const h=grapple.hooks[i];if(p.state.broken[i]){if(h.active)h.reset();h.broken=true;}else h.repair();}draw();}
 function draw(){const p=profile||guest;label.textContent='Repair kits · '+p.state.bag.repairKit;cutButton.hidden=!grapple.active;repairButton.hidden=!grapple.hooks.some(h=>h.broken);repairButton.disabled=busy||p.state.bag.repairKit<1;cutButton.disabled=busy;for(const c of caches)c.lid.rotation.x=p.state.chests.includes(c.spec.id)?-1.25:0;}
 async function load(){try{const r=await fetch('/api/town');if(!r.ok)throw new Error('Inventory unavailable');const p=await r.json();accept(p.signedIn?p:guest);}catch{message('Equipment inventory unavailable · retrying');setTimeout(load,3000);}}
 load();window.addEventListener('town-inventory',e=>accept(e.detail));
 async function action(action,extra={}){if(busy||!available||!profile)return;busy=true;draw();try{let p;if(profile.signedIn){const r=await fetch('/api/town/equipment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});p=await r.json();if(!r.ok)throw new Error(p.error||'Equipment unavailable');}else{const state=structuredClone(profile.state);let note='';if(action==='cut'){for(const i of extra.sides)state.broken[i]=true;note='Cable cut · R to repair';}else if(action==='repair'){if(!state.bag.repairKit)throw new Error('No repair kits · find a chest');for(let i=0;i<2;i++)if(state.broken[i]&&state.bag.repairKit>0){state.broken[i]=false;state.bag.repairKit--;}note='Grapple repaired';}else{if(state.chests.includes(extra.chest))throw new Error('Chest already collected');state.chests.push(extra.chest);state.bag.repairKit++;note='Found 1 grapple repair kit';}p={signedIn:false,state,revision:profile.revision+1,note};}
 accept(p);window.dispatchEvent(new CustomEvent('town-inventory',{detail:p}));message(p.note);
 }catch(e){message(e.message);}finally{busy=false;draw();}}
 function cut(){const sides=grapple.hooks.flatMap((h,i)=>h.active?[i]:[]);if(!sides.length){message('No deployed cables to cut');return;}action('cut',{sides});}
 function repair(){if(!grapple.hooks.some(h=>h.broken)){message('Grapples are intact');return;}action('repair');}
 function open(){if(nearest)action('chest',{chest:nearest.spec.id,x:lastPos.x,y:lastPos.y,z:lastPos.z});}
 cutButton.onclick=cut;repairButton.onclick=repair;prompt.onclick=open;let lastPos=new T.Vector3();
 function update(pos,enabled){available=enabled;lastPos.copy(pos);nearest=null;let distance=4;for(const c of caches){if((profile||guest).state.chests.includes(c.spec.id))continue;const d=pos.distanceTo(c.root.position.clone().add(new T.Vector3(0,1,0)));if(d<distance){nearest=c;distance=d;}}document.body.dataset.chestNear=enabled&&nearest?'true':'';prompt.hidden=!enabled||!nearest;prompt.textContent='G · Open supply chest';draw();}
 return{update,cut,repair,open};
}
