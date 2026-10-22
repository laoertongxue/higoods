import assert from 'node:assert/strict'
import test from 'node:test'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'

// Execute the real page renderer with narrow display/read dependencies. This
// asserts one coherent inventory read and actual stale/filter outputs, not time.
test('在线库存每次渲染只投影一次，未盘点统计与筛选共用全库存日期且下次读取新库存',async()=>{
 const key='__inventorySingleRenderContract',boundary:any={reads:0,config:null,rows:[],host:{innerHTML:''},filter:{}}
 boundary.rows=Array.from({length:40},(_,i)=>({id:String(i),spu:'SPU-'+i,sku:'SKU-'+i,warehouseName:i===0?'旧仓':'新仓',zone:'正常',countedAt:i===0?'2026-10-01 12:00:00':'2026-10-21 12:00:00',onHand:1,available:1}))
 const original=await readFile(new URL('../../src/pages/wls/stock-online/warehouse-stock.ts',import.meta.url),'utf8')
 const compiled=ts.transpileModule(original,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 const implementations:Record<string,string>={
  finishedInventoryOnlineRows:`()=>{f.reads++;if(f.reads>3)throw Error('重复读取全库存');return structuredClone(f.rows)}`,
  escapeHtml:'value=>String(value)',normalizeListColumnPreferences:'(_rules,defaults)=>defaults',
  sortStandardListRows:'rows=>rows',paginateStandardListRows:'(rows,page,size)=>({rows:rows.slice(0,size),currentPage:1,total:rows.length,pageSize:size})',
  renderStandardListPage:'config=>{f.config=config;return "rendered"}',renderStandardListStats:'value=>value',renderStandardListTable:'value=>value',
 }
 const code=compiled.replace(/import\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g,(_line,names)=>{
  const stub=`const f=globalThis[${JSON.stringify(key)}];`+names.split(',').map((value:string)=>{const name=value.trim();return `export const ${name}=${implementations[name]||'()=>""'};`}).join('')
  return `import {${names}} from ${JSON.stringify('data:text/javascript;base64,'+Buffer.from(stub).toString('base64'))};`
 })
 ;(globalThis as any)[key]=boundary
 const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document')
 Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:(selector:string)=>selector.includes('workspace')?boundary.host:{querySelector:(s:string)=>({value:boundary.filter[s.match(/field="([^"]+)/)?.[1]||'']||''})}}})
 try{
  const page=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
  page.renderWarehouseStock();assert.equal(boundary.reads,1);assert.equal(boundary.config.tableHtml.rows.length,10)
  assert.equal(boundary.config.statsHtml.find((r:any)=>r.label==='15天未盘点 SKU').value,'1 个')
  boundary.reads=0;boundary.filter={warehouse:'旧仓',stale:'仅15天未盘点'}
  const action={dataset:{wlsOnlineWarehouseStockAction:'apply-filter'}}
  page.handleWarehouseStockEvent({closest:(selector:string)=>selector.includes('-field]')?null:action})
  assert.equal(boundary.reads,1);assert.equal(boundary.config.tableHtml.rows.length,1);assert.equal(boundary.config.tableHtml.rows[0].spu,'SPU-0')
  boundary.reads=0;boundary.rows[0].countedAt='2026-10-21 12:00:00';page.renderWarehouseStock()
  assert.equal(boundary.reads,1);assert.equal(boundary.config.tableHtml.rows.length,0)
 }finally{if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document');Reflect.deleteProperty(globalThis,key)}
})

// A render must use one actual snapshot for totals, filters, table and cards.
// A following render must read the updated inventory instead of keeping a cache.
test('成衣即时库存同次页面的数量、仓库和明细共用一次读取，下次渲染读取新库存',async()=>{
 const key='__realtimeSingleRenderContract',f:any={reads:0,config:null,rows:[
  {id:'A',warehouseId:'WA',warehouseName:'甲仓',sku:'SKU-A',spu:'SPU-A',productName:'甲款',spotStock:11},
  {id:'B',warehouseId:'WB',warehouseName:'乙仓',sku:'SKU-B',spu:'SPU-B',productName:'乙款',spotStock:5},
 ]}
 const original=await readFile(new URL('../../src/pages/wls/finished/stock-realtime.ts',import.meta.url),'utf8')
 const compiled=ts.transpileModule(original,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 const implementations:Record<string,string>={
  finishedInventoryRealtimeRows:'()=>{f.reads++;return structuredClone(f.rows)}',escapeHtml:'value=>String(value)',
  normalizeListColumnPreferences:'(_rules,defaults)=>defaults',sortStandardListRows:'rows=>rows',
  paginateStandardListRows:'(rows,page,size)=>({rows:rows.slice(0,size),currentPage:1,total:rows.length,totalPages:1,pageSize:size,from:rows.length?1:0,to:Math.min(size,rows.length)})',
  renderStandardListPage:'config=>{f.config=config;return "rendered"}',renderStandardListStats:'value=>value',renderStandardListTable:'value=>value',
 }
 const code=compiled.replace(/import\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g,(_line,names)=>{
  const stub=`const f=globalThis[${JSON.stringify(key)}];`+names.split(',').map((value:string)=>{const name=value.trim();return `export const ${name}=${implementations[name]||'()=>""'};`}).join('')
  return `import {${names}} from ${JSON.stringify('data:text/javascript;base64,'+Buffer.from(stub).toString('base64'))};`
 })
 ;(globalThis as any)[key]=f
 try{
  const page=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
  page.renderFinishedStockRealtime();assert.equal(f.reads,1,'同次页面不应反复投影全库存')
  assert.deepEqual(f.config.tableHtml.rows.map((row:any)=>row.id),['A','B'])
  assert.deepEqual(f.config.statsHtml.map((row:any)=>row.value),['2 条','1 条','1 条'])
  assert.match(f.config.filtersHtml,/甲仓/);assert.match(f.config.filtersHtml,/乙仓/)
  f.reads=0;f.rows.push({id:'C',warehouseId:'WC',warehouseName:'丙仓',sku:'SKU-C',spu:'SPU-C',productName:'丙款',spotStock:0})
  page.renderFinishedStockRealtime();assert.equal(f.reads,1)
  assert.deepEqual(f.config.tableHtml.rows.map((row:any)=>row.id),['A','B','C'])
  assert.deepEqual(f.config.statsHtml.map((row:any)=>row.value),['3 条','1 条','1 条']);assert.match(f.config.filtersHtml,/丙仓/)
  const priorWindow=(globalThis as any).window
  try{
   ;(globalThis as any).window={location:{search:'?sku=SKU-B'},localStorage:{}}
   f.reads=0;page.renderFinishedStockRealtime();assert.equal(f.reads,1)
   assert.deepEqual(f.config.tableHtml.rows.map((row:any)=>row.id),['B'])
   assert.deepEqual(f.config.statsHtml.map((row:any)=>row.value),['1 条','0 条','1 条'],'统计应与实际SKU筛选结果一致')
  }finally{if(priorWindow===undefined)Reflect.deleteProperty(globalThis,'window');else (globalThis as any).window=priorWindow}
 }finally{Reflect.deleteProperty(globalThis,key)}
})
