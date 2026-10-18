// One optional speech attempt. Audio and transcripts stay transient until graded.
export function createReviewSpeechCapture({lang,recognitionFactory,mediaDevices=globalThis.navigator?.mediaDevices,Recorder=globalThis.MediaRecorder,transcribe,onText=()=>{},onState=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
 let canceled=false,ended=false,recognition,recorder,stream,timer,nativeTimer,stopRequested=false,fallback=false,transcript='',resolveDone;
 const done=new Promise(resolve=>resolveDone=resolve);
 const cleanup=()=>{clearTimer(timer);clearTimer(nativeTimer);stream?.getTracks().forEach(track=>track.stop())};
 const settle=(state,text='')=>{if(ended)return;ended=true;cleanup();if(!canceled){if(text)onText(text);onState(state)}resolveDone(text)};
 const fail=error=>settle(error?.name==='NotAllowedError'?'Microphone blocked. Allow access or continue without recording.':error?.message||'Could not recognize speech. Try recording again.');
 async function record(){
  fallback=true;clearTimer(nativeTimer);
  try{recognition?.abort()}catch{}
  if(!mediaDevices?.getUserMedia||!Recorder){settle('Recording is unavailable in this browser. You can still reveal the meaning.');return}
  try{
   onState('Starting microphone…');stream=await mediaDevices.getUserMedia({audio:true});
   if(canceled||ended){cleanup();return}
   const chunks=[];recorder=new Recorder(stream);
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
   recorder.onerror=e=>fail(e.error||new Error('Recording failed.'));
   recorder.onstop=async()=>{
    cleanup();if(canceled||ended)return;
    if(!chunks.length){settle('Nothing heard. Try recording again.');return}
    onState('Transcribing…');
    try{const text=await transcribe(new Blob(chunks,{type:recorder.mimeType||chunks[0].type}),lang);if(!canceled&&!ended)settle(text?.trim()?'Ready to check.':'Nothing heard. Try recording again.',text?.trim()||'')}
    catch(error){fail(error)}
   };
   recorder.start();onState('Recording… Tap again to stop.');
   timer=setTimer(()=>finish(),30000);if(stopRequested)finish();
  }catch(error){fail(error)}
 }
 function start(){
  try{recognition=recognitionFactory?.(lang)}catch{}
  if(!recognition){record();return}
  recognition.onresult=e=>{if(canceled||ended||fallback)return;transcript=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim();onText(transcript)};
  recognition.onerror=e=>{if(canceled||ended||fallback)return;if(['not-allowed','audio-capture'].includes(e.error)){settle('Microphone unavailable. Allow access or continue without recording.');return}record()};
  recognition.onend=()=>{if(canceled||ended||fallback)return;settle(transcript?'Ready to check.':'Nothing heard. Try recording again.',transcript)};
  try{recognition.start();onState('Recording… Tap again to stop.');nativeTimer=setTimer(()=>{if(!ended&&!fallback){if(transcript)finish();else record()}},12000);timer=setTimer(()=>finish(),30000)}catch{record()}
 }
 function finish(){
  if(!ended&&!canceled){stopRequested=true;
   if(fallback){if(recorder?.state==='recording')recorder.stop()}
   else {clearTimer(nativeTimer);nativeTimer=setTimer(()=>settle(transcript?'Ready to check.':'Nothing heard. Try recording again.',transcript),2500);try{recognition?.stop()}catch(error){fail(error)}}
  }
  return done;
 }
 function cancel(){if(canceled)return;canceled=true;try{recognition?.abort()}catch{}try{if(recorder?.state==='recording')recorder.stop()}catch{}settle('');cleanup()}
 return {start,finish,cancel,done};
}
