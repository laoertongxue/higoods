import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEngineeringMasterOrder,
  confirmEngineeringMasterTaskPlan,
  getEngineeringMasterOrderById,
  listEngineeringMasterPriorResultCandidates,
  updateEngineeringTaskRecord,
} from '../../src/data/pcs-engineering-master-repository.ts'
import {
  activateTechPackVersionForStyle,
  publishTechnicalDataVersion,
} from '../../src/data/pcs-project-technical-data-writeback.ts'
import {
  approveTechPackReview,
  getTechnicalProcessRouteGate,
  startTechPackReview,
  submitTechPackFirstStageReview,
} from '../../src/data/pcs-tech-pack-review.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  updateTechnicalDataVersionContent,
} from '../../src/data/pcs-technical-data-version-repository.ts'
import { findStyleArchiveByCode, getStyleArchiveById } from '../../src/data/pcs-style-archive-repository.ts'
import { createMaterialArchive, createMaterialSkuRecord } from '../../src/data/pcs-material-archive-repository.ts'
import { productionDemands } from '../../src/data/fcs/production-demands.ts'
import { buildProductionOrderFromDemand, productionOrders } from '../../src/data/fcs/production-orders.ts'
import {
  getDemandCurrentTechPackInfo,
  listPublishedTechPackVersionOptionsForDemand,
} from '../../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import { deriveTmfProductionDemands } from '../../src/data/fcs/webbing-production-demands.ts'
import { getTmfPurchaseState, registerTmfProductionOrder } from '../../src/data/pms/tmf-material-purchases.ts'
import { CURRENT_PROCESS_ROUTE_SCHEMA_VERSION } from '../../src/data/tech-pack-process-route.ts'

const FIXED = '2026-09-20 10:00:00'
const PRIMARY_STYLE_CODE = 'STYLE-PRJ-202603-009'
const GATE_STYLE_CODE = 'STYLE-PRJ-202603-003'
const MERCHANDISER = { id: 'TM-MERCH', name: '链测试跟单' }

function buildWebbingBomItem(material: { code: string; skuId: string; name: string }) {
  return {
    id: 'BOM-WB', type: '辅料', name: material.name, spec: '20mm 白色 / 每件 0.65 米',
    materialCode: material.code, materialSkuId: material.skuId, unit: '米',
    unitConsumption: 0.65, sampleQuantity: 1, lossRate: 0, supplier: 'TMF基础生产',
  }
}

function buildCutEntry(materialSkuId: string) {
  const specification = (id: string, size: string, lengthMm: number) => ({
    id, bomItemId: 'BOM-WB', usage: '腰带', garmentSize: size, piecesPerGarment: 1,
    cutLengthMm: lengthMm, finishedLengthMm: lengthMm, lengthBasis: 'EXCLUDING_ENDS' as const, toleranceMm: 2,
    measurementCondition: '自然平放', cuttingMethod: '冷切', acceptanceRequirement: '按确认样',
    tippingRequired: false, endA: { method: 'NONE' as const, specification: '' }, endB: { method: 'NONE' as const, specification: '' },
  })
  return {
    id: 'CUT', entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '准备阶段',
    processCode: 'WEBBING_CUT', processName: '织带截断',
    assignmentGranularity: 'DETAIL', defaultDocType: 'PREPARATION_ORDER', taskTypeMode: 'PROCESS', isSpecialCraft: false,
    routeObjectKey: 'BOM:BOM-WB', linkedBomItemIds: ['BOM-WB'], inputObjectType: 'ACCESSORY', outputObjectType: 'ACCESSORY',
    inputInventoryForm: 'CONTINUOUS', outputInventoryForm: 'FINISHED_PIECES',
    inputMaterialSkuId: materialSkuId, outputMaterialSkuId: materialSkuId,
    predecessorEntryIds: [], routeStepNo: 1, routeLaneNo: 1,
    webbingSpecifications: [specification('S-50', 'S', 500), specification('M-70', 'M', 700)],
  }
}

