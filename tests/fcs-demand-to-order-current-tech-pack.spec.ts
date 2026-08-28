import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProductionOrderFromDemand, type ProductionOrderSeed } from '../src/data/fcs/production-orders.ts'
import type { ProductionDemand } from '../src/data/fcs/production-demands.ts'
import { getDemandCurrentTechPackInfo } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  listStyleArchives,
  resetStyleArchiveRepository,
  updateStyleArchive,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
  updateTechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-repository.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function buildDemand(input: {
  demandId: string
  styleCode: string
  techPackStatus?: 'INCOMPLETE' | 'RELEASED'
  techPackVersionLabel?: string
}): ProductionDemand {
  return {
    demandId: input.demandId,
    legacyType: 'ID_PURCHASE',
    legacyOrderNo: `LEGACY-${input.demandId}`,
    sourceSystem: 'NEW',
    spuCode: input.styleCode,
    spuName: '需求转生产单校验款',
    imageUrl: '/placeholder.svg?height=80&width=80',
    category: '测试分类',
    marketScopes: ['内销'],
    priority: 'HIGH',
    demandStatus: 'PENDING_CONVERT',
    techPackStatus: input.techPackStatus ?? 'RELEASED',
    techPackVersionLabel: input.techPackVersionLabel ?? '',
    requiredDeliveryDate: '2026-05-12',
    requiredQtyTotal: 520,
    constraintsNote: '用于验证需求转单前置校验',
    skuLines: [
      { skuCode: `${input.styleCode}-BK-M`, size: 'M', color: '黑色', qty: 240 },
      { skuCode: `${input.styleCode}-BK-L`, size: 'L', color: '黑色', qty: 280 },
    ],
    hasProductionOrder: false,
    productionOrderId: null,
    createdAt: '2026-04-10 15:00:00',
    updatedAt: '2026-04-10 15:00:00',
  }
}

function buildOrderSeed(orderId: string, demandId: string): ProductionOrderSeed {
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
    createdAt: '2026-04-10 15:05:00',
    updatedAt: '2026-04-10 15:05:00',
    snapshotAt: '2026-04-10 15:05:00',
  }
}

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetTechnicalDataVersionRepository()

const style = listStyleArchives()[0]
const baseVersion = listTechnicalDataVersions()[0]
assert.ok(style, '必须存在款式档案演示数据')
assert.ok(baseVersion, '必须存在技术包结构演示数据')
const baseContent = getTechnicalDataVersionContent(baseVersion.technicalVersionId)
assert.ok(baseContent, '必须存在技术包内容演示数据')

const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'MERCHANDISER-CURRENT-TECH-PACK',
  merchandiserName: '跟单-转单校验',
  createdById: 'MERCHANDISER-CURRENT-TECH-PACK',
  createdBy: '跟单-转单校验',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: {
    styleCode: style.styleCode,
    formalSaleStatus: 'NO_FORMAL_SALE',
    formalProductionStatus: 'NO_FORMAL_PRODUCTION',
    formalSaleSource: '专项测试固定事实',
    formalProductionSource: '专项测试固定事实',
    checkedAt: '2026-08-27 09:00:00',
  },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '专项测试',
    triggerBusinessObjectId: 'CURRENT-TECH-PACK-DEMAND',
    thresholdQuantity: 1,
    reachedQuantity: 1,
    reachedAt: '2026-08-27 09:00:00',
    reason: '专项测试已满足做大货要求',
    uniqueTriggerKey: 'CURRENT-TECH-PACK-DEMAND',
  },
  creationReason: '验证需求转单只读取工程主单正式技术包',
}).masterOrderId)

const releasedSeedTechPack = getDemandCurrentTechPackInfo({ spuCode: 'SPU-2024-001' })
assert.equal(releasedSeedTechPack.canConvertToProductionOrder, true, '旧 FCS 已发布技术包补齐后应可作为当前生效技术包转单')
assert.ok(releasedSeedTechPack.currentTechPackVersionCode, '已启用需求应展示当前生效技术包版本编号')

assert.throws(
  () =>
    buildProductionOrderFromDemand(
      buildOrderSeed('PO-CURRENT-001', 'DEM-CURRENT-001'),
      buildDemand({ demandId: 'DEM-CURRENT-001', styleCode: 'UNKNOWN-STYLE' }),
      '测试用户',
    ),
  /当前需求未关联正式款式档案/,
  '未关联正式款式档案时不应允许转单',
)

updateStyleArchive(style.styleId, {
  currentTechPackVersionId: '',
  currentTechPackVersionCode: '',
  currentTechPackVersionLabel: '',
  currentTechPackVersionStatus: '',
  currentTechPackVersionActivatedAt: '',
  currentTechPackVersionActivatedBy: '',
})
const blockedCurrentTechPack = getDemandCurrentTechPackInfo({ spuCode: style.styleCode })
assert.equal(blockedCurrentTechPack.canConvertToProductionOrder, false, '未启用当前生效技术包的需求不应允许转单')
assert.match(blockedCurrentTechPack.blockReason, /尚未启用技术包版本/, '未启用场景应返回明确阻断原因')

