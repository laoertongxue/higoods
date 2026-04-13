import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildProductionOrderFromDemand,
  type ProductionOrderSeed,
} from '../src/data/fcs/production-orders.ts'
import {
  generateTechPackVersionFromPlateTask,
  publishTechnicalDataVersion,
  saveTechnicalDataVersionContent,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import type { ProductionDemand } from '../src/data/fcs/production-demands.ts'
import {
  fillCoreTechPackContent,
  prepareTechPackTaskScenario,
} from './pcs-tech-pack-test-helper.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function buildDemand(styleCode: string, styleName: string, techPackVersionLabel: string): ProductionDemand {
  return {
    demandId: 'DEM-TECH-PACK-SNAPSHOT-001',
    legacyType: 'ID_PURCHASE',
    legacyOrderNo: 'LEGACY-TECH-PACK-001',
    sourceSystem: 'NEW',
    spuCode: styleCode,
    spuName: styleName,
    imageUrl: '/placeholder.svg?height=80&width=80',
    category: '测试分类',
    marketScopes: ['内销'],
    priority: 'HIGH',
    demandStatus: 'PENDING_CONVERT',
    techPackStatus: 'RELEASED',
    techPackVersionLabel,
    requiredDeliveryDate: '2026-05-01',
    requiredQtyTotal: 600,
    constraintsNote: '用于验证生产单技术包快照创建',
    skuLines: [
      { skuCode: `${styleCode}-BK-M`, size: 'M', color: '黑色', qty: 260 },
      { skuCode: `${styleCode}-BK-L`, size: 'L', color: '黑色', qty: 340 },
    ],
    hasProductionOrder: false,
    productionOrderId: null,
    createdAt: '2026-04-10 12:00:00',
    updatedAt: '2026-04-10 12:00:00',
  }
}

function buildOrderSeed(demandId: string): ProductionOrderSeed {
  return {
    productionOrderId: 'PO-TECH-PACK-SNAPSHOT-001',
    demandId,
    status: 'READY_FOR_BREAKDOWN',
    mainFactoryId: 'ID-F001',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F001',
    assignmentSummary: {
      directCount: 0,
      biddingCount: 0,
      totalTasks: 0,
      unassignedCount: 0,
    },
    assignmentProgress: {
      status: 'NOT_READY',
      directAssignedCount: 0,
      biddingLaunchedCount: 0,
      biddingAwardedCount: 0,
    },
    biddingSummary: {
      activeTenderCount: 0,
      overdueTenderCount: 0,
    },
    directDispatchSummary: {
      assignedFactoryCount: 0,
      rejectedCount: 0,
      overdueAckCount: 0,
    },
    taskBreakdownSummary: {
      isBrokenDown: false,
      taskTypesTop3: [],
    },
    riskFlags: [],
    auditLogs: [],
    createdAt: '2026-04-10 12:05:00',
    updatedAt: '2026-04-10 12:05:00',
    snapshotAt: '2026-04-10 12:05:00',
  }
}

const scenario = prepareTechPackTaskScenario()
const draft = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')

fillCoreTechPackContent(draft.record.technicalVersionId, scenario.styleCode)
saveTechnicalDataVersionContent(
  draft.record.technicalVersionId,
  {
    patternDesigns: [
      {
        id: 'design-1',
        name: '花型主稿',
        imageUrl: '/mock/design-1.png',
      },
    ],
    attachments: [
      {
        id: 'attachment-1',
        fileName: '工艺说明.pdf',
        fileType: 'PDF',
        fileSize: '512 KB',
        uploadedAt: '2026-04-10 12:01:00',
        uploadedBy: '测试用户',
        downloadUrl: 'local://attachment-1',
      },
    ],
  },
  '测试用户',
)

const published = publishTechnicalDataVersion(draft.record.technicalVersionId, '测试用户')
activateTechPackVersionForStyle(scenario.styleId, published.technicalVersionId, '测试用户')

const demand = buildDemand(scenario.styleCode, '生产单技术包快照测试款', published.versionLabel)
const order = buildProductionOrderFromDemand(buildOrderSeed(demand.demandId), demand, '测试用户')
const snapshot = order.techPackSnapshot

assert.ok(snapshot, '生产单生成后必须写入正式技术包快照对象')
assert.equal(snapshot!.productionOrderId, order.productionOrderId, '快照必须绑定当前生产单主键')
assert.equal(snapshot!.productionOrderNo, order.productionOrderNo, '快照必须绑定当前生产单编号')
assert.equal(snapshot!.styleId, scenario.styleId, '快照必须记录来源款式主键')
assert.equal(snapshot!.styleCode, scenario.styleCode, '快照必须记录来源款式编号')
assert.equal(snapshot!.sourceTechPackVersionId, published.technicalVersionId, '快照必须记录当前生效技术包版本主键')
assert.equal(snapshot!.sourceTechPackVersionCode, published.technicalVersionCode, '快照必须记录当前生效技术包版本编号')
assert.equal(snapshot!.sourceTechPackVersionLabel, published.versionLabel, '快照必须记录当前生效技术包版本标签')
assert.ok(snapshot!.sourcePublishedAt, '快照必须记录来源版本发布时间')
assert.equal(snapshot!.snapshotBy, '测试用户', '快照必须记录冻结操作人')
assert.ok(snapshot!.bomItems.length > 0, '快照必须冻结 BOM 内容')
assert.ok(snapshot!.patternFiles.length > 0, '快照必须冻结纸样内容')
assert.ok(snapshot!.processEntries.length > 0, '快照必须冻结工序工艺内容')
assert.ok(snapshot!.sizeTable.length > 0, '快照必须冻结放码规则内容')
assert.ok(snapshot!.qualityRules.length > 0, '快照必须冻结质检标准内容')
assert.ok(snapshot!.colorMaterialMappings.length > 0, '快照必须冻结款色用料对应内容')
assert.ok(snapshot!.patternDesigns.length > 0, '快照必须冻结花型设计内容')
assert.ok(snapshot!.attachments.length > 0, '快照必须冻结附件内容')
assert.deepEqual(snapshot!.linkedPatternTaskIds, [scenario.plateTaskId], '快照必须冻结来源任务链')
assert.equal('status' in snapshot!, false, '快照对象不应再保留旧薄模型 status 字段')
assert.equal('versionLabel' in snapshot!, false, '快照对象不应再保留旧薄模型 versionLabel 字段')

const ordersPageSource = read('src/pages/production/orders-domain.ts')
const detailPageSource = read('src/pages/production/detail-domain.ts')
assert.ok(ordersPageSource.includes('techPackSnapshotDisplay.techPackVersionText'), '生产单列表必须从技术包快照展示版本信息')
assert.ok(ordersPageSource.includes('techPackSnapshotDisplay.techPackSnapshotAt'), '生产单列表必须从技术包快照展示冻结时间')
assert.ok(detailPageSource.includes('sourceTechPackVersionCode'), '生产单详情必须展示来源技术包版本编号')
assert.ok(detailPageSource.includes('sourceTechPackVersionLabel'), '生产单详情必须展示来源技术包版本标签')
assert.ok(detailPageSource.includes('来源任务链'), '生产单详情必须展示来源任务链')

console.log('fcs-production-tech-pack-snapshot-create.spec.ts PASS')