function preparePublishedVersion(styleCode: string, specsOverride?: (versionId: string) => void): { versionId: string; masterOrderId: string; materialSkuId: string } {
  const style = findStyleArchiveByCode(styleCode)
  assert.ok(style, '演示款式档案必须存在且带可用设计改款成果')
  const master = createEngineeringMasterOrder({
    styleId: style.styleId, styleCode,
    merchandiserName: MERCHANDISER.name, merchandiserId: MERCHANDISER.id,
    createdBy: MERCHANDISER.name, createdById: MERCHANDISER.id, createdByRole: '跟单',
    preparationType: 'PURE_WOVEN',
    qualificationFact: {
      styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION',
      formalSaleSource: 'TMF链测试固定事实', formalProductionSource: 'TMF链测试固定事实', checkedAt: FIXED,
    },
    bulkProductionQualification: {
      basisType: 'DESIGN_REVISION_READY', triggerBusinessObjectType: '设计改款任务',
      triggerBusinessObjectId: listEngineeringMasterPriorResultCandidates(styleCode, 'PURE_WOVEN')[0].source.samplingTaskId,
      thresholdQuantity: null, reachedQuantity: null, reachedAt: FIXED,
      reason: '链测试资格', uniqueTriggerKey: `TMF-PCS-ADOPT-CHAIN-${Date.now()}`,
    },
    creationReason: 'TMF发布采用链测试',
  })
  const templateRecord = listTechnicalDataVersions().find((record) => record.technicalVersionCode === 'TDV-20260407-018')
  assert.ok(templateRecord, '必须存在可复用的技术包纸样、尺码和质量结构演示数据')
  const template = getTechnicalDataVersionContent(templateRecord.technicalVersionId)!
  const candidates = listEngineeringMasterPriorResultCandidates(styleCode, 'PURE_WOVEN')
  assert.ok(candidates.some((candidate) => candidate.engineeringTaskType === 'BASE_PATTERN_WOVEN'), '款式必须带可复用的基码纸样成果')
  confirmEngineeringMasterTaskPlan(master.masterOrderId, {
    confirmedBy: MERCHANDISER.name, confirmedById: MERCHANDISER.id, confirmedByRole: '跟单', preparationType: 'PURE_WOVEN',
    bomConditions: { hasPrintRequirement: false, hasYarnDyeRequirement: false, hasFabricDyeRequirement: false, hasAccessoryPurchaseRequirement: false },
    selectedConditionalTaskTypes: [],
    priorResultDecisions: candidates.map((candidate) => ({
      engineeringTaskType: candidate.engineeringTaskType,
      sourceSamplingTaskId: candidate.source.samplingTaskId,
      sourceProfessionalTaskId: candidate.source.professionalTaskId,
      sourceResultVersion: candidate.source.resultVersion,
      decision: candidate.engineeringTaskType === 'BASE_PATTERN_WOVEN' ? '复用' as const : '重新执行' as const,
    })),
    preProductionSampleRequirements: [{ targetColor: '白', targetSize: 'S', requiredQuantity: 2, requirementNote: '链测试产前确认' }],
  })
  const planned = getEngineeringMasterOrderById(master.masterOrderId)!
  const confirmationTask = planned.tasks.find((task) => task.taskType === 'TECH_PACK_CONFIRMATION')
  assert.ok(confirmationTask, '生产准备单必须生成技术包确认任务')

  const material = createMaterialArchive({
    kind: 'accessory', materialName: `TMF发布采用链织带 ${Date.now()}`, materialNameEn: 'TMF adopt chain webbing',
    categoryName: '织带', specSummary: '链测试白色 20mm', composition: '涤纶', processTags: [],
    widthText: '20mm', gramWeightText: '', pricingUnit: '米', mainUnit: '米', auxiliaryUnits: [], unitConversions: [],
    mainImageUrl: '', barcodeTemplateCode: '', remark: 'TMF发布采用链测试物料',
  })
  const sku = createMaterialSkuRecord(material.materialId, {
    colorName: '本白', specName: '20mm', sizeName: '-', skuImageUrl: '', costPrice: 10, freightCost: 0,
    weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, barcode: '',
  })
  assert.ok(sku, '链测试织带 SKU 必须创建成功')
  const webbingMaterial = { code: sku.materialCode, skuId: sku.materialSkuId, name: material.materialName }

  const versionId = `tdv_tmf_pcs_chain_${Date.now()}`
  createTechnicalDataVersionDraft({
    technicalVersionId: versionId, technicalVersionCode: 'TDV-TMF-PCS-CHAIN', versionLabel: 'V1.0', versionNo: 1,
    styleId: style.styleId, styleCode, styleName: style.styleName,
    sourceProjectId: master.masterOrderId, sourceProjectCode: planned.masterOrderCode, sourceProjectName: 'TMF链测试生产准备主单',
    sourceProjectNodeId: '',
    primaryPlateTaskId: '', primaryPlateTaskCode: '', primaryPlateTaskVersion: '',
    linkedDesignRevisionTaskIds: [], linkedPatternTaskIds: [], linkedArtworkTaskIds: [],
    createdFromTaskType: 'ENGINEERING_MASTER', createdFromTaskId: confirmationTask.taskId, createdFromTaskCode: confirmationTask.taskId,
    baseTechnicalVersionId: '', baseTechnicalVersionCode: '', changeScope: '生产准备单生成', changeSummary: 'TMF链测试汇总',
    garmentDifficultyGrade: 'B',
    linkedPartTemplateIds: [], linkedPatternLibraryVersionIds: [], linkedPatternAssetIds: [], linkedPatternAssetCodes: [],
    archiveCollectedFlag: false, archiveCollectedAt: '',
    versionStatus: 'DRAFT', reviewStage: '未提交审核',
    bomStatus: 'COMPLETE', patternStatus: 'EMPTY', processStatus: 'COMPLETE', gradingStatus: 'EMPTY', qualityStatus: 'EMPTY',
    colorMaterialStatus: 'EMPTY', designStatus: 'COMPLETE', attachmentStatus: 'EMPTY',
    bomItemCount: 1, patternFileCount: 0, processEntryCount: 1, gradingRuleCount: 0, qualityRuleCount: 0,
    colorMaterialMappingCount: 0, designAssetCount: 0, attachmentCount: 0, completenessScore: 100,
    missingItemCodes: [], missingItemNames: [],
    publishedAt: '', publishedBy: '', createdAt: FIXED, createdBy: MERCHANDISER.name,
    updatedAt: FIXED, updatedBy: MERCHANDISER.name, note: '', legacySpuCode: '', legacyVersionLabel: '',
  }, {
    technicalVersionId: versionId,
    patternFiles: template.patternFiles.map((file, index) => ({ ...structuredClone(file), id: `${versionId}-PATTERN-${index + 1}` })),
    patternDesc: 'TMF链测试纸样结构',
    processEntries: [buildCutEntry(webbingMaterial.skuId)],
    processRouteSchemaVersion: CURRENT_PROCESS_ROUTE_SCHEMA_VERSION,
    processRouteStatus: 'CONFIRMED', processRouteConfirmedBy: MERCHANDISER.name, processRouteConfirmedAt: FIXED,
    sizeTable: template.sizeTable.map((row, index) => ({ ...structuredClone(row), id: `${versionId}-SIZE-${index + 1}` })),
    qualityRules: template.qualityRules.map((row, index) => ({ ...structuredClone(row), id: `${versionId}-QUALITY-${index + 1}` })),
    bomItems: [buildWebbingBomItem(webbingMaterial)], bomCustomCosts: [], bomCustomCostDecision: 'NO_CUSTOM_COST',
    colorMaterialMappings: [{
      id: `${versionId}-MAP-1`, spuCode: styleCode, colorCode: 'COLOR-1', colorName: '白',
      status: 'CONFIRMED' as const, generatedMode: 'AUTO' as const, confirmedBy: MERCHANDISER.name, confirmedAt: FIXED,
      remark: 'TMF链测试映射',
      lines: [{
        id: `${versionId}-MAP-1-L1`, bomItemId: 'BOM-WB', materialCode: webbingMaterial.code, materialName: webbingMaterial.name,
        materialType: '辅料' as const, unit: '米', applicableSkuCodes: [], sourceMode: 'AUTO' as const, note: 'TMF链测试',
      }],
    }],
    patternDesigns: [], attachments: [], legacyCompatibleCostPayload: {},
  })
  specsOverride?.(versionId)
  return { versionId, masterOrderId: master.masterOrderId, materialSkuId: webbingMaterial.skuId }
}

