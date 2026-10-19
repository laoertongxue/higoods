import {registerHooks} from 'node:module';import {readFileSync} from 'node:fs';
const target='file:///Users/laoer/.codex/worktrees/81b7/higoods/src/data/wls/accessory-warehouse-post-finishing.ts';const before='/Users/laoer/.codex/worktrees/81b7/higoods/docs/product-design/post-finishing-partial-flow-20261019/evidence/retained-checks/task-material-readiness-before/src/data/wls/accessory-warehouse-post-finishing.ts';
registerHooks({load(url,context,next){return url.split('?')[0]===target?{format:'module-typescript',source:readFileSync(before,'utf8'),shortCircuit:true}:next(url,context)}});
