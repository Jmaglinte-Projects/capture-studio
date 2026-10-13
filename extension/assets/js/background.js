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
async function metrics(tabId){const [{result}]=await chrome.scripting.executeScript({target:{tabId},func:()=>({width:innerWidth,height:innerHeight,totalWidth:Math.max(innerWidth,document.documentElement.scrollWidth,document.body?.scrollWidth||0),totalHeight:Math.max(innerHeight,document.documentElement.scrollHeight,document.body?.scrollHeight||0),dpr:devicePixelRatio,x:scrollX,y:scrollY,title:document.title,url:location.href})});return result}
async function frame(tabId,windowId){await ensureSource(tabId,windowId);return chrome.tabs.captureVisibleTab(windowId,{format:'png'})}
async function runCapture({mode,tabId,windowId,delay:wait=0}){
  await chrome.action.setBadgeText({text:''});await chrome.storage.local.remove('lastCaptureError');await delay(Math.max(180,Math.min(wait,5000)));await ensureSource(tabId,windowId);
  let payload;
  if(mode==='fullpage')payload=await captureFullPage(tabId,windowId);
  else if(mode==='area'){
    let selection;try{const [{result}]=await chrome.scripting.executeScript({target:{tabId},files:['assets/js/select-area.js']});selection=result}catch{throw new Error('Selected-area capture is unavailable on this page. Try a regular website tab.')}
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
let recorderCreating=null,pickerId=null,permissionWindowId=null,sourceWindowId=null;
const recordingPhases=['preparing','permission','selecting','countdown','recording','paused','saving'];
async function recorderContext(){return(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('offscreen.html')]}))[0]}
async function ensureRecorder(){if(await recorderContext())return;if(!recorderCreating)recorderCreating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA','BLOBS'],justification:'Keep the user-requested screen/camera recording running when the extension popup closes.'}).finally(()=>recorderCreating=null);await recorderCreating}
async function engine(command,data={}){const {desktopEngine}=await chrome.storage.session.get('desktopEngine');if(desktopEngine)return chrome.runtime.sendMessage({target:'desktop-recorder',command,...data}).catch(()=>({phase:'idle'}));if(!await recorderContext())return{phase:'idle'};return chrome.runtime.sendMessage({target:'recorder',command,...data})}
async function updateRecordState(state){await chrome.storage.session.set({recorderState:state});const text=state.phase==='recording'?'REC':state.phase==='paused'?'Ⅱ':state.phase==='error'?'!':state.phase==='countdown'?String(state.meta?.countdown||'…'):'';await chrome.action.setBadgeText({text});if(text)await chrome.action.setBadgeBackgroundColor({color:state.phase==='paused'?'#d89428':state.phase==='error'?'#cd485c':'#e85064'})}
let previewQueue=Promise.resolve();
function openRecordingPreview(captureId){
 if(!captureId)return Promise.resolve();
 previewQueue=previewQueue.catch(()=>{}).then(async()=>{const {lastRecordingPreview}=await chrome.storage.session.get('lastRecordingPreview');if(lastRecordingPreview===captureId)return;await chrome.tabs.create({url:chrome.runtime.getURL('preview.html?capture='+encodeURIComponent(captureId)),active:true});await chrome.storage.session.set({lastRecordingPreview:captureId})});
 return previewQueue;
}
async function recordStatus(){const stored=await chrome.storage.session.get(['recorderState','recordIntent']);const live=await engine('status');if(stored.recordIntent&&['idle','preparing'].includes(live.phase))return stored.recorderState?.phase&&stored.recorderState.phase!=='idle'?stored.recorderState:{phase:'preparing'};if(stored.recorderState&&['complete','error'].includes(stored.recorderState.phase)&&!recordingPhases.includes(live.phase))return stored.recorderState;return live.phase&&live.phase!=='idle'?live:stored.recorderState||live||{phase:'idle'}}
function cleanSettings(raw={}){const pick=(key,values,fallback)=>values.includes(String(raw[key]))?String(raw[key]):fallback;return{mode:pick('mode',['desktop','camera','tab','region'],'desktop'),quality:pick('quality',['720','1080','1440','2160'],'1080'),fps:pick('fps',['24','30','60'],'30'),format:pick('format',['webm','mp4'],'webm'),bitrate:pick('bitrate',['2','5','8','16','32'],'8'),countdown:pick('countdown',['0','3','5'],'3'),mic:!!raw.mic,overlay:!!raw.overlay,systemAudio:!!raw.systemAudio}}
async function failRecording(error){await chrome.storage.session.remove('recordIntent');await engine('abort').catch(()=>{});if(sourceWindowId!==null){const id=sourceWindowId;sourceWindowId=null;await chrome.storage.session.remove('desktopEngine');await chrome.windows.remove(id).catch(()=>{})}await updateRecordState({phase:error.name==='AbortError'?'idle':'error',elapsed:0,error:error.name==='AbortError'?'':error.message})}
async function continueRecording(intent){
  try{
    if(intent.settings.mode==='desktop'){await chrome.storage.session.set({desktopEngine:true});await updateRecordState({phase:'selecting',elapsed:0});const window=await chrome.windows.create({url:chrome.runtime.getURL('source.html'),type:'popup',width:440,height:300});sourceWindowId=window.id;return}
    await chrome.storage.session.remove('desktopEngine');await ensureRecorder();const preparation=await engine('prepare',{settings:intent.settings});
    if(!preparation.ok){if(preparation.permissionNeeded){await updateRecordState({phase:'permission',elapsed:0});const url=chrome.runtime.getURL(`permission.html?camera=${preparation.camera?1:0}&mic=${preparation.mic?1:0}`);const window=await chrome.windows.create({url,type:'popup',width:470,height:330});permissionWindowId=window.id;return}throw new Error(preparation.error||'Could not access recording devices.')}
    if(!(await chrome.storage.session.get('recordIntent')).recordIntent){await engine('abort');return}
    let source={kind:'camera',audio:false};
    if(intent.settings.mode==='tab'||intent.settings.mode==='region'){
      let region=null;
      if(intent.settings.mode==='region'){await updateRecordState({phase:'selecting',elapsed:0});await chrome.windows.update(intent.windowId,{focused:true});await chrome.tabs.update(intent.tabId,{active:true});const [{result}]=await chrome.scripting.executeScript({target:{tabId:intent.tabId},files:['assets/js/select-area.js']});if(!result)throw new DOMException('Selection cancelled','AbortError');region=result}
      const viewport=await metrics(intent.tabId).catch(()=>null);
      source={kind:'tab',width:viewport?.width,height:viewport?.height,dpr:viewport?.dpr||1,streamId:await chrome.tabCapture.getMediaStreamId({targetTabId:intent.tabId}),audio:intent.settings.systemAudio,region};
    }
    if(!(await chrome.storage.session.get('recordIntent')).recordIntent){await engine('abort');return}
    const response=await engine('start',{source});await chrome.storage.session.remove('recordIntent');if(!response.ok)throw new Error(response.error||'Could not start the recording.');
  }catch(error){await failRecording(error)}
}
async function handleRecordMessage(message){
  if(message.action==='record-status')return recordStatus();
  if(message.action==='record-start'){
    if((await chrome.storage.session.get('recordIntent')).recordIntent||recordingPhases.includes((await recordStatus()).phase))throw new Error('A recording is already active.');
    const intent={settings:cleanSettings(message.settings),tabId:message.tabId,windowId:message.windowId};
    await chrome.storage.session.set({recordIntent:intent});await updateRecordState({phase:'preparing',elapsed:0});continueRecording(intent);return{started:true};
  }
  if(message.action==='record-error'){await failRecording(new Error(message.error||'Recording failed.'));return{ok:true}}
  if(message.action==='record-permission'){
    permissionWindowId=null;
    if(!message.approved)return handleRecordMessage({action:'record-cancel'});
    const {recordIntent}=await chrome.storage.session.get('recordIntent');if(!recordIntent)throw new Error('Recording was cancelled.');continueRecording(recordIntent);return{started:true};
  }
  if(message.action==='record-cancel'){
    await chrome.storage.session.remove('recordIntent');if(sourceWindowId!==null){const id=sourceWindowId;await engine('abort');sourceWindowId=null;await chrome.storage.session.remove('desktopEngine');await chrome.windows.remove(id).catch(()=>{})}if(pickerId!==null){chrome.desktopCapture.cancelChooseDesktopMedia(pickerId);pickerId=null}await engine('abort');await updateRecordState({phase:'idle',elapsed:0});return{phase:'idle'};
  }
  if(message.action==='record-pause')return engine('pause');
  if(message.action==='record-resume')return engine('resume');
  if(message.action==='record-stop')return engine('stop');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.target==='recorder'||message.target==='desktop-recorder')return;
  if(message.action==='record-state'){updateRecordState(message.state).then(async()=>{if(['complete','error'].includes(message.state.phase)&&sourceWindowId!==null){await chrome.storage.session.remove('recordIntent');const id=sourceWindowId;sourceWindowId=null;await chrome.storage.session.remove('desktopEngine');await chrome.windows.remove(id).catch(()=>{})}if(message.state.phase==='complete')await openRecordingPreview(message.state.captureId);reply({ok:true})}).catch(error=>reply({error:error.message}));return true}
  if(!['record-start','record-status','record-pause','record-resume','record-stop','record-cancel','record-permission','record-error'].includes(message.action))return;
  handleRecordMessage(message).then(reply).catch(error=>reply({error:error.message}));return true;
});
chrome.windows.onRemoved.addListener(id=>{if(id===permissionWindowId||id===sourceWindowId){permissionWindowId=sourceWindowId=null;chrome.storage.session.remove('desktopEngine');handleRecordMessage({action:'record-cancel'}).catch(()=>{})}});
