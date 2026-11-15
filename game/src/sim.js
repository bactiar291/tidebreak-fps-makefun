// SPDX-License-Identifier: MIT
import {SITE, floorY, move, wallDistance, boxRay} from './map.js';
import {bot} from './bots.js';
export const DT=1/60;
export const WEAPONS={
  pistol:{name:'Kestrel P9',label:'PISTOL',price:0,mag:12,reserve:48,damage:29,interval:.28,reload:1.35,spread:.008,kick:.014,auto:false},
  smg:{name:'Undertow S24',label:'SMG',price:1100,mag:24,reserve:96,damage:21,interval:.085,reload:1.65,spread:.014,kick:.009,auto:true},
  rifle:{name:'Breakwater R20',label:'RIFLE',price:1900,mag:20,reserve:80,damage:36,interval:.16,reload:2.05,spread:.004,kick:.018,auto:true}
};
export function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function input(){return {forward:0,strafe:0,fire:false,pressed:false,crouch:false,walk:false,interact:false,aim:false};}
function actor(id,team,x,z){return {id,team,name:['YOU','MICA','RUSK','BRINE','FLINT'][id],x,z,px:x,pz:z,y:0,yaw:team===0?0:Math.PI,pitch:0,vx:0,vz:0,hp:100,armor:50,alive:true,crouch:false,weapon:'pistol',ammo:12,reserve:48,cool:0,reload:0,recoil:0,shots:0,kills:0,step:0,flash:0,hurt:0,action:0,lastDamage:-10,seen:-1,reaction:0,memory:0,heardX:x,heardZ:z,navX:x,navZ:z,navTime:0,hold:0,routeIndex:0,role:['player','planter','anchor','pier','hall'][id],intent:'patrol',contact:'',goalX:x,goalZ:z,stuck:0,recoveries:0};}
export function createState(seed=517,difficulty='normal',mode='match'){
  const s={seed,initialSeed:seed,difficulty,mode,phase:'menu',paused:false,tick:0,time:0,acc:0,round:0,score:[0,0],money:2400,roundTime:85,phaseTime:0,result:'',winner:-1,awards:0,message:'',messageTime:0,actors:[],bomb:{planted:false,time:30,progress:0,defuse:0,owner:-1,defuser:-1},smokes:Array.from({length:3},()=>({active:false,x:0,z:0,life:0,age:0})),grenades:1,events:Array.from({length:96},()=>({seq:0,type:'',x:0,y:0,z:0,tx:0,ty:0,tz:0,id:0,head:false})),eventSeq:0,feed:[],stats:{shots:0,hits:0,heads:0},input:input(),damageMark:0};
  startRound(s);s.phase='menu';return s;
}
export function event(s,type,a,tx=0,ty=0,tz=0,head=false){
  const e=s.events[s.eventSeq%96];e.seq=++s.eventSeq;e.type=type;e.x=a.x;e.y=floorY(a.x,a.z)+(a.crouch?1.05:1.55);e.z=a.z;e.tx=tx;e.ty=ty;e.tz=tz;e.id=a.id;e.head=head;
}
export function message(s,text){s.message=text;s.messageTime=3;}
export function equip(a,key){const w=WEAPONS[key];a.weapon=key;a.ammo=w.mag;a.reserve=w.reserve;a.reload=0;a.recoil=0;}
export function startRound(s){
  const old=s.actors[0],keep=old?.alive?old.weapon:'pistol';
  s.round++;s.phase='buy';s.phaseTime=18;s.roundTime=85;s.result='';s.winner=-1;s.paused=false;s.input=input();s.grenades=1;
  s.bomb.planted=false;s.bomb.time=30;s.bomb.progress=0;s.bomb.defuse=0;s.bomb.owner=-1;s.bomb.defuser=-1;
  for(const smoke of s.smokes)smoke.active=false;
  s.actors=[actor(0,0,0,23),actor(1,0,-3,22),actor(2,1,3,-18),actor(3,1,-15,-21),actor(4,1,16,-9)];
  equip(s.actors[0],keep);equip(s.actors[1],'rifle');equip(s.actors[2],'rifle');equip(s.actors[3],'smg');equip(s.actors[4],'smg');
  s.feed.length=0;message(s,'Plan your route. Reach relay 01 and hold E.');
}
export function restart(s){const fresh=createState(s.initialSeed,s.difficulty,s.mode);Object.assign(s,fresh);s.phase='buy';}
export function deploy(s){if(s.phase==='buy'){s.phase='live';s.phaseTime=0;message(s,'Relay 01 • hold E to sabotage. Mica takes the canal.');}}
export function buy(s,item){
  if(s.phase!=='buy')return message(s,'Requisitions are only available before deployment.'),false;
  const p=s.actors[0];let price;
  if(item==='armor')price=450;else if(item==='ammo')price=200;else if(item==='smoke')price=250;else price=WEAPONS[item]?.price;
  if(price===undefined)return false;
  if(item===p.weapon&&item!=='pistol')return message(s,'Already equipped. Buy reserve ammunition instead.'),false;
  if(item==='armor'&&p.armor===100)return message(s,'Armor is already full.'),false;
  if(item==='smoke'&&s.grenades>=2)return message(s,'Two smoke canisters maximum.'),false;
  if(item==='ammo'&&p.ammo===WEAPONS[p.weapon].mag&&p.reserve===WEAPONS[p.weapon].reserve)return message(s,'Ammunition is already full.'),false;
  if(s.money<price)return message(s,'Insufficient funds.'),false;
  s.money-=price;
  if(item==='armor')p.armor=100;else if(item==='ammo'){p.ammo=WEAPONS[p.weapon].mag;p.reserve=WEAPONS[p.weapon].reserve;}else if(item==='smoke')s.grenades++;else equip(p,item);
  message(s,'Requisition confirmed.');return true;
}
export function reload(s,a=s.actors[0]){if(s.phase!=='live'||s.paused||!a.alive||a.reload>0||a.reserve<=0||a.ammo===WEAPONS[a.weapon].mag)return false;a.reload=WEAPONS[a.weapon].reload;a.action=0;event(s,'reload',a);return true;}
export function cancelReload(s){const p=s.actors[0];if(p.reload>0){p.reload=0;message(s,'Reload cancelled • magazine unchanged.');}}
export function smokeBlocked(s,x,z,tx,tz){
  const dx=tx-x,dz=tz-z,dd=dx*dx+dz*dz;
  for(const g of s.smokes)if(g.active&&g.age>.4){const t=dd?Math.max(0,Math.min(1,((g.x-x)*dx+(g.z-z)*dz)/dd)):0;if(Math.hypot(x+dx*t-g.x,z+dz*t-g.z)<3.3)return true;}
  return false;
}
export function sees(s,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d>32||smokeBlocked(s,a.x,a.z,b.x,b.z))return false;
  if(d>3 && (-Math.sin(a.yaw)*dx-Math.cos(a.yaw)*dz)/d<.28)return false;
  const y=floorY(a.x,a.z)+(a.crouch?1.05:1.55),by=floorY(b.x,b.z)+(b.crouch?.8:1.3),dy=by-y,dist=Math.hypot(dx,dy,dz);
  return wallDistance(a.x,y,a.z,dx/dist,dy/dist,dz/dist,dist)>=dist-.05;
}
export function noise(s,a,radius){for(const b of s.actors)if(b.alive&&b.team!==a.team&&Math.hypot(a.x-b.x,a.z-b.z)<radius){if(b.seen<0){b.memory=3;b.heardX=a.x;b.heardZ=a.z;b.contact='sound';}}}
export function hurt(s,a,damage,by,head=false){
  if(!a.alive||s.phase!=='live')return;
  const absorb=head?0:Math.min(a.armor,damage*.42);a.armor-=absorb;a.hp=Math.max(0,a.hp-(damage-absorb));a.hurt=.28;a.lastDamage=s.time;a.action=0;
  if(a.id===0)s.damageMark=.3;
  event(s,'hit',a,0,0,0,head);
  if(a.hp<=0){a.alive=false;a.reload=0;a.vx=0;a.vz=0;a.action=0;
    if(by&&by.team!==a.team){by.kills++;if(by.id===0)s.money+=300;}
    const line=`${by?.name??'RELAY'} / ${a.name}${head?' • HEAD':''}`;s.feed.unshift(line);if(s.feed.length>4)s.feed.pop();
    if(a.id===0)message(s,'You are down. Spectating Mica; the round continues.');
  }
}
// Separate standing/crouching head and torso AABBs. Shared for human and bot bullets.
const hitBox={x:0,z:0,w:.55,d:.55,y:0,h:1};
export function trace(s,a,dx,dy,dz){
  const oy=floorY(a.x,a.z)+(a.crouch?1.05:1.55);
  let distance=wallDistance(a.x,oy,a.z,dx,dy,dz,80),target=null,head=false;
  for(const b of s.actors){if(!b.alive||b===a)continue;
    const fy=floorY(b.x,b.z),height=b.crouch?1.2:1.8;
    hitBox.x=b.x;hitBox.z=b.z;hitBox.w=.55;hitBox.d=.48;hitBox.y=fy+.15;hitBox.h=height-.52;
    let t=boxRay(a.x,oy,a.z,dx,dy,dz,hitBox,distance);
    if(t<distance){distance=t;target=b;head=false;}
    hitBox.w=.38;hitBox.d=.38;hitBox.y=fy+height-.42;hitBox.h=.42;
    t=boxRay(a.x,oy,a.z,dx,dy,dz,hitBox,distance);
    if(t<distance){distance=t;target=b;head=true;}
  }
  s.traceDistance=distance;s.traceHead=head;s.traceTarget=target;
}
export function fire(s,a,yaw=a.yaw,pitch=a.pitch,bot=false){
  if(s.phase!=='live'||s.paused||!a.alive||a.cool>0||a.reload>0||a.ammo<=0||a.action>0)return false;
  const w=WEAPONS[a.weapon],speed=Math.hypot(a.vx,a.vz);
  let spread=w.spread*(a.crouch?.55:1)+speed*.011+a.recoil*.35;
  if(bot)spread+=s.difficulty==='easy'?.055:.028;
  yaw+=(random(s)-.5)*spread*2;pitch+=(random(s)-.5)*spread*2+a.recoil*.3;
  const dx=-Math.sin(yaw)*Math.cos(pitch),dy=Math.sin(pitch),dz=-Math.cos(yaw)*Math.cos(pitch);
  trace(s,a,dx,dy,dz);
  a.ammo--;a.cool=w.interval*(bot?1.5:1);a.flash=.06;a.recoil=Math.min(.2,a.recoil+w.kick);a.shots++;
  const oy=floorY(a.x,a.z)+(a.crouch?1.05:1.55),d=s.traceDistance;
  event(s,'shot',a,a.x+dx*d,oy+dy*d,a.z+dz*d,s.traceHead);noise(s,a,30);
  if(a.id===0)s.stats.shots++;
  const b=s.traceTarget;
  if(b&&b.team!==a.team){let damage=w.damage*(s.traceHead?3.2:1);if(bot)damage*=s.difficulty==='easy'?.55:.8;hurt(s,b,damage,a,s.traceHead);if(a.id===0){s.stats.hits++;if(s.traceHead)s.stats.heads++;event(s,'confirm',a,0,0,0,s.traceHead);}}
  return true;
}
export function throwSmoke(s){
  const a=s.actors[0];if(s.phase!=='live'||s.paused||!a.alive||s.grenades<=0)return false;
  const g=s.smokes.find(g=>!g.active);if(!g)return false;
  const dx=-Math.sin(a.yaw),dz=-Math.cos(a.yaw),d=Math.max(.5,Math.min(9,wallDistance(a.x,1.2,a.z,dx,0,dz,9)-.6));
  g.active=true;g.x=a.x+dx*d;g.z=a.z+dz*d;g.life=11;g.age=0;s.grenades--;noise(s,a,10);event(s,'smoke',a);message(s,'Smoke deployed • breaks visual contact for both teams.');return true;
}
export function award(s,team,reason){
  if(s.phase!=='live')return false;
  s.score[team]++;s.awards++;s.winner=team;s.result=reason;s.money=Math.min(9000,s.money+(team===0?2200:1500));s.phase=s.score[team]>=3?'match':'result';s.phaseTime=6;
  for(const a of s.actors){a.reload=0;a.action=0;}
  event(s,'round',s.actors[0]);return true;
}
function objective(s){
  const b=s.bomb;
  if(b.planted){
    b.time-=DT;
    // Detonation owns a simultaneous final tick; a dead defuser can never finish.
    if(b.time<=0){award(s,0,'RELAY DISABLED');return;}
    let defuser=null;
    for(const a of s.actors)if(a.alive&&a.team===1&&Math.hypot(a.x-SITE.x,a.z-SITE.z)<2.5&&Math.hypot(a.vx,a.vz)<.25&&s.time-a.lastDamage>.25){defuser=a;break;}
    if(defuser){if(b.defuser!==defuser.id)b.defuse=0;b.defuser=defuser.id;b.defuse+=DT;defuser.action=b.defuse;if(b.defuse>=5){award(s,1,'RELAY SECURED');return;}}
    else {b.defuse=0;b.defuser=-1;}
  }else{
    let planter=null;
    for(const a of s.actors)if(a.alive&&a.team===0&&(a.id!==0||s.input.interact)&&Math.hypot(a.x-SITE.x,a.z-SITE.z)<SITE.radius&&Math.hypot(a.vx,a.vz)<.2&&s.time-a.lastDamage>.25&&a.reload<=0){planter=a;break;}
    if(planter){if(b.owner!==planter.id)b.progress=0;b.owner=planter.id;b.progress+=DT;planter.action=b.progress;if(b.progress>=3){b.planted=true;b.time=30;b.progress=0;planter.action=0;message(s,'Sabotage armed. Protect the relay for 30 seconds.');event(s,'plant',planter);}}
    else {b.progress=0;b.owner=-1;}
  }
  let attackers=0,defenders=0;for(const a of s.actors)if(a.alive){if(a.team===0)attackers++;else defenders++;}
  if(defenders===0){award(s,0,'DEFENDERS ELIMINATED');return;}
  if(attackers===0&&!b.planted){award(s,1,'ATTACKERS ELIMINATED');return;}
  if(s.roundTime<=0&&!b.planted)award(s,1,'TIME EXPIRED');
}
const botActions={sees,fire,reload};
export function step(s){
  if(s.paused||s.phase==='menu'||s.phase==='match')return;
  s.tick++;s.time+=DT;s.messageTime=Math.max(0,s.messageTime-DT);s.damageMark=Math.max(0,s.damageMark-DT);
  if(s.phase==='buy'){s.phaseTime-=DT;if(s.phaseTime<=0)deploy(s);return;}
  if(s.phase==='result'){s.phaseTime-=DT;if(s.phaseTime<=0)startRound(s);return;}
  s.roundTime-=DT;
  for(const g of s.smokes)if(g.active){g.age+=DT;g.life-=DT;if(g.life<=0)g.active=false;}
  for(const a of s.actors){a.px=a.x;a.pz=a.z;a.action=0;if(!a.alive)continue;
    a.cool=Math.max(0,a.cool-DT);a.flash=Math.max(0,a.flash-DT);a.hurt=Math.max(0,a.hurt-DT);a.recoil=Math.max(0,a.recoil-DT*.075);
    if(a.reload>0){a.reload=Math.max(0,a.reload-DT);if(a.reload===0){const n=Math.min(WEAPONS[a.weapon].mag-a.ammo,a.reserve);a.ammo+=n;a.reserve-=n;event(s,'ready',a);}}
    if(a.id===0){
      const i=s.input;a.crouch=i.crouch;const speed=i.crouch?1.65:i.walk?2:4.5;
      let x=i.strafe,z=-i.forward;const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
      const tx=(Math.cos(a.yaw)*x+Math.sin(a.yaw)*z)*speed,tz=(-Math.sin(a.yaw)*x+Math.cos(a.yaw)*z)*speed;
      const accel=len>0?DT*12:DT*17;a.vx+=(tx-a.vx)*accel;a.vz+=(tz-a.vz)*accel;
      move(a,a.vx*DT,a.vz*DT);
      if(i.fire&&(WEAPONS[a.weapon].auto||i.pressed)&&!i.interact)fire(s,a);i.pressed=false;
    }else bot(s,a,botActions);
    const speed=Math.hypot(a.vx,a.vz);a.step+=speed*DT;
    if(a.step>1.7){a.step=0;event(s,'step',a);noise(s,a,a.crouch||a.id===0&&s.input.walk?2:10);}
    a.y=floorY(a.x,a.z);
  }
  objective(s);
}
export function advance(s,elapsed){s.acc+=Math.min(elapsed,.25);while(s.acc+1e-10>=DT){step(s);s.acc-=DT;}return Math.max(0,s.acc/DT);}
// Public playable drills. These initialize scenarios, then use the exact match rules and AI.
export function scenario(s,name){
  restart(s);s.mode=name;s.phase='live';equip(s.actors[0],'rifle');s.money=2400;
  if(name==='relay'){
    const p=s.actors[0];p.x=3;p.z=-17;p.yaw=-.25;
    s.actors[1].x=-2;s.actors[1].z=-13;
    s.actors[2].x=10;s.actors[2].z=10;s.actors[3].x=-18;s.actors[3].z=23;s.actors[4].x=17;s.actors[4].z=23;
    message(s,'RELAY DRILL • hold E for 3s, then defend. Enemies are active.');
  }else if(name==='range'){
    const p=s.actors[0];p.x=-18;p.z=19;
    s.actors[1].x=-6;s.actors[1].z=14;
    s.actors[2].x=-18;s.actors[2].z=-8;s.actors[2].yaw=Math.PI;
    message(s,'PIER DRILL • stop, aim, fire. Live opponents; all round rules apply.');
  }
  for(const a of s.actors){a.px=a.x;a.pz=a.z;}
}
export function snapshot(s){return JSON.parse(JSON.stringify({phase:s.phase,paused:s.paused,round:s.round,score:s.score,money:s.money,time:s.time,roundTime:s.roundTime,phaseTime:s.phaseTime,result:s.result,awards:s.awards,actors:s.actors,bomb:s.bomb,grenades:s.grenades,smokes:s.smokes,stats:s.stats,eventSeq:s.eventSeq}));}
