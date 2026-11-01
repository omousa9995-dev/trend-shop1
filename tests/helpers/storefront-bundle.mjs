import {buildSync} from 'esbuild';
// Exercise the actual module graph, including lazy phone validation and localization.
// Concatenating files after deleting import statements loses imported aliases and modules.
export const storefrontBundle=buildSync({entryPoints:[new URL('../../public/app.js',import.meta.url).pathname],bundle:true,format:'iife',write:false,target:'es2022',logLevel:'silent'}).outputFiles[0].text;
