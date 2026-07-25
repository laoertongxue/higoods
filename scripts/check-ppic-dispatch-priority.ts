import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getCutPieceReleaseSummaryForProductionOrder } from '../src/data/fcs/cut-piece-release.ts'

const summary = getCutPieceReleaseSummaryForProductionOrder('po-14671')
assert.ok(summary, 'PPIC 必须能读到裁片放行摘要')
assert.ok(summary.ppicAvailableDispatchQty >= 0, 'PPIC 可派总量必须存在')
assert.ok(summary.releaseAvailableStatus !== null, '放行状态不能为 null')

const sewingSource = readFileSync(
  resolve(process.cwd(), 'src/pages/sewing-dispatch-workbench.ts'), 'utf8')
assert.match(sewingSource, /ppicAvailableDispatchQty/, 'PPIC页面必须引用PPIC可派总量')
assert.match(sewingSource, /totalRiskReleaseQty/, 'PPIC页面必须引用风险放行数量')
assert.match(sewingSource, /totalTargetQty/, 'PPIC页面必须引用裁床目标')
assert.match(sewingSource, /当前可派车缝/, 'PPIC摘要必须优先展示当前可派车缝')
assert.match(sewingSource, /超可派派工|overDispatchQty|二次确认/, '必须处理超可派情况')

const materialPrepSource = readFileSync(
  resolve(process.cwd(), 'src/pages/fcs/material-prep/sewing.ts'), 'utf8')
assert.match(materialPrepSource, /ppicAvailableDispatchQty|releaseAvailableStatus/, '配料页必须使用新口径')

console.log('[check-ppic-dispatch-priority] PPIC可做数量优先检查通过')
