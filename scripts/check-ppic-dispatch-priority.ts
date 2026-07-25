import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getCutPieceReleaseSummaryForProductionOrder } from '../src/data/fcs/cut-piece-release.ts'
import { listSewingDispatchWorkbenchTasks } from '../src/data/fcs/sewing-dispatch-workbench.ts'

const summary = getCutPieceReleaseSummaryForProductionOrder('po-14671')
assert.ok(summary, 'PPIC 必须能读到裁片放行摘要')
assert.ok(summary.ppicAvailableDispatchQty >= 0, 'PPIC 可派总量必须存在')
assert.ok(summary.releaseAvailableStatus !== null, '放行状态不能为 null')

const ppicSummaries = listSewingDispatchWorkbenchTasks()
  .map((task) => getCutPieceReleaseSummaryForProductionOrder(task.productionOrderId))
  .filter((item): item is NonNullable<typeof item> => Boolean(item))
const ppicStatuses = new Set(ppicSummaries.map((item) => item.releaseAvailableStatus))
assert.ok(ppicSummaries.length >= 4, 'PPIC工作台必须至少有 4 个任务能读到裁片放行摘要，支撑跨页面演示')
assert.ok(ppicStatuses.has('按齐套放行'), 'PPIC工作台必须覆盖按齐套放行摘要')
assert.ok(ppicStatuses.has('风险放行'), 'PPIC工作台必须覆盖风险放行摘要')
assert.ok(ppicStatuses.has('暂不放行'), 'PPIC工作台必须覆盖暂不放行摘要')
assert.ok(ppicStatuses.has('确认后需复核'), 'PPIC工作台必须覆盖确认后需复核摘要')

const sewingSource = readFileSync(
  resolve(process.cwd(), 'src/pages/sewing-dispatch-workbench.ts'), 'utf8')
const sewingDataSource = readFileSync(
  resolve(process.cwd(), 'src/data/fcs/sewing-dispatch-workbench.ts'), 'utf8')
assert.match(sewingSource, /ppicAvailableDispatchQty/, 'PPIC页面必须引用PPIC可派总量')
assert.match(sewingSource, /totalRiskReleaseQty/, 'PPIC页面必须引用风险放行数量')
assert.match(sewingSource, /totalTargetQty/, 'PPIC页面必须引用裁床目标')
assert.match(sewingSource, /当前可派车缝/, 'PPIC摘要必须优先展示当前可派车缝')
assert.match(sewingSource, /超可派派工|overDispatchQty|二次确认/, '必须处理超可派情况')
assert.doesNotMatch(sewingSource, /row\.remainingQty\s*<=\s*maxAvail/, 'PPIC候选行不能用可派总量前置过滤，否则超可派二次确认无法触发')
assert.match(sewingDataSource, /cutPieceReleaseVersionSnapshots/, 'PPIC派工草稿必须保留当时引用的裁床放行版本快照')
assert.match(sewingDataSource, /latestReleaseVersion/, 'PPIC派工草稿必须记录裁床放行版本号')

const materialPrepSource = readFileSync(
  resolve(process.cwd(), 'src/pages/fcs/material-prep/sewing.ts'), 'utf8')
assert.match(materialPrepSource, /ppicAvailableDispatchQty|releaseAvailableStatus/, '配料页必须使用新口径')

console.log('[check-ppic-dispatch-priority] PPIC可做数量优先检查通过')
