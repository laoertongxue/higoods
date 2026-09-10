import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { listDyeWorkOrderOnlineRows, filterDyeWorkOrderOnlineRows } from '../src/data/fcs/dye-work-order-online-view.ts'
import { listDyeWorkOrders, completeDyeInputReceipt } from '../src/data/fcs/dyeing-task-domain.ts'
import { renderCraftDyeingWorkOrdersPage } from '../src/pages/process-factory/dyeing/work-orders.ts'
let start = performance.now()
const rows = listDyeWorkOrderOnlineRows()
const initialProjectionMs = performance.now() - start
start = performance.now()
filterDyeWorkOrderOnlineRows(listDyeWorkOrderOnlineRows(), {keyword: rows[0].workOrderNo})
const reprojectionQueryMs = performance.now() - start
start = performance.now()
const filtered = filterDyeWorkOrderOnlineRows(rows, {keyword: rows[0].workOrderNo})
const snapshotFilterMs = performance.now() - start
assert.equal(filtered.length, 1)
const order = listDyeWorkOrders().find(item => item.status === 'WAIT_MATERIAL' && !item.requiresWaterSoluble)!
assert(order)
const before = renderCraftDyeingWorkOrdersPage()
completeDyeInputReceipt(order.dyeOrderId, { outputQty: 123.45, receiptId: 'SNAPSHOT-INVALIDATE', upstreamRecordId: 'SNAPSHOT-SOURCE', operatorName: '快照验收' })
const after = renderCraftDyeingWorkOrdersPage()
assert.notEqual(after, before, '路由重入必须丢弃旧快照')
assert(after.includes('123.45'), '路由重入必须读取外部更新后的数量')
const source = readFileSync(new URL('../src/pages/process-factory/dyeing/work-orders.ts', import.meta.url), 'utf8')
assert.match(source, /updateDyeWorkOrderFromPfos\(dyeOrderId, input\)\s+state\.rowsSnapshot = null/, '保存成功必须失效本页快照')
assert.equal((source.match(/listDyeWorkOrderOnlineRows\(\)/g) ?? []).length, 1, '列表仅快照入口允许投影，不得每个动作重复投影')
const evidence = {generatedAt: new Date().toISOString(), measuredEnvironment:'Node source projection benchmark; browser interaction measured separately', initialProjectionMs, reprojectionQueryMs, snapshotFilterMs, resultRows:filtered.length, checks:{routeReentryObservesExternalReceipt:'PASS (runtime)', successfulEditInvalidation:'PASS (source control-flow assertion)', singleProjectionEntry:'PASS (source assertion)'}, originalBeforeMeasurement:{reprojectionQueryMs:812.730292,snapshotFilterMs:0.103417}}
mkdirSync('output/playwright/process-order-review', {recursive:true})
writeFileSync('output/playwright/process-order-review/dye-snapshot-performance.json', JSON.stringify(evidence,null,2))
console.log(JSON.stringify(evidence,null,2))
