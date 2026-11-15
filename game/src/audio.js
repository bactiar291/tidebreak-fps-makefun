// SPDX-License-Identifier: MIT
// Small reusable audio voice pool; no assets and no sound before explicit interaction.
export class Sound{
  constructor(){this.enabled=false;this.ctx=null;this.seq=0;this.voices=[];this.cursor=0;}
  init(){if(this.ctx)return;this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=0;this.master.connect(this.ctx.destination);
    for(let i=0;i<12;i++){const osc=this.ctx.createOscillator(),gain=this.ctx.createGain(),pan=this.ctx.createStereoPanner();osc.type=i%2?'triangle':'sawtooth';gain.gain.value=0;osc.connect(gain).connect(pan).connect(this.master);osc.start();this.voices.push({osc,gain,pan});}
  }
  toggle(){this.init();this.enabled=!this.enabled;this.ctx.resume();this.master.gain.value=this.enabled?.18:0;return this.enabled;}
  play(freq,duration,volume,pan=0){if(!this.ctx||!this.enabled)return;const v=this.voices[this.cursor++%12],t=this.ctx.currentTime;v.osc.frequency.cancelScheduledValues(t);v.osc.frequency.setValueAtTime(freq,t);v.osc.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.35),t+duration);v.gain.gain.cancelScheduledValues(t);v.gain.gain.setValueAtTime(volume,t);v.gain.gain.exponentialRampToValueAtTime(.001,t+duration);v.pan.pan.value=pan;}
  update(s){const p=s.actors[0];for(let n=Math.max(this.seq+1,s.eventSeq-95);n<=s.eventSeq;n++){const e=s.events[(n-1)%96],d=Math.hypot(e.x-p.x,e.z-p.z),volume=1/(1+d*.18),pan=Math.max(-1,Math.min(1,((e.x-p.x)*Math.cos(p.yaw)-(e.z-p.z)*Math.sin(p.yaw))/15));
    if(e.type==='shot')this.play(e.id===0?135:100,.11,volume,pan);else if(e.type==='step')this.play(65,.045,volume*.25,pan);else if(e.type==='reload'||e.type==='ready')this.play(350,.07,volume*.35,pan);else if(e.type==='confirm')this.play(e.head?900:600,.09,.4);else if(e.type==='plant'||e.type==='round')this.play(440,.4,.5);else if(e.type==='smoke')this.play(90,.5,.35,pan);
  }this.seq=s.eventSeq;}
}
