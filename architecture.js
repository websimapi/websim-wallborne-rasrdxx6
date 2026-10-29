// All homes are hollow: wall openings, accessible rooms and solid furnishings.
export function createArchitecture({cube,inst,solid,roofSolid,box,roofGeo,cyl,mats}){
 const {stone,plaster,wood,roof,dark,trim,gold,cloth,poorPlaster,poorRoof,slate,rug,glass}=mats;
 return function house(x,z,w,d,region=1,royal=false,spec={}){
 const rich=region===0,poor=region===2,h=spec.height||(rich?(royal?12:9):poor?5.7:7.5);
 const wall=rich?stone:poor?poorPlaster:plaster,beam=rich?trim:wood,tile=rich?slate:poor?poorRoof:roof;
 const deco=(m,dx,y,dz,sx,sy,sz,ry=0)=>cube(m,x+dx,y,z+dz,sx,sy,sz,ry);
 const body=(m,dx,y,dz,sx,sy,sz)=>solid(m,x+dx,y,z+dz,sx,sy,sz);
 // Window openings are genuinely cut out, not black stickers over a solid box.
 function face(axis,fixed,length,door=false){
 const winW=rich?2.8:1.7,winBottom=rich?2.3:1.8,winTop=Math.max(rich?6.4:3.8,h-1.25);
 const openings=[{p:-length*.31,w:winW,b:winBottom,t:winTop},{p:length*.31,w:winW,b:winBottom,t:winTop}];
 if(door)openings.push({p:0,w:rich?4:2.7,b:0,t:rich?5:3.6});
 openings.sort((a,b)=>a.p-b.p);
 const panel=(p,y,len,sy)=>{if(len<.01||sy<.01)return;body(wall,axis==='x'?p:fixed,y,axis==='x'?fixed:p,axis==='x'?len:.55,sy,axis==='x'?.55:len);};
 let cursor=-length/2;
 for(const o of openings){const left=o.p-o.w/2;panel((cursor+left)/2,h/2,left-cursor,h);panel(o.p,o.b/2,o.w,o.b);panel(o.p,(o.t+h)/2,o.w,h-o.t);
 if(o.b>0){
 const px=axis==='x'?o.p:fixed,pz=axis==='x'?fixed:o.p;
 // Deep window sills and timber mullions on both faces of each opening.
 deco(beam,px,o.b-.1,pz,axis==='x'?o.w+.45:.9,.22,axis==='x'?.9:o.w+.45);
 deco(beam,px,(o.b+o.t)/2,pz,axis==='x'?.1:.2,o.t-o.b,axis==='x'?.2:.1);
 for(let bar=o.b+1.8;bar<o.t;bar+=2.7)deco(wood,px,bar,pz,axis==='x'?o.w+.15:.24,.15,axis==='x'?.24:o.w+.15);
 for(const edge of [-1,1])deco(wood,axis==='x'?px+edge*(o.w/2+.07):px,(o.b+o.t)/2,axis==='x'?pz:pz+edge*(o.w/2+.07),axis==='x'?.14:.22,o.t-o.b+.2,axis==='x'?.22:.14);
 if(!rich){for(const s of [-1,1])deco(wood,axis==='x'?px+s*(o.w/2+.35):px,(o.b+o.t)/2,axis==='x'?pz:pz+s*(o.w/2+.35),axis==='x'?.55:.18,o.t-o.b,axis==='x'?.18:.55);}
 }
 cursor=o.p+o.w/2;}
 panel((cursor+length/2)/2,h/2,length/2-cursor,h);
 }
 face('x',-d/2,w,true);face('x',d/2,w);face('z',-w/2,d,spec.variant===4);face('z',w/2,d,spec.variant===1);
 body(wood,0,.04,0,w,.2,d);body(wood,0,h,0,w,.32,d);
 const roofHeight=spec.roof||(rich?6:poor?3.5:4.5);
 inst(roofGeo,tile,x,h+.16,z,w+1.8,roofHeight,d+1.8,0,true);
 roofSolid(x,z,w/2+.9,d/2+.9,h+.16,roofHeight);
 // Bay extensions and cross-gables vary the footprint and skyline.
 if(spec.variant===1||spec.variant===4){
 const side=spec.variant===1?1:-1,bw=w*.28,bd=d*.38,bx=side*(w/2+bw/2),bz=d*.1;
 body(wall,bx,h*.38,bz+bd/2,bw,h*.76,.5);body(wall,bx,h*.38,bz-bd/2,bw,h*.76,.5);body(wall,side*(w/2+bw),h*.38,bz,.5,h*.76,bd);body(wood,bx,.04,bz,bw,.2,bd);
 inst(roofGeo,tile,x+bx,h*.76,z+bz,bw+1,roofHeight*.7,bd+1,Math.PI/2,true);
 // Remove a side-wall section through the extension's doorway in the collector.
 spec.bay={side,bz,width:bd};
 }
 if(spec.variant===2||spec.variant===5){for(const s of [-1,1]){deco(wall,s*w*.25,h+roofHeight*.22,-d*.22,2.4,2.5,2);deco(dark,s*w*.25,h+roofHeight*.22,-d*.22-1.025,1.2,1.6,.06);deco(wood,s*w*.25,h+roofHeight*.22,-d*.22-1.08,.1,1.7,.07);inst(roofGeo,tile,x+s*w*.25,h+roofHeight*.22+1.25,z-d*.22,3.2,2,3,Math.PI/2);}}
 // Dark half-timber floor bands, diagonal braces, projecting sills and eaves.
 for(let level=3.6;level<h-.7;level+=3.1){for(const side of [-1,1]){deco(wood,0,level,side*(d/2+.32),w+.4,.22,.3);deco(wood,side*(w/2+.32),level,0,.3,.22,d+.4);}}
 for(const side of [-1,1]){for(const col of [-.44,-.17,.17,.44])deco(wood,w*col,h/2,side*(d/2+.32),.2,h,.24);
 for(let level=2;level<h-1;level+=3.1)for(const bay of [-1,1])if(mats.braceUp)inst(bay===side?mats.braceUp:mats.braceDown,wood,x+bay*w*.44,level,z+side*(d/2+.4),w*.17,2.6,1);}
 deco(wood,0,h-.1,-d/2-.5,w+1.2,.28,.5);deco(wood,0,h-.1,d/2+.5,w+1.2,.28,.5);
 // Exposed framing, stone quoins, cornices and ridge caps.
 for(const s of [-1,1])for(const t of [-1,1]){deco(beam,s*w/2,h/2,t*d/2,.35,h,.65);if(rich)for(let y=.6;y<h;y+=1.3)deco(trim,s*w/2,y,t*d/2,1.05,.55,1.05);}
 for(const y of [1,h-.45]){deco(beam,0,y,-d/2-.3,w+.7,.25,.25);deco(beam,0,y,d/2+.3,w+.7,.25,.25);}
 if(!rich)for(const dx of [-w*.2,w*.2])deco(wood,dx,h/2,-d/2-.31,.2,h,.18);
 deco(tile,0,h+roofHeight+.2,0,.45,.35,d+2);
 body(stone,w*.3,h+1.7,d*.2,1.2,4,1.3);deco(trim,w*.3,h+3.8,d*.2,1.65,.3,1.75);
 // Door stands open against the inside wall; the central passage stays clear.
 deco(wood,rich?-2.1:-1.45,1.7,-d/2+1.1,.16,3.4,2.2);
 for(const s of [-1,1])deco(beam,s*(rich?2.15:1.55),1.9,-d/2-.35,.28,3.8,.7);
 deco(beam,0,rich?5.1:3.8,-d/2-.35,rich?4.6:3.4,.3,.7);
 // Enterable upper stories with cut-out stairwells and alternating dogleg flights.
 const holeX0=-w/2+.75,holeX1=-w/2+6.15,holeZ0=d/2-8,holeZ1=d/2-2;
 for(let level=3.4,story=0;level<h-2.5;level+=3.4,story++){
 const lx=-w/2+.5,rx=w/2-.5,fz=-d/2+.5,bz=d/2-.5;
 const floorPanel=(x0,x1,z0,z1)=>{if(x1>x0&&z1>z0)body(wood,(x0+x1)/2,level,(z0+z1)/2,x1-x0,.18,z1-z0);};
 floorPanel(lx,holeX0,fz,bz);floorPanel(holeX1,rx,fz,bz);floorPanel(holeX0,holeX1,fz,holeZ0);floorPanel(holeX0,holeX1,holeZ1,bz);
 const stairX=holeX0+1.35+(story%2)*2.7,base=level-3.4;
 for(let step=0;step<20;step++){const t=(step+.5)/20,z0=story%2?holeZ1-t*6:holeZ0+t*6;body(wood,stairX,base+(step+.5)*.17,z0,2.45,.17,.33);if(step%4===0)deco(wood,stairX-1.13,base+(step+1)*.17+.45,z0,.09,.9,.09);}
 // Furnish the landing without obstructing the through-route.
 body(wood,w*.27,level+.6,d*.18,2.4,1.1,2.9);deco(cloth,w*.27,level+1.23,d*.18,2.35,.14,2.85);
 for(const side of [-1,1])deco(wood,0,level-.2,side*(d/2-.6),w-1,.22,.2);
 }
 // Reachable dining area, chairs, bed, cabinet and hearth.
 const tx=w*.18,tz=d*.13;
 body(wood,tx,1.15,tz,rich?4:2.8,.22,1.8);
 for(const a of [-1,1])for(const b of [-1,1])deco(wood,tx+a*(rich?1.65:1.05),.55,tz+b*.65,.16,1.1,.16);
 for(const s of [-1,1]){body(wood,tx+s*(rich?2.8:2),.55,tz,1,.18,1);deco(wood,tx+s*(rich?2.8:2),1,tz+.45,1,1,.12);}
 body(wood,-w*.28,.45,-d*.26,rich?3.8:2.6,.9,poor?3.8:4.8);deco(cloth,-w*.28,.99,-d*.26,rich?3.7:2.5,.18,poor?3.7:4.7);deco(trim,-w*.28,1.13,-d*.26+1.5,1.7,.22,.8);
 body(wood,w*.32,1.6,d*.38,2.1,3.2,1);for(const y of [.5,1.4,2.3])deco(trim,w*.32,y,d*.38-.55,1.7,.12,.12);
 body(stone,-w*.34,1.1,-d*.1,2.2,2.2,1.3);deco(dark,-w*.34,.9,-d*.1-.68,1.5,1.2,.05);deco(wood,-w*.34,.35,-d*.1-.75,1.2,.16,.3);
 if(rich){
 // Dividing wall creates a bedroom and a receiving room with a walk-through doorway.
 const partition=d*.12,span=(w-3.2)/2;
 for(const s of [-1,1])body(plaster,s*(1.6+span/2),h*.4,partition,span,h*.8,.3);
 deco(rug,0,.18,-d*.2,w*.45,.025,d*.3);
 for(const s of [-1,1]){deco(trim,s*(w/2+1),3,-d/2-1,.8,6,.8);inst(cyl,trim,x+s*(w/2+1),6.2,z-d/2-1,.7,.4,.7);deco(gold,s*w*.3,h-1.8,-d/2-.4,1,2.2,.12);}
 deco(trim,0,h-.3,-d/2-.7,w+4,.8,2.3);
 // Entrance garden, low hedges, planters and a royal crest.
 for(const s of [-1,1]){deco(stone,s*(w*.4),.5,-d/2-4,2.5,1,2.5);inst(cyl,glass,x+s*w*.4,1.5,z-d/2-4,1.3,1.5,1.3);}
 if(royal){deco(gold,0,h-1.5,-d/2-.6,2.5,2.5,.2);for(const s of [-1,1]){deco(trim,s*w*.5,h+2,d*.25,4,5,4);inst(roofGeo,slate,x+s*w*.5,h+4.5,z+d*.25,5,5,5);}}
 }else if(poor){
 // Patched plaster, rough shutters, stacked firewood and a barrel by the entry.
 deco(wood,w*.23,2.5,-d/2-.34,1.5,.18,.12,.25);
 inst(cyl,wood,x+w*.5+1,.65,z-d*.25,.65,1.3,.65);for(let k=0;k<3;k++)deco(wood,-w*.5-1,.18+k*.28,d*.2,1.7,.22,.25);
 }else{deco(cloth,w*.25,3.8,-d/2-1.1,w*.4,.16,2);for(const s of [-1,1])deco(wood,w*.25+s*w*.2,1.8,-d/2-1.9,.12,3.6,.12);}
 };
}