function approveAllReviewNodes(versionId: string): void {
  const submitted = submitTechPackFirstStageReview(versionId, MERCHANDISER.name)
  for (const nodeKey of ['BUYER', 'PATTERN_MAKER'] as const) {
    const node = nodeKey === 'BUYER' ? submitted.buyerReview! : submitted.patternMakerReview!
    if (node.status === '无需审核') continue
    const operator = { id: node.assignedReviewerId, name: node.assignedReviewerName }
    startTechPackReview(versionId, nodeKey, { operator, opinion: '开始审核' })
    approveTechPackReview(versionId, nodeKey, '审核通过', operator)
  }
  const merchandiser = getTechnicalDataVersionById(versionId)!.merchandiserReview!
  const operator = { id: merchandiser.assignedReviewerId, name: merchandiser.assignedReviewerName }
  startTechPackReview(versionId, 'MERCHANDISER', { operator, opinion: '开始复核' })
  approveTechPackReview(versionId, 'MERCHANDISER', '确认发布', operator)
}

function webbingDemand(styleCode: string) {
  const demand = productionDemands.find((item) => item.spuCode === 'SPU-2024-001')!
  return {
    ...structuredClone(demand), demandId: `DEM-TMF-PCS-CHAIN-${styleCode}`, spuCode: styleCode, spuName: 'TMF发布采用链目标款',
    skuLines: [
      { skuCode: 'SKU-TMF-S', size: 'S', color: '白', qty: 400 },
      { skuCode: 'SKU-TMF-M', size: 'M', color: '白', qty: 600 },
    ],
    requiredDeliveryDate: '2026-10-15', hasProductionOrder: false, productionOrderId: null,
  }
}

