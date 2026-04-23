import assert from 'node:assert/strict'

import { getRevisionTaskById, resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'
import { saveRevisionTaskDraft } from '../src/data/pcs-task-project-relation-writeback.ts'

resetRevisionTaskRepository()

const task = saveRevisionTaskDraft({
  projectId: '',
  title: '旧款连衣裙改版',
  sourceType: '人工创建',
  styleId: 'style_test',
  styleCode: 'OLD-SPU-001',
  styleName: '旧款连衣裙',
  ownerName: '测试版师',
  revisionScopeCodes: ['PATTERN', 'FABRIC'],
  revisionScopeNames: ['版型结构', '面料'],
  issueSummary: '旧款腰节和面料需要调整。',
  evidenceSummary: '直播反馈和试穿记录已确认。',
  baseStyleId: 'style_test',
  baseStyleCode: 'OLD-SPU-001',
  baseStyleName: '旧款连衣裙',
  targetStyleCodeCandidate: 'NEW-SPU-001',
  targetStyleNameCandidate: '新款连衣裙',
  sampleQty: 2,
  stylePreference: '更轻盈',
  patternMakerName: '测试版师',
  revisionSuggestionRichText: '调整腰节并替换面料。',
  paperPrintAt: '2026-04-23 10:00:00',
  deliveryAddress: '深圳样衣室',
  patternArea: '深圳',
  materialAdjustmentLines: [
    {
      lineId: 'material_1',
      materialImageId: 'mock://revision/material/1',
      materialName: '雪纺面料',
      materialSku: 'FAB-REV-001',
      printRequirement: '轻薄印花',
      quantity: 2,
      unitPrice: 12,
      amount: 24,
      note: '测试面辅料变化',
    },
  ],
  newPatternImageIds: ['mock://revision/pattern/1'],
  newPatternSpuCode: 'PAT-REV-001',
  patternChangeNote: '花型密度降低。',
  patternPieceImageIds: ['mock://revision/piece/front'],
  patternFileIds: ['mock://revision/file/pattern.dxf'],
  mainImageIds: ['mock://revision/main/1'],
  designDraftImageIds: ['mock://revision/draft/1'],
  liveRetestRequired: true,
  liveRetestStatus: '待回直播验证',
})

const saved = getRevisionTaskById(task.revisionTaskId)
assert.equal(saved?.baseStyleCode, 'OLD-SPU-001')
assert.equal(saved?.targetStyleCodeCandidate, 'NEW-SPU-001')
assert.equal(saved?.sampleQty, 2)
assert.equal(saved?.patternMakerName, '测试版师')
assert.equal(saved?.materialAdjustmentLines[0]?.materialSku, 'FAB-REV-001')
assert.equal(saved?.newPatternSpuCode, 'PAT-REV-001')
assert.equal(saved?.patternPieceImageIds[0], 'mock://revision/piece/front')
assert.equal(saved?.patternFileIds[0], 'mock://revision/file/pattern.dxf')
assert.equal(saved?.designDraftImageIds[0], 'mock://revision/draft/1')
assert.equal(saved?.liveRetestStatus, '待回直播验证')

console.log('pcs-revision-task-demand-fields.spec.ts PASS')
