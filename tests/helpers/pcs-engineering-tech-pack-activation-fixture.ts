import assert from 'node:assert/strict'

import { createMaterialArchive, createMaterialSkuRecord } from '../../src/data/pcs-material-archive-repository.ts'
import {
  getEngineeringMasterOrderById,
  updateEngineeringTaskRecord,
} from '../../src/data/pcs-engineering-master-repository.ts'
import {
  getTechnicalDataVersionById,
  updateTechnicalDataVersionContent,
} from '../../src/data/pcs-technical-data-version-repository.ts'
import {
  approveTechPackReview,
  startTechPackReview,
  submitTechPackFirstStageReview,
} from '../../src/data/pcs-tech-pack-review.ts'
import {
  activateTechPackVersionForStyle,
  publishTechnicalDataVersion,
} from '../../src/data/pcs-project-technical-data-writeback.ts'

// 测试夹具仍走真实的 BOM、三段审核、发布、固定依赖和正式启用入口。
export function publishAndActivateEngineeringTechPackForFixture(input: {
  technicalVersionId: string
  masterOrderId: string
  styleId: string
  operatorName: string
}): void {
  const material = createMaterialArchive({
    kind: 'fabric', materialName: `正式启用夹具面料 ${Date.now()} ${Math.random()}`, materialNameEn: 'Activation fixture fabric',
    categoryName: '测试面料', specSummary: '标准', composition: '棉', processTags: [], widthText: '150cm', gramWeightText: '180g',
    pricingUnit: '米', mainUnit: '米', auxiliaryUnits: [], unitConversions: [], mainImageUrl: '', barcodeTemplateCode: '', remark: '',
  })
  const sku = createMaterialSkuRecord(material.materialId, {
    colorName: '黑色', specName: '标准', sizeName: '-', skuImageUrl: '', costPrice: 10, freightCost: 0,
    weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, barcode: '',
  })
  assert.ok(sku)
  updateTechnicalDataVersionContent(input.technicalVersionId, {
    bomItems: [{
      id: `BOM-${input.technicalVersionId}`, type: '面料', name: sku.materialName, spec: sku.specName,
      materialCode: sku.materialCode, materialSkuId: sku.materialSkuId, unit: '米', unitConsumption: 1,
      sampleQuantity: 1, lossRate: 0, supplier: '测试供应商',
    }],
    bomCustomCosts: [],
  })

  const submitted = submitTechPackFirstStageReview(input.technicalVersionId, input.operatorName)
  for (const nodeKey of ['BUYER', 'PATTERN_MAKER'] as const) {
    const node = nodeKey === 'BUYER' ? submitted.buyerReview! : submitted.patternMakerReview!
    if (node.status === '无需审核') continue
    const operator = { id: node.assignedReviewerId, name: node.assignedReviewerName }
    startTechPackReview(input.technicalVersionId, nodeKey, { operator, opinion: '开始审核' })
    approveTechPackReview(input.technicalVersionId, nodeKey, '审核通过', operator)
  }
  const merchandiser = getTechnicalDataVersionById(input.technicalVersionId)!.merchandiserReview!
  const merchandiserOperator = { id: merchandiser.assignedReviewerId, name: merchandiser.assignedReviewerName }
  startTechPackReview(input.technicalVersionId, 'MERCHANDISER', { operator: merchandiserOperator, opinion: '开始复核' })
  approveTechPackReview(input.technicalVersionId, 'MERCHANDISER', '确认发布', merchandiserOperator)
  publishTechnicalDataVersion(input.technicalVersionId, input.operatorName)

  const master = getEngineeringMasterOrderById(input.masterOrderId)
  assert.ok(master)
  for (const task of master.tasks) {
    if (task.taskType === 'TECH_PACK_CONFIRMATION') continue
    updateEngineeringTaskRecord(input.masterOrderId, task.taskId, (draft) => {
      draft.status = draft.status === '未启用' ? '因需求变更结束' : '已完成'
      draft.firstCompletedAt = draft.firstCompletedAt || '2026-08-02 09:00'
      draft.effectiveCompletedAt = '2026-08-02 09:00'
      draft.completedAt = '2026-08-02 09:00'
    })
  }
  activateTechPackVersionForStyle(input.styleId, input.technicalVersionId, input.operatorName)
}
