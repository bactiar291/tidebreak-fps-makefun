// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,deploy,step,advance,noise,sees,fire,reload,equip,DT} from '../game/src/sim.js';
import {bot} from '../game/src/bots.js';
import {blocked,clearLine,nodes,route,move,SITE} from '../game/src/map.js';
const live=()=>{const s=createState(517);s.phase='buy';deploy(s);return s;};
const ticks=(s,n)=>{for(let i=0;i<n;i++)step(s);};
function quiet(s){s.actors[0].x=0;s.actors[0].z=26;s.actors[1].alive=false;return s;}
test('guards have distinct anchor, pier and hall duties',()=>{const s=quiet(live());ticks(s,60);assert.deepEqual(s.actors.slice(2).map(a=>a.role),['anchor','pier','hall']);assert(s.actors.slice(2).every(a=>['patrol','hold'].includes(a.intent)));});
test('heard contact changes route without revealing or tracking the hidden actor',()=>{const s=quiet(live()),p=s.actors[0],a=s.actors[4];Object.assign(p,{x:5,z:12});Object.assign(a,{x:9,z:12,yaw:Math.PI/2});assert(!sees(s,a,p));noise(s,p,20);p.z=16;step(s);assert.equal(a.seen,-1);assert.equal(a.intent,'investigate');assert.equal(a.goalX,5);assert.equal(a.goalZ,12);assert.equal(a.shots,0);});
test('smoke prevents visual acquisition and firing but preserves a sound location',()=>{const s=quiet(live()),p=s.actors[0],a=s.actors[3];s.actors[2].alive=s.actors[4].alive=false;Object.assign(p,{x:-18,z:8});Object.assign(a,{x:-18,z:0,yaw:Math.PI});Object.assign(s.smokes[0],{active:true,x:-18,z:4,age:1,life:11});noise(s,p,20);ticks(s,30);assert.equal(a.seen,-1);assert.equal(a.shots,0);assert.equal(a.goalZ,8);});
test('anchor does not abandon relay for a distant gunshot',()=>{const s=quiet(live()),p=s.actors[0],a=s.actors[2];Object.assign(p,{x:3,z:10});noise(s,p,30);ticks(s,60);assert.equal(a.intent,'hold');assert(Math.hypot(a.goalX-SITE.x,a.goalZ-SITE.z)<10);});
test('retake assigns one defuser and two separate covering positions',()=>{const s=quiet(live());s.actors[0].alive=false;s.bomb.planted=true;step(s);assert.equal(s.actors.slice(2).filter(a=>a.intent==='defuse').length,1);assert.equal(s.actors.slice(2).filter(a=>a.intent==='cover').length,2);const goals=new Set(s.actors.slice(2).map(a=>`${a.goalX},${a.goalZ}`));assert.equal(goals.size,3);ticks(s,330);assert.equal(s.result,'RELAY SECURED');});
test('dead designated defuser is replaced without inheriting progress',()=>{const s=quiet(live());s.actors[0].alive=false;s.bomb.planted=true;step(s);const first=s.actors.find(a=>a.intent==='defuse');s.bomb.defuser=first.id;s.bomb.defuse=4;first.alive=false;step(s);assert.equal(s.actors.filter(a=>a.alive&&a.intent==='defuse').length,1);assert.equal(s.bomb.defuse,0);});
test('route waypoints are walkable and every node reaches relay without a stuck loop',()=>{for(const [x,z] of nodes){assert(!blocked(x,z),`${x},${z}`);const a={x,z,vx:0,vz:0};for(let n=0;n<2400&&Math.hypot(a.x-SITE.x,a.z-SITE.z)>.6;n++){route(a,SITE.x,SITE.z);assert(clearLine(a.x,a.z,a.navX,a.navZ));const dx=a.navX-a.x,dz=a.navZ-a.z,d=Math.hypot(dx,dz);if(d>.01)move(a,dx/d*.04,dz/d*.04);}assert(Math.hypot(a.x-SITE.x,a.z-SITE.z)<.6,JSON.stringify(a));}});
test('stale unreachable waypoint is replanned without teleporting through cover',()=>{const s=quiet(live()),a=s.actors[4];Object.assign(a,{x:5.9,z:8,goalX:13,goalZ:-7,navX:13,navZ:8,navTime:99});const x=a.x,z=a.z;for(let i=0;i<90;i++)bot(s,a,{sees:()=>false,fire:()=>{},reload:()=>{}});assert(!blocked(a.x,a.z));assert(a.recoveries>0);assert(Math.hypot(a.x-x,a.z-z)<4);assert(a.navTime<1);});
test('friendly body stops a bot bullet without damage to either actor behind it',()=>{const s=live(),a=s.actors[2],friend=s.actors[3],p=s.actors[0];s.actors[1].alive=s.actors[4].alive=false;Object.assign(a,{x:-18,z:0,yaw:Math.PI});Object.assign(friend,{x:-18,z:4});Object.assign(p,{x:-18,z:8});equip(a,'rifle');assert(fire(s,a,Math.PI,0));assert.equal(friend.hp,100);assert.equal(p.hp,100);});
test('empty magazine seeks reachable cover occluded from a visible opponent',()=>{const s=quiet(live()),a=s.actors[4],p=s.actors[0];s.actors[2].alive=s.actors[3].alive=false;Object.assign(a,{x:-18,z:-1,ammo:0,yaw:Math.atan2(-6,-24)});Object.assign(p,{x:-12,z:23});assert(sees(s,a,p));bot(s,a,{sees,fire,reload});assert.equal(a.intent,'reload-cover');assert(a.reload>0);assert.equal(a.goalX,-18);assert.equal(a.goalZ,-8);assert(clearLine(a.x,a.z,a.goalX,a.goalZ));});
for(const id of [3,4])test(`actor ${id} keeps reload cover through 99 real ticks and releases it on completion`,()=>{
  const s=quiet(live()),a=s.actors[id],p=s.actors[0];
  for(const b of s.actors.slice(2))if(b!==a)b.alive=false;
  Object.assign(a,{x:-18,z:-1,ammo:0,yaw:Math.atan2(-6,-24)});Object.assign(p,{x:-12,z:23});
  const trace=[];
  for(let i=0;i<99;i++){step(s);trace.push({intent:a.intent,z:a.z,reload:a.reload,goalX:a.goalX,goalZ:a.goalZ});}
  assert.equal(trace.filter(t=>t.intent==='reload-cover').length,99,JSON.stringify(trace));
  assert(trace.every(t=>t.reload>0&&t.goalX===-18&&t.goalZ===-8));
  assert(a.z<-4.7);assert.equal(a.seen,-1);assert.equal(a.shots,0);
  const remembered=[a.heardX,a.heardZ];Object.assign(p,{x:10,z:12});
  let remaining=0;while(a.reload>0&&remaining++<10)step(s);
  assert.equal(a.reload,0);assert.equal(a.ammo,24);assert.equal(a.reserve,72);
  assert.equal(a.intent,'pursue');assert.deepEqual([a.goalX,a.goalZ],remembered);
  Object.assign(p,{x:-18,z:a.z+8});a.yaw=Math.PI;step(s);
  assert.equal(a.seen,p.id);assert.equal(a.intent,'engage');assert(a.reaction>.3);assert.equal(a.shots,0);
});
for(const id of [3,4])test(`actor ${id} holds arrived cover while hidden opponent moves for the full reload`,()=>{
  const s=quiet(live()),a=s.actors[id],p=s.actors[0];
  for(const b of s.actors.slice(2))if(b!==a)b.alive=false;
  Object.assign(a,{x:-18,z:-1,ammo:0,yaw:Math.atan2(-6,-24)});Object.assign(p,{x:-12,z:23});step(s);
  const remembered=[a.heardX,a.heardZ],reaction=a.reaction;
  Object.assign(a,{x:a.goalX,z:a.goalZ});const held=[a.x,a.z];let active=0;
  while(a.reload>DT&&active++<120){
    Object.assign(p,{x:10,z:12+active*.01});assert(!sees(s,a,p));step(s);
    if(a.reload===0)break;
    assert.equal(a.intent,'reload-cover');assert.deepEqual([a.goalX,a.goalZ],held);
    assert.deepEqual([a.x,a.z],held);assert.equal(a.vx,0);assert.equal(a.vz,0);
    assert.equal(a.seen,-1);assert.equal(a.reaction,reaction);assert.deepEqual([a.heardX,a.heardZ],remembered);
  }
  assert(active>=98);while(a.reload>0)step(s);
  assert.equal(a.intent,'pursue');assert.deepEqual([a.goalX,a.goalZ],remembered);assert.equal(a.ammo,24);
});
test('lost visual contact pursues the last sighting and expires without tracking',()=>{const s=quiet(live()),a=s.actors[3],p=s.actors[0];s.actors[2].alive=s.actors[4].alive=false;Object.assign(a,{x:-18,z:0,yaw:Math.PI});Object.assign(p,{x:-18,z:8});step(s);assert.equal(a.seen,0);p.x=10;p.z=12;step(s);assert.equal(a.seen,-1);assert.equal(a.intent,'pursue');assert.equal(a.goalX,-18);assert.equal(a.goalZ,8);ticks(s,250);assert.equal(a.memory,0);assert(['patrol','hold'].includes(a.intent));});
test('tactical decisions and RNG repeat across irregular render cadence',()=>{const a=live(),b=live();for(let i=0;i<1200;i++)advance(a,DT);for(let i=0;i<200;i++){advance(b,DT*2);advance(b,DT*.5);advance(b,DT*3.5);}assert.equal(a.tick,b.tick);assert.deepEqual(a.actors,b.actors);assert.equal(a.seed,b.seed);assert.deepEqual(a.bomb,b.bomb);});
