// SPDX-License-Identifier: MIT
// Local contract checks, not the official sealed scorer and not a judge score.
import {createRequire} from 'node:module';
import {readFileSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {buildDossier,readGameTree,htmlFacts,importMapOf,resolveGamePath,isRelativeSpecifier,importMapMatch} from '../vendor/makefun-threejs.ts';
const require=createRequire(import.meta.url);
const acorn=require('internal/deps/acorn/acorn/dist/acorn');
const out=resolve(process.argv[2]);
if(!out.startsWith('/tmp/makefun/fps-'))throw Error('Tests require explicit /tmp/makefun/fps- output');
const caps={text_max_bytes:163840,screenshots:{max:4,max_bytes:262144},game_max_files:993,game_max_bytes:50331648,game_path_max_bytes:1000};
const rows=[];
function row(name,fn){try{const detail=fn();rows.push({name,pass:true,detail});}catch(e){rows.push({name,pass:false,detail:e.message});}}
function assert(ok,msg){if(!ok)throw Error(msg);}
const tree=readGameTree(join(out,'game'),caps),files=new Set(tree.files.map(f=>f.path)),facts=htmlFacts(readFileSync(join(out,'game/index.html'),'utf8')),map=importMapOf(facts).map;
const hash=b=>createHash('sha256').update(b).digest('hex');
row('game_files',()=>{assert(tree.count<=993&&tree.totalBytes<=50331648,'Game caps');assert(lstatSync(join(out,'game/index.html')).size<=1048576,'Index cap');let total=0,count=0;function walk(p){for(const f of readdirSync(p)){const q=join(p,f),st=lstatSync(q);count++;assert(st.isDirectory()||st.isFile(),'Special file');if(st.isDirectory())walk(q);else total+=st.size;}}walk(out);assert(count<=1000&&total<=67108864,'Output cap');return {entries:tree.count,bytes:tree.totalBytes,outputEntries:count,outputBytes:total};});
row('three_js',()=>{assert(facts.importMaps.length===1&&map,'Single valid import map');const p=resolveGamePath(map.imports.three,'index.html');assert(p==='vendor/three/three.module.min.js','Three mapping');const hashes={};for(const [name,expected] of [['three.module.min.js','ef510bae547ab3789d6ed543333a8bf42510a8c70743b766c4e19039b976c26b'],['three.core.min.js','613e370f76638fdef83926642bf256dc9615684922de1ce1f63a8583e5d78578']]){const h=hash(readFileSync(join(out,'game/vendor/three',name)));assert(h===expected,'Vendor mismatch');hashes[name]=h;}return hashes;});
let parsed=0,referenceCount=0;
function ref(spec,from,module=false){let p;if(module&&!isRelativeSpecifier(spec)){const m=importMapMatch(map,spec,from);assert(m.found&&m.value,'Unmapped import '+spec);p=resolveGamePath(m.value,'index.html');}else p=resolveGamePath(spec,from);assert(p&&files.has(p),'Unresolved or external '+spec+' from '+from);referenceCount++;}
function ast(source,from){const tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});parsed++;function walk(n){if(!n||typeof n!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type)&&n.source)ref(n.source.value,from,true);if(n.type==='ImportExpression'){assert(n.source.type==='Literal','Nonliteral dynamic import');ref(n.source.value,from,true);}for(const key of Object.keys(n)){const child=n[key];if(Array.isArray(child)){for(const c of child)walk(c);}else if(child&&typeof child==='object')walk(child);}}walk(tree);}
row('references',()=>{for(const a of facts.scripts){if(a.src)ref(a.src,'index.html');else if(a.type==='module')ast(a.text,'index.html');}for(const a of facts.links)ref(a.href,'index.html');for(const a of facts.resources)ref(a.src,'index.html');for(const value of Object.values(map.imports))if(value)ref(value,'index.html');for(const f of tree.files)if(/\.(mjs|js)$/.test(f.path))ast(readFileSync(join(out,'game',f.path),'utf8'),f.path);return {referenceCount,parsedModules:parsed};});
row('screenshots',()=>{const shots=readdirSync(join(out,'screenshots')).filter(n=>!n.startsWith('.'));assert(shots.length>=3&&shots.length<=4,'Image count');for(const n of shots){assert(/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(n),'Image name');assert(lstatSync(join(out,'screenshots',n)).isFile(),'Image regular file');assert(lstatSync(join(out,'screenshots',n)).size<=262144,'Image size');}const data=JSON.parse(readFileSync(process.env.TIDEBREAK_IMAGE_REPORT??'/tmp/makefun/fps-images.json','utf8'));assert(data.every(i=>i.valid),'Pillow decode/dimension checks');return data;});
row('dossier_matches',()=>{const actual=readFileSync(join(out,'dossier.json')),expected=buildDossier(out,caps);assert(actual.equals(Buffer.from(expected)),'Dossier bytes');assert(actual.length<=1572864,'Dossier size');const doc=JSON.parse(actual);assert(Buffer.byteLength(doc.text)<=163840&&!doc.text.includes('[Cut at'),'Source truncated');return {bytes:actual.length,textBytes:Buffer.byteLength(doc.text),sha256:hash(actual)};});
row('js_parses',()=>{assert(parsed>=7,'All modules parsed in references row');return {parsed};});
console.log(JSON.stringify({localOnly:true,passed:rows.filter(r=>r.pass).length,total:rows.length,sourceBytes:tree.files.filter(f=>f.cls==='source').reduce((n,f)=>n+f.bytes,0),rows},null,2));
if(rows.some(r=>!r.pass))process.exitCode=1;
