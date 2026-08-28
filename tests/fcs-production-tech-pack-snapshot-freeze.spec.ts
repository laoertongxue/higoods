import assert from 'node:assert/strict'

import { buildProductionOrderFromDemand, type ProductionOrderSeed } from '../src/data/fcs/production-orders.ts'
import type { ProductionDemand } from '../src/data/fcs/production-demands.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  getStyleArchiveById,
  listStyleArchives,
  updateStyleArchive,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'

function buildDemand(input: {
  demandId: string
  styleCode: string
  styleName: string
  versionLabel: string
}): ProductionDemand {
  return {
    demandId: input.demandId,
    legacyType: 'ID_PURCHASE',
    legacyOrderNo: `LEGACY-${input.demandId}`,
    sourceSystem: 'NEW',
    spuCode: input.styleCode,
    spuName: input.styleName,
    imageUrl: '/assets/products/product-dress-pink-floral.webp',
    category: '测试分类',
    marketScopes: ['内销'],
    priority: 'NORMAL',
    demandStatus: 'PENDING_CONVERT',
    techPackStatus: 'RELEASED',
    techPackVersionLabel: input.versionLabel,
    requiredDeliveryDate: '2026-09-10',
    requiredQtyTotal: 480,
    constraintsNote: '验证生产单技术包快照冻结',
    skuLines: [
      { skuCode: `${input.styleCode}-BK-M`, size: 'M', color: '黑色', qty: 220 },
      { skuCode: `${input.styleCode}-BK-L`, size: 'L', color: '黑色', qty: 260 },
    ],
    hasProductionOrder: false,
    productionOrderId: null,
    createdAt: '2026-08-27 10:00:00',
    updatedAt: '2026-08-27 10:00:00',
  }
}

function buildSeed(orderId: string, demandId: string, snapshotAt: string): ProductionOrderSeed {
  return {
    productionOrderId: orderId,
    demandId,
    status: 'READY_FOR_BREAKDOWN',
    mainFactoryId: 'ID-F001',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F001',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: [],
    auditLogs: [],
    createdAt: snapshotAt,
    updatedAt: snapshotAt,
    snapshotAt,
  }
}

resetEngineeringMasterRepository()
resetTechnicalDataVersionRepository()

const style = listStyleArchives()[0]
const baseRecord = listTechnicalDataVersions()[0]
assert.ok(style, '必须存在款式档案演示数据')
assert.ok(baseRecord, '必须存在技术包结构演示数据')
const baseContent = getTechnicalDataVersionContent(baseRecord.technicalVersionId)
assert.ok(baseContent, '必须存在技术包内容演示数据')

const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'MERCHANDISER-FREEZE',
  merchandiserName: '跟单-快照验证',
  createdById: 'MERCHANDISER-FREEZE',
  createdBy: '跟单-快照验证',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: {
    styleCode: style.styleCode,
    formalSaleStatus: 'NO_FORMAL_SALE',
    formalProductionStatus: 'NO_FORMAL_PRODUCTION',
    formalSaleSource: '正式销售订单',
    formalProductionSource: '正式生产单',
    checkedAt: '2026-08-27 09:00:00',
  },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '测款结果',
    triggerBusinessObjectId: 'TEST-SNAPSHOT-FREEZE',
    thresholdQuantity: 300,
    reachedQuantity: 480,
    reachedAt: '2026-08-27 09:00:00',
    reason: '已满足做大货要求',
    uniqueTriggerKey: 'TEST-SNAPSHOT-FREEZE',
  },
  creationReason: '验证正式技术包快照冻结',
}).masterOrderId)
const sourceTaskId = `${master.masterOrderId}-TECH_PACK_CONFIRMATION`

