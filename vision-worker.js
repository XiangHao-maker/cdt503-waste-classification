'use strict';
importScripts('./vendor/ort.wasm.min.js');
ort.env.wasm.wasmPaths=new URL('./vendor/',self.location.href).href;
ort.env.wasm.numThreads=1;
let segmenter,classifier,queue=Promise.resolve();
const canvas=(w,h)=>new OffscreenCanvas(w,h);
async function models(){
 if(!segmenter)segmenter=await ort.InferenceSession.create('./models/u2netp.onnx',{executionProviders:['wasm']});
 if(!classifier)classifier=await ort.InferenceSession.create('./models/trashnet.onnx',{executionProviders:['wasm']});
}
async function classify(image){
 const c=canvas(224,224),ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,224,224);
 const s=224/Math.max(image.width,image.height),w=image.width*s,h=image.height*s;ctx.drawImage(image,(224-w)/2,(224-h)/2,w,h);
 const p=ctx.getImageData(0,0,224,224).data,t=new Float32Array(3*224*224);
 for(let i=0;i<224*224;i++)for(let j=0;j<3;j++)t[j*224*224+i]=p[4*i+j]/255;
 const out=await classifier.run({image:new ort.Tensor('float32',t,[1,3,224,224])});
 const values=Array.from(out.logits.data),m=Math.max(...values),e=values.map(v=>Math.exp(v-m)),sum=e.reduce((a,b)=>a+b,0);
 return e.map(v=>v/sum);
}
function components(mask,n){
 const seen=new Uint8Array(n*n),labels=new Int32Array(n*n),regions=[],todo=new Int32Array(n*n);let label=0;
 for(let start=0;start<mask.length;start++){
  if(seen[start]||mask[start]<.45)continue;label++;let head=0,tail=1,count=0,x0=n,y0=n,x1=0,y1=0;todo[0]=start;seen[start]=1;
  while(head<tail){const i=todo[head++],x=i%n,y=(i/n)|0;labels[i]=label;count++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
   for(const j of [x?i-1:-1,x<n-1?i+1:-1,y?i-n:-1,y<n-1?i+n:-1])if(j>=0&&!seen[j]&&mask[j]>=.45){seen[j]=1;todo[tail++]=j;}
  }
  if(count>110&&x1-x0>7&&y1-y0>7&&count<n*n*.92)regions.push({label,count,x0:Math.max(0,x0-2),y0:Math.max(0,y0-2),x1:Math.min(n-1,x1+2),y1:Math.min(n-1,y1+2)});
 }
 return {labels,regions:regions.sort((a,b)=>b.count-a.count).slice(0,12)};
}
async function process(data){
 const image=data.image;try{
  await models();const n=320,c=canvas(n,n),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,n,n);
  const rgba=ctx.getImageData(0,0,n,n).data,tensor=new Float32Array(n*n*3),mean=[.485,.456,.406],std=[.229,.224,.225];let max=1;
  for(let i=0;i<rgba.length;i+=4)max=Math.max(max,rgba[i],rgba[i+1],rgba[i+2]);
  for(let i=0;i<n*n;i++)for(let j=0;j<3;j++)tensor[j*n*n+i]=(rgba[4*i+j]/max-mean[j])/std[j];
  const output=await segmenter.run({[segmenter.inputNames[0]]:new ort.Tensor('float32',tensor,[1,3,n,n])});
  const mask=output[segmenter.outputNames[0]].data,{labels,regions}=components(mask,n),items=[],transfers=[];
  for(const r of regions){
   const x=r.x0/n,y=r.y0/n,w=(r.x1-r.x0+1)/n,h=(r.y1-r.y0+1)/n;
   const crop=canvas(Math.max(1,Math.round(w*image.width)),Math.max(1,Math.round(h*image.height))),cc=crop.getContext('2d');
   cc.drawImage(image,x*image.width,y*image.height,w*image.width,h*image.height,0,0,crop.width,crop.height);
   const probabilities=await classify(crop);const item={box:{x,y,w,h},probabilities};
   if(!data.live){
    const matte=canvas(n,n),mc=matte.getContext('2d'),pixels=mc.createImageData(n,n);
    for(let i=0;i<n*n;i++){pixels.data[4*i]=255;pixels.data[4*i+1]=255;pixels.data[4*i+2]=255;
     // Retain only this connected component, including a soft boundary.
     if(labels[i]===r.label)pixels.data[4*i+3]=Math.round(Math.min(1,mask[i]/.65)*255);
    }
    mc.putImageData(pixels,0,0);cc.globalCompositeOperation='destination-in';cc.drawImage(matte,r.x0,r.y0,r.x1-r.x0+1,r.y1-r.y0+1,0,0,crop.width,crop.height);
    item.sprite=crop.transferToImageBitmap();transfers.push(item.sprite);
   }
   items.push(item);
  }
  // The whole-frame fallback remains explicitly single-object recognition.
  const single=data.live&&items.length===0?await classify(image):null;
  postMessage({id:data.id,items,single},transfers);
 }finally{image.close();}
}
self.onmessage=({data})=>{queue=queue.then(()=>process(data)).catch(e=>postMessage({id:data.id,error:String(e.message||e)}));};
