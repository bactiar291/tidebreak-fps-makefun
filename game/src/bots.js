// SPDX-License-Identifier: MIT
// Decisions use only visible enemies, expiring contact coordinates and the public relay alarm.
import {SITE,floorY,route,move,clearLine,wallDistance} from './map.js';
const DT=1/60;
export const POSTS={anchor:[[3,-16],[1,-13],[10,-21]],pier:[[-15,-20],[-18,-8],[-18,8]],hall:[[13,-7],[13,2],[14,16]]};
const COVER=[[1,-13],[-5,-12],[13,-7],[10,-21],[-18,-8],[3,5],[10,11]];
function goal(a,x,z,intent){if(a.goalX!==x||a.goalZ!==z){a.navTime=0;a.hold=0;}a.goalX=x;a.goalZ=z;a.intent=intent;}
function navigate(a,speed=2.3,radius=.65){
  if(Math.hypot(a.x-a.goalX,a.z-a.goalZ)<radius){a.vx=a.vz=0;a.stuck=0;return true;}
  a.navTime-=DT;if(a.navTime<=0){route(a,a.goalX,a.goalZ);a.navTime=.22;}
  const dx=a.navX-a.x,dz=a.navZ-a.z,d=Math.hypot(dx,dz),x=a.x,z=a.z;
  if(d>.08){a.yaw=Math.atan2(-dx,-dz);a.vx=dx/d*speed;a.vz=dz/d*speed;move(a,a.vx*DT,a.vz*DT);}
  if(Math.hypot(a.x-x,a.z-z)<.005)a.stuck+=DT;else a.stuck=0;
  if(a.stuck>.45){a.navTime=0;a.stuck=0;a.recoveries++;}
  return false;
}
function defuser(s){
  const current=s.actors[s.bomb.defuser];if(current?.alive&&current.team===1)return current.id;
  let id=-1,best=Infinity;for(const b of s.actors)if(b.alive&&b.team===1){const d=Math.hypot(b.x-SITE.x,b.z-SITE.z);if(d<best){best=d;id=b.id;}}return id;
}
function reloadCover(a,target){
  let best=Infinity,pick=null;
  for(const p of COVER){const distance=Math.hypot(a.x-p[0],a.z-p[1]);if(distance>9||distance<.5||distance>=best||!clearLine(a.x,a.z,...p))continue;
    const dx=target.x-p[0],dz=target.z-p[1],d=Math.hypot(dx,dz);
    if(wallDistance(p[0],floorY(...p)+1.3,p[1],dx/d,0,dz/d,d)<d-.5){pick=p;best=distance;}}
  return pick;
}
export function bot(s,a,{sees,fire,reload}){
  let target=null,nearest=Infinity;
  for(const b of s.actors)if(b.alive&&a.team!==b.team&&sees(s,a,b)){const d=Math.hypot(a.x-b.x,a.z-b.z);if(d<nearest){nearest=d;target=b;}}
  if(target){
    if(a.seen!==target.id){a.seen=target.id;a.reaction=s.difficulty==='easy'?.65:.4;}
    a.memory=4;a.heardX=target.x;a.heardZ=target.z;a.contact='sight';a.reaction-=DT;
  }else {a.seen=-1;a.memory=Math.max(0,a.memory-DT);a.pitch=0;}
  // Keep the selected destination until reload completes, even after turning out of sight.
  // Perception above still expires contact and applies reaction delay on reacquisition.
  if(a.reload>0&&a.intent==='reload-cover'){navigate(a);return;}
  if(target){
    if(a.ammo===0)reload(s,a);
    if(a.reload>0){const cover=reloadCover(a,target);if(cover){goal(a,...cover,'reload-cover');navigate(a);return;}}
    a.intent='engage';a.yaw=Math.atan2(-(target.x-a.x),-(target.z-a.z));
    const ty=floorY(target.x,target.z)+(target.crouch?.75:1.2),sy=floorY(a.x,a.z)+1.55;
    a.pitch=Math.atan2(ty-sy,nearest);a.vx*=.75;a.vz*=.75;
    if(a.reaction<=0&&a.ammo>0)fire(s,a,a.yaw,a.pitch,true);
    a.navTime=0;return;
  }
  if(a.ammo<4)reload(s,a);
  if(s.bomb.planted){
    if(a.team===1){
      if(defuser(s)===a.id)goal(a,SITE.x,SITE.z,'defuse');
      else {const p=a.role==='pier'?POSTS.pier[0]:a.role==='hall'?POSTS.anchor[2]:POSTS.anchor[1];goal(a,...p,'cover');}
    }else goal(a,-1,-14,'cover');
  }else if(a.team===0){
    if(a.routeIndex===0&&Math.hypot(a.x+6,a.z+11)>.7)goal(a,-6,-11,'advance');
    else{a.routeIndex=1;goal(a,SITE.x,SITE.z,'plant');}
  }else if(a.memory>0&&(a.role!=='anchor'||Math.hypot(a.heardX-SITE.x,a.heardZ-SITE.z)<14)){
    goal(a,a.heardX,a.heardZ,a.contact==='sight'?'pursue':'investigate');
  }else{
    const posts=POSTS[a.role],p=posts[a.routeIndex%posts.length];goal(a,...p,'patrol');
  }
  if(navigate(a,2.3,a.intent==='defuse'?1.6:.65)){
    a.hold+=DT;
    if(a.intent==='patrol')a.intent='hold';
    // Search the remembered location instead of following an unseen actor's new position.
    const facing=a.memory>0?Math.atan2(-(a.heardX-a.x),-(a.heardZ-a.z)):Math.PI;
    a.yaw=facing+Math.sin(s.time*.7+a.id)*.6;
    if(a.intent==='hold'&&a.hold>(a.role==='anchor'?6:3.5)){a.routeIndex++;a.hold=0;}
    if((a.intent==='pursue'||a.intent==='investigate')&&a.hold>1.2)a.memory=0;
  }
}
