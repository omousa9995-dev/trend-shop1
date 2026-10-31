import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
await build({entryPoints:['src/contact-phone.js'],outfile:'public/contact-phone.js',bundle:true,format:'esm',platform:'neutral',target:'es2020',minify:true,legalComments:'none',banner:{js:'/* Phone parsing: libphonenumber-js 1.13.15 (MIT). License: docs/licenses/libphonenumber-js-LICENSE.txt. */'}});
mkdirSync('docs/licenses',{recursive:true});
writeFileSync('docs/licenses/libphonenumber-js-LICENSE.txt',readFileSync('node_modules/libphonenumber-js/LICENSE'));
