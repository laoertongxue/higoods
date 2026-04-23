import assert from 'node:assert/strict'

import {
  getPlateMakingTaskById,
  listPlateMakingTasks,
  resetPlateMakingTaskRepository,
  updatePlateMakingTask,
} from '../src/data/pcs-plate-making-repository.ts'

resetPlateMakingTaskRepository()

const task = listPlateMakingTasks()[0]
assert.ok(task, '必须存在制版任务演示数据')

const updated = updatePlateMakingTask(task.plateTaskId, {
  productHistoryType: '未卖过',
  patternMakerId: 'maker_test',
  patternMakerName: '测试版师',
  sampleConfirmedAt: '2026-04-23 10:00:00',
  urgentFlag: true,
  patternArea: '深圳',
  colorRequirementText: '花色需求已确认',
  newPatternSpuCode: 'PAT-SPU-TEST',
  flowerImageIds: ['mock://plate/flower/1'],
  materialRequirementLines: [
    {
      lineId: 'material_1',
      materialImageId: 'mock://plate/material/1',
      materialName: '测试面料',
      materialSku: 'FAB-TEST',
      printRequirement: '对位印花',
      quantity: 2,
      unitPrice: 10,
      amount: 20,
      note: '测试明细',
    },
  ],
  patternImageLineItems: [
    {
      lineId: 'pattern_image_1',
      imageId: 'mock://plate/pattern/front',
      materialPartName: '前片',
      materialDescription: '前片纸样图',
      pieceCount: 2,
    },
  ],
  patternPdfFileIds: ['mock://plate/file/pattern.pdf'],
  patternDxfFileIds: ['mock://plate/file/pattern.dxf'],
  patternRulFileIds: ['mock://plate/file/pattern.rul'],
  supportImageIds: ['mock://plate/support/image'],
  supportVideoIds: ['mock://plate/support/video'],
  partTemplateLinks: [
    {
      templateId: 'template_1',
      templateCode: 'PART-TPL-TEST',
      templateName: '测试部位模板',
      matchedPartNames: ['前片', '后片'],
    },
  ],
})

assert.ok(updated, '制版任务应可保存执行字段')
const saved = getPlateMakingTaskById(task.plateTaskId)
assert.equal(saved?.patternMakerName, '测试版师')
assert.equal(saved?.patternArea, '深圳')
assert.equal(saved?.urgentFlag, true)
assert.equal(saved?.sampleConfirmedAt, '2026-04-23 10:00:00')
assert.equal(saved?.materialRequirementLines?.[0]?.materialSku, 'FAB-TEST')
assert.equal(saved?.patternImageLineItems?.[0]?.materialPartName, '前片')
assert.equal(saved?.patternPdfFileIds?.[0], 'mock://plate/file/pattern.pdf')
assert.equal(saved?.patternDxfFileIds?.[0], 'mock://plate/file/pattern.dxf')
assert.equal(saved?.patternRulFileIds?.[0], 'mock://plate/file/pattern.rul')
assert.equal(saved?.partTemplateLinks?.[0]?.templateCode, 'PART-TPL-TEST')

console.log('pcs-plate-making-demand-fields.spec.ts PASS')
