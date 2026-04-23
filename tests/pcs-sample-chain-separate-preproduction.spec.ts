import assert from 'node:assert/strict'

import {
  listPreProductionSampleTasks,
  resetPreProductionSampleTaskRepository,
  updatePreProductionSampleTask,
} from '../src/data/pcs-pre-production-sample-repository.ts'

resetPreProductionSampleTaskRepository()

const task = listPreProductionSampleTasks()[0]
assert.ok(task, '必须存在产前版样衣演示数据')

const updated = updatePreProductionSampleTask(task.preProductionSampleTaskId, {
  sampleChainMode: '新增一件产前版样衣',
  samplePlanLines: [
    {
      lineId: 'new-pre-production-01',
      sampleRole: '正确布确认样',
      materialMode: '正确布',
      quantity: 1,
      targetFactoryId: '',
      targetFactoryName: '',
      linkedSampleAssetId: 'sample_asset_new_1',
      linkedSampleCode: 'SY-NEW-001',
      status: '已确认',
      note: '',
    },
  ],
  finalReferenceSampleAssetIds: ['sample_asset_new_1'],
})

assert.equal(updated?.sampleChainMode, '新增一件产前版样衣')
assert.equal(updated?.samplePlanLines[0]?.sampleRole, '正确布确认样')
assert.equal(updated?.finalReferenceSampleAssetIds[0], 'sample_asset_new_1')

console.log('pcs-sample-chain-separate-preproduction.spec.ts PASS')
