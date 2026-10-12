let capturing=false;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.action!=='capture')return;
  if(capturing){reply({error:'A capture is already running. Finish it or press Escape to cancel.'});return}
  if(!['visible','fullpage','area'].includes(message.mode)||!Number.isInteger(message.tabId)||!Number.isInteger(message.windowId)){reply({error:'Choose a capture mode on an active tab.'});return}
  capturing=true;reply({started:true});
  runCapture(message).catch(async error=>{if(error.name==='AbortError')return;await chrome.storage.local.set({lastCaptureError:error.message});await chrome.action.setBadgeText({text:'!'});await chrome.action.setBadgeBackgroundColor({color:'#d64e60'})}).finally(()=>capturing=false);
});
async function ensureSource(tabId,windowId){const [active]=await chrome.tabs.query({active:true,windowId});if(active?.id!==tabId)throw new Error('The active tab changed. Keep the source tab active and try again.')}
async function metrics(tabId){const [{result}]=await chrome.scripting.executeScript({target:{tabId},func:()=>({width:innerWidth,height:innerHeight,totalWidth:Math.max(innerWidth,document.documentElement.scrollWidth,document.body?.scrollWidth||0),totalHeight:Math.max(innerHeight,document.documentElement.scrollHeight,document.body?.scrollHeight||0),x:scrollX,y:scrollY,title:document.title,url:location.href})});return result}
async function frame(tabId,windowId){await ensureSource(tabId,windowId);return chrome.tabs.captureVisibleTab(windowId,{format:'png'})}
async function runCapture({mode,tabId,windowId,delay:wait=0}){
  await chrome.action.setBadgeText({text:''});await chrome.storage.local.remove('lastCaptureError');await delay(Math.max(180,Math.min(wait,5000)));await ensureSource(tabId,windowId);
  let payload;
  if(mode==='fullpage')payload=await captureFullPage(tabId,windowId);
  else if(mode==='area'){
    let selection;try{const [{result}]=await chrome.scripting.executeScript({target:{tabId},files:['select-area.js']});selection=result}catch{throw new Error('Selected-area capture is unavailable on this page. Try a regular website tab.')}
    if(!selection)throw new DOMException('Selection cancelled','AbortError');await delay(180);const data=await frame(tabId,windowId);payload={mode,region:selection,width:selection.viewportWidth,height:selection.viewportHeight,slices:[{x:0,y:0,data}]};
  }else{const data=await frame(tabId,windowId);payload={mode,slices:[{x:0,y:0,data}]}}
  const id=crypto.randomUUID();payload.id=id;payload.created=Date.now();await chrome.storage.local.set({['pendingCapture:'+id]:payload});
  await chrome.tabs.create({url:chrome.runtime.getURL('editor.html?capture='+id),windowId});
}
async function captureFullPage(tabId,windowId){
  let original,prepared=false;
  try{
    try{original=await metrics(tabId)}catch{throw new Error('Full-page capture is unavailable on this page. Try a regular website tab.')}
    const width=Math.min(original.totalWidth,16000),height=Math.min(original.totalHeight,16000),slices=[];
    await chrome.scripting.executeScript({target:{tabId},func:()=>{const style=document.createElement('style');style.id='capture-studio-scroll';style.textContent='html{scroll-behavior:auto!important}*{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}[data-capture-studio-fixed]{visibility:hidden!important}';document.documentElement.append(style)}});prepared=true;
    for(let y=0;y<height;y+=original.height){for(let x=0;x<width;x+=original.width){await ensureSource(tabId,windowId);const [{result:position}]=await chrome.scripting.executeScript({target:{tabId},func:(x,y)=>{scrollTo(x,y);return{x:scrollX,y:scrollY}},args:[x,y]});await delay(650);const data=await frame(tabId,windowId);slices.push({...position,data});if(slices.length===1)await chrome.scripting.executeScript({target:{tabId},func:()=>{for(const element of document.querySelectorAll('body *')){const position=getComputedStyle(element).position;if(position==='fixed'||position==='sticky')element.setAttribute('data-capture-studio-fixed','')}}});if(position.x+original.width>=width)break}if(slices[slices.length-1].y+original.height>=height)break}
    return{mode:'fullpage',width:original.width,height:original.height,totalWidth:width,totalHeight:height,slices,truncated:width<original.totalWidth||height<original.totalHeight};
  }finally{if(original&&prepared)await chrome.scripting.executeScript({target:{tabId},func:(x,y)=>{scrollTo(x,y);document.getElementById('capture-studio-scroll')?.remove();document.querySelectorAll('[data-capture-studio-fixed]').forEach(element=>element.removeAttribute('data-capture-studio-fixed'))},args:[original.x,original.y]}).catch(()=>{})}
}
