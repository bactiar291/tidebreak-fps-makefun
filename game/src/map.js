// SPDX-License-Identifier: MIT
// Shared collision/render plan. X east, Z south; metres. The canal ramps are walkable.
export const SITE = { x: 3, z: -18, radius: 2.8 };
export const walls = [];
const wall = (x,z,w,d,h,kind='stone') => walls.push({x,z,w,d,h,kind});
wall(-21,0,1,56,.65,'sea'); wall(21,0,1,56,5); wall(0,-28,43,1,4); wall(0,28,43,1,3);
// Pump hall: three doors, north service exit, open windows above cover height.
wall(7,8,1,15,4.8,'teal'); wall(18,7,1,19,4.8,'stone');
wall(10,17,7,1,4.8); wall(17,17,3,1,4.8);
wall(9,-3,5,1,4.8,'teal'); wall(17,-3,3,1,4.8,'teal');
wall(13,6,3,3,1.4,'machine'); wall(15,12,3.5,2,1.1,'machine');
// Generator court breaks the direct spawn-to-relay angle.
wall(-1,8,5,3,2.1,'crate'); wall(-1,-3,4,3,1.45,'machine');
wall(7,-9,8,2,2.2,'machine'); wall(15,-16,3,5,2.7,'teal');
wall(-9,-16,5,3,2.4,'stone'); wall(-13,-5,3,4,1.25,'crate');
wall(-15,12,4,2,1.3,'crate'); wall(-8,20,3,2,1.5,'crate');
wall(1,-23,8,2,2,'teal');
export function floorY(x,z) {
  if (x < -9 || x > -4 || z < -14 || z > 17) return 0;
  return -.65 * Math.min(1,(z+14)/4,(17-z)/4);
}
export function zone(x,z) {
  if(z < -12) return 'RELAY / 01';
  if(x>7 && z>-3 && z<17) return 'PUMP HALL';
  if(x < -10) return 'SEAWARD PIER';
  if(x < -4) return 'LOWER CANAL';
  return 'GENERATOR COURT';
}
export function blocked(x,z,r=.34) {
  for (const b of walls) {
    const dx=Math.max(Math.abs(x-b.x)-b.w/2,0), dz=Math.max(Math.abs(z-b.z)-b.d/2,0);
    if(dx*dx+dz*dz < r*r) return true;
  }
  return false;
}
export function move(a,dx,dz) {
  // Substeps prevent tunnelling even under unusually large externally supplied displacements.
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
  for(let i=0;i<n;i++) {
    if(!blocked(a.x+dx/n,a.z)) a.x+=dx/n; else a.vx=0;
    if(!blocked(a.x,a.z+dz/n)) a.z+=dz/n; else a.vz=0;
  }
}
export function boxRay(ox,oy,oz,dx,dy,dz,b,max=100) {
  let lo=0,hi=max;
  const minX=b.x-b.w/2,maxX=b.x+b.w/2,minZ=b.z-b.d/2,maxZ=b.z+b.d/2;
  for(let k=0;k<3;k++) {
    const o=k===0?ox:k===1?oy:oz, d=k===0?dx:k===1?dy:dz;
    const low=k===0?minX:k===1?(b.y??0):minZ, high=k===0?maxX:k===1?(b.y??0)+b.h:maxZ;
    if(Math.abs(d)<1e-8) { if(o<low||o>high)return Infinity; }
    else {let a=(low-o)/d,c=(high-o)/d;if(a>c){const t=a;a=c;c=t;}lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return Infinity;}
  }
  return lo;
}
export function wallDistance(ox,oy,oz,dx,dy,dz,max=100) {
  let nearest=max;
  for(const b of walls) nearest=Math.min(nearest,boxRay(ox,oy,oz,dx,dy,dz,b,max));
  return nearest;
}
export function clearLine(x,z,tx,tz,r=.4) {
  const d=Math.hypot(tx-x,tz-z),n=Math.ceil(d/.3);
  for(let i=1;i<=n;i++)if(blocked(x+(tx-x)*i/n,z+(tz-z)*i/n,r))return false;
  return true;
}
export const nodes = [
  [0,23],[-6,24],[-12,23],[-18,18],[-18,8],[-18,-1],[-18,-12],[-15,-21],[-6,-22],[3,-18],
  [-6,14],[-6,5],[-6,-5],[-5,-12],[2,15],[3,5],[3,-1],[1,-8],[1,-13],
  [14,21],[14,16],[10,11],[10,2],[13,-3],[13,-7],[18,-9],[18,-22],[10,-21]
];
const links=nodes.map(()=>[]);
for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  if(clearLine(...nodes[i],...nodes[j],.48)){const d=Math.hypot(nodes[i][0]-nodes[j][0],nodes[i][1]-nodes[j][1]);links[i].push([j,d]);links[j].push([i,d]);}
}
// Static all-pairs next-hop table; navigation allocates nothing during a simulation tick.
const dist=nodes.map((_,i)=>nodes.map((_,j)=>i===j?0:Infinity));
const next=nodes.map((_,i)=>nodes.map((_,j)=>j));
for(let i=0;i<nodes.length;i++)for(const [j,d] of links[i])dist[i][j]=d;
for(let k=0;k<nodes.length;k++)for(let i=0;i<nodes.length;i++)for(let j=0;j<nodes.length;j++)if(dist[i][k]+dist[k][j]<dist[i][j]){dist[i][j]=dist[i][k]+dist[k][j];next[i][j]=next[i][k];}
export function route(a,tx,tz) {
  if(clearLine(a.x,a.z,tx,tz)) {a.navX=tx;a.navZ=tz;return;}
  let from=-1,to=-1,best=Infinity,end=Infinity;
  for(let i=0;i<nodes.length;i++){
    const [x,z]=nodes[i],d=Math.hypot(x-a.x,z-a.z),e=Math.hypot(x-tx,z-tz);
    if(d<best&&clearLine(a.x,a.z,x,z)){from=i;best=d;}
    if(e<end&&clearLine(tx,tz,x,z)){to=i;end=e;}
  }
  if(from<0||to<0){a.navX=a.x;a.navZ=a.z;return;}
  const hop=next[from][to];
  const pick=clearLine(a.x,a.z,nodes[hop][0],nodes[hop][1])?hop:from;
  a.navX=nodes[pick][0];a.navZ=nodes[pick][1];
}
