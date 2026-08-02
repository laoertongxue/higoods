import assert from 'node:assert/strict'

import {
  closeEngineeringMasterOrder,
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  setEngineeringMasterStatus,
  updateEngineeringTaskRecord,
  validateEngineeringMasterOrderClose,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  assertEngineeringBomPricingSnapshotValid,
} from '../src/data/pcs-engineering-bom-pricing.ts'
import {
  createMaterialArchive,
  createMaterialSkuRecord,
} from '../src/data/pcs-material-archive-repository.ts'
import {
  listStyleArchives,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
} from '../src/data/pcs-technical-data-version-repository.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import { getEngineeringTaskDefinition } from '../src/data/pcs-engineering-dependency-policy.ts'
import type {
  TechnicalBomItem,
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'
import {
  handlePcsEngineeringMasterDetailEvent,
  renderPcsEngineeringMasterDetailPage,
} from '../src/pages/pcs-engineering-master-detail.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives()[0]
const baseRecord = listTechnicalDataVersions()[0]
assert.ok(style)
assert.ok(baseRecord)

const materialArchive = createMaterialArchive({
  kind: 'fabric',
  materialName: `工程关闭门禁面料 ${Date.now()}`,
  materialNameEn: 'Close gate fabric',
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
const materialSku = createMaterialSkuRecord(materialArchive.materialId, {
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
assert.ok(materialSku)

function makeRecord(masterOrderId: string, confirmationTaskId: string, id: string): TechnicalDataVersionRecord {
  return {
    ...baseRecord,
    technicalVersionId: id,
    technicalVersionCode: `TP-${id}`,
    versionLabel: 'v-close-gate',
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    sourceProjectId: masterOrderId,
    sourceProjectCode: masterOrderId,
    sourceProjectName: style.styleName,
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
    publishedBy: '跟单甲',
    missingItemCodes: [],
    missingItemNames: [],
    updatedAt: '2026-08-02 10:00',
    updatedBy: '跟单甲',
  }
}

function makeBomItem(): TechnicalBomItem {
  return {
    id: 'BOM-CLOSE-GATE',
    type: '面料',
    name: materialSku.materialName,
    spec: materialSku.specName,
    materialCode: materialSku.materialCode,
    materialSkuId: materialSku.materialSkuId,
    unit: '米',
    unitConsumption: 1,
    sampleQuantity: 1,
    lossRate: 0,
    supplier: '测试供应商',
  }
}

function makeContent(technicalVersionId: string, withPricingBom: boolean): TechnicalDataVersionContent {
  return {
    technicalVersionId,
    patternFiles: [],
    patternDesc: '',
    processEntries: [],
    processRouteStatus: 'CONFIRMED',
    processRouteConfirmedBy: '跟单甲',
    processRouteConfirmedAt: '2026-08-02 09:00',
    processRouteUpdatedBy: '跟单甲',
    processRouteUpdatedAt: '2026-08-02 09:00',
    processRouteChangeReason: '',
    sizeTable: [],
    bomItems: withPricingBom ? [makeBomItem()] : [],
    bomCustomCosts: withPricingBom ? [{ title: '车位费', amountIdr: 10000 }] : [],
    qualityRules: [],
    colorMaterialMappings: [],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  }
}

function createReadyMaster(withPricingBom: boolean) {
  resetEngineeringMasterRepository()
  const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
    styleId: style.styleId,
    styleCode: style.styleCode,
    merchandiserName: '跟单-林晓',
    createdBy: '跟单-林晓',
  }).masterOrderId)
  for (const task of master.tasks) {
    updateEngineeringTaskRecord(master.masterOrderId, task.taskId, (draft) => {
      if (['PATTERN_ARTWORK', 'COLOR_YARN', 'COLOR_FABRIC'].includes(draft.taskType)) {
        draft.status = '因需求变更结束'
        return
      }
      if (draft.taskType === 'TECH_PACK_CONFIRMATION') {
        draft.status = '待前置'
        return
      }
      draft.status = '已完成'
      draft.firstCompletedAt = '2026-08-02 09:30'
      draft.effectiveCompletedAt = '2026-08-02 09:30'
      draft.completedAt = '2026-08-02 09:30'
    })
  }
  const confirmationTaskId = `${master.masterOrderId}-TECH_PACK_CONFIRMATION`
  const versionId = `TDV-CLOSE-${withPricingBom ? 'VALID' : 'NO-SNAPSHOT'}-${Date.now()}-${Math.random()}`
  createTechnicalDataVersionDraft(
    makeRecord(master.masterOrderId, confirmationTaskId, versionId),
    makeContent(versionId, withPricingBom),
  )
  activateTechPackVersionForStyle(style.styleId, versionId, '跟单-林晓')
  return { masterOrderId: master.masterOrderId, versionId, confirmationTaskId }
}

// 新工程来源技术包缺少 BOM 与价格字段时，正式启用本身就必须失败，且工程主单与技术包事实不变。
resetEngineeringMasterRepository()
const missingSnapshotMaster = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单-林晓',
  createdBy: '跟单-林晓',
}).masterOrderId)
for (const task of missingSnapshotMaster.tasks) {
  updateEngineeringTaskRecord(missingSnapshotMaster.masterOrderId, task.taskId, (draft) => {
    if (draft.taskType === 'TECH_PACK_CONFIRMATION') return
    draft.status = ['PATTERN_ARTWORK', 'COLOR_YARN', 'COLOR_FABRIC'].includes(draft.taskType)
      ? '因需求变更结束'
      : '已完成'
  })
}
const missingSnapshotTaskId = `${missingSnapshotMaster.masterOrderId}-TECH_PACK_CONFIRMATION`
const missingSnapshotVersionId = `TDV-CLOSE-NO-SNAPSHOT-${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord(missingSnapshotMaster.masterOrderId, missingSnapshotTaskId, missingSnapshotVersionId),
  makeContent(missingSnapshotVersionId, false),
)
const missingSnapshotMasterBefore = getEngineeringMasterOrderById(missingSnapshotMaster.masterOrderId)
const missingSnapshotContentBefore = getTechnicalDataVersionContent(missingSnapshotVersionId)
assert.throws(
  () => activateTechPackVersionForStyle(style.styleId, missingSnapshotVersionId, '跟单-林晓'),
  /正式快照|BOM.*定价字段/,
)
assert.deepEqual(getEngineeringMasterOrderById(missingSnapshotMaster.masterOrderId), missingSnapshotMasterBefore)
assert.deepEqual(getTechnicalDataVersionContent(missingSnapshotVersionId), missingSnapshotContentBefore)

// 快照结构失效必须被独立校验识别，不能只判断对象是否存在。
assert.throws(
  () => assertEngineeringBomPricingSnapshotValid({
    snapshotVersion: 1,
    frozenAt: '2026-08-02 10:00',
    frozenBy: '跟单甲',
    exchangeRateIdrPerCny: 0,
    exchangeRateSource: '系统最新汇率',
    materialLines: [],
    customCosts: [],
    cost: {
      materialCostCny: 0,
      customCostIdr: 0,
      comprehensiveCostCny: 0,
      comprehensiveCostIdr: 0,
      exchangeRateIdrPerCny: 0,
    },
    bomItems: [],
    materialPriceSnapshots: [],
    customCostsIdr: [],
    materialCostCny: 0,
    comprehensiveCostCny: 0,
    comprehensiveCostIdr: 0,
    linkedPartTemplateVersions: [],
  }),
  /汇率|快照/,
)

const ready = createReadyMaster(true)
assert.equal(getTechnicalDataVersionById(ready.versionId)?.versionStatus, 'PUBLISHED')
assert.equal(getTechnicalDataVersionContent(ready.versionId)?.bomPricingSnapshot?.snapshotVersion, 1)
assert.equal(
  getEngineeringMasterOrderById(ready.masterOrderId)?.tasks.find((task) => task.taskId === ready.confirmationTaskId)?.status,
  '已完成',
  '技术包正式启用必须原子完成真实技术包确认任务',
)

// 有效任务未完成必须阻断；恢复完成后可继续校验。
const accessoryTaskId = `${ready.masterOrderId}-ACCESSORY_PURCHASE`
updateEngineeringTaskRecord(ready.masterOrderId, accessoryTaskId, (task) => {
  task.status = '进行中'
})
assert.throws(() => validateEngineeringMasterOrderClose(ready.masterOrderId), /辅料下单任务.*未完成|有效任务.*未完成/)
updateEngineeringTaskRecord(ready.masterOrderId, accessoryTaskId, (task) => {
  task.status = '已完成'
})

// 固定依赖不能缺失，也不能通过人工清空依赖绕过。
updateEngineeringTaskRecord(ready.masterOrderId, ready.confirmationTaskId, (task) => {
  task.dependsOnTaskIds = []
})
assert.throws(() => validateEngineeringMasterOrderClose(ready.masterOrderId), /缺少固定前置|依赖/)
updateEngineeringTaskRecord(ready.masterOrderId, ready.confirmationTaskId, (task) => {
  task.dependsOnTaskIds = getEngineeringTaskDefinition('TECH_PACK_CONFIRMATION').dependsOn
    .map((taskType) => `${ready.masterOrderId}-${taskType}`)
})

// 因需求变更结束的非有效条件任务不阻断；生产需求、生产单和加工单不存在也不阻断。
const validation = validateEngineeringMasterOrderClose(ready.masterOrderId)
assert.equal(validation.canClose, true)

// 旧的任意状态投影入口不得绕过关闭领域门禁。
assert.throws(() => setEngineeringMasterStatus(ready.masterOrderId, '已关闭'), /关闭.*领域入口|不能直接/)

// 只有该工程主单跟单可以执行人工关闭。
assert.throws(() => closeEngineeringMasterOrder(ready.masterOrderId, '其他跟单'), /只有.*跟单|主单跟单/)
const closableHtml = renderPcsEngineeringMasterDetailPage(ready.masterOrderId)
assert.match(closableHtml, /data-skip-page-rerender="true" data-pcs-engineering-master-action="close-master-order"/)

Object.assign(globalThis, {
  window: {
    location: { pathname: `/pcs/engineering/masters/${ready.masterOrderId}` },
    dispatchEvent: () => true,
  },
  document: { querySelector: () => null },
})
const closeActionNode = { dataset: { pcsEngineeringMasterAction: 'close-master-order' } }
const handled = handlePcsEngineeringMasterDetailEvent({
  closest: () => closeActionNode,
} as unknown as HTMLElement)
assert.equal(handled, true)
assert.equal(getEngineeringMasterOrderById(ready.masterOrderId)?.status, '已关闭')
assert.ok(getEngineeringMasterOrderById(ready.masterOrderId)?.closedAt)
assert.throws(() => closeEngineeringMasterOrder(ready.masterOrderId, '跟单-林晓'), /已关闭|不能重复/)

console.log('pcs-engineering-master-close-gate.spec.ts PASS')
