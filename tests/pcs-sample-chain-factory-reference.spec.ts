import assert from 'node:assert/strict'

import { getPreProductionSampleChainMissingFields } from '../src/data/pcs-sample-chain-service.ts'
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
  specialSceneReasonCodes: ['大货量大', '工厂参照样'],
  productionReferenceRequiredFlag: true,
  samplePlanLines: [
    {
      lineId: 'factory-reference-01',
      sampleRole: '工厂参照样',
      materialMode: '正确布',
      quantity: 3,
      targetFactoryId: 'factory_1',
      targetFactoryName: '参照工厂',
      linkedSampleAssetId: 'sample_asset_factory',
      linkedSampleCode: 'SY-FAC-001',
      status: '已确认',
      note: '',
    },
  ],
  finalReferenceSampleAssetIds: ['sample_asset_factory'],
})

assert.ok(updated?.samplePlanLines.some((line) => line.sampleRole === '工厂参照样'))
assert.equal(getPreProductionSampleChainMissingFields(updated!).includes('工厂参照样计划'), false)

console.log('pcs-sample-chain-factory-reference.spec.ts PASS')
