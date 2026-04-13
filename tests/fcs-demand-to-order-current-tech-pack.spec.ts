import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProductionOrderFromDemand, type ProductionOrderSeed } from '../src/data/fcs/production-orders.ts'
import type { ProductionDemand } from '../src/data/fcs/production-demands.ts'
import { getDemandCurrentTechPackInfo } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import { updateStyleArchive } from '../src/data/pcs-style-archive-repository.ts'
import {
  generateTechPackVersionFromPlateTask,
  publishTechnicalDataVersion,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import {
  fillCoreTechPackContent,
  prepareTechPackTaskScenario,
} from './pcs-tech-pack-test-helper.ts'

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

const scenario = prepareTechPackTaskScenario()

const releasedSeedTechPack = getDemandCurrentTechPackInfo({ spuCode: 'SPU-2024-001' })
assert.equal(releasedSeedTechPack.canConvertToProductionOrder, true, '旧 FCS 已发布技术包补齐后应可作为当前生效技术包转单')
assert.ok(releasedSeedTechPack.currentTechPackVersionCode, '已启用需求应展示当前生效技术包版本编号')

const blockedSeedTechPack = getDemandCurrentTechPackInfo({ spuCode: 'SPU-2024-002' })
assert.equal(blockedSeedTechPack.canConvertToProductionOrder, false, '未启用当前生效技术包的需求不应允许转单')
assert.match(blockedSeedTechPack.blockReason, /尚未启用技术包版本/, '未启用场景应返回明确阻断原因')

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

assert.throws(
  () =>
    buildProductionOrderFromDemand(
      buildOrderSeed('PO-CURRENT-002', 'DEM-CURRENT-002'),
      buildDemand({ demandId: 'DEM-CURRENT-002', styleCode: scenario.styleCode, techPackStatus: 'INCOMPLETE' }),
      '测试用户',
    ),
  /当前款式尚未启用技术包版本/,
  '未启用当前生效技术包版本时不应允许转单',
)

const draft = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')
fillCoreTechPackContent(draft.record.technicalVersionId, scenario.styleCode)
updateStyleArchive(scenario.styleId, {
  currentTechPackVersionId: draft.record.technicalVersionId,
  currentTechPackVersionCode: draft.record.technicalVersionCode,
  currentTechPackVersionLabel: draft.record.versionLabel,
  currentTechPackVersionStatus: '草稿中',
  currentTechPackVersionActivatedAt: '2026-04-10 15:08:00',
  currentTechPackVersionActivatedBy: '测试用户',
})

assert.throws(
  () =>
    buildProductionOrderFromDemand(
      buildOrderSeed('PO-CURRENT-003', 'DEM-CURRENT-003'),
      buildDemand({ demandId: 'DEM-CURRENT-003', styleCode: scenario.styleCode }),
      '测试用户',
    ),
  /当前生效技术包版本未发布/,
  '当前生效版本不是已发布时不应允许转单',
)

const published = publishTechnicalDataVersion(draft.record.technicalVersionId, '测试用户')
activateTechPackVersionForStyle(scenario.styleId, published.technicalVersionId, '测试用户')

const validDemand = buildDemand({
  demandId: 'DEM-CURRENT-004',
  styleCode: scenario.styleCode,
  techPackVersionLabel: published.versionLabel,
})
const order = buildProductionOrderFromDemand(
  buildOrderSeed('PO-CURRENT-004', validDemand.demandId),
  validDemand,
  '测试用户',
)

assert.equal(order.techPackSnapshot!.sourceTechPackVersionId, published.technicalVersionId, '需求转生产单时必须使用当前生效技术包版本')

const demandPageSource = read('src/pages/production/demand-domain.ts')
const contextSource = read('src/pages/production/context.ts')
const ordersPageSource = read('src/pages/production/orders-domain.ts')
const detailPageSource = read('src/pages/production/detail-domain.ts')
assert.ok(demandPageSource.includes('当前生效技术包版本'), '生产需求页必须展示当前生效技术包版本区块')
assert.ok(demandPageSource.includes('当前生效技术包'), '生产需求页列表必须展示当前生效技术包列')
assert.ok(demandPageSource.includes('不可转单'), '生产需求页筛选项应明确区分不可转单状态')
assert.ok(contextSource.includes("if (!allowGenerate) return ''"), '不可转单的需求不应继续渲染生成按钮')
assert.ok(ordersPageSource.includes('技术包快照版本'), '生产单列表必须展示技术包快照版本列')
assert.ok(detailPageSource.includes('技术包快照编号'), '生产单详情必须展示技术包快照编号')
assert.ok(detailPageSource.includes('来源任务链'), '生产单详情必须展示来源任务链')

console.log('fcs-demand-to-order-current-tech-pack.spec.ts PASS')
