import assert from 'node:assert/strict'
import test from 'node:test'
import { listEngineeringIndependentSamplingRecords, normalizeEngineeringDesignRevisionRecord } from '../../src/data/pcs-engineering-master-sampling.ts'

test('旧设计任务移除线下工作和依赖，保留加工单身份、样衣成果及原始输入', () => {
  const record = structuredClone(listEngineeringIndependentSamplingRecords().find(row => row.professionalTasks.some(task => task.taskType === 'DISPLAY_SAMPLE'))!)
  const sample = record.professionalTasks.find(task => task.taskType === 'DISPLAY_SAMPLE')!
  const ref = { processType: 'PRINTING' as const, processOrderId: 'historic-print', processOrderCode: 'PH-HISTORIC', sourceKey: 'frozen-source', targetColor: '白', bomVersionId: 'bom', bomItemId: 'line', materialSkuId: 'sku', prerequisiteProcessOrderId: 'dyed-first' }
  const retired = { ...structuredClone(sample), taskId: 'old-artwork', taskType: 'PATTERN_ARTWORK' as const, taskName: '花型任务', processWorkOrderRefs: [ref] }
  record.professionalTasks.push(retired, { ...retired, taskId: 'old-color', taskType: 'COLOR_FABRIC', taskName: '调色任务' })
  sample.dependsOnTaskIds.push('old-artwork', 'old-color')
  record.selectedTaskTypes.push('PATTERN_ARTWORK', 'COLOR_FABRIC')
  const result = normalizeEngineeringDesignRevisionRecord(record)
  const migrated = result.professionalTasks.find(task => task.taskType === 'DISPLAY_SAMPLE')!
  assert.ok(result.professionalTasks.every(task => ['BASE_PATTERN', 'DISPLAY_SAMPLE'].includes(task.taskType)))
  assert.ok(!migrated.dependsOnTaskIds.includes('old-artwork'))
  assert.equal(migrated.processWorkOrderRefs.filter(item => item.processOrderId === ref.processOrderId).length, 1)
  assert.deepEqual(migrated.processWorkOrderRefs.find(item => item.processOrderId === ref.processOrderId), ref)
  assert.deepEqual(migrated.results, sample.results)
  assert.deepEqual(result.designFiles, record.designFiles)
  assert.equal(result.bomDraftVersionId, record.bomDraftVersionId)
  assert.deepEqual(normalizeEngineeringDesignRevisionRecord(result), result)
  const currentRef = { ...ref, sourceKey: 'already-frozen-source' }
  const collision = structuredClone(record)
  collision.professionalTasks.find(task => task.taskType === 'DISPLAY_SAMPLE')!.processWorkOrderRefs.push(currentRef)
  const deduplicated = normalizeEngineeringDesignRevisionRecord(collision)
  assert.deepEqual(deduplicated.professionalTasks.find(task => task.taskType === 'DISPLAY_SAMPLE')!.processWorkOrderRefs.find(item => item.processOrderId === ref.processOrderId), currentRef, '已有样衣引用优先，不能被旧工作引用覆盖')
  const noSample = normalizeEngineeringDesignRevisionRecord({ ...record, professionalTasks: [retired] })
  assert.equal(noSample.professionalTasks.length, 0)
  assert.deepEqual(noSample.historicalProcessWorkOrderRefs, [ref])
  assert.equal(noSample.status, record.status, '迁移不能编造样衣成果或完成事实')
})
