'use strict';
// All positions use the original 800 x 520 machine coordinate system.
class WastePhysics {
 constructor(M){this.M=M;this.engine=M.Engine.create({enableSleeping:true,positionIterations:8,velocityIterations:8});this.accumulator=0;this.shock={x:0,y:0};this.items=[];this.reset([]);}
 reset(items){const M=this.M;M.Composite.clear(this.engine.world,false);M.Engine.clear(this.engine);this.accumulator=0;this.shock={x:0,y:0};this.items=items;
  M.Composite.add(this.engine.world,[M.Bodies.rectangle(400,470,800,36,{isStatic:true}),M.Bodies.rectangle(14,245,28,450,{isStatic:true}),M.Bodies.rectangle(786,245,28,450,{isStatic:true}),M.Bodies.rectangle(400,25,800,30,{isStatic:true})]);
  for(const item of items){const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(40,40):document.createElement('canvas');c.width=40;c.height=40;const ctx=c.getContext('2d');ctx.drawImage(item.sprite,0,0,40,40);const pixels=ctx.getImageData(0,0,40,40).data,points=[];
   for(let y=0;y<40;y+=2)for(let x=0;x<40;x+=2)if(pixels[(y*40+x)*4+3]>100)points.push({x:(x/40-.5)*item.w,y:(y/40-.5)*item.h});
   let hull=points.length>=3?M.Vertices.hull(points):[];if(hull.length<3||M.Vertices.area(hull)<1)hull=[{x:-item.w/2,y:-item.h/2},{x:item.w/2,y:-item.h/2},{x:item.w/2,y:item.h/2},{x:-item.w/2,y:item.h/2}];
   item.offset=M.Vertices.centre(hull);item.body=M.Bodies.fromVertices(item.x,item.y,[hull],{friction:.5,frictionStatic:.8,frictionAir:.009,restitution:.22,density:.002},true);M.Body.setAngle(item.body,item.angle||0);M.Composite.add(this.engine.world,item.body);
  }
 }
 hold(item){const {Body}=this.M;Body.setStatic(item.body,true);item.body.collisionFilter.mask=0;Body.setVelocity(item.body,{x:0,y:0});Body.setAngularVelocity(item.body,0);}
 pin(item){this.M.Body.setPosition(item.body,{x:item.x,y:item.y});this.M.Body.setAngle(item.body,item.angle);}
 remove(item){if(item.body)this.M.Composite.remove(this.engine.world,item.body);this.items=this.items.filter(i=>i!==item);}
 shake(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return;this.shock.x=Math.max(-20,Math.min(20,this.shock.x+x));this.shock.y=Math.max(-16,Math.min(16,this.shock.y+y));for(const i of this.items)if(!i.body.isStatic)this.M.Sleeping.set(i.body,false);}
 step(seconds){const M=this.M;this.accumulator=Math.min(.1,this.accumulator+seconds);while(this.accumulator>=1/60){
   for(const item of this.items){const b=item.body;if(b.isStatic)continue;if(Math.abs(this.shock.x)+Math.abs(this.shock.y)>.02)M.Body.applyForce(b,b.position,{x:b.mass*this.shock.x*.00023,y:b.mass*this.shock.y*.00023});
    const speed=Math.hypot(b.velocity.x,b.velocity.y);if(speed>22)M.Body.setVelocity(b,{x:b.velocity.x*22/speed,y:b.velocity.y*22/speed});
   }
   M.Engine.update(this.engine,1000/60);this.shock.x*=.9;this.shock.y*=.9;this.accumulator-=1/60;
  }
  for(const item of this.items){if(item.body.isStatic)continue;item.x=item.body.position.x;item.y=item.body.position.y;item.angle=item.body.angle;}
 }
}
globalThis.WastePhysics=WastePhysics;
