import esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const dir=path.resolve('output/learner-attention/browser');
await esbuild.build({entryPoints:[dir+'/entry.tsx'],outfile:dir+'/app.js',bundle:true,format:'iife',jsx:'automatic',tsconfig:'apps/web/tsconfig.json',loader:{'.woff':'file','.woff2':'file','.ttf':'file'},plugins:[{name:'isolated-runtime',setup(build){
 build.onResolve({filter:/^@\/app\/actions\/admin-classes$/},()=>({path:dir+'/fixture.ts'}));
 build.onResolve({filter:/^(next\/link|@\/i18n\/navigation|@\/components\/shared\/theme-provider)$/},args=>({path:args.path,namespace:'qa-mock'}));
 build.onLoad({filter:/.*/,namespace:'qa-mock'},args=>({loader:'tsx',resolveDir:process.cwd(),contents:args.path==='next/link'?`import React from 'react';export default React.forwardRef(function Link({href,children,...props},ref){return <a ref={ref} href={href} {...props}>{children}</a>})`:args.path.includes('navigation')?`export function useRouter(){return {replace(href,options){location.href='/'+(options?.locale??(location.pathname.startsWith('/vi/')?'vi':'en'))+href},refresh(){location.reload()}}}`:`export function useCspNonce(){return undefined}` }));
}}]});
const css=await fs.readFile('apps/web/src/app/globals.css','utf8');
const result=await postcss([tailwind({base:path.resolve('apps/web')})]).process(css,{from:path.resolve('apps/web/src/app/globals.css')});
await fs.writeFile(dir+'/styles.css',result.css);
await fs.writeFile(dir+'/index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
console.log('Synthetic harness bundled from '+process.cwd());
