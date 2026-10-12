import {captureOperation,notifyCaptures} from './capture-store.js';
export async function consumeExtensionCapture(id){
  if(!globalThis.chrome?.runtime?.id||!chrome.storage?.local||!id)return null;
  const key='pendingCapture:'+id;const data=await chrome.storage.local.get(key);const payload=data[key];if(!payload)return null;
  const first=await createImageBitmap(await(await fetch(payload.slices[0].data)).blob());
  const ratioX=payload.width?first.width/payload.width:1,ratioY=payload.height?first.height/payload.height:1;
  const area=payload.region;
  const desiredWidth=area?area.w*ratioX:payload.mode==='fullpage'?payload.totalWidth*ratioX:first.width;
  const desiredHeight=area?area.h*ratioY:payload.mode==='fullpage'?payload.totalHeight*ratioY:first.height;
  const scale=Math.min(1,Math.sqrt(40000000/(desiredWidth*desiredHeight)));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(desiredWidth*scale));canvas.height=Math.max(1,Math.round(desiredHeight*scale));const context=canvas.getContext('2d');
  if(area)context.drawImage(first,area.x*ratioX,area.y*ratioY,area.w*ratioX,area.h*ratioY,0,0,canvas.width,canvas.height);
  else if(payload.mode==='fullpage'){for(let i=0;i<payload.slices.length;i++){const slice=payload.slices[i];const image=i===0?first:await createImageBitmap(await(await fetch(slice.data)).blob());context.drawImage(image,0,0,image.width,image.height,slice.x*ratioX*scale,slice.y*ratioY*scale,image.width*scale,image.height*scale);if(i!==0)image.close()}}
  else context.drawImage(first,0,0,canvas.width,canvas.height);
  first.close();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Could not assemble this screenshot.');
  const capture={id,type:'image',blob,name:`${payload.mode==='fullpage'?'Full page':area?'Selected area':'Screenshot'} · ${new Date(payload.created).toLocaleString()}`,created:payload.created,meta:{width:canvas.width,height:canvas.height,captureMode:payload.mode,truncated:!!payload.truncated,scaled:scale<1}};
  await captureOperation('put',capture);notifyCaptures();await chrome.storage.local.remove(key);return capture;
}
