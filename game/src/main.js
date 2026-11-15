// SPDX-License-Identifier: MIT
import {createState,advance,deploy,buy,reload,cancelReload,throwSmoke,restart,startRound,scenario,snapshot,WEAPONS} from './sim.js';
import {walls,SITE,zone} from './map.js';
import {View} from './view.js';
import {Sound} from './audio.js';
const $=id=>document.getElementById(id),s=createState(),canvas=$('world'),view=new View(canvas,s),sound=new Sound();
const elements={};for(const id of ['menu','buy','pause','result','hud','score','clock','location','objective','feed','prompt','progress','notice','vitals','utility','ammo','damage','crosshair','hitmarker'])elements[id]=$(id);
const keys=new Set();let drag=false,active=false,shop=true,last=performance.now(),uiClock=0,hitTime=0,lastSeq=0,previousPhase='menu';
const radar=$('radar').getContext('2d');
function resetInput(){keys.clear();s.input.forward=0;s.input.strafe=0;s.input.fire=false;s.input.interact=false;s.input.crouch=false;s.input.walk=false;s.input.aim=false;drag=false;}
function lock(){active=true;canvas.requestPointerLock?.().catch(()=>{active=true;});}
function unlock(){active=false;resetInput();if(document.pointerLockElement)document.exitPointerLock();}
function start(mode){s.difficulty=$('difficulty').value;restart(s);s.mode='match';if(mode!=='match')scenario(s,mode);shop=true;lock();ui();}
$('start').onclick=()=>start('match');$('range').onclick=()=>start('range');$('relay').onclick=()=>start('relay');
$('deploy').onclick=()=>{deploy(s);shop=false;lock();ui();};
for(const b of document.querySelectorAll('[data-buy]'))b.onclick=()=>{buy(s,b.dataset.buy);ui();};
function toggleSound(){const on=sound.toggle();$('sound').textContent=$('pauseSound').textContent=on?'SOUND ON':'SOUND OFF';}
$('sound').onclick=toggleSound;$('pauseSound').onclick=toggleSound;
$('resume').onclick=()=>{s.paused=false;lock();ui();};
$('restart').onclick=$('rematch').onclick=()=>{restart(s);s.mode='match';shop=true;unlock();ui();};
$('next').onclick=()=>{if(s.phase==='result'){startRound(s);shop=true;unlock();ui();}};
function pause(){if(s.phase==='live'){s.paused=true;unlock();ui();}}
addEventListener('keydown',e=>{
  if(['Space','ControlLeft','ControlRight','Tab','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();
  if(e.code==='Escape'){pause();return;}if(e.repeat)return;
  keys.add(e.code);
  if(e.code==='KeyR')reload(s);if(e.code==='KeyX')cancelReload(s);if(e.code==='KeyG')throwSmoke(s);
  if(e.code==='KeyB'&&s.phase==='buy'){shop=!shop;if(shop)unlock();else lock();ui();}
  if(e.code==='Enter'&&s.phase==='buy'){deploy(s);shop=false;lock();}
});
addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('mousedown',e=>{if(s.phase!=='live'||s.paused)return;if(e.button===0){s.input.fire=true;s.input.pressed=true;}if(e.button===2){drag=true;s.input.aim=true;}active=true;});
addEventListener('mouseup',e=>{if(e.button===0)s.input.fire=false;if(e.button===2){drag=false;s.input.aim=false;}});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(s.phase!=='live'||s.paused||!s.actors[0].alive)return;if(document.pointerLockElement===canvas||drag){const p=s.actors[0],sensitivity=s.input.aim?.0013:.0022;p.yaw-=e.movementX*sensitivity;p.pitch=Math.max(-1.35,Math.min(1.35,p.pitch-e.movementY*sensitivity));}});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas){active=true;if(s.phase==='buy'&&shop)unlock();}else if(active&&s.phase==='live')pause();});
addEventListener('blur',()=>{resetInput();pause();});addEventListener('resize',()=>view.resize());
function map(){
  const c=radar;c.clearRect(0,0,184,220);c.fillStyle='#142d36';c.fillRect(0,0,184,220);
  c.save();c.translate(92,110);c.scale(3.5,3.5);c.fillStyle='#49666a';
  for(const b of walls)c.fillRect(b.x-b.w/2,b.z-b.d/2,b.w,b.d);
  c.strokeStyle='#df9a67';c.lineWidth=.3;c.beginPath();c.arc(SITE.x,SITE.z,3,0,Math.PI*2);c.stroke();
  for(const a of s.actors)if(a.alive&&a.team===0){c.fillStyle=a.id===0?'#efdfbf':'#75c6c0';c.beginPath();c.arc(a.x,a.z,.9,0,Math.PI*2);c.fill();c.strokeStyle='#f0e6d4';c.beginPath();c.moveTo(a.x,a.z);c.lineTo(a.x-Math.sin(a.yaw)*2.5,a.z-Math.cos(a.yaw)*2.5);c.stroke();}
  c.restore();c.fillStyle='#ded3ba';c.font='9px monospace';c.fillText('N ↑   RELAY 01',10,15);c.fillStyle='#8eb8b5';c.fillText('FRIENDLY POSITIONS',10,210);
}
function ui(){
  const p=s.actors[0],w=WEAPONS[p.weapon],live=s.phase==='live';
  elements.menu.hidden=s.phase!=='menu';elements.hud.hidden=s.phase==='menu';elements.buy.hidden=s.phase!=='buy'||!shop;elements.pause.hidden=!s.paused;elements.result.hidden=s.phase!=='result'&&s.phase!=='match';
  let a=0,b=0;for(const bot of s.actors)if(bot.alive){if(bot.team===0)a++;else b++;}
  elements.score.textContent=`TIDE ${s.score[0]} : ${s.score[1]} GUARD`;
  const seconds=Math.max(0,Math.ceil(s.bomb.planted?s.bomb.time:s.phase==='buy'?s.phaseTime:s.roundTime));
  elements.clock.innerHTML=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}<small>${s.bomb.planted?'RELAY ARMED':s.phase==='buy'?'REQUISITIONS':`ROUND ${s.round} / FIRST TO 3`}</small>`;
  elements.location.textContent=zone(p.x,p.z);elements.objective.textContent=s.bomb.planted?'PROTECT THE RELAY • DENY THE DEFUSE':`SABOTAGE RELAY 01  /  ${a} TIDE : ${b} GUARD ALIVE`;
  elements.feed.textContent=s.feed.join('   |   ');elements.notice.textContent=s.messageTime>0?s.message:'';
  elements.vitals.innerHTML=`<small>HEALTH / ARMOR</small>${Math.ceil(p.hp)} <span style="font-size:16px;color:#9fbfb9">/ ${Math.ceil(p.armor)}</span>`;
  elements.utility.innerHTML=`<small>REQUISITION FUNDS</small>$${s.money}  ·  SMOKE ${s.grenades}`;
  elements.ammo.innerHTML=`<small>${w.name.toUpperCase()}${p.reload>0?' / RELOADING':''}</small>${p.ammo} <span>/ ${p.reserve}</span>`;
  const near=Math.hypot(p.x-SITE.x,p.z-SITE.z)<SITE.radius;
  elements.prompt.textContent=!p.alive?'SPECTATING MICA • ROUND CONTINUES':p.reload>0?'RELOADING • X TO CANCEL':near&&!s.bomb.planted?'HOLD E • SABOTAGE RELAY':s.bomb.defuse>0?'DEFENDER DISARMING • INTERRUPT NOW':'';
  const progress=s.bomb.planted?s.bomb.defuse/5:s.bomb.progress/3;elements.progress.style.display=progress>0?'block':'none';elements.progress.firstElementChild.style.width=`${progress*100}%`;
  elements.damage.style.opacity=s.damageMark;elements.crosshair.hidden=!live||!p.alive||s.paused;
  elements.crosshair.style.transform=`scale(${1+Math.hypot(p.vx,p.vz)*.12+p.recoil*5})`;
  $('buytime').textContent=` / ${Math.ceil(s.phaseTime)}s`;$('bank').textContent=`$${s.money} AVAILABLE  /  EQUIPPED: ${w.name}`;$('shopnotice').textContent=s.messageTime>0?s.message:'';
  $('resultlabel').textContent=s.phase==='match'?'OPERATION COMPLETE':`ROUND ${s.round} COMPLETE`;$('resulttitle').textContent=s.result;$('resultscore').textContent=`TIDE ${s.score[0]} — ${s.score[1]} GUARD`;
  $('resultdetail').textContent=`${s.winner===0?'Your team wins. +$2,200':'Defenders win. +$1,500'}  ${s.phase==='result'?`Next requisitions in ${Math.ceil(s.phaseTime)}s.`:'Play another operation from a clean economy.'}`;
  $('next').hidden=s.phase==='match';map();
}
function frame(now){
  const elapsed=Math.min(.25,(now-last)/1000);last=now;
  s.input.forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);s.input.strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);s.input.walk=keys.has('ShiftLeft')||keys.has('ShiftRight');s.input.crouch=keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('KeyC');s.input.interact=keys.has('KeyE');
  const alpha=advance(s,elapsed);
  if(s.phase!==previousPhase){if(s.phase==='buy'){shop=true;unlock();}if(s.phase==='result'||s.phase==='match')unlock();if(s.phase==='live'&&previousPhase==='buy'){shop=false;active=true;}previousPhase=s.phase;ui();}
  for(let n=Math.max(lastSeq+1,s.eventSeq-95);n<=s.eventSeq;n++)if(s.events[(n-1)%96].type==='confirm')hitTime=.15;lastSeq=s.eventSeq;hitTime=Math.max(0,hitTime-elapsed);elements.hitmarker.style.opacity=hitTime>0?1:0;
  sound.update(s);view.render(alpha,elapsed);uiClock+=elapsed;if(uiClock>.08){ui();uiClock=0;}
  requestAnimationFrame(frame);
}
// Read-only snapshots are available for QA and accessibility tooling. No mutation API in ordinary play.
Object.defineProperty(window,'tidebreak',{value:Object.freeze({state:()=>snapshot(s),renderInfo:()=>({frames:view.frames,calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles,webgl2:view.renderer.getContext() instanceof WebGL2RenderingContext}),version:'1.0.0'})});
ui();requestAnimationFrame(frame);
