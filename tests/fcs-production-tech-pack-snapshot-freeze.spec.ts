import assert from 'node:assert/strict'
import { buildProductionOrderFromDemand, type ProductionOrderSeed } from '../src/data/fcs/production-orders.ts'
import {
  generateTechPackVersionFromPlateTask,
  generateTechPackVersionFromRevisionTask,
  publishTechnicalDataVersion,
  saveTechnicalDataVersionContent,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import type { ProductionDemand } from '../src/data/fcs/production-demands.ts'
import {
  fillCoreTechPackContent,
  prepareTechPackTaskScenario,
} from './pcs-tech-pack-test-helper.ts'

function buildDemand(
  demandId: string,
  styleCode: string,
  techPackVersionLabel: string,
): ProductionDemand {
  return {
    demandId,
    legacyType: 'ID_PURCHASE',
    legacyOrderNo: `LEGACY-${demandId}`,
    sourceSystem: 'NEW',
    spuCode: styleCode,
    spuName: '冻结验证款式',
    imageUrl: '/placeholder.svg?height=80&width=80',
    category: '测试分类',
    marketScopes: ['内销'],
    priority: 'NORMAL',
    demandStatus: 'PENDING_CONVERT',
    techPackStatus: 'RELEASED',
    techPackVersionLabel,
    requiredDeliveryDate: '2026-05-10',
    requiredQtyTotal: 480,
    constraintsNote: '用于验证生产单快照冻结',
    skuLines: [
      { skuCode: `${styleCode}-BK-M`, size: 'M', color: '黑色', qty: 220 },
      { skuCode: `${styleCode}-BK-L`, size: 'L', color: '黑色', qty: 260 },
    ],
    hasProductionOrder: false,
    productionOrderId: null,
    createdAt: '2026-04-10 13:00:00',
    updatedAt: '2026-04-10 13:00:00',
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

const scenario = prepareTechPackTaskScenario()

const firstDraft = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')
fillCoreTechPackContent(firstDraft.record.technicalVersionId, scenario.styleCode)
saveTechnicalDataVersionContent(
  firstDraft.record.technicalVersionId,
  {
    bomItems: [
      {
        id: 'bom-freeze-1',
        type: '面料',
        name: '首版主面料',
        spec: '100% 棉',
        unitConsumption: 1.15,
        lossRate: 0.02,
        supplier: '供应商甲',
      },
    ],
  },
  '测试用户',
)
const firstPublished = publishTechnicalDataVersion(firstDraft.record.technicalVersionId, '测试用户')
activateTechPackVersionForStyle(scenario.styleId, firstPublished.technicalVersionId, '测试用户')

const firstDemand = buildDemand('DEM-FREEZE-001', scenario.styleCode, firstPublished.versionLabel)
const firstOrder = buildProductionOrderFromDemand(
  buildSeed('PO-FREEZE-001', firstDemand.demandId, '2026-04-10 13:10:00'),
  firstDemand,
  '测试用户',
)
const firstSnapshotVersionCode = firstOrder.techPackSnapshot!.sourceTechPackVersionCode
const firstSnapshotVersionLabel = firstOrder.techPackSnapshot!.sourceTechPackVersionLabel
const firstSnapshotBomName = firstOrder.techPackSnapshot!.bomItems[0].name

saveTechnicalDataVersionContent(
  firstPublished.technicalVersionId,
  {
    bomItems: [
      {
        id: 'bom-freeze-1',
        type: '面料',
        name: '已变更主面料',
        spec: '65% 棉 35% 涤',
        unitConsumption: 1.22,
        lossRate: 0.04,
        supplier: '供应商乙',
      },
    ],
  },
  '测试用户',
)

assert.equal(firstOrder.techPackSnapshot!.bomItems[0].name, firstSnapshotBomName, '已生成生产单的快照 BOM 不得被后续版本内容修改影响')

const secondDraft = generateTechPackVersionFromRevisionTask(scenario.revisionTaskId, '测试用户')
fillCoreTechPackContent(secondDraft.record.technicalVersionId, scenario.styleCode)
saveTechnicalDataVersionContent(
  secondDraft.record.technicalVersionId,
  {
    bomItems: [
      {
        id: 'bom-freeze-2',
        type: '面料',
        name: '二版主面料',
        spec: '弹力棉',
        unitConsumption: 1.3,
        lossRate: 0.05,
        supplier: '供应商丙',
      },
    ],
  },
  '测试用户',
)
const secondPublished = publishTechnicalDataVersion(secondDraft.record.technicalVersionId, '测试用户')
activateTechPackVersionForStyle(scenario.styleId, secondPublished.technicalVersionId, '测试用户')

const secondDemand = buildDemand('DEM-FREEZE-002', scenario.styleCode, secondPublished.versionLabel)
const secondOrder = buildProductionOrderFromDemand(
  buildSeed('PO-FREEZE-002', secondDemand.demandId, '2026-04-10 14:10:00'),
  secondDemand,
  '测试用户',
)

assert.equal(firstOrder.techPackSnapshot!.sourceTechPackVersionCode, firstSnapshotVersionCode, '切换当前生效版本后，旧生产单快照版本编号不得变化')
assert.equal(firstOrder.techPackSnapshot!.sourceTechPackVersionLabel, firstSnapshotVersionLabel, '切换当前生效版本后，旧生产单快照版本标签不得变化')
assert.equal(secondOrder.techPackSnapshot!.sourceTechPackVersionId, secondPublished.technicalVersionId, '新生产单必须使用切换后的当前生效技术包版本')
assert.equal(secondOrder.techPackSnapshot!.linkedRevisionTaskIds[0], scenario.revisionTaskId, '新快照必须记录新的来源任务链')

console.log('fcs-production-tech-pack-snapshot-freeze.spec.ts PASS')
