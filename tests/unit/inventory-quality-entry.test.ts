import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
test('即时库存直达复用同一库存渲染器，不先展开全部仓储路由及其工艺来源',async()=>{
 const file=ts.createSourceFile('routes.ts',readFileSync(new URL('../../src/router/routes.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true)
 const node=file.statements.find(row=>ts.isFunctionDeclaration(row)&&row.name?.text==='resolvePage')!
 const js=ts.transpileModule(node.getText(file).replace(/^export /,'').replaceAll('import(','loadModule('),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 const calls:string[]=[]
 const resolve=new Function('normalizePathname','loadModule',`${js};return resolvePage`)((path:string)=>path.split('?')[0],async(path:string)=>{calls.push(path);assert.equal(path,'../pages/wls/finished/stock-realtime.ts');return {renderFinishedStockRealtime:()=>'<main>原库存</main>'}})
 assert.equal(await resolve('/wls/finished/stock/realtime?sku=SKU-GC-20001'),'<main>原库存</main>');assert.equal(calls.length,1)
})
