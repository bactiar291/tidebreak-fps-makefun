// SPDX-License-Identifier: MIT
import * as T from 'three';
import {walls,SITE,floorY} from './map.js';
import {WEAPONS} from './sim.js';
const C={stone:0xD6C3A4,teal:0x326F78,sea:0x326F78,metal:0x273C45,orange:0xD67843,crate:0x9c7654,machine:0x527c7e};
export class View{
  constructor(canvas,s){
    this.s=s;this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.setClearColor(0xc9d8d1);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.13;
    this.scene=new T.Scene();this.scene.fog=new T.Fog(0xc9d8d1,40,112);
    this.camera=new T.PerspectiveCamera(74,1,.06,160);this.camera.rotation.order='YXZ';
    this.scene.add(new T.HemisphereLight(0xeaf4ef,0x756047,2.2));const sun=new T.DirectionalLight(0xffd2a0,3.1);sun.position.set(-25,38,16);this.scene.add(sun);
    this.materials={};this.boxGeo=new T.BoxGeometry(1,1,1);this.cylGeo=new T.CylinderGeometry(1,1,1,12);this.sphereGeo=new T.IcosahedronGeometry(1,1);
    this.world();this.batchStatic();this.people=[];for(let i=0;i<5;i++)this.people.push(this.person(i));
    this.weaponScene=new T.Scene();this.weaponScene.add(new T.HemisphereLight(0xf5eee0,0x344d57,3));this.weaponCamera=new T.PerspectiveCamera(62,1,.02,10);this.weaponRoot=new T.Group();this.weaponScene.add(this.weaponRoot);this.weaponKey='';
    this.effects=[];const tracerMat=new T.MeshBasicMaterial({color:0xffd28a});
    for(let i=0;i<48;i++){const m=new T.Mesh(this.boxGeo,tracerMat);m.visible=false;this.scene.add(m);this.effects.push({mesh:m,life:0});}
    this.smokeMeshes=[];const smokeMat=new T.MeshLambertMaterial({color:0xb2b6aa,transparent:true,opacity:.82,depthWrite:false});
    for(let i=0;i<3;i++){const g=new T.Group();for(let j=0;j<9;j++){const m=new T.Mesh(this.sphereGeo,smokeMat);const angle=j*2.399;m.position.set(Math.cos(angle)*1.4,.6+(j%3)*.55,Math.sin(angle)*1.4);m.scale.set(1.8,1.5,1.8);g.add(m);}this.scene.add(g);this.smokeMeshes.push(g);}
    this.seq=0;this.effectCursor=0;this.tmpA=new T.Vector3();this.tmpB=new T.Vector3();this.lastStamp=0;this.frames=0;this.resize();
  }
  mat(color){const key=String(color);return this.materials[key]??(this.materials[key]=new T.MeshLambertMaterial({color}));}
  box(x,y,z,w,h,d,color,parent=this.scene){const m=new T.Mesh(this.boxGeo,this.mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;}
  cylinder(x,y,z,r,h,color,parent=this.scene){const m=new T.Mesh(this.cylGeo,this.mat(color));m.position.set(x,y,z);m.scale.set(r,h,r);parent.add(m);return m;}
  sign(text,sub,x,y,z,w=4,rotation=0,bg='#273C45'){
    const c=document.createElement('canvas');c.width=512;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,160);ctx.fillStyle='#D67843';ctx.fillRect(0,0,12,160);ctx.fillStyle='#f3ead8';ctx.font='bold 45px monospace';ctx.fillText(text,30,70);ctx.font='20px monospace';ctx.fillStyle='#b8d1ce';ctx.fillText(sub,32,116);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(w,w*160/512),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));m.position.set(x,y,z);m.rotation.y=rotation;this.scene.add(m);return m;
  }
  world(){
    this.box(-15,-.9,0,12,1.8,57,0xb8ab90);
    this.box(8.5,-.9,0,25,1.8,57,0xb8ab90);
    this.box(-6.5,-.9,-21.25,5,1.8,14.5,0xb8ab90);
    this.box(-6.5,-.9,22.75,5,1.8,11.5,0xb8ab90);
    // Continuous canal floor, with actual collision-height ramps represented in the mesh.
    this.box(-6.5,-.7,1.5,5,.1,23,0x708a89);
    for(const [z,angle] of [[-12,Math.atan(.65/4)],[15,-Math.atan(.65/4)]]){const ramp=this.box(-6.5,-.325,z,5,.12,4.05,0x80918b);ramp.rotation.x=angle;}
    this.box(-58,-1.15,-9,73,.15,160,0x4b858c);
    for(let i=0;i<22;i++)this.box(-28-(i%5)*8,-1.05,-50+i*5,5+(i%4)*2,.018,.08,0x95b9b5);
    // Pier planks and expansion seams mark distance without busy textures.
    for(let z=-26;z<28;z+=2){this.box(-15,.005,z,10,.02,.045,0x968f79);this.box(4,.005,z,15,.02,.035,0xa99c83);}
    for(const b of walls){
      this.box(b.x,b.h/2,b.z,b.w,b.h,b.d,C[b.kind]);
      this.box(b.x,b.h+.07,b.z,b.w+.12,.14,b.d+.12,b.kind==='teal'?0x244c55:0xe8dac2);
      if(b.kind==='crate'){
        for(const x of [-.35,.35])this.box(b.x+x*b.w,b.h/2,b.z+b.d/2+.025,.1,b.h,.05,0x483f35);
        this.box(b.x,b.h*.68,b.z+b.d/2+.04,b.w,.12,.04,0xD67843);
      }
      if(b.kind==='machine'){
        for(let i=0;i<5;i++)this.box(b.x-b.w*.33+i*b.w*.16,b.h*.6,b.z+b.d/2+.025,.08,b.h*.45,.05,0x273c45);
        this.box(b.x,.17,b.z+b.d/2+.05,b.w,.22,.08,0xd67843);
      }
    }
    // Pump hall roof, skylight gaps, structural ribs and a visible industrial interior.
    this.box(12.5,4.85,7,12,.25,20,0x334f56);
    for(let z=-2;z<18;z+=4){this.box(12.5,4.55,z,11,.25,.22,0x9a8463);this.box(7.6,2.2,z,.22,4.4,.22,0x273c45);}
    this.box(12.5,4.72,9,2.6,.03,12,0xb1c9bd);
    this.sign('PUMP HALL','02 / INTAKE + FILTRATION',12,3.4,17.53,5);
    this.sign('RELAY 01','AUTHORIZED SERVICE ONLY',3,3,-27.43,6);
    this.sign('SEAWARD','PIER / KEEP CLEAR',-20.45,2.4,8,3,-Math.PI/2);
    this.sign('GENERATOR','COURT / 03',7,2.95,-8,4);
    this.sign('LOWER CANAL','RELAY ACCESS  →',-8,1.3,18.6,3.2);
    this.sign('TIDEBREAK','COASTAL WATER AUTHORITY',19.4,3.4,23,4,-Math.PI/2);
    this.sign('01','RELAY',3,2.55,-22,2.4);
    // Main relay console and antennas. The console sits outside the usable planting circle.
    this.box(3,.7,-21,2.2,1.4,.65,0x273c45);this.box(3,1.13,-20.65,1.6,.38,.04,0x7caca8);
    for(let i=0;i<5;i++)this.box(2.5+i*.25,.8,-20.64,.08,.08,.04,0xd67843);
    this.cylinder(1,6.7,-24,.11,10,0x273c45);this.box(1,10.6,-24,4,.1,.1,0x273c45);
    for(let x=-.5;x<3;x+=.75)this.box(x,10.6,-24,.07,1.3,.07,0x273c45);
    const ring=new T.Mesh(new T.RingGeometry(2.35,2.48,48),new T.MeshBasicMaterial({color:0xD67843,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(SITE.x,.025,SITE.z);this.scene.add(ring);
    this.relayLamp=this.box(3,1.6,-21,.18,.18,.18,0xd67843);
    // Tall intake tanks make the station silhouette; ornamental shapes stay outside walkable space.
    for(const z of [-18,-6,8]){this.cylinder(24,4,z,2.6,8,0x739597);this.cylinder(24,8.2,z,2.8,.25,0x273c45);for(let y=1;y<8;y+=2)this.cylinder(24,y,z,2.64,.07,0x273c45);}
    for(let z=-23;z<26;z+=5){this.box(-20.3,1,z,.12,.9,.12,0x273c45);this.box(-20.3,1.4,z,.12,.1,5,0x273c45);}
    // Pump pipes, valves, inspection lights and hazard markings.
    for(const x of [9,17]){const pipe=this.cylinder(x,3.7,7,.16,17,0xd67843);pipe.rotation.x=Math.PI/2;for(let z=0;z<17;z+=4)this.box(x,3.7,z,.45,.5,.1,0x273c45);}
    for(let i=0;i<8;i++){const stripe=this.box(4.8+i*.38,.027,-15.4,.19,.025,1,0xD67843);stripe.rotation.y=-.45;}
    for(let z=-20;z<=20;z+=10){this.box(-11,3.4,z,.13,6.8,.13,0x273c45);this.box(-10.2,6.7,z,1.7,.13,.16,0x273c45);this.box(-9.5,6.5,z,.6,.16,.4,0xe8d9ad);}
    for(let i=0;i<7;i++){this.box(0,.03,18-i*4,.1,.025,1.1,0xe4d7bd);}
    // Distant breakwater and low cliffs give sea-facing views a horizon.
    for(let i=0;i<12;i++)this.box(-60+i*6,1.5,-65-(i%3)*3,7,3+(i%3)*2,7,0x9ca59a);
  }
  batchStatic(){
    const groups=new Map();
    for(const mesh of this.scene.children){if(!mesh.isMesh||mesh===this.relayLamp||(mesh.geometry!==this.boxGeo&&mesh.geometry!==this.cylGeo))continue;const key=mesh.geometry.id+':'+mesh.material.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);}
    for(const meshes of groups.values()){const batch=new T.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);for(let i=0;i<meshes.length;i++){meshes[i].updateMatrix();batch.setMatrixAt(i,meshes[i].matrix);this.scene.remove(meshes[i]);}batch.computeBoundingSphere();this.scene.add(batch);}
  }
  person(id){
    const g=new T.Group(),ally=id<2,color=ally?0x407f88:0xbf6b43;this.scene.add(g);
    this.box(0,.9,0,.48,.64,.3,color,g);this.box(0,1.05,-.19,.42,.35,.08,0x273c45,g);
    this.box(0,.6,0,.4,.2,.29,0x273c45,g);
    const head=this.box(0,1.52,0,.32,.35,.32,0xd0b28d,g);this.box(0,1.66,0,.38,.17,.37,0x273c45,g);this.box(0,1.53,-.173,.27,.09,.04,0x637f80,g);
    const legs=[this.box(-.14,.29,0,.17,.56,.21,0x384d53,g),this.box(.14,.29,0,.17,.56,.21,0x384d53,g)];
    this.box(-.32,1.01,-.1,.15,.5,.19,color,g);this.box(.32,1.01,-.1,.15,.5,.19,color,g);
    this.box(.18,1.12,-.38,.12,.15,.65,0x1f333a,g);
    this.box(0,1.17,-.242,.18,.08,.02,ally?0xb0dfd6:0xf4ba7f,g);
    return {g,legs,head};
  }
  weapon(key){
    // Discard only a small group on equipment changes; shared materials and geometry remain pooled.
    this.weaponRoot.clear();this.weaponKey=key;const g=this.weaponRoot,short=key==='pistol',smg=key==='smg';
    this.box(0,0,0,.17,.18,short?.32:.61,0x273c45,g);this.box(0,.11,-.02,.15,.06,short?.35:.65,0x687b7a,g);
    this.box(0,-.13,.08,.13,.22,.14,0x614e3c,g);this.box(0,-.08,.25,.15,.14,short?.1:.34,0x273c45,g);
    this.box(0,.025,short?-.22:-.49,.07,.075,short?.16:smg?.26:.43,0x243840,g);
    this.box(0,.18,-.12,.045,.08,.07,0x202f35,g);this.box(0,.16,-.29,.03,.08,.04,0xd67843,g);
    this.mag=this.box(0,-.2,-.13,.12,short?.13:.28,.16,0x1d3037,g);
    if(!short){for(let i=0;i<6;i++)this.box(.092,.025,-.13-i*.04,.018,.08,.018,0xD67843,g);this.box(-.13,-.16,-.25,.14,.17,.24,0x294851,g);}
    this.box(.1,-.2,.13,.16,.14,.21,0x294851,g);this.box(.16,-.28,.29,.22,.18,.4,0xb79978,g);
    this.muzzle=new T.Mesh(new T.ConeGeometry(.065,.22,6),new T.MeshBasicMaterial({color:0xffd38b}));this.muzzle.rotation.x=-Math.PI/2;this.muzzle.position.set(0,.025,short?-.35:smg?-.65:-.76);g.add(this.muzzle);
  }
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.weaponCamera.aspect=w/h;this.weaponCamera.updateProjectionMatrix();}
  render(alpha,realDt){
    const s=this.s,p=s.actors[0];let focus=p;
    if(!p.alive){focus=s.actors[1].alive?s.actors[1]:p;}
    if(s.phase==='menu'){
      this.camera.position.set(-15,5.3,22);this.camera.lookAt(1,1.5,-9);
    }else{
      const x=focus.px+(focus.x-focus.px)*alpha,z=focus.pz+(focus.z-focus.pz)*alpha;
      const bob=Math.sin(s.time*10)*Math.min(.035,Math.hypot(focus.vx,focus.vz)*.008);
      this.camera.position.set(x,floorY(x,z)+(focus.crouch?1.05:1.55)+bob,z);
      this.camera.rotation.set(focus.pitch+focus.recoil*.25,focus.yaw,0,'YXZ');
    }
    const fov=s.input.aim?56:74;if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    for(let i=0;i<this.people.length;i++){const a=s.actors[i],m=this.people[i];m.g.visible=i!==focus.id;m.g.position.set(a.px+(a.x-a.px)*alpha,floorY(a.x,a.z),a.pz+(a.z-a.pz)*alpha);m.g.rotation.y=a.yaw;
      m.g.rotation.z=a.alive?0:Math.PI/2;m.g.scale.y=a.crouch?.7:1;const stride=a.alive?Math.sin(s.time*9)*Math.min(.5,Math.hypot(a.vx,a.vz)*.15):0;m.legs[0].rotation.x=stride;m.legs[1].rotation.x=-stride;
    }
    for(let n=Math.max(this.seq+1,s.eventSeq-95);n<=s.eventSeq;n++){const e=s.events[(n-1)%96];if(e.type==='shot'){
      const fx=this.effects[this.effectCursor++%this.effects.length],m=fx.mesh;fx.life=.07;m.visible=true;this.tmpA.set(e.x,e.y,e.z);this.tmpB.set(e.tx,e.ty,e.tz);const d=this.tmpA.distanceTo(this.tmpB);m.position.copy(this.tmpA).lerp(this.tmpB,.5);m.scale.set(.012,.012,d);m.lookAt(this.tmpB);
      const impact=this.effects[this.effectCursor++%this.effects.length];impact.life=.18;impact.mesh.visible=true;impact.mesh.position.copy(this.tmpB);impact.mesh.scale.set(.08,.08,.08);
    }}this.seq=s.eventSeq;
    for(const fx of this.effects)if(fx.life>0){fx.life-=realDt;fx.mesh.visible=fx.life>0;}
    for(let i=0;i<3;i++){const g=s.smokes[i],m=this.smokeMeshes[i];m.visible=g.active;if(g.active){m.position.set(g.x,floorY(g.x,g.z),g.z);m.scale.setScalar(Math.min(1,g.age*1.5)*Math.min(1,g.life));m.rotation.y=s.time*.03;}}
    this.relayLamp.visible=!s.bomb.planted||Math.floor(s.bomb.time*3)%2===0;
    this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);
    if(s.phase!=='menu'&&p.alive){
      if(p.weapon!==this.weaponKey)this.weapon(p.weapon);
      const w=WEAPONS[p.weapon],r=p.reload>0?Math.sin((1-p.reload/w.reload)*Math.PI):0;
      this.weaponRoot.position.set(s.input.aim?.09:.27,-.24-r*.15,-.48+p.recoil*.7);this.weaponRoot.rotation.set(r*.4+p.recoil,-r*.25,r*-.5);this.mag.position.y=-.2-r*.23;
      this.muzzle.visible=p.flash>0;this.muzzle.rotation.z=s.tick;
      this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);
    }
    this.frames++;
  }
}
