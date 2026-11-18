'use strict';
const $ = id => document.getElementById(id);
const state = {config:null, worker:null, ready:false, busy:false, image:false, source:'', stream:null, request:0, pending:0, result:null, cameraRequest:0, timer:null};
const descriptions = {
  cardboard:['纸板 / CARDBOARD','干净纸板通常可回收','去除胶带、塑料填充物，压平后保持干燥。沾油或严重污染的纸板请查询当地投放要求。'],
  glass:['玻璃 / GLASS','普通玻璃容器通常可回收','倒空内容物，按当地要求处理瓶盖。碎玻璃应妥善包裹并标记；陶瓷、灯泡和耐热玻璃不能直接按普通玻璃瓶处理。'],
  metal:['金属 / METAL','常见金属包装通常可回收','易拉罐、干净金属盒等可按当地回收规则投放。电池、带压容器和化学品包装需要单独确认，模型不能判断其危险性。'],
  paper:['纸张 / PAPER','干净纸张通常可回收','保持干燥，去掉其他材质附件。纸巾、油污纸、复合涂层纸等不能仅凭外观按普通废纸处理。'],
  plastic:['塑料 / PLASTIC','先确认塑料种类与当地回收要求','倒空并清理明显残留。不同塑料、薄膜和复合包装的接收规则不同；识别为塑料不等于一定可回收。'],
  trash:['其他垃圾 / TRASH','需要进一步人工确认','这是训练集中的混合剩余类别，不代表所有物品都应投入其他垃圾桶。食品、药品、电池等请单独按当地规则判断。']
};
function message(text='') {$('message').textContent=text;}
function controls() {$('classify').disabled=!state.ready||!state.image||state.busy; $('classify').firstElementChild.textContent=state.busy?'正在分类…':'开始分类';}
function resetResult() {$('result').hidden=true;$('result-empty').hidden=false;$('result-time').textContent='本地 AI 推理';state.result=null;}
function invalidate() {state.request++; state.pending=0;state.busy=false;clearTimeout(state.timer);controls();resetResult();}
function initWorker() {
  if(state.worker)state.worker.terminate();
  state.ready=false;state.busy=false;state.pending=0;clearTimeout(state.timer);controls();
  $('retry').hidden=true;$('model-status').className='status loading';$('model-status').textContent='正在加载本地模型…';
  const worker=new Worker('./worker.js');state.worker=worker;
  worker.onmessage=({data})=>{
    if(state.worker!==worker)return;
    if(data.type==='ready'){state.ready=true;$('model-status').className='status';$('model-status').textContent='模型已就绪 · 本地识别';controls();return;}
    if(data.id!==undefined&&data.id!==state.pending)return;
    if(data.type==='error'){failModel('模型未能运行，请重新加载，或使用新版 Chrome / Edge。');console.error(data.message);return;}
    if(data.type==='result'){
      clearTimeout(state.timer);state.busy=false;state.pending=0;controls();renderResult(data);
    }
  };
  worker.onerror=()=>failModel('模型加载失败，请重新加载，确认文件完整并使用新版浏览器。');
  worker.postMessage({type:'load'});
}
function failModel(text) {clearTimeout(state.timer);state.ready=false;state.busy=false;state.pending=0;$('retry').hidden=false;$('model-status').className='status error';$('model-status').textContent='模型未就绪';message(text);controls();}
function changeMode(camera){
  $('upload-tab').setAttribute('aria-selected',String(!camera));$('camera-tab').setAttribute('aria-selected',String(camera));
  $('upload-pane').hidden=camera;$('camera-pane').hidden=!camera;
  if(!camera)stopCamera();message('');
}
function putImage(image, source){
  invalidate();const canvas=$('preview');const max=1400;
  const w=image.videoWidth||image.naturalWidth||image.width,h=image.videoHeight||image.naturalHeight||image.height;
  if(!w||!h)throw new Error('图片没有有效尺寸，请更换一张。');
  const scale=Math.min(1,max/Math.max(w,h));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  state.image=true;state.source=source;$('preview-wrap').hidden=false;$('image-name').textContent=source;
  document.querySelector('.input-panel').classList.add('has-image');$('dropzone').querySelector('strong').textContent='换一张图片';$('input-note').textContent='准备好后，点击“开始分类”。画面中尽量只保留一件物品。';
  window.dispatchEvent(new CustomEvent('waste-image',{detail:{canvas,source}}));
  message(Math.min(w,h)<100?'图片分辨率偏低，建议换一张更清楚的照片。':'');controls();
}
async function readFile(file){
  if(!file)return;
  const ticket=++state.request;
  if(file.size>20*1024*1024){message('图片超过20 MB，请压缩后再上传。');return;}
  if(!/\.(jpe?g|png|webp|bmp)$/i.test(file.name)&&!['image/jpeg','image/png','image/webp','image/bmp'].includes(file.type)){message('暂不支持该文件。请上传 JPG、PNG 或 WebP；HEIC 照片请先导出为 JPG。');return;}
  const url=URL.createObjectURL(file);
  try{const im=new Image();im.src=url;await im.decode();if(ticket!==state.request)return;putImage(im,file.name);}
  catch(e){message('图片读取失败。请确认文件完整，或转为 JPG / PNG 后重试。');}
  finally{URL.revokeObjectURL(url);$('file-input').value='';}
}
function clearImage(){invalidate();state.image=false;state.source='';$('preview-wrap').hidden=true;$('preview').width=1;$('preview').height=1;document.querySelector('.input-panel').classList.remove('has-image');$('dropzone').querySelector('strong').textContent='选择图片，或拖到这里';$('input-note').textContent='手机照片也可以传到电脑后上传。';message('');controls();}
async function listCameras(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  const old=$('camera-select').value;
  const all=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
  $('camera-select').replaceChildren(new Option('系统默认摄像头',''));
  all.forEach((d,i)=>$('camera-select').append(new Option(d.label||`摄像头 ${i+1}`,d.deviceId)));
  if(all.some(d=>d.deviceId===old))$('camera-select').value=old;
}
function stopCamera(){state.cameraRequest++;if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null;}$('video').srcObject=null;$('camera-view').hidden=true;$('capture').disabled=true;$('camera-stop').disabled=true;$('camera-start').disabled=false;window.dispatchEvent(new Event('waste-camera-stopped'));}
async function startCamera(){
  stopCamera();const ticket=state.cameraRequest;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){message('摄像头需要 localhost 或 HTTPS。请双击“启动垃圾分类.cmd”打开，上传图片仍可使用。');return;}
  $('camera-start').disabled=true;message('请在浏览器提示中允许使用摄像头。');
  try{
    const id=$('camera-select').value;
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(id?{deviceId:{exact:id}}:{}),width:{ideal:1280},height:{ideal:720}}});
    if(ticket!==state.cameraRequest){stream.getTracks().forEach(t=>t.stop());return;}
    state.stream=stream;$('video').srcObject=stream;$('camera-view').hidden=false;await $('video').play();
    if(ticket!==state.cameraRequest)return;
    $('capture').disabled=false;$('camera-stop').disabled=false;message('摄像头已开启。放好物品，等画面清楚后点击“拍照”。');await listCameras();
    stream.getVideoTracks()[0].addEventListener('ended',()=>{if(state.stream===stream){stopCamera();message('摄像头已断开，可以重新开启或改用上传图片。');}});
  }catch(e){if(ticket!==state.cameraRequest)return;stopCamera();const notes={NotAllowedError:'没有获得摄像头权限。可在地址栏的网站设置中允许后重试，或改用上传图片。',NotFoundError:'没有找到摄像头。请检查设备是否启用，或改用上传图片。',NotReadableError:'摄像头可能被其他软件占用。请关闭会议或相机软件后重试。',OverconstrainedError:'所选摄像头当前不可用，请切换到系统默认摄像头。'};message(notes[e.name]||'摄像头暂时无法开启，请检查系统权限或改用上传图片。');}
}
function capture(){
  const video=$('video');if(!state.stream||video.readyState<2){message('画面还未准备好，请稍候再拍。');return;}
  putImage(video,'摄像头照片 · '+new Date().toLocaleTimeString('zh-CN'));stopCamera();message('拍照完成，摄像头已关闭。点击“开始分类”查看结果。');
}
function prepareTensor(){
  const image=$('preview'),n=224,canvas=document.createElement('canvas');canvas.width=n;canvas.height=n;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,n,n);
  const scale=n/Math.max(image.width,image.height),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));
  ctx.drawImage(image,Math.floor((n-w)/2),Math.floor((n-h)/2),w,h);
  const pixels=ctx.getImageData(0,0,n,n).data,tensor=new Float32Array(n*n*3);
  let sum=0,sq=0;
  for(let i=0;i<n*n;i++){for(let c=0;c<3;c++)tensor[c*n*n+i]=pixels[i*4+c]/255;}
  // Quality check on the original preview, to avoid letterbox-white masking a dark image.
  const q=document.createElement('canvas');q.width=64;q.height=64;const qc=q.getContext('2d',{willReadFrequently:true});qc.drawImage(image,0,0,64,64);
  const pix=qc.getImageData(0,0,64,64).data;
  for(let i=0;i<4096;i++){const v=(pix[i*4]+pix[i*4+1]+pix[i*4+2])/765;sum+=v;sq+=v*v;}
  const mean=sum/4096,std=Math.sqrt(Math.max(0,sq/4096-mean*mean));
  return {tensor,blank:std<.018,dark:mean<.06};
}
function classify(){
  if(!state.ready||!state.image||state.busy)return;
  const {tensor,blank,dark}=prepareTensor();
  if(blank||dark){message(blank?'画面接近纯色，暂时无法判断。请确认物品清楚可见后重新拍摄。':'画面太暗，建议补充光线后重新拍摄。');resetResult();return;}
  message('');resetResult();state.busy=true;state.pending=++state.request;controls();
  state.worker.postMessage({type:'predict',id:state.pending,tensor},[tensor.buffer]);
  state.timer=setTimeout(()=>{if(state.busy){state.worker.terminate();failModel('本次识别等待时间过长，请重新加载模型后再试。');}},45000);
}
function renderResult(data){
  const p=data.probabilities,rank=p.map((value,i)=>({value,i})).sort((a,b)=>b.value-a.value),top=rank[0];
  const config=state.config,key=config.classes[top.i],uncertain=top.value<config.confidence_threshold||top.value-rank[1].value<config.margin_threshold;
  const desc=descriptions[key];$('result-empty').hidden=true;$('result').hidden=false;
  $('result-label').textContent=uncertain?'暂不确定':config.labels[top.i];$('result-confidence').textContent=(top.value*100).toFixed(1)+'%';
  $('result-kicker').textContent=uncertain?'需要人工确认':'预测材质';
  $('result-subtitle').textContent=uncertain?`最接近：${config.labels[top.i]}；模型把握不足，建议换个角度再拍。`:desc[0]+' · 模型置信度';
  $('advice').classList.toggle('uncertain',uncertain);$('advice-title').textContent=uncertain?'先不要根据本次结果投放':desc[1];
  $('advice-text').textContent=uncertain?'检查画面是否有多个物品、背景是否复杂。把一件物品放到浅色背景上，再拍一张；也可以直接人工判断。':desc[2];
  $('result-time').textContent=`推理 ${Math.round(data.elapsed)} ms`;$('bars').replaceChildren();
  for(const item of rank){const row=document.createElement('div');row.className='bar-row';const label=document.createElement('span');label.textContent=config.labels[item.i];const track=document.createElement('div');track.className='bar-track';const fill=document.createElement('div');fill.className='bar-fill';fill.style.width=(item.value*100)+'%';track.append(fill);const value=document.createElement('span');value.textContent=(item.value*100).toFixed(1)+'%';row.append(label,track,value);$('bars').append(row);}
  state.result={timestamp:new Date().toISOString(),source:state.source,predicted_class:key,predicted_label:config.labels[top.i],uncertain,confidence:top.value,probabilities:Object.fromEntries(config.classes.map((c,i)=>[c,p[i]])),inference_ms:data.elapsed,model_sha256:config.model_sha256,note:'仅供学习演示，非当地垃圾投放规则；置信度不保证正确。'};
}
function saveResult(){if(!state.result)return;const blob=new Blob([JSON.stringify(state.result,null,2)],{type:'application/json'});const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='垃圾分类结果-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function sampleButtons(){for(const sample of state.config.samples){const button=document.createElement('button');button.className='sample';button.type='button';button.title='加载'+sample.zh+'测试图片';const img=new Image();img.src='samples/'+sample.file;img.alt=sample.zh+'测试样例';const text=document.createElement('span');text.textContent=sample.zh;button.append(img,text);button.onclick=async()=>{const ticket=++state.request;try{await img.decode();if(ticket!==state.request)return;putImage(img,`${sample.zh} · 独立测试集样例`);}catch(e){message('样例未能读取，请检查 samples 文件夹。');}};$('samples').append(button);}}
async function loadReport(){
  const response=await fetch('reports/metrics.json');if(!response.ok)throw new Error('report unavailable');const r=await response.json();
  const rows=[['颜色直方图 + 逻辑回归',r.baseline_histogram],['基础 CNN（从头训练）',r.baseline_cnn],['MobileNetV3 迁移学习（主模型）',r.test],['主模型 · 亮度降至65%压力测试',r.stress_brightness_065]];
  for(const [name,metric] of rows){if(!metric)continue;const row=document.createElement('tr');for(const text of [name,(metric.accuracy*100).toFixed(1)+'%',metric.macro_f1.toFixed(3)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('comparison').append(row);}
  const header=document.createElement('tr');for(const name of ['真实 / 预测',...state.config.labels]){const th=document.createElement('th');th.textContent=name;header.append(th);}$('confusion').append(header);
  r.test.confusion_matrix.forEach((values,i)=>{const row=document.createElement('tr'),th=document.createElement('th');th.textContent=state.config.labels[i];row.append(th);values.forEach((value,j)=>{const td=document.createElement('td');td.textContent=value;if(i===j)td.className='diagonal';row.append(td);});$('confusion').append(row);});
  for(const item of state.config.failures.slice(0,8)){const box=document.createElement('article');box.className='failure';const img=new Image();img.src='samples/'+item.file;img.alt='模型误判的测试图片';img.loading='lazy';const text=document.createElement('p');text.textContent=`真实：${state.config.labels[state.config.classes.indexOf(item.true)]} → 预测：${state.config.labels[state.config.classes.indexOf(item.predicted)]}（${(item.confidence*100).toFixed(0)}%）`;box.append(img,text);$('failures').append(box);}
  try{const h=await fetch('reports/cnn_history.json');if(h.ok)drawCurve(await h.json());else $('training-chart').parentElement.hidden=true;}catch(e){$('training-chart').parentElement.hidden=true;}
}
function drawCurve(history){const c=$('training-chart'),ctx=c.getContext('2d'),w=c.width,h=c.height,left=45,right=w-45,top=22,bottom=h-32;ctx.clearRect(0,0,w,h);ctx.font='11px sans-serif';const lossmax=Math.ceil(Math.max(...history.map(x=>x.train_loss))*2)/2;for(let i=0;i<=4;i++){const y=bottom-(bottom-top)*i/4;ctx.strokeStyle='#e1e8d7';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle='#6c7c67';ctx.fillText((lossmax*i/4).toFixed(1),8,y+4);ctx.fillText(Math.round(i/4*100)+'%',right+8,y+4);}for(const [key,color,max] of [['train_loss','#5c83a8',lossmax],['validation_accuracy','#4f7c40',1]]){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();history.forEach((row,i)=>{const x=left+(right-left)*i/Math.max(1,history.length-1),y=bottom-row[key]/max*(bottom-top);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();}ctx.fillStyle='#74816b';ctx.fillText('第1轮',left,bottom+21);ctx.fillText('第'+history.length+'轮',right-35,bottom+21);}
async function init(){
  $('upload-tab').onclick=()=>changeMode(false);$('camera-tab').onclick=()=>changeMode(true);
  $('file-input').onchange=e=>window.wasteFiles?window.wasteFiles(Array.from(e.target.files)):readFile(e.target.files[0]);
  const dz=$('dropzone');for(const name of ['dragenter','dragover'])dz.addEventListener(name,e=>{e.preventDefault();dz.classList.add('dragover');});
  for(const name of ['dragleave','drop'])dz.addEventListener(name,e=>{e.preventDefault();dz.classList.remove('dragover');});dz.addEventListener('drop',e=>window.wasteFiles?window.wasteFiles(Array.from(e.dataTransfer.files)):readFile(e.dataTransfer.files[0]));
  // Prevent accidental navigation when a file is dropped outside the drop zone.
  window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
  $('clear').onclick=clearImage;$('camera-start').onclick=startCamera;$('camera-stop').onclick=()=>{stopCamera();message('摄像头已关闭。');};$('capture').onclick=capture;
  $('classify').onclick=classify;$('retry').onclick=()=>{message('');initWorker();};$('download-result').onclick=saveResult;
  window.addEventListener('pagehide',stopCamera);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
  if(location.protocol==='file:'){failModel('请双击“启动垃圾分类.cmd”启动，直接打开 HTML 文件无法加载模型或使用摄像头。');return;}
  try{const response=await fetch('config.json');if(!response.ok)throw new Error('Missing config');state.config=await response.json();
    const m=state.config.metrics;$('metric-accuracy').textContent=(m.accuracy*100).toFixed(1)+'%';$('metric-f1').textContent=m.macro_f1.toFixed(3);$('metric-count').textContent=m.test_count;
    sampleButtons();initWorker();loadReport().catch(()=>{document.querySelector('.method-content').append(document.createTextNode('实验明细暂时无法读取。'));});
  }catch(e){failModel('项目文件不完整，请先完成训练与导出，并检查 config.json 是否存在。');}
}
init();
