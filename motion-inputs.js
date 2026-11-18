'use strict';
class WindowMotionTracker {
 constructor(){this.reset();}
 reset(){this.last=null;this.velocity={x:0,y:0};}
 sample(s){
  if(!s.active||![s.x,s.y,s.width,s.height,s.time].every(Number.isFinite)){this.reset();return null;}
  const old=this.last;this.last=s;if(!old)return null;const dt=s.time-old.time,dx=s.x-old.x,dy=s.y-old.y;
  if(dt<16)return null;
  // Ignore snapping, monitor changes and restored/maximized window geometry.
  if(Math.abs(dx)>300||Math.abs(dy)>300||Math.abs(s.width-old.width)>3||Math.abs(s.height-old.height)>3){this.velocity={x:0,y:0};return null;}
  // Some systems pause page timers while the native title bar is held.
  if(dt>300){this.velocity={x:0,y:0};return dx||dy?{x:Math.max(-8,Math.min(8,-dx*.04)),y:Math.max(-6,Math.min(6,-dy*.04)),moved:true}:null;}
  const vx=dx/dt,vy=dy/dt,ax=vx-this.velocity.x,ay=vy-this.velocity.y;this.velocity={x:vx,y:vy};
  if(Math.abs(ax)+Math.abs(ay)<.008)return null;
  return {x:Math.max(-18,Math.min(18,-ax*16)),y:Math.max(-14,Math.min(14,-ay*16)),moved:dx!==0||dy!==0};
 }
}
class DeviceMotionInput {
 constructor(env,onForce,onStatus,isActive){this.env=env;this.onForce=onForce;this.onStatus=onStatus;this.isActive=isActive;this.handler=null;this.timer=null;this.pending=false;this.generation=0;this.baseline=null;}
 stop(note){this.generation++;if(this.handler)this.env.removeEventListener('devicemotion',this.handler);this.handler=null;this.env.clearTimeout(this.timer);this.timer=null;this.baseline=null;if(note)this.onStatus(note);}
 async start(){
  if(this.pending||this.handler)return;
  const env=this.env,Type=env.DeviceMotionEvent;
  if(!env.isSecureContext||!Type){this.onStatus('当前设备或浏览器不支持机身运动感应，请使用窗口或鼠标晃动。');return;}
  this.pending=true;const generation=++this.generation;
  try{if(typeof Type.requestPermission==='function'&&await Type.requestPermission()!=='granted'){if(generation===this.generation)this.onStatus('未获得运动感应权限，窗口和鼠标晃动仍然可用。');return;}
   if(generation!==this.generation)return;
   let seen=false;
   this.handler=e=>{
    let ax=e.acceleration?.x,ay=e.acceleration?.y;
    if(!Number.isFinite(ax)||!Number.isFinite(ay)){
     const a=e.accelerationIncludingGravity;if(!Number.isFinite(a?.x)||!Number.isFinite(a?.y))return;
     if(!this.baseline)this.baseline={x:a.x,y:a.y};this.baseline.x=this.baseline.x*.96+a.x*.04;this.baseline.y=this.baseline.y*.96+a.y*.04;ax=a.x-this.baseline.x;ay=a.y-this.baseline.y;
    }
    if(!seen){seen=true;env.clearTimeout(this.timer);this.onStatus('已连接运动传感器，晃动机身即可产生惯性。');}
    if(!this.isActive()){this.baseline=null;return;}
    const angle=(env.screen?.orientation?.angle||0)*Math.PI/180,x=ax*Math.cos(angle)-ay*Math.sin(angle),y=ax*Math.sin(angle)+ay*Math.cos(angle);
    if(Math.hypot(x,y)>.25)this.onForce(Math.max(-16,Math.min(16,-x*.7)),Math.max(-12,Math.min(12,y*.7)));
   };
   env.addEventListener('devicemotion',this.handler);this.onStatus('正在等待机身运动数据…');this.timer=env.setTimeout(()=>{if(!seen)this.stop('没有收到运动传感器数据。这台电脑请使用窗口或鼠标晃动。');},6000);
  }catch(e){if(generation===this.generation)this.stop('无法启用运动感应，窗口和鼠标晃动仍然可用。');}
  finally{this.pending=false;}
 }
}
globalThis.WindowMotionTracker=WindowMotionTracker;globalThis.DeviceMotionInput=DeviceMotionInput;
