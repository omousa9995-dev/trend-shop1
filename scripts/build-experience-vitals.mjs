import {build} from 'esbuild';
import fs from 'node:fs';
const version=JSON.parse(fs.readFileSync(new URL('../node_modules/web-vitals/package.json',import.meta.url))).version;
await build({stdin:{contents:"export {onLCP,onINP,onCLS} from 'web-vitals';",resolveDir:new URL('../',import.meta.url).pathname},bundle:true,format:'esm',target:'es2022',minify:true,outfile:new URL('../public/web-vitals-local.js',import.meta.url).pathname,banner:{js:`/* web-vitals ${version} — Google Chrome team, Apache-2.0. License: /licenses/web-vitals-LICENSE.txt */`}});
fs.mkdirSync(new URL('../docs/licenses/',import.meta.url),{recursive:true});fs.copyFileSync(new URL('../node_modules/web-vitals/LICENSE',import.meta.url),new URL('../docs/licenses/web-vitals-LICENSE.txt',import.meta.url));
fs.mkdirSync(new URL('../public/licenses/',import.meta.url),{recursive:true});fs.copyFileSync(new URL('../node_modules/web-vitals/LICENSE',import.meta.url),new URL('../public/licenses/web-vitals-LICENSE.txt',import.meta.url));
console.log('Built locally hosted web-vitals '+version);
