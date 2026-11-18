'use strict';
(() => {
 const el=id=>document.getElementById(id),copy=source=>{const c=document.createElement('canvas');const s=Math.min(1,1000/Math.max(source.width,source.height));c.width=Math.round(source.width*s);c.height=Math.round(source.height*s);c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c;};
 let worker,serial=0,chain=Promise.resolve(),pending=0,epoch=0,current=null,boxStart=null,selecting=false,liveRunning=false,lastLive=0,stable='',stableCount=0;
 const candidates=[],collection=[];let uid=0;
 const status=t=>el('extract-status').textContent=t;
 function rpc(source,live=false){
  const job=async()=>{
   if(!worker)worker=new Worker('./vision-worker.js');
   const image=await createImageBitmap(source),id=++serial;
   return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{worker.terminate();worker=null;reject(new Error('处理超时，请重试，或缩小照片。'));},90000);
    worker.onmessage=({data})=>{if(data.id!==id)return;clearTimeout(timeout);data.error?reject(new Error(data.error)):resolve(data);};
    worker.onerror=()=>{clearTimeout(timeout);worker.terminate();worker=null;reject(new Error('图像模型无法运行，请使用新版 Chrome / Edge 并重新尝试。'));};
    worker.postMessage({id,image,live},[image]);
   });
  };
  const result=chain.then(job);chain=result.catch(()=>{});return result;
 }
 function label(probabilities){
  if(!state.config)return '等待分类模型';
  const order=probabilities.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v),a=order[0],uncertain=a.v<state.config.confidence_threshold||a.v-order[1].v<state.config.margin_threshold;
  return `${uncertain?'待确认 · ':''}${state.config.labels[a.i]} ${Math.round(a.v*100)}%`;
 }
 function card(item,remove,confirm){
  const article=document.createElement('article'),canvas=document.createElement('canvas');canvas.width=150;canvas.height=120;
  const ctx=canvas.getContext('2d'),s=Math.min(130/item.sprite.width,100/item.sprite.height);ctx.drawImage(item.sprite,(150-item.sprite.width*s)/2,(120-item.sprite.height*s)/2,item.sprite.width*s,item.sprite.height*s);
  const p=document.createElement('p');p.textContent=label(item.probabilities);article.append(canvas,p);
  if(confirm){const b=document.createElement('button');b.className='secondary';b.textContent='确认加入';b.onclick=confirm;article.append(b);}
  if(remove){const b=document.createElement('button');b.className='text-button';b.textContent='移除';b.onclick=remove;article.append(b);}
  return article;
 }
 function render(){
  el('cutout-list').replaceChildren();el('collected-items').replaceChildren();
  candidates.forEach(item=>el('cutout-list').append(card(item,()=>{candidates.splice(candidates.indexOf(item),1);item.sprite.close();render();},()=>{collection.push(item);candidates.splice(candidates.indexOf(item),1);render();})));
  collection.forEach(item=>el('collected-items').append(card(item,()=>{if(game.phase!=='idle')return;collection.splice(collection.indexOf(item),1);for(const old of game.items)if(old.id===item.id)physics.remove(old);game.items=game.items.filter(i=>i.id!==item.id);if(collection.length<2)el('claw-game').hidden=true;render();},null)));
  el('collection-count').textContent=`${collection.length} 件已确认`;el('confirm-all').disabled=!candidates.length;
  el('open-game').disabled=collection.length<2||game.phase!=='idle';el('open-game').textContent=collection.length<2?'至少收集两件后开启抓娃娃机':`把 ${collection.length} 件物品放入抓娃娃机`;
 }
 async function extract(source,manual=false,revision=null){
  if(revision!==null)setSceneAnalysis(revision,"pending");
  const ticket=epoch;pending++;status('正在提取轮廓并逐件识别…首次需要加载抠图模型，请稍候。');
  try{
   const result=await rpc(source);if(revision!==null)setSceneAnalysis(revision,"ready",result.items);
   if(ticket!==epoch){result.items.forEach(i=>i.sprite.close());return;}
   let added=0;
   for(const item of result.items){
    const probe=document.createElement('canvas');probe.width=32;probe.height=32;const pc=probe.getContext('2d');pc.drawImage(item.sprite,0,0,32,32);const pixels=pc.getImageData(0,0,32,32).data;let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619);item.hash=hash;
    if(candidates.length+collection.length>=24||[...candidates,...collection].some(i=>i.hash===hash)){item.sprite.close();continue;}item.id=++uid;candidates.push(item);added++;
   }
   if(!result.items.length)status(manual?'框内未提取到清楚的主体，请重新框选或换背景拍摄。':'没有提取到清楚的主体，可框选一件物品重试，或换成简单背景。');
   else status(`本次提取 ${result.items.length} 件，新增 ${added} 件候选（重复图片跳过，最多保留24件）。请检查后确认加入；粘连物品可分别框选。`);
   render();
  }catch(e){if(revision!==null)setSceneAnalysis(revision,'error');status('提取失败：'+e.message);}finally{pending--;}
 }
 window.addEventListener('waste-image',e=>{current=copy(e.detail.canvas);el('extract-now').disabled=false;el('select-box').disabled=false;extract(copy(current),false,e.detail.revision);});
 window.wasteFiles=async files=>{
  const list=files.filter(f=>f.size<=20*1024*1024&&(/\.(jpe?g|png|webp|bmp)$/i.test(f.name)||/^image\/(jpeg|png|webp|bmp)$/.test(f.type))).slice(0,12);
  if(!list.length){message('请上传 JPG、PNG、WebP 或 BMP，每张不超过20 MB。');return;}
  if(list.length!==files.length)message('部分文件格式不支持、超过20 MB，或超过单次12张上限。');
  for(const f of list){const url=URL.createObjectURL(f);try{const im=new Image();im.src=url;await im.decode();putImage(im,f.name);}catch(e){status('无法读取：'+f.name);}finally{URL.revokeObjectURL(url);}}
  el('file-input').value='';
 };
 el('extract-now').onclick=()=>{if(current)extract(copy(current),false,state.imageRevision);};
 function endSelection(){selecting=false;boxStart=null;el('select-box').setAttribute('aria-pressed','false');el('box-tip').hidden=true;el('cancel-box').hidden=true;el('preview').classList.remove('selecting');}
 el('select-box').onclick=()=>{selecting=true;el('select-box').setAttribute('aria-pressed','true');el('box-tip').hidden=false;el('cancel-box').hidden=false;el('preview').classList.add('selecting');el('preview').scrollIntoView({block:'center',behavior:'instant'});};
 el('cancel-box').onclick=endSelection;
 const preview=el('preview'),point=e=>{const r=preview.getBoundingClientRect();return {x:Math.max(0,Math.min(preview.width,(e.clientX-r.left)/r.width*preview.width)),y:Math.max(0,Math.min(preview.height,(e.clientY-r.top)/r.height*preview.height))};};
 preview.addEventListener('pointerdown',e=>{if(!selecting)return;e.preventDefault();boxStart=point(e);preview.setPointerCapture(e.pointerId);});
 preview.addEventListener('pointermove',e=>{if(!boxStart||!current)return;const p=point(e),ctx=preview.getContext('2d');ctx.drawImage(current,0,0,preview.width,preview.height);ctx.strokeStyle='#ef8d36';ctx.lineWidth=4;ctx.strokeRect(boxStart.x,boxStart.y,p.x-boxStart.x,p.y-boxStart.y);});
 preview.addEventListener('pointerup',e=>{
  if(!boxStart||!current)return;const p=point(e),s=boxStart,x=Math.min(p.x,s.x),y=Math.min(p.y,s.y),w=Math.abs(p.x-s.x),h=Math.abs(p.y-s.y);endSelection();preview.getContext('2d').drawImage(current,0,0,preview.width,preview.height);
  if(w<15||h<15){status('框选范围太小，请拖动框住一件物品。');return;}
  const c=document.createElement('canvas');c.width=Math.round(w);c.height=Math.round(h);c.getContext('2d').drawImage(preview,x,y,w,h,0,0,c.width,c.height);extract(c,true);
 });
 preview.addEventListener('pointercancel',()=>{endSelection();if(current)preview.getContext('2d').drawImage(current,0,0,preview.width,preview.height);});
 el('clear').addEventListener('click',()=>{current=null;endSelection();el('select-box').disabled=true;el('extract-now').disabled=true;});
 el('confirm-all').onclick=()=>{collection.push(...candidates.splice(0));render();};
 el('clear-collection').onclick=()=>{epoch++;candidates.forEach(i=>i.sprite.close());candidates.length=0;collection.length=0;game.items=[];game.prizes=[];game.phase='idle';physics.reset([]);stopDrag();clearInterval(shakePulse);sorter.flight=null;sorter.counts.fill(0);el('claw-game').hidden=true;el('prizes').replaceChildren();status('收集区已清空。');render();};
 // Serial inference: never build a queue of camera frames. Still photos take priority.
 async function live(){
  const video=el('video'),overlay=el('live-overlay');
  if(state.stream&&el('live-enable').checked&&!document.hidden&&video.readyState>=2&&!liveRunning&&!pending&&performance.now()-lastLive>650){
   liveRunning=true;lastLive=performance.now();const stream=state.stream;
   try{
    const source=document.createElement('canvas');const s=Math.min(1,1000/video.videoWidth);source.width=Math.round(video.videoWidth*s);source.height=Math.round(video.videoHeight*s);source.getContext('2d').drawImage(video,0,0,source.width,source.height);
    const result=await rpc(source,true);
    if(stream!==state.stream||!el('live-enable').checked||document.hidden)return;
    overlay.width=video.videoWidth;overlay.height=video.videoHeight;const ctx=overlay.getContext('2d');ctx.font=`bold ${Math.max(15,overlay.width/40)}px sans-serif`;ctx.lineWidth=Math.max(2,overlay.width/350);
    const signature=result.items.map(i=>i.probabilities.indexOf(Math.max(...i.probabilities))).join(',')||'single';stableCount=signature===stable?stableCount+1:1;stable=signature;
    for(const item of result.items){const b=item.box,x=b.x*overlay.width,y=b.y*overlay.height,w=b.w*overlay.width,h=b.h*overlay.height;ctx.strokeStyle='#dff49c';ctx.strokeRect(x,y,w,h);const text=stableCount<2?'正在确认…':label(item.probabilities);ctx.fillStyle='#123c30';ctx.fillRect(x,Math.max(0,y-30),Math.min(overlay.width-x,ctx.measureText(text).width+16),30);ctx.fillStyle='#fff';ctx.fillText(text,x+5,Math.max(23,y-8));}
    el('live-label').textContent=result.items.length?`${result.items.length} 件候选物品`:'单件画面预测';
    el('live-status').textContent=result.items.length?`实时预测 · ${result.items.length} 件候选。背景物品也可能被选中，拍照后请确认。`:`未分离出主体；整幅画面预测：${result.single?label(result.single):'待确认'}。请将物品分开放在简单背景上。`;
   }catch(e){el('live-status').textContent='实时识别暂不可用：'+e.message;el('live-enable').checked=false;}
   finally{liveRunning=false;}
  }
  if(!state.stream||!el('live-enable').checked){overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);stable='';stableCount=0;}
 }
 window.addEventListener('waste-camera-stopped',()=>{const c=el('live-overlay');c.getContext('2d').clearRect(0,0,c.width,c.height);el('live-label').textContent='本机预览';el('live-status').textContent='摄像头已关闭，重新开启即可继续实时识别。';stable='';stableCount=0;});
 setInterval(live,250);
 // Fixed-step rigid-body simulation, shared by dragging and optional device motion.
 const game={items:[],prizes:[],phase:'idle',x:400,y:85,held:null,start:0,axis:0,last:0};
 const gc=el('game-canvas'),ctx=gc.getContext('2d'),physics=new WastePhysics(Matter);
 function startGame(){if(collection.length<2)return;pauseShaking();game.items=collection.map((item,i)=>({...item,x:100+(i%7)*94,y:170-Math.floor(i/7)*85,vy:0,w:Math.min(85,85*item.sprite.width/item.sprite.height),h:Math.min(85,85*item.sprite.height/item.sprite.width),angle:(i%3-1)*.14}));game.prizes=[];physics.reset(game.items);sorter.flight=null;sorter.counts.fill(0);sorter.flash=null;el('sort-status').textContent='抓到物品后，会沿滑道进入对应材质桶。';game.phase='idle';game.held=null;game.x=400;game.y=85;el('claw-game').hidden=false;el('prizes').replaceChildren();el('game-score').textContent='已抓到 0 件';el('game-message').textContent='对准物品，再按抓取。';el('grab').disabled=false;gc.scrollIntoView({block:'center'});render();}
 el('open-game').onclick=startGame;el('restart-game').onclick=()=>{if(game.phase==='idle')startGame();};
 function grab(){if(game.phase!=='idle'||!game.items.length)return;game.phase='down';game.start=performance.now();game.held=null;el('grab').disabled=true;el('restart-game').disabled=true;el('game-message').textContent='爪子下降中…';render();}
 el('grab').onclick=grab;
 for(const [id,axis] of [['move-left',-1],['move-right',1]]){const button=el(id);button.style.touchAction='none';button.onpointerdown=e=>{button.setPointerCapture(e.pointerId);game.axis=axis;};button.onpointerup=button.onpointercancel=()=>game.axis=0;}
 gc.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight',' '].includes(e.key)){e.preventDefault();if(e.key===' ')grab();else game.axis=e.key==='ArrowLeft'?-1:1;}});gc.addEventListener('keyup',()=>game.axis=0);gc.addEventListener('blur',()=>game.axis=0);window.addEventListener('blur',()=>game.axis=0);
 function draw(time){
  const dt=Math.min(.035,(time-(game.last||time))/1000);game.last=time;
  if(!el('claw-game').hidden){
   if(game.phase==='idle')game.x=Math.max(65,Math.min(735,game.x+game.axis*260*dt));
   physics.step(dt);
   if(game.phase==='down'){
    game.y+=230*dt;const target=game.items.filter(i=>{const b=i.body.bounds;return game.x>=b.min.x-18&&game.x<=b.max.x+18&&b.min.y<=game.y+32&&b.max.y>=game.y-12;}).sort((a,b)=>a.body.bounds.min.y-b.body.bounds.min.y)[0];
    if(target||game.y>=420){game.held=target||null;if(target)physics.hold(target);game.phase='up';el('game-message').textContent=target?'抓住了，正在提升…':'没有对准，换个位置再试。';}
   }else if(game.phase==='up'){game.y=Math.max(85,game.y-230*dt);if(game.y===85)game.phase=game.held?'return':'idle';}
   else if(game.phase==='return'){game.x=Math.max(65,game.x-300*dt);if(game.x===65){game.phase='release';game.start=time;}}
   else if(game.phase==='release'){
    game.held.y+=500*dt;
    if(game.held.y>505){physics.remove(game.held);beginSort(game.held,time);game.phase='sorting';}
   }
   if(game.held&&!['release','sorting'].includes(game.phase)){game.held.x=game.x;game.held.y=game.y+28;physics.pin(game.held);}
   if(game.phase==='idle'){el('grab').disabled=!game.items.length;el('restart-game').disabled=false;el('open-game').disabled=collection.length<2;}
   ctx.clearRect(0,0,800,520);const bg=ctx.createLinearGradient(0,0,0,520);bg.addColorStop(0,'#dceee1');bg.addColorStop(1,'#f5edce');ctx.fillStyle=bg;ctx.fillRect(0,0,800,520);
   ctx.fillStyle='#244f40';ctx.fillRect(0,0,800,30);ctx.fillStyle='#dff49c';ctx.font='14px sans-serif';ctx.fillText('真实照片 · 再抓一下',24,21);
   ctx.strokeStyle='#b6cbb7';ctx.lineWidth=2;ctx.strokeRect(28,40,744,420);ctx.fillStyle='#c4d6ba';ctx.fillRect(28,452,744,12);
   ctx.fillStyle='#175b45';ctx.fillRect(26,422,85,42);ctx.fillStyle='#fff';ctx.font='13px sans-serif';ctx.fillText('收集出口',41,448);
   for(const item of game.items){if(game.phase==='sorting'&&item===game.held)continue;ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.angle);ctx.shadowColor='#123c3033';ctx.shadowBlur=8;ctx.shadowOffsetY=5;ctx.drawImage(item.sprite,-item.w/2-(item.offset?.x||0),-item.h/2-(item.offset?.y||0),item.w,item.h);ctx.restore();}
   ctx.strokeStyle='#426455';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(game.x,30);ctx.lineTo(game.x,game.y);ctx.stroke();ctx.fillStyle='#175b45';ctx.fillRect(game.x-18,game.y-6,36,17);
   const spread=game.held?14:30;ctx.strokeStyle='#175b45';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(game.x-12,game.y+8);ctx.lineTo(game.x-spread,game.y+28);ctx.lineTo(game.x-9,game.y+42);ctx.moveTo(game.x+12,game.y+8);ctx.lineTo(game.x+spread,game.y+28);ctx.lineTo(game.x+9,game.y+42);ctx.stroke();
   ctx.fillStyle='#175b45';ctx.fillRect(0,475,800,45);ctx.fillStyle='#dff49c';ctx.font='18px sans-serif';ctx.fillText('RE:CATCH',30,504);ctx.font='12px sans-serif';ctx.fillText('← → 移动 / 空格抓取',610,503);
  }
  if(!el('claw-game').hidden)drawSorter(time);
  requestAnimationFrame(draw);
 }
  const shell=el('machine-shell');let dragging=null,shakePulse=null;
 function stopDrag(){dragging=null;shell.style.transform='';shell.classList.remove('shaking');}
 for(const surface of [gc,el('shake-handle')]){
  surface.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();surface.setPointerCapture(e.pointerId);dragging={id:e.pointerId,x:e.clientX,y:e.clientY};shell.classList.add('shaking');gc.focus({preventScroll:true});});
  surface.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragging.id)return;const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;dragging.x=e.clientX;dragging.y=e.clientY;physics.shake(-dx*.22,-dy*.22);shell.style.transform=`translate(${Math.max(-12,Math.min(12,dx*.5))}px,${Math.max(-6,Math.min(6,dy*.3))}px) rotate(${Math.max(-1,Math.min(1,dx*.04))}deg)`;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,stopDrag);
 }
 function shakeMachine(){if(el('claw-game').hidden)return;clearInterval(shakePulse);let n=0;physics.shake(18,-10);shakePulse=setInterval(()=>{if(el('claw-game').hidden||document.hidden||++n>6){clearInterval(shakePulse);stopDrag();return;}const s=n%2?1:-1;physics.shake(s*16,-6);shell.style.transform=`translate(${s*6}px,0) rotate(${s*.6}deg)`;},130);}
 el('shake-machine').onclick=shakeMachine;el('shake-handle').addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();shakeMachine();}});
 function pauseShaking(){stopDrag();clearInterval(shakePulse);physics.shock={x:0,y:0};}
 window.addEventListener('blur',pauseShaking);document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseShaking();});window.addEventListener('pagehide',pauseShaking);


 const binNames=['纸板','玻璃','金属','纸张','塑料','其他','待确认'];
 const binColors=['#ad7542','#4b9c89','#6383a7','#a7944d','#508cad','#74776f','#b27b41'];
 const sorter={flight:null,counts:Array(7).fill(0),flash:null};
 const sc=el('sort-canvas'),sx=sc.getContext('2d');
 function beginSort(item,time){
  const ranked=item.probabilities.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v),a=ranked[0];
  const uncertain=a.v<state.config.confidence_threshold||a.v-ranked[1].v<state.config.margin_threshold;
  const bin=uncertain?6:a.i;sorter.flight={item,bin,start:time};
  el('sort-status').textContent=uncertain?'预测不确定，物品送往待确认区。':`正在送往${binNames[bin]}材质桶…`;
  el('game-message').textContent='物品进入分拣滑道，等待入桶…';sc.scrollIntoView({block:'center',behavior:'smooth'});
 }
 function drawSorter(time){
  const f=sorter.flight,p=f?Math.min(1,(time-f.start)/1800):0;
  sx.clearRect(0,0,800,250);sx.fillStyle='#f3f7ed';sx.fillRect(0,0,800,250);
  // The chute branches toward the material bin selected by the classifier.
  sx.lineCap='round';sx.lineWidth=11;sx.strokeStyle='#d2dfcc';sx.beginPath();sx.moveTo(65,0);sx.lineTo(65,32);sx.lineTo(735,32);sx.stroke();
  for(let i=0;i<7;i++){
   const x=15+i*112,cx=x+49,active=f?.bin===i,flash=sorter.flash?.bin===i&&time-sorter.flash.time<1000;
   sx.strokeStyle=active?'#d7b64e':'#d2dfcc';sx.lineWidth=7;sx.beginPath();sx.moveTo(cx,32);sx.lineTo(cx,113);sx.stroke();
   if(active||flash){sx.fillStyle='#e0edaa';sx.beginPath();sx.ellipse(cx,195,55,13,0,0,Math.PI*2);sx.fill();}
   sx.fillStyle=binColors[i];sx.fillRect(x+9,130,80,74);sx.fillStyle='#ffffff22';sx.fillRect(x+17,138,9,56);
   // Lid swings around its back edge while the cutout approaches the opening.
   const open=active?Math.sin(Math.min(1,p/.65)*Math.PI/2):flash?Math.max(0,1-(time-sorter.flash.time)/450):0;
   sx.save();sx.translate(x+7,126);sx.rotate(-open*.85);sx.fillStyle=binColors[i];sx.fillRect(0,-6,84,9);sx.fillStyle='#ffffff77';sx.fillRect(30,-10,24,5);sx.restore();
   sx.fillStyle='#fff';sx.textAlign='center';sx.font='bold 15px sans-serif';sx.fillText(binNames[i],cx,172);sx.font='12px sans-serif';sx.fillText(sorter.counts[i]+' 件',cx,192);
   sx.fillStyle='#5c7564';sx.font='11px sans-serif';sx.fillText(i===6?'请人工确认':'预测材质',cx,224);
   if(flash){const t=(time-sorter.flash.time)/1000;sx.fillStyle=binColors[i];for(let k=0;k<9;k++){const a=k*Math.PI*2/9;sx.globalAlpha=1-t;sx.fillRect(cx+Math.cos(a)*t*55,120+Math.sin(a)*t*35-t*30,4,4);}sx.globalAlpha=1;}
  }
  sx.textAlign='left';
  if(f){
   const target=64+112*f.bin;let x,y,scale=1;
   if(p<.65){const t=p/.65;x=65+(target-65)*(t*t*(3-2*t));y=15+25*Math.sin(t*Math.PI);}
   else {const t=(p-.65)/.35;x=target;y=15+145*t*t;scale=1-.65*t;}
   sx.save();sx.translate(x,y);sx.rotate(Math.sin(p*Math.PI*4)*.15);const item=f.item,w=item.w*.65*scale,h=item.h*.65*scale;sx.drawImage(item.sprite,-w/2,-h/2,w,h);sx.restore();
   // Front rim occludes the sprite for the last part of the drop.
   if(p>.9){sx.fillStyle=binColors[f.bin];sx.fillRect(target-40,133,80,71);sx.fillStyle='#fff';sx.textAlign='center';sx.font='bold 15px sans-serif';sx.fillText(binNames[f.bin],target,172);sx.textAlign='left';}
   if(p===1){const prize=f.item;sorter.counts[f.bin]++;sorter.flash={bin:f.bin,time};sorter.flight=null;game.items=game.items.filter(i=>i!==prize);game.prizes.push(prize);el('prizes').append(card(prize,null,null));game.held=null;game.phase='idle';el('game-score').textContent=`已抓到 ${game.prizes.length} 件`;el('sort-status').textContent=f.bin===6?'已进入待确认区，请人工确认材质。':`已落入${binNames[f.bin]}材质桶！`;el('game-message').textContent=game.items.length?'投放完成！继续抓下一件。':'全部抓完并分拣！可以重新装入再玩一次。';}
  }
 }

 requestAnimationFrame(draw);render();
})();
