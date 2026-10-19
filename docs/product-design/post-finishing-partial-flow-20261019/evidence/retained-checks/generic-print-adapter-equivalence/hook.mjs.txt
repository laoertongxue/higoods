import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
const path='/Users/laoer/.codex/worktrees/81b7/higoods/src/pages/print/print-preview.ts';
registerHooks({load(url,context,nextLoad){return url.split('?')[0]===new URL('file://'+path).href?{format:'module-typescript',source:readFileSync(path,'utf8')+'\nexport {loadPrintAdapter as isolatedLoadPrintAdapter};\n',shortCircuit:true}:nextLoad(url,context)}});