function createPublishedVersion(input: {
  id: string
  code: string
  versionNo: number
  versionLabel: string
  materialName: string
  linkedDesignRevisionTaskIds: string[]
  publishedAt: string
}): TechnicalDataVersionRecord {
  const record: TechnicalDataVersionRecord = {
    ...baseRecord,
    technicalVersionId: input.id,
    technicalVersionCode: input.code,
    versionNo: input.versionNo,
    versionLabel: input.versionLabel,
    versionStatus: 'PUBLISHED',
    reviewStage: '已发布',
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    sourceProjectId: master.masterOrderId,
    sourceProjectCode: master.masterOrderCode,
    sourceProjectName: master.styleName,
    sourceProjectNodeId: '',
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: sourceTaskId,
    createdFromTaskCode: sourceTaskId,
    linkedDesignRevisionTaskIds: [...input.linkedDesignRevisionTaskIds],
    publishedAt: input.publishedAt,
    publishedBy: '跟单-快照验证',
    updatedAt: input.publishedAt,
    updatedBy: '跟单-快照验证',
  }
  const firstBom = baseContent.bomItems[0]
  const content: TechnicalDataVersionContent = {
    ...baseContent,
    technicalVersionId: input.id,
    bomItems: firstBom
      ? [{ ...firstBom, id: `BOM-${input.id}`, name: input.materialName }]
      : [],
    patternFiles: baseContent.patternFiles.map((item) => ({ ...item })),
    processEntries: baseContent.processEntries.map((item) => ({ ...item })),
    sizeTable: baseContent.sizeTable.map((item) => ({ ...item })),
    qualityRules: baseContent.qualityRules.map((item) => ({ ...item })),
    colorMaterialMappings: baseContent.colorMaterialMappings.map((item) => ({ ...item })),
    patternDesigns: baseContent.patternDesigns.map((item) => ({ ...item })),
    attachments: baseContent.attachments.map((item) => ({ ...item })),
    bomCustomCosts: baseContent.bomCustomCosts.map((item) => ({ ...item })),
    bomPricingSnapshot: undefined,
  }
  return createTechnicalDataVersionDraft(record, content)
}

function activateVersion(record: TechnicalDataVersionRecord): void {
  updateStyleArchive(style.styleId, {
    currentTechPackVersionId: record.technicalVersionId,
    currentTechPackVersionCode: record.technicalVersionCode,
    currentTechPackVersionLabel: record.versionLabel,
    currentTechPackVersionStatus: 'PUBLISHED',
    currentTechPackVersionActivatedAt: record.publishedAt,
    currentTechPackVersionActivatedBy: '跟单-快照验证',
  })
  assert.equal(getStyleArchiveById(style.styleId)?.currentTechPackVersionId, record.technicalVersionId)
}

const firstVersion = createPublishedVersion({
  id: 'TDV-SNAPSHOT-FREEZE-001',
  code: 'TP-SNAPSHOT-FREEZE-001',
  versionNo: 1,
  versionLabel: 'V1',
  materialName: '首版主面料',
  linkedDesignRevisionTaskIds: [],
  publishedAt: '2026-08-27 10:10:00',
})
activateVersion(firstVersion)

const firstDemand = buildDemand({
  demandId: 'DEM-SNAPSHOT-FREEZE-001',
  styleCode: style.styleCode,
  styleName: style.styleName,
  versionLabel: firstVersion.versionLabel,
})
const firstOrder = buildProductionOrderFromDemand(
  buildSeed('PO-SNAPSHOT-FREEZE-001', firstDemand.demandId, '2026-08-27 10:20:00'),
  firstDemand,
  '测试用户',
)
assert.ok(firstOrder.techPackSnapshot, '首张生产单必须冻结当前正式技术包')
const firstSnapshot = structuredClone(firstOrder.techPackSnapshot)

const secondVersion = createPublishedVersion({
  id: 'TDV-SNAPSHOT-FREEZE-002',
  code: 'TP-SNAPSHOT-FREEZE-002',
  versionNo: 2,
  versionLabel: 'V2',
  materialName: '二版主面料',
  linkedDesignRevisionTaskIds: ['ES-DR-FREEZE-001'],
  publishedAt: '2026-08-27 11:10:00',
})
activateVersion(secondVersion)

const secondDemand = buildDemand({
  demandId: 'DEM-SNAPSHOT-FREEZE-002',
  styleCode: style.styleCode,
  styleName: style.styleName,
  versionLabel: secondVersion.versionLabel,
})
const secondOrder = buildProductionOrderFromDemand(
  buildSeed('PO-SNAPSHOT-FREEZE-002', secondDemand.demandId, '2026-08-27 11:20:00'),
  secondDemand,
  '测试用户',
)

assert.deepEqual(firstOrder.techPackSnapshot, firstSnapshot, '切换正式技术包后，旧生产单快照必须保持冻结')
assert.equal(firstOrder.techPackSnapshot?.sourceTechPackVersionId, firstVersion.technicalVersionId)
assert.equal(secondOrder.techPackSnapshot?.sourceTechPackVersionId, secondVersion.technicalVersionId)
assert.deepEqual(
  secondOrder.techPackSnapshot?.linkedDesignRevisionTaskIds,
  ['ES-DR-FREEZE-001'],
  '新生产单快照必须保留设计改款成果的溯源关系',
)
assert.notEqual(
  firstOrder.techPackSnapshot?.bomItems[0]?.name,
  secondOrder.techPackSnapshot?.bomItems[0]?.name,
  '新旧生产单必须分别冻结各自版本的 BOM 内容',
)

console.log('fcs-production-tech-pack-snapshot-freeze.spec.ts PASS')
