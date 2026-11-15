// SPDX-License-Identifier: MIT
import {cpSync,mkdirSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildDossier} from './vendor/makefun-threejs.ts';
const root=fileURLToPath(new URL('.',import.meta.url));
const output=resolve(process.env.MAKEFUN_OUTPUT_DIR??'/output');
if(output===resolve(root)||output===resolve(root,'game'))throw Error('Output must not replace source.');
mkdirSync(output,{recursive:true});
if(readdirSync(output).length)throw Error('Use an empty output directory for a reproducible handoff.');
cpSync(join(root,'game'),join(output,'game'),{recursive:true});
if(process.argv.includes('--prepare')){console.log('Prepared static game at '+join(output,'game'));}
else{
  if(!existsSync(join(root,'screenshots')))throw Error('Capture real browser screenshots before building.');
  cpSync(join(root,'screenshots'),join(output,'screenshots'),{recursive:true});
  const dossier=buildDossier(output,{text_max_bytes:163840,screenshots:{max:4,max_bytes:262144},game_max_files:993,game_max_bytes:50331648,game_path_max_bytes:1000});
  writeFileSync(join(output,'dossier.json'),dossier);
  console.log('TIDEBREAK dossier built: '+dossier.length+' bytes');
}
