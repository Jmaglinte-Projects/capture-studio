import {prepare,start,abort,state} from './offscreen.js';
const {recordIntent}=await chrome.storage.session.get('recordIntent');
if(!recordIntent){window.close()}else{
  const prepared=await prepare(recordIntent.settings);
  if(!prepared.ok){document.getElementById('error').textContent='Allow camera/microphone access, then restart recording from the extension.';await chrome.runtime.sendMessage({action:'record-error',error:'Camera or microphone permission was denied. Allow device access and try again.'})}
  else{
    const sources=['screen','window','tab'];if(recordIntent.settings.systemAudio)sources.push('audio');
    chrome.desktopCapture.chooseDesktopMedia(sources,async(streamId,details)=>{try{
      if(chrome.runtime.lastError)throw new Error(chrome.runtime.lastError.message);if(!streamId){await chrome.runtime.sendMessage({action:'record-cancel'});return}
      document.getElementById('heading').textContent='Starting your recording…';
      const response=await start({kind:'desktop',streamId,audio:!!details?.canRequestAudioTrack});await chrome.storage.session.remove('recordIntent');
      if(!response.ok)throw new Error(response.error);
      document.getElementById('heading').textContent='Recording in progress';document.getElementById('description').textContent='This minimized extension window keeps desktop recording running. Use the extension popup to pause or stop.';
      const windowInfo=await chrome.windows.getCurrent();await chrome.windows.update(windowInfo.id,{state:'minimized'});
    }catch(e){document.getElementById('error').textContent=e.message;await chrome.runtime.sendMessage({action:'record-error',error:e.message})}});
  }
}
