(async()=>{
  const previous=document.getElementById('capture-studio-selection');if(previous)previous.remove();
  const host=document.createElement('div');host.id='capture-studio-selection';host.style.cssText='position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';const shadow=host.attachShadow({mode:'closed'});
  shadow.innerHTML='<style>:host{all:initial}*{box-sizing:border-box}.surface{position:fixed;inset:0;cursor:crosshair;touch-action:none;background:#10213b33}.hint{position:fixed;top:18px;left:50%;transform:translateX(-50%);padding:12px 18px;border-radius:10px;background:#fff;color:#263346;box-shadow:0 4px 22px #17233733;font:13px system-ui;pointer-events:none;white-space:nowrap}.selection{position:fixed;border:2px solid #4f7ff5;box-shadow:0 0 0 99999px #10213b55;pointer-events:none}.size{position:absolute;top:100%;left:0;white-space:nowrap;margin-top:7px;background:#4f7ff5;color:white;font:11px system-ui;padding:5px 7px;border-radius:5px}</style><div class="surface"><div class="hint">Drag to select an area · Escape to cancel</div><div class="selection" hidden><span class="size"></span></div></div>';
  document.documentElement.append(host);const surface=shadow.querySelector('.surface'),box=shadow.querySelector('.selection'),size=shadow.querySelector('.size');
  return new Promise(resolve=>{
    let start=null,selection=null,done=false;
    const point=e=>({x:Math.max(0,Math.min(innerWidth,e.clientX)),y:Math.max(0,Math.min(innerHeight,e.clientY))});
    function finish(result){if(done)return;done=true;clearTimeout(timeout);document.removeEventListener('keydown',escape,true);host.remove();resolve(result)}
    const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(null)}};document.addEventListener('keydown',escape,true);
    const timeout=setTimeout(()=>finish(null),120000);
    surface.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
    surface.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();start=point(e);surface.setPointerCapture(e.pointerId);selection=null};
    surface.onpointermove=e=>{if(!start)return;const p=point(e);selection={x:Math.min(p.x,start.x),y:Math.min(p.y,start.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y),viewportWidth:innerWidth,viewportHeight:innerHeight};box.hidden=false;box.style.left=selection.x+'px';box.style.top=selection.y+'px';box.style.width=selection.w+'px';box.style.height=selection.h+'px';size.textContent=Math.round(selection.w)+' × '+Math.round(selection.h)};
    surface.onpointerup=e=>{if(!start)return;surface.onpointermove(e);start=null;if(selection?.w>=4&&selection?.h>=4)finish(selection);else box.hidden=true};surface.onpointercancel=()=>{start=null;selection=null;box.hidden=true};
  });
})();
