'use strict';
importScripts('./vendor/ort.wasm.min.js');
ort.env.wasm.wasmPaths = new URL('./vendor/', self.location.href).href;
ort.env.wasm.numThreads = 1;
let session;
async function load() {
  if (!session) session = await ort.InferenceSession.create(new URL('./models/trashnet.onnx', self.location.href).href, {executionProviders:['wasm'], graphOptimizationLevel:'all'});
  return session;
}
self.onmessage = async ({data}) => {
  try {
    const model = await load();
    if (data.type === 'load') { postMessage({type:'ready'}); return; }
    if (data.type !== 'predict') return;
    const t = performance.now();
    const output = await model.run({image: new ort.Tensor('float32', data.tensor, [1,3,224,224])});
    const logits = Array.from(output.logits.data);
    const top = Math.max(...logits);
    const exps = logits.map(x=>Math.exp(x-top));
    const total = exps.reduce((a,b)=>a+b,0);
    postMessage({type:'result', id:data.id, probabilities:exps.map(x=>x/total), logits, elapsed:performance.now()-t});
  } catch(e) { session = null; postMessage({type:'error',id:data.id,message:String(e.message||e)}); }
};
