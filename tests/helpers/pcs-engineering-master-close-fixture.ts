import assert from 'node:assert/strict'

import {
  getEngineeringMasterOrderById,
  updateEngineeringTaskRecord,
} from '../../src/data/pcs-engineering-master-repository.ts'
import {
  closeEngineeringMasterOrder,
  validateEngineeringMasterOrderClose,
} from '../../src/data/pcs-engineering-master-close-service.ts'
import {
  createMaterialArchive,
  createMaterialSkuRecord,
} from '../../src/data/pcs-material-archive-repository.ts'
import {
  createTechnicalDataVersionDraft,
  listTechnicalDataVersions,
} from '../../src/data/pcs-technical-data-version-repository.ts'
import { activateTechPackVersionForStyle } from '../../src/data/pcs-tech-pack-version-activation.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../../src/data/pcs-technical-data-version-types.ts'

// 关闭相关测试夹具必须走与页面相同的正式启用和关闭领域入口，禁止直接改写“已关闭”。
export function closeEngineeringMasterForFixture(masterOrderId: string, operatorName: string): void {
  const master = getEngineeringMasterOrderById(masterOrderId)
  assert.ok(master)
  for (const task of master.tasks) {
    updateEngineeringTaskRecord(masterOrderId, task.taskId, (draft) => {
      if (draft.status === '未启用') {
        draft.status = '因需求变更结束'
        return
      }
      if (draft.taskType === 'TECH_PACK_CONFIRMATION') return
      draft.status = '已完成'
      draft.firstCompletedAt = draft.firstCompletedAt || '2026-08-02 09:00'
      draft.effectiveCompletedAt = '2026-08-02 09:00'
      draft.completedAt = '2026-08-02 09:00'
    })
  }

  try {
    validateEngineeringMasterOrderClose(masterOrderId)
    closeEngineeringMasterOrder(masterOrderId, operatorName)
    return
  } catch {
    // 尚无同源正式技术包时，继续建立完整审核发布夹具并通过正式启用入口完成确认任务。
  }

  const material = createMaterialArchive({
    kind: 'fabric',
    materialName: `关闭测试夹具面料 ${Date.now()} ${Math.random()}`,
    materialNameEn: 'Close fixture fabric',
    categoryName: '测试面料',
    specSummary: '标准',
    composition: '棉',
    processTags: [],
    widthText: '150cm',
    gramWeightText: '180g',
    pricingUnit: '米',
    mainUnit: '米',
    auxiliaryUnits: [],
    unitConversions: [],
    mainImageUrl: '',
    barcodeTemplateCode: '',
    remark: '',
  })
  const sku = createMaterialSkuRecord(material.materialId, {
    colorName: '黑色',
    specName: '标准',
    sizeName: '-',
    skuImageUrl: '',
    costPrice: 10,
    freightCost: 0,
    weightKg: 0,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    barcode: '',
  })
  assert.ok(sku)
  const base = listTechnicalDataVersions()[0]
  assert.ok(base)
  const versionId = `TDV-CLOSE-FIXTURE-${Date.now()}-${Math.random()}`
  const confirmationTaskId = `${masterOrderId}-TECH_PACK_CONFIRMATION`
  const record: TechnicalDataVersionRecord = {
    ...base,
    technicalVersionId: versionId,
    technicalVersionCode: `TP-${versionId}`,
    styleId: master.styleId,
    styleCode: master.styleCode,
    styleName: master.styleName,
    sourceProjectId: masterOrderId,
    sourceProjectCode: master.masterOrderCode,
    sourceProjectName: master.styleName,
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: confirmationTaskId,
    createdFromTaskCode: confirmationTaskId,
    linkedPartTemplateIds: [],
    versionStatus: 'PUBLISHED',
    reviewStage: '已发布',
    buyerReview: undefined,
    patternMakerReview: undefined,
    merchandiserReview: undefined,
    reviewSubmittedAt: '',
    reviewSubmittedBy: '',
    returnedFromMerchandiserFlag: false,
    reviewUnlockedModuleKeys: [],
    publishedAt: '2026-08-02 10:00',
    publishedBy: operatorName,
    missingItemCodes: [],
    missingItemNames: [],
    updatedAt: '2026-08-02 10:00',
    updatedBy: operatorName,
  }
  const content: TechnicalDataVersionContent = {
    technicalVersionId: versionId,
    patternFiles: [],
    patternDesc: '',
    processEntries: [],
    processRouteStatus: 'CONFIRMED',
    sizeTable: [],
    bomItems: [{
      id: `BOM-${versionId}`,
      type: '面料',
      name: sku.materialName,
      spec: sku.specName,
      materialCode: sku.materialCode,
      materialSkuId: sku.materialSkuId,
      unit: '米',
      unitConsumption: 1,
      sampleQuantity: 1,
      lossRate: 0,
      supplier: '测试供应商',
    }],
    bomCustomCosts: [],
    qualityRules: [],
    colorMaterialMappings: [],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  }
  createTechnicalDataVersionDraft(record, content)
  activateTechPackVersionForStyle(master.styleId, versionId, operatorName)
  closeEngineeringMasterOrder(masterOrderId, operatorName)
}