test('TMF发布采用链：技术包发布门禁→审核发布→启用→生产单采用→生成织带加工需求', () => {
  const { versionId, masterOrderId, materialSkuId } = preparePublishedVersion(PRIMARY_STYLE_CODE)
  assert.equal(getTechnicalProcessRouteGate(versionId).confirmed, true)
  // 发布前必须完成审核；未审核不能发布。
  assert.throws(() => publishTechnicalDataVersion(versionId, MERCHANDISER.name), /跟单审核通过/)
  approveAllReviewNodes(versionId)
  const published = publishTechnicalDataVersion(versionId, MERCHANDISER.name)
  assert.equal(published.versionStatus, 'PUBLISHED')
  assert.ok(published.publishedAt && published.publishedBy)

  // 启用为款式当前生效版本；未启用前不能转换生产单。
  const demand = webbingDemand(PRIMARY_STYLE_CODE)
  assert.equal(getDemandCurrentTechPackInfo(demand).canConvertToProductionOrder, false)
  const options = listPublishedTechPackVersionOptionsForDemand(demand)
  assert.equal(options.length, 1)
  assert.equal(options[0].technicalVersionId, versionId)
  assert.equal(options[0].isCurrentTechPackVersion, false)

  const master = getEngineeringMasterOrderById(masterOrderId)!
  for (const task of master.tasks) {
    if (task.taskType === 'TECH_PACK_CONFIRMATION') continue
    updateEngineeringTaskRecord(masterOrderId, task.taskId, (draft) => {
      draft.status = draft.status === '未启用' ? '因需求变更结束' : '已完成'
      draft.firstCompletedAt = draft.firstCompletedAt || FIXED
      draft.effectiveCompletedAt = FIXED
      draft.completedAt = FIXED
    })
  }
  activateTechPackVersionForStyle(findStyleArchiveByCode(PRIMARY_STYLE_CODE)!.styleId, versionId, MERCHANDISER.name)
  assert.equal(getStyleArchiveById(findStyleArchiveByCode(PRIMARY_STYLE_CODE)!.styleId)!.currentTechPackVersionId, versionId)
  const info = getDemandCurrentTechPackInfo(demand)
  assert.equal(info.canConvertToProductionOrder, true)
  assert.equal(info.currentTechPackVersionId, versionId)

  // 开发动机生产单：按选定的已发布版本构建采用快照。
  const templateOrder = productionOrders.find((order) => order.techPackSnapshot)!
  const seed = {
    ...structuredClone(templateOrder),
    productionOrderId: 'PO-TMF-PCS-CHAIN', productionOrderNo: 'PO-TMF-PCS-CHAIN',
    demandId: demand.demandId, sourceDemandIds: [demand.demandId],
    status: 'EXECUTING' as const, selectedTechPackVersionId: versionId, techPackSnapshot: null as never,
    snapshotAt: FIXED, createdAt: FIXED, updatedAt: FIXED,
  }
  const order = buildProductionOrderFromDemand(seed as unknown as Parameters<typeof buildProductionOrderFromDemand>[0], demand, MERCHANDISER.name)
  assert.equal(order.techPackSnapshot!.status, 'RELEASED')
  assert.equal(order.techPackSnapshot!.sourceTechPackVersionId, versionId)
  assert.equal(order.techPackSnapshot!.productionOrderId, 'PO-TMF-PCS-CHAIN')

  // 从采用快照生成织带加工需求：两条规格、同一半成品 SKU、长度不进入 SKU。
  const demands = deriveTmfProductionDemands(order)
  assert.equal(demands.length, 2)
  assert.deepEqual(demands.map((item) => item.specification.cutLengthMm).sort((a, b) => a - b), [500, 700])
  assert.ok(demands.every((item) => item.materialSkuId === materialSkuId))
  assert.ok(demands.every((item) => item.techPackSnapshotId === order.techPackSnapshot!.snapshotId))

  registerTmfProductionOrder(order, { id: 'TMF-PLAN', name: '链测试生产计划', role: '生产计划' }, 'tmf-pcs-adopt-chain')
  const registered = getTmfPurchaseState().demands.filter((item) => item.productionOrderId === 'PO-TMF-PCS-CHAIN')
  assert.equal(registered.length, 2)
  assert.ok(registered.every((item) => item.techPackVersionId === versionId))
})

test('TMF发布门禁：含织带截断工序但规格未补齐的采用版本不能发布', () => {
  const { versionId } = preparePublishedVersion(GATE_STYLE_CODE, (createdVersionId) => {
    const content = getTechnicalDataVersionContent(createdVersionId)!
    updateTechnicalDataVersionContent(createdVersionId, {
      processEntries: content.processEntries.map((entry) => (
        entry.processCode === 'WEBBING_CUT'
          ? {
              ...entry,
              linkedBomItemIds: ['BOM-WB', 'BOM-GHOST'],
              webbingSpecifications: [{ ...entry.webbingSpecifications![0], bomItemId: 'BOM-GHOST' }],
            }
          : entry
      )),
    })
  })
  // 路线图校验认可规格在其关联 BOM 内；发布门禁进一步要求该 BOM 仍存在于当前版本内容。
  assert.equal(getTechnicalProcessRouteGate(versionId).confirmed, true)
  assert.throws(() => publishTechnicalDataVersion(versionId, MERCHANDISER.name), /BOM 已不存在/)
})
