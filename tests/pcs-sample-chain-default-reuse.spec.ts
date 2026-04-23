import assert from 'node:assert/strict'

import { listFirstSampleTasks, resetFirstSampleTaskRepository, updateFirstSampleTask } from '../src/data/pcs-first-sample-repository.ts'
import { listPreProductionSampleTasks, resetPreProductionSampleTaskRepository } from '../src/data/pcs-pre-production-sample-repository.ts'

resetFirstSampleTaskRepository()
resetPreProductionSampleTaskRepository()

const first = listFirstSampleTasks()[0]
assert.ok(first, '必须存在首版样衣演示数据')
updateFirstSampleTask(first.firstSampleTaskId, {
  sampleAssetId: 'sample_asset_reuse_1',
  sampleCode: 'SY-REUSE-001',
  reuseAsPreProductionFlag: true,
  reuseAsPreProductionConfirmedAt: '2026-04-23 10:00:00',
  reuseAsPreProductionConfirmedBy: '测试用户',
})

const preProduction = listPreProductionSampleTasks().find((item) => item.sampleChainMode === '直接复用首版样衣')
assert.ok(preProduction, '必须存在产前版样衣演示数据')
assert.equal(preProduction.sampleChainMode, '直接复用首版样衣')
assert.ok(preProduction.samplePlanLines.some((line) => line.sampleRole === '复用首版样衣'))

console.log('pcs-sample-chain-default-reuse.spec.ts PASS')
