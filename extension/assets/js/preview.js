import {captureOperation,notifyCaptures} from './capture-store.js';
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('capture');
let item=null,url=null,saving=false;
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error)}
function extension(){return item.blob.type.toLowerCase().includes('mp4')?'mp4':'webm'}
function setName(name){$('name').value=name;$('title').textContent=name;document.title=name+' · Capture Studio'}
async function saveName(){
 if(!item||saving)return false;const name=$('name').value.trim();if(!name){status('Enter a recording name.',true);$('name').focus();return false}if(name===item.name)return true;
 saving=true;$('rename').disabled=true;
 try{const current=await captureOperation('get',id);if(!current)throw new Error('This recording was removed from your library. Download it to keep a copy.');const updated={...current,name,updated:Date.now()};await captureOperation('put',updated);item=updated;setName(name);notifyCaptures();status('Recording renamed.');return true}catch(e){status('Could not save the name: '+e.message,true);return false}finally{saving=false;$('rename').disabled=false}
}
$('renameForm').onsubmit=async e=>{e.preventDefault();await saveName()};
$('download').onclick=async()=>{
 if(!item||!await saveName())return;const link=document.createElement('a');link.href=url;const name=item.name.replace(/\.(mp4|webm)$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'').trim()||'Recording';link.download=name+'.'+extension();link.click();status('Download started.');
};
$('video').onerror=()=>status('This browser could not play the recording. You can still download the original file.',true);
window.addEventListener('beforeunload',e=>{if(item&&$('name').value.trim()!==item.name){e.preventDefault();e.returnValue=''}});
window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url)});
async function load(){try{if(!id)throw new Error('Open a recording from My captures.');item=await captureOperation('get',id);if(!item||item.type!=='video'||!item.blob)throw new Error('Recording not found in this browser. Open My captures to choose another recording.');url=URL.createObjectURL(item.blob);$('video').src=url;$('video').hidden=false;$('loading').hidden=true;setName(item.name);const seconds=Math.floor((item.duration||0)/1000),time=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');$('details').textContent=`${time} · ${item.meta?.width||'?'} × ${item.meta?.height||'?'} · ${(item.blob.size/1048576).toFixed(1)} MB · ${extension().toUpperCase()}`;$('download').textContent='↓ Download '+extension().toUpperCase();for(const key of ['download','name','rename'])$(key).disabled=false;status('Ready to preview, rename, or download.')}catch(e){$('loading').textContent=e.message;$('details').textContent='Recording unavailable';status(e.message,true)}}
load();
