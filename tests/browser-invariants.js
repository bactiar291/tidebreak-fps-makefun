// Executed in browser QA against isolated real simulation instances, never the rendered scene.
async () => {
  const m=await import('./src/sim.js');
  const results=[];
  const check=(name,pass)=>{results.push({name,passed:!!pass});if(!pass)throw Error(name);};
  const live=()=>{const s=m.createState();s.phase='buy';m.deploy(s);return s;};
  const ticks=(s,n)=>{for(let i=0;i<n;i++)m.step(s);};
  let s=live(),p=s.actors[0],b=s.actors[2];
  p.x=-18;p.z=10;b.x=-18;b.z=0;
  m.trace(s,p,0,0,-1);check('browser head hitbox',s.traceTarget===b&&s.traceHead);
  const d=Math.hypot(10,.55);m.trace(s,p,0,-.55/d,-10/d);check('browser body hitbox',s.traceTarget===b&&!s.traceHead);
  s=live();s.bomb.planted=true;s.bomb.time=.1;s.actors[0].alive=false;s.actors[1].alive=false;ticks(s,8);check('browser detonation after attackers dead',s.result==='RELAY DISABLED'&&s.score[0]===1);
  ticks(s,8);check('browser score awarded once',s.awards===1);
  s=live();s.roundTime=0;m.step(s);check('browser timeout',s.result==='TIME EXPIRED');
  s=live();for(const a of s.actors)if(a.team===1)a.alive=false;m.step(s);check('browser elimination',s.result==='DEFENDERS ELIMINATED');
  s=live();for(let r=0;r<3;r++){m.award(s,0,'TEST');if(r<2){m.startRound(s);m.deploy(s);}}check('browser complete match',s.phase==='match'&&s.score[0]===3);m.restart(s);check('browser match reset',s.phase==='buy'&&s.score[0]===0&&s.money===2400);
  return results;
}
