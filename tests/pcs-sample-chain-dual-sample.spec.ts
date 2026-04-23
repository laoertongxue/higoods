import assert from 'node:assert/strict'

import { createDefaultSamplePlanLines, getPreProductionSampleChainMissingFields } from '../src/data/pcs-sample-chain-service.ts'
import {
  listPreProductionSampleTasks,
  resetPreProductionSampleTaskRepository,
  updatePreProductionSampleTask,
} from '../src/data/pcs-pre-production-sample-repository.ts'

resetPreProductionSampleTaskRepository()

const task = listPreProductionSampleTasks()[0]
assert.ok(task, '必须存在产前版样衣演示数据')

const updated = updatePreProductionSampleTask(task.preProductionSampleTaskId, {
  sampleChainMode: '双样衣',
  specialSceneReasonCodes: ['定位印', '正确布确认'],
  correctFabricRequiredFlag: true,
  samplePlanLines: createDefaultSamplePlanLines('双样衣'),
  finalReferenceSampleAssetIds: ['correct_sample_asset'],
})

assert.equal(updated?.sampleChainMode, '双样衣')
assert.ok(updated?.samplePlanLines.some((line) => line.sampleRole === '替代布确认样'))
assert.ok(updated?.samplePlanLines.some((line) => line.sampleRole === '正确布确认样'))
assert.equal(getPreProductionSampleChainMissingFields(updated!).includes('替代布确认样'), false)
assert.equal(getPreProductionSampleChainMissingFields(updated!).includes('正确布确认样'), false)

console.log('pcs-sample-chain-dual-sample.spec.ts PASS')