assert.throws(
  () =>
    buildProductionOrderFromDemand(
      buildOrderSeed('PO-CURRENT-002', 'DEM-CURRENT-002'),
      buildDemand({ demandId: 'DEM-CURRENT-002', styleCode: style.styleCode, techPackStatus: 'INCOMPLETE' }),
      '测试用户',
    ),
  /当前款式尚未启用技术包版本/,
  '未启用当前生效技术包版本时不应允许转单',
)

const draft = createTechnicalDataVersionDraft({
  ...baseVersion,
  technicalVersionId: 'TDV-CURRENT-TECH-PACK-DRAFT',
  technicalVersionCode: 'TP-CURRENT-TECH-PACK-DRAFT',
  versionNo: 1,
  versionLabel: 'V1',
  versionStatus: 'DRAFT',
  reviewStage: '未提交审核',
  styleId: style.styleId,
  styleCode: style.styleCode,
  styleName: style.styleName,
  sourceProjectId: master.masterOrderId,
  sourceProjectCode: master.masterOrderCode,
  sourceProjectName: master.styleName,
  sourceProjectNodeId: '',
  createdFromTaskType: 'ENGINEERING_MASTER',
  createdFromTaskId: `${master.masterOrderId}-TECH_PACK_CONFIRMATION`,
  createdFromTaskCode: `${master.masterOrderId}-TECH_PACK_CONFIRMATION`,
  createdAt: '2026-08-27 10:00:00',
  createdBy: '跟单-转单校验',
  updatedAt: '2026-08-27 10:00:00',
  updatedBy: '跟单-转单校验',
}, {
  ...baseContent,
  technicalVersionId: 'TDV-CURRENT-TECH-PACK-DRAFT',
})
updateStyleArchive(style.styleId, {
  currentTechPackVersionId: draft.technicalVersionId,
  currentTechPackVersionCode: draft.technicalVersionCode,
  currentTechPackVersionLabel: draft.versionLabel,
  currentTechPackVersionStatus: '草稿中',
  currentTechPackVersionActivatedAt: '2026-04-10 15:08:00',
  currentTechPackVersionActivatedBy: '测试用户',
})

assert.throws(
  () =>
    buildProductionOrderFromDemand(
      buildOrderSeed('PO-CURRENT-003', 'DEM-CURRENT-003'),
      buildDemand({ demandId: 'DEM-CURRENT-003', styleCode: style.styleCode }),
      '测试用户',
    ),
  /当前生效技术包版本未发布/,
  '当前生效版本不是已发布时不应允许转单',
)

const published = updateTechnicalDataVersionRecord(draft.technicalVersionId, {
  versionStatus: 'PUBLISHED',
  reviewStage: '已发布',
  publishedAt: '2026-08-27 10:30:00',
  publishedBy: '跟单-转单校验',
  updatedAt: '2026-08-27 10:30:00',
  updatedBy: '跟单-转单校验',
})
assert.ok(published)
updateStyleArchive(style.styleId, {
  currentTechPackVersionId: published.technicalVersionId,
  currentTechPackVersionCode: published.technicalVersionCode,
  currentTechPackVersionLabel: published.versionLabel,
  currentTechPackVersionStatus: 'PUBLISHED',
  currentTechPackVersionActivatedAt: '2026-08-27 10:30:00',
  currentTechPackVersionActivatedBy: '跟单-转单校验',
})

const validDemand = buildDemand({
  demandId: 'DEM-CURRENT-004',
  styleCode: style.styleCode,
  techPackVersionLabel: published.versionLabel,
})
const order = buildProductionOrderFromDemand(
  buildOrderSeed('PO-CURRENT-004', validDemand.demandId),
  validDemand,
  '测试用户',
)

assert.equal(order.techPackSnapshot!.sourceTechPackVersionId, published.technicalVersionId, '需求转生产单时必须使用当前生效技术包版本')
assert.equal(published.createdFromTaskType, 'ENGINEERING_MASTER', '当前生效正式技术包必须来自工程主单')

const demandPageSource = read('src/pages/production/demand-domain.ts')
const contextSource = read('src/pages/production/context.ts')
const ordersPageSource = read('src/pages/production/orders-domain.ts')
const detailPageSource = read('src/pages/production/detail-domain.ts')
assert.ok(demandPageSource.includes('当前生效技术包版本'), '生产需求页必须展示当前生效技术包版本区块')
assert.ok(demandPageSource.includes('当前生效技术包'), '生产需求页列表必须展示当前生效技术包列')
assert.ok(demandPageSource.includes('不可转单'), '生产需求页筛选项应明确区分不可转单状态')
assert.ok(contextSource.includes("if (!allowGenerate) return ''"), '不可转单的需求不应继续渲染生成按钮')
assert.ok(ordersPageSource.includes('技术包版本：'), '生产单列表必须展示技术包快照所冻结的版本')
assert.ok(detailPageSource.includes('技术包快照编号'), '生产单详情必须展示技术包快照编号')
assert.ok(detailPageSource.includes('来源任务链'), '生产单详情必须展示来源任务链')

console.log('fcs-demand-to-order-current-tech-pack.spec.ts PASS')
