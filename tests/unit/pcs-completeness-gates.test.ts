import assert from 'node:assert/strict'
import test from 'node:test'
import { assertEngineeringTaskDetailCompletion } from '../../src/data/pcs-engineering-master-repository.ts'
import { buildTechnicalDataDerivedState, assertTechnicalDataReadyForPublish } from '../../src/data/pcs-technical-data-version-repository.ts'
import { createTechnicalDataVersionBootstrapSnapshot } from '../../src/data/pcs-technical-data-version-bootstrap.ts'
import type { EngineeringTaskRecord } from '../../src/data/pcs-engineering-master-types.ts'

test('专业任务必须全部有效明细通过且保留成果与审核事实', () => {
  const line = { status: '正常', requirementType: '印花', reviewStatus: '通过', resultFileIds: ['file'], effectImageIds: [], reviewedBy: '审核人', reviewedAt: '2026-10-03' }
  const task = { taskType: 'PATTERN_ARTWORK', taskName: '花型任务', materialLines: [line, { ...line, reviewStatus: '待提交' }] } as unknown as EngineeringTaskRecord
  assert.throws(() => assertEngineeringTaskDetailCompletion(task), /1\/2/)
  task.materialLines[1].reviewStatus = '通过'
  task.materialLines[1].reviewedBy = ''
  assert.throws(() => assertEngineeringTaskDetailCompletion(task), /审核记录/)
  task.materialLines[1].reviewedBy = '审核人'
  assert.doesNotThrow(() => assertEngineeringTaskDetailCompletion(task))
  task.materialLines = []
  assert.throws(() => assertEngineeringTaskDetailCompletion(task), /0\/0/)
})

test('纸样名称或物料关联不能替代可读取原文件', () => {
  const snapshot = createTechnicalDataVersionBootstrapSnapshot()
  const content = structuredClone(snapshot.contents.find(row => row.patternFiles.length)!)
  assert.ok(content)
  content.patternFiles = content.patternFiles.map(file => ({ ...file, fileUrl: '', prjFile: undefined, dxfFile: undefined }))
  assert.ok(buildTechnicalDataDerivedState('DRAFT', content).missingItemCodes.includes('PATTERN'))
  assert.throws(() => assertTechnicalDataReadyForPublish(content), /纸样/)
  content.patternFiles = content.patternFiles.map(file => ({ ...file, recordKind: 'MATERIAL_ASSOCIATION' }))
  assert.ok(buildTechnicalDataDerivedState('DRAFT', content).missingItemCodes.includes('PATTERN'))
})
