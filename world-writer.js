export function startWorldWriter(){
 let paused=false,running=false,failures=0,timer=null,status=null;try{paused=localStorage.getItem('wallborne.writer.paused')==='yes';}catch{}
 const button=document.createElement('button');button.id='worldWriter';button.hidden=true;document.body.append(button);
 const paint=()=>{if(!status)return;button.hidden=!status.owner;button.textContent=(paused?'World writing paused':status.done>=status.total?'Souls ready':'Writing souls')+' · '+status.done+'/'+status.total+(status.done<status.total?(paused?' · resume':' · pause'):'');};
 button.onclick=()=>{paused=!paused;try{localStorage.setItem('wallborne.writer.paused',paused?'yes':'no');}catch{}paint();if(!paused)run();};
 async function run(){clearTimeout(timer);if(running||paused||document.hidden||status&&!status.owner)return;if(status?.done>=status?.total)return;running=true;try{const response=await fetch('/api/world-writer',{method:status?'POST':'GET'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Writer unavailable');status={...status,...data};failures=0;paint();}catch(error){failures++;button.title=error.message;}finally{running=false;if(!paused&&status?.owner&&status.done<status.total)timer=setTimeout(run,failures?Math.min(180000,30000*failures):8000);}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)run();});run();
}
