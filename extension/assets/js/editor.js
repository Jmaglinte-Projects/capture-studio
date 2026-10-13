import {arrowPolygon,segmentDistance,polygonHit} from './annotation-geometry.js';
import {consumeExtensionCapture} from './extension-capture.js';
import {enhanceDropdowns,refreshDropdowns} from './dropdown.js';
import {captureOperation,notifyCaptures} from './capture-store.js';
const $=id=>document.getElementById(id),canvas=$('canvas'),overlay=$('overlay'),ctx=canvas.getContext('2d'),previewCtx=overlay.getContext('2d');
const id=new URLSearchParams(location.search).get('capture');
let importing=null;
let base=null,marks=[],history=[],future=[],tool='pen',selected=-1,gesture=null,crop=null,textPoint=null,item=null,loading=false,loaded=false,dirty=false,pollTimer;
function status(message,error=false){$('editorStatus').textContent=message;$('editorStatus').classList.toggle('error',error)}
function cloneMarks(){return structuredClone(marks)}
function checkpoint(){history.push({base,marks:cloneMarks()});if(history.length>50)history.shift();future=[];dirty=true}
function restore(state){base=state.base;marks=state.marks;selected=-1;gesture=null;crop=null;dirty=true;render();fit()}
function rect(a,b){return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)}}
function localBounds(mark){if(mark.type==='arrow'){const points=arrowPolygon(mark);if(!points.length)return{x:mark.x,y:mark.y,w:0,h:0};const xs=points.map(p=>p.x),ys=points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}if(mark.type==='text'){const lines=mark.text.split('\n');ctx.save();ctx.font=`600 ${mark.size}px system-ui, sans-serif`;const w=Math.max(...lines.map(t=>ctx.measureText(t).width),1);ctx.restore();return{x:mark.x,y:mark.y,w,h:lines.length*mark.size*1.25}}if(mark.type==='pen'){const xs=mark.points.map(p=>p.x),ys=mark.points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}return rect({x:mark.x,y:mark.y},{x:mark.x+mark.w,y:mark.y+mark.h})}
function rotatePoint(point,center,degrees){const angle=degrees*Math.PI/180,dx=point.x-center.x,dy=point.y-center.y;return{x:center.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:center.y+dx*Math.sin(angle)+dy*Math.cos(angle)}}
function markCenter(mark){const b=localBounds(mark);return{x:b.x+b.w/2,y:b.y+b.h/2}}
function bounds(mark){const b=localBounds(mark);if(!mark.rotation)return b;const center=markCenter(mark),points=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}].map(p=>rotatePoint(p,center,mark.rotation));const xs=points.map(p=>p.x),ys=points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}
function rotateSelected(degrees){if(selected<0||gesture||!Number.isFinite(degrees))return;const value=((degrees%360)+360)%360;if(value===(marks[selected].rotation||0))return;checkpoint();marks[selected].rotation=value;render();status('Annotation rotated. Drag to move it, or undo to restore its angle.')}
$('rotateLeft').onclick=()=>rotateSelected((marks[selected]?.rotation||0)-15);
$('rotateRight').onclick=()=>rotateSelected((marks[selected]?.rotation||0)+15);
$('resetRotation').onclick=()=>rotateSelected(0);
$('rotation').onchange=()=>rotateSelected($('rotation').valueAsNumber);
function drawMark(context,mark){context.save();if(mark.rotation){const center=markCenter(mark);context.translate(center.x,center.y);context.rotate(mark.rotation*Math.PI/180);context.translate(-center.x,-center.y)}context.strokeStyle=mark.color;context.fillStyle=mark.color;context.lineWidth=mark.width;context.lineCap='round';context.lineJoin='round';context.setLineDash([]);if(mark.type==='text'){context.font=`600 ${mark.size}px system-ui, sans-serif`;context.textBaseline='top';mark.text.split('\n').forEach((line,i)=>context.fillText(line,mark.x,mark.y+i*mark.size*1.25))}else if(mark.type==='pen'){context.beginPath();mark.points.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));if(mark.points.length===1){context.arc(mark.points[0].x,mark.points[0].y,mark.width/2,0,Math.PI*2);context.fill()}else context.stroke()}else if(mark.type==='arrow'){const points=arrowPolygon(mark);if(points.length){context.beginPath();points.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.closePath();context.fill()}}else{const b=localBounds(mark);if(mark.type==='rect')context.strokeRect(b.x,b.y,b.w,b.h);if(mark.type==='ellipse'){context.beginPath();context.ellipse(b.x+b.w/2,b.y+b.h/2,b.w/2,b.h/2,0,0,Math.PI*2);context.stroke()}if(mark.type==='redact'){context.fillStyle='#000';context.fillRect(Math.floor(b.x),Math.floor(b.y),Math.ceil(b.w),Math.ceil(b.h))}}context.restore()}
function render(){if(!base)return;if(canvas.width!==base.width||canvas.height!==base.height){canvas.width=overlay.width=base.width;canvas.height=overlay.height=base.height}ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(base,0,0);marks.forEach(mark=>drawMark(ctx,mark));renderOverlay();$('dimensions').textContent=`${canvas.width} × ${canvas.height} px`;$('undo').disabled=!history.length;$('redo').disabled=!future.length;$('deleteMark').disabled=selected<0;for(const key of ['rotateLeft','rotateRight','resetRotation','rotation'])$(key).disabled=selected<0;$('rotation').value=selected<0?'0':String(Math.round((marks[selected].rotation||0)*10)/10);$('cropActions').hidden=!crop||(gesture?.type==='draw'&&tool==='crop');if(crop)$('cropSize').textContent=`Crop to ${Math.round(crop.w)} × ${Math.round(crop.h)} px`}
function selectionHandles(mark){
 const b=localBounds(mark),center=markCenter(mark),angle=mark.rotation||0;
 const transform=p=>rotatePoint(p,center,angle);
 const handles=mark.type==='arrow'?[{kind:'endpoint',index:0,...transform({x:mark.x,y:mark.y})},{kind:'endpoint',index:1,...transform({x:mark.x+mark.w,y:mark.y+mark.h})}]:[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}].map((point,index)=>({kind:'resize',index,...transform(point)}));
 const top=transform({x:center.x,y:b.y}),rotation=transform({x:center.x,y:b.y-26/currentScale()}),margin=8/currentScale();
 handles.push({kind:'rotate',x:Math.max(margin,Math.min(canvas.width-margin,rotation.x)),y:Math.max(margin,Math.min(canvas.height-margin,rotation.y)),stem:top});
 return handles;
}
function handleAt(point){if(selected<0||!marks[selected]||crop)return null;return selectionHandles(marks[selected]).find(h=>Math.hypot(point.x-h.x,point.y-h.y)<=10/currentScale())||null}
function renderOverlay(){
 previewCtx.clearRect(0,0,overlay.width,overlay.height);previewCtx.save();
 if(selected>=0&&marks[selected]&&!crop){
  const mark=marks[selected],b=localBounds(mark),center=markCenter(mark),handles=selectionHandles(mark);
  if(!['arrow','ellipse'].includes(mark.type)){
   const corners=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}].map(p=>rotatePoint(p,center,mark.rotation||0));
   previewCtx.strokeStyle='#4f7ff5';previewCtx.lineWidth=1/currentScale();previewCtx.setLineDash([4/currentScale(),4/currentScale()]);previewCtx.beginPath();corners.forEach((p,i)=>i?previewCtx.lineTo(p.x,p.y):previewCtx.moveTo(p.x,p.y));previewCtx.closePath();previewCtx.stroke();
  }
  previewCtx.setLineDash([]);
  for(const h of handles){
   if(h.kind==='rotate'){previewCtx.strokeStyle='#91a0b6';previewCtx.lineWidth=1/currentScale();previewCtx.beginPath();previewCtx.moveTo(h.stem.x,h.stem.y);previewCtx.lineTo(h.x,h.y);previewCtx.stroke()}
   previewCtx.beginPath();previewCtx.arc(h.x,h.y,(h.kind==='rotate'?5:6)/currentScale(),0,Math.PI*2);previewCtx.fillStyle=h.kind==='rotate'?'#169447':'#1685ff';previewCtx.strokeStyle='#fff';previewCtx.lineWidth=2/currentScale();previewCtx.fill();previewCtx.stroke();
  }
 }
 if(crop){previewCtx.fillStyle='#16233780';previewCtx.fillRect(0,0,overlay.width,overlay.height);previewCtx.clearRect(crop.x,crop.y,crop.w,crop.h);previewCtx.strokeStyle='#fff';previewCtx.lineWidth=2/currentScale();previewCtx.setLineDash([6/currentScale(),4/currentScale()]);previewCtx.strokeRect(crop.x,crop.y,crop.w,crop.h)}else if(gesture?.mark)drawMark(previewCtx,gesture.mark);
 previewCtx.restore();
}
function currentScale(){return canvas.getBoundingClientRect().width/canvas.width||1}
function fit(){refreshDropdowns();if(!base)return;const choice=$('zoom').value;const scale=choice==='fit'?Math.min(1,Math.max(50,$('workspace').clientWidth-50)/canvas.width,Math.max(50,$('workspace').clientHeight-50)/canvas.height):+choice;$('canvasHolder').style.width=`${Math.max(1,canvas.width*scale)}px`;$('canvasHolder').style.height=`${Math.max(1,canvas.height*scale)}px`;renderOverlay()}
new ResizeObserver(fit).observe($('workspace'));$('zoom').onchange=fit;
function zoomBy(factor){if(!base)return;const target=Math.min(2,Math.max(.25,currentScale()*factor));const choices=[.25,.5,.75,1,1.5,2];$('zoom').value=String(choices.reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a));fit()}
$('zoomIn').onclick=()=>zoomBy(1.5);$('zoomOut').onclick=()=>zoomBy(1/1.5);
function position(e){const r=overlay.getBoundingClientRect();return{x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))}}
function commitText(){if(!textPoint)return;const text=$('inlineText').value.trim();if(text){checkpoint();marks.push({type:'text',...textPoint,text,color:$('color').value,size:+$('fontSize').value,width:+$('stroke').value});selected=marks.length-1}textPoint=null;$('inlineText').hidden=true;render()}
function cancelText(){textPoint=null;$('inlineText').hidden=true}
function startText(point,text='',index=-1){textPoint=point;const input=$('inlineText');input.value=text;input.style.left=`${point.x/canvas.width*100}%`;input.style.top=`${point.y/canvas.height*100}%`;input.style.fontSize=`${+$('fontSize').value*currentScale()}px`;input.style.color=$('color').value;input.hidden=false;input.focus()}
$('inlineText').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();commitText()}if(e.key==='Escape'){e.preventDefault();cancelText()}};
function setTool(next){commitText();gesture=null;crop=null;selected=-1;tool=next;document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===next);b.setAttribute('aria-pressed',b.dataset.tool===next)});overlay.style.cursor=next==='select'?'default':'crosshair';const hints={select:'Drag inside to move. Blue handles resize shapes or adjust arrow endpoints; the green handle rotates. Hold Shift to snap rotation or preserve proportions.',pen:'Drag to draw. Drag an existing pen stroke to move it; use Select to move any annotation.',rect:'Drag in any direction to draw a rectangle.',ellipse:'Drag to draw an ellipse.',arrow:'Drag to draw an arrow. Drag its blue endpoints to change length and direction, or drag inside to move it.',text:'Click to type, then press Enter. Drag existing text to move it. Shift + Enter adds a new line.',redact:'Drag over private information to cover its pixels with solid black.',crop:'Drag to choose an area, then select Apply crop. Cancel keeps the full image.'};$('toolHint').textContent=hints[next];render()}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
function hit(point,type=null){for(let i=marks.length-1;i>=0;i--){const mark=marks[i];if(type&&mark.type!==type)continue;const local=rotatePoint(point,markCenter(mark),-(mark.rotation||0));const pad=Math.max(6/currentScale(),mark.width/2);if(mark.type==='arrow'){if(polygonHit(local,arrowPolygon(mark),pad))return i;continue}if(mark.type==='pen'){if(mark.points.length===1&&segmentDistance(local,mark.points[0],mark.points[0])<=pad)return i;for(let j=1;j<mark.points.length;j++)if(segmentDistance(local,mark.points[j-1],mark.points[j])<=pad)return i;continue}const b=localBounds(mark);if(local.x>=b.x-pad&&local.x<=b.x+b.w+pad&&local.y>=b.y-pad&&local.y<=b.y+b.h+pad)return i}return -1}
function moveMark(mark,dx,dy){if(mark.type==='pen')mark.points.forEach(p=>{p.x+=dx;p.y+=dy});else{mark.x+=dx;mark.y+=dy}}
function resizeMark(original,handle,point,keepAspect){
 const mark=structuredClone(original),b=localBounds(original),center=markCenter(original),angle=original.rotation||0;
 const local=rotatePoint(point,center,-angle),right=handle.index===1||handle.index===2,bottom=handle.index>=2;
 const anchor={x:right?b.x:b.x+b.w,y:bottom?b.y:b.y+b.h};
 let width=Math.max(2,right?local.x-anchor.x:anchor.x-local.x),height=Math.max(2,bottom?local.y-anchor.y:anchor.y-local.y);
 if(keepAspect||mark.type==='text'){const scale=Math.max(.05,Math.max(width/Math.max(1,b.w),height/Math.max(1,b.h)));width=Math.max(1,b.w)*scale;height=Math.max(1,b.h)*scale}
 let x=right?anchor.x:anchor.x-width,y=bottom?anchor.y:anchor.y-height;
 if(mark.type==='text'){
  mark.size=Math.max(4,original.size*width/Math.max(1,b.w));const measured=localBounds(mark);width=measured.w;height=measured.h;
  mark.x=right?anchor.x:anchor.x-width;mark.y=bottom?anchor.y:anchor.y-height;
 }else if(mark.type==='pen'){
  mark.points=original.points.map(p=>({x:x+(p.x-b.x)*width/Math.max(1,b.w),y:y+(p.y-b.y)*height/Math.max(1,b.h)}));
 }else{mark.x=x;mark.y=y;mark.w=width;mark.h=height}
 // Keep the opposite corner fixed in world space, even for a rotated object.
 const nextCenter=markCenter(mark),worldCenter=rotatePoint(nextCenter,center,angle);moveMark(mark,worldCenter.x-nextCenter.x,worldCenter.y-nextCenter.y);
 return mark;
}
overlay.onpointerdown=e=>{
 if(!base||e.button!==0||gesture)return;e.preventDefault();commitText();const point=position(e),handle=handleAt(point);
 if(handle){overlay.setPointerCapture(e.pointerId);gesture={type:handle.kind,handle,pointer:e.pointerId,start:point,original:structuredClone(marks[selected]),before:cloneMarks()};render();return}
 const picked=tool==='select'?hit(point):tool!=='crop'?hit(point,tool):-1;
 if(tool==='text'&&picked<0){startText(point);return}
 overlay.setPointerCapture(e.pointerId);
 if(tool==='select'||picked>=0){selected=picked;gesture=selected<0?null:{type:'move',pointer:e.pointerId,start:point,original:structuredClone(marks[selected]),before:cloneMarks()};render();return}
 crop=null;selected=-1;gesture={type:'draw',pointer:e.pointerId,start:point,mark:tool==='crop'?null:{type:tool,x:point.x,y:point.y,w:0,h:0,points:[point],color:$('color').value,width:+$('stroke').value}};render();
};
overlay.onpointermove=e=>{
 const point=position(e);
 if(!gesture){const handle=handleAt(point);overlay.style.cursor=handle?(handle.kind==='rotate'?'grab':handle.kind==='endpoint'?'crosshair':handle.index%2?'nesw-resize':'nwse-resize'):hit(point,tool==='select'?null:tool)>=0?'move':tool==='select'?'default':'crosshair';return}
 if(gesture.pointer!==e.pointerId)return;
 if(gesture.type==='move'){marks[selected]=structuredClone(gesture.original);moveMark(marks[selected],point.x-gesture.start.x,point.y-gesture.start.y);render();return}
 if(gesture.type==='rotate'){
  const center=markCenter(gesture.original),start=Math.atan2(gesture.start.y-center.y,gesture.start.x-center.x),now=Math.atan2(point.y-center.y,point.x-center.x);
  let angle=(gesture.original.rotation||0)+(now-start)*180/Math.PI;if(e.shiftKey)angle=Math.round(angle/15)*15;
  marks[selected]={...structuredClone(gesture.original),rotation:((angle%360)+360)%360};overlay.style.cursor='grabbing';render();return;
 }
 if(gesture.type==='endpoint'){
  const original=gesture.original,center=markCenter(original),tail=rotatePoint({x:original.x,y:original.y},center,original.rotation||0),tip=rotatePoint({x:original.x+original.w,y:original.y+original.h},center,original.rotation||0);
  const from=gesture.handle.index===0?point:tail,to=gesture.handle.index===1?point:tip;
  if(Math.hypot(to.x-from.x,to.y-from.y)>=2)marks[selected]={...original,x:from.x,y:from.y,w:to.x-from.x,h:to.y-from.y,rotation:0};render();return;
 }
 if(gesture.type==='resize'){marks[selected]=resizeMark(gesture.original,gesture.handle,point,e.shiftKey);render();return}
 if(tool==='crop'){crop=rect(gesture.start,point);render()}else{const mark=gesture.mark;if(mark.type==='pen')mark.points.push(point);else{mark.w=point.x-gesture.start.x;mark.h=point.y-gesture.start.y}renderOverlay()}
};
function endGesture(e){if(!gesture||gesture.pointer!==e.pointerId)return;overlay.onpointermove(e);const active=gesture;gesture=null;if(active.type!=='draw'){const changed=JSON.stringify(active.before)!==JSON.stringify(marks);if(changed){history.push({base,marks:active.before});if(history.length>50)history.shift();future=[];dirty=true}}else if(tool==='crop'){if(!crop||crop.w<2||crop.h<2)crop=null;else crop={x:Math.floor(crop.x),y:Math.floor(crop.y),w:Math.floor(crop.w),h:Math.floor(crop.h)}}else if(active.mark.type==='pen'||Math.abs(active.mark.w)>1||Math.abs(active.mark.h)>1){checkpoint();marks.push(active.mark);selected=active.mark.type==='pen'?-1:marks.length-1}render()}
overlay.onpointerup=endGesture;
function cancelGesture(){if(gesture&&gesture.type!=='draw')marks=gesture.before;gesture=null;crop=null;render()}
overlay.onpointercancel=cancelGesture;overlay.onlostpointercapture=()=>{if(gesture)cancelGesture()};
function applyCrop(){if(!crop)return;commitText();const area=crop;checkpoint();render();const next=document.createElement('canvas');next.width=area.w;next.height=area.h;next.getContext('2d').drawImage(canvas,area.x,area.y,area.w,area.h,0,0,area.w,area.h);base=next;marks=[];crop=null;selected=-1;render();fit();status('Crop applied. Undo restores the full image.')}
$('applyCrop').onclick=applyCrop;$('cancelCrop').onclick=()=>{crop=null;render();status('Crop cancelled.')};
function undo(){cancelText();cancelGesture();if(!history.length)return;future.push({base,marks:cloneMarks()});restore(history.pop());status('Undone.')}
function redo(){cancelText();cancelGesture();if(!future.length)return;history.push({base,marks:cloneMarks()});restore(future.pop());status('Redone.')}
$('undo').onclick=undo;$('redo').onclick=redo;
function deleteSelected(){if(selected<0)return;checkpoint();marks.splice(selected,1);selected=-1;render();status('Annotation deleted.')}
$('deleteMark').onclick=deleteSelected;
for(const key of ['color','stroke','fontSize'])$(key).onchange=()=>{if(selected<0)return;checkpoint();if(key==='color')marks[selected].color=$(key).value;if(key==='stroke')marks[selected].width=+$(key).value;if(key==='fontSize'&&marks[selected].type==='text')marks[selected].size=+$(key).value;render()};
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return}if(e.metaKey||e.ctrlKey||e.altKey)return;if(e.key==='Escape'){cancelText();cancelGesture();selected=-1;render()}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected()}const next={v:'select',p:'pen',r:'rect',e:'ellipse',a:'arrow',t:'text',b:'redact',c:'crop'}[e.key.toLowerCase()];if(next)setTool(next)});
function png(){commitText();if(crop)throw new Error('Apply or cancel the crop before copying or saving.');return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not export this image.')),'image/png'))}
$('copy').onclick=()=>{if(!loaded)return;try{if(!navigator.clipboard?.write||!globalThis.ClipboardItem)throw new Error('Image copying is unavailable in this browser. Use Download PNG.');const promise=png();const operation=navigator.clipboard.write([new ClipboardItem({'image/png':promise})]);operation.then(()=>status('Image copied. Paste it with ⌘V or Ctrl+V.')).catch(e=>status(e.name==='NotAllowedError'?'Clipboard access was denied. Allow clipboard access or download the PNG.':e.message,true))}catch(e){status(e.message,true)}};
$('download').onclick=async()=>{try{const blob=await png();const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${(item?.name||'Screenshot').replace(/[^a-z0-9 _-]/gi,'').trim()||'Screenshot'}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status('PNG downloaded.')}catch(e){status(e.message,true)}};
$('save').onclick=async()=>{try{const blob=await png();item={...item,blob,meta:{...item.meta,width:canvas.width,height:canvas.height},updated:Date.now()};await captureOperation('put',item);notifyCaptures();dirty=false;status('Edited screenshot saved to your capture library.')}catch(e){status('Could not save: '+e.message+'. Copy or download to keep your edits.',true)}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
async function loadCapture(capture){if(loaded||loading||!capture?.blob)return;loading=true;try{const image=await createImageBitmap(capture.blob);base=document.createElement('canvas');base.width=image.width;base.height=image.height;base.getContext('2d').drawImage(image,0,0);image.close();item=capture;loaded=true;clearInterval(pollTimer);$('loading').hidden=true;$('canvasHolder').hidden=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);render();fit();status(capture.meta?.truncated?'Page captured up to 16,000 pixels. Edit, copy, or download it.':capture.meta?.scaled?'Large screenshot resized to fit the editor. Edit, copy, or download it.':'Screenshot ready. Edit, copy, download, or save to your library.')}catch(e){status('Could not open the screenshot: '+e.message,true)}finally{loading=false}}
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.opener&&e.data?.type==='capture-ready'&&e.data.id===id)loadCapture(e.data.item)});
async function checkCapture(){if(!id||loaded||loading)return;try{let capture=await captureOperation('get',id);if(!capture){importing??=consumeExtensionCapture(id).finally(()=>importing=null);capture=await importing}if(capture)await loadCapture(capture)}catch{status('Browser storage unavailable. Waiting for the original tab to send the screenshot.')}}
enhanceDropdowns(document.querySelectorAll('.options select'));
document.querySelectorAll('button:not(#retry)').forEach(b=>b.disabled=true);
if(!id){$('loadHint').textContent='Open a screenshot from Capture Studio to edit it.';status('No screenshot selected.',true)}else{window.opener?.postMessage({type:'editor-ready',id},location.origin);checkCapture();pollTimer=setInterval(checkCapture,500);setTimeout(()=>{if(!loaded){$('loadHint').textContent='Complete capture in the original tab, or reopen a screenshot from your library.';$('retry').hidden=false}},30000)}
$('retry').onclick=()=>{window.opener?.postMessage({type:'editor-ready',id},location.origin);checkCapture()};
