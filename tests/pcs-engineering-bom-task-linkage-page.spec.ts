import { chromium } from '@playwright/test'
import { PCS_LEGACY_KEYS, pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import { listEngineeringMasterPriorResultCandidates } from '../src/data/pcs-engineering-master-repository.ts'
import { resetAndGetProductionPreparationStyle } from './helpers/pcs-engineering-design-revision-fixture.ts'
import { createTestingOrder, updateTestingOrder } from '../src/data/pcs-testing-order-repository.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  captureStyleArchiveRepositoryState,
  listStyleArchives,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'
import { getProjectStoreSnapshot } from '../src/data/pcs-project-repository.ts'
import { getProjectRelationStoreSnapshot } from '../src/data/pcs-project-relation-repository.ts'
import { getProjectArchiveStoreSnapshot } from '../src/data/pcs-project-archive-repository.ts'
import { saveTechnicalDataVersionContent } from '../src/data/pcs-project-technical-data-writeback.ts'
import { setBomPriceReviewInvalidationFailureForTesting } from '../src/data/pcs-tech-pack-bom-price-review-invalidation.ts'
import { listTechPackReviewNotifications } from '../src/data/pcs-tech-pack-review-notification-repository.ts'
import { listTechPackVersionLogs } from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  applyBomRequirementsToEngineeringTasks,
  createEngineeringMasterOrder,
  getEngineeringMasterOrderStoreSnapshot,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  applyEngineeringTaskLinkageFromBomForTechnicalVersion,
  saveTechnicalDataVersionContentWithEngineeringLinkage,
  type BomItemRow,
} from '../src/pages/tech-pack/context.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionById,
  getTechnicalDataVersionStoreSnapshot,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
  updateTechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type { TechnicalDataVersionContent } from '../src/data/pcs-technical-data-version-types.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetTechnicalDataVersionRepository()
const style = resetAndGetProductionPreparationStyle()
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-M-A',
  merchandiserName: '跟单A',
  createdById: 'USER-M-A',
  createdBy: '跟单A',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: { styleCode: style.styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION', formalSaleSource: '专项测试固定事实', formalProductionSource: '专项测试固定事实', checkedAt: '2026-08-27 09:00:00' },
  bulkProductionQualification: { basisType: 'TEST_APPROVED', triggerBusinessObjectType: '专项测试', triggerBusinessObjectId: `BOM-LINK-${style.styleCode}`, thresholdQuantity: 1, reachedQuantity: 1, reachedAt: '2026-08-27 09:00:00', reason: '专项测试已满足做大货要求', uniqueTriggerKey: `BOM-LINK-${style.styleCode}` },
  creationReason: '专项测试创建生产准备单',
}).masterOrderId)

const baseVersion = listTechnicalDataVersions()[0]
assert.ok(baseVersion)
const linkedTechnicalVersionId = `TDV-BOM-LINK-${Date.now()}`
const content: TechnicalDataVersionContent = {
  technicalVersionId: linkedTechnicalVersionId,
  patternFiles: [],
  patternDesc: '',
  processEntries: [],
  sizeTable: [],
  bomItems: [],
  bomCustomCosts: [],
  qualityRules: [],
  colorMaterialMappings: [],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {},
}
createTechnicalDataVersionDraft({
  ...baseVersion,
  technicalVersionId: linkedTechnicalVersionId,
  technicalVersionCode: `TP-${linkedTechnicalVersionId}`,
  styleId: style.styleId,
  styleCode: style.styleCode,
  sourceProjectId: master.masterOrderId,
  createdFromTaskType: 'ENGINEERING_MASTER',
  createdFromTaskId: `${master.masterOrderId}-TECH_PACK_CONFIRMATION`,
  versionStatus: 'DRAFT',
  publishedAt: '',
  publishedBy: '',
}, content)

const bomRows = [{
  id: 'BOM-PAGE-PRINT',
  type: '面料',
  colorLabel: '黑色',
  materialCode: 'MAT-001',
  materialSkuId: 'MAT-SKU-001',
  materialName: '黑色面料',
  spec: '150cm',
  unit: '码',
  patternPieces: [],
  linkedPatternIds: [],
  applicableSkuCodes: [],
  usageProcessCodes: [],
  usage: 1,
  lossRate: 0,
  printRequirement: '数码印花',
  waterSolubleRequirement: '否',
  dyeRequirement: '无',
  printSideMode: 'SINGLE',
  frontPatternDesignId: '',
  frontPatternDesignIds: [],
  insidePatternDesignId: '',
  insidePatternDesignIds: [],
}] satisfies BomItemRow[]
const browser = await chromium.launch({ headless: true })
let linked: Awaited<ReturnType<typeof applyEngineeringTaskLinkageFromBomForTechnicalVersion>>
try {
  const page = await browser.newPage()
  await page.addInitScript('globalThis.__name = (value) => value')
  await page.goto('http://127.0.0.1:5173/pcs/testing/orders')
  await page.getByRole('heading', { name: '测款单', exact: true }).waitFor()
  linked = await page.evaluate(async ({ snapshots, versionId, rows }) => {
    const rt = await import('/src/data/pcs-record-runtime.ts')
    await rt.ensurePcsRecordState()
    await rt.runPcsRecordCommand(() => { for (const [key, raw] of snapshots) rt.pcsRecordStore.setItem(key, raw) })
    return await (await import('/src/pages/tech-pack/context.ts')).applyEngineeringTaskLinkageFromBomForTechnicalVersion(versionId, rows)
  }, { snapshots: PCS_LEGACY_KEYS.map(key => [key, pcsRecordStore.getItem(key)]).filter(([,raw]) => raw !== null), versionId: linkedTechnicalVersionId, rows: bomRows })
} finally { await browser.close() }
for (const task of linked!.masterOrder.tasks) updateEngineeringTaskRecord(master.masterOrderId, task.taskId, stored => Object.assign(stored, task))

assert.equal(linked?.masterOrder.masterOrderId, master.masterOrderId)
assert.equal(
  linked?.masterOrder.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')?.materialLines[0]?.bomItemId,
  'BOM-PAGE-PRINT',
  '技术包 BOM 适配层必须把真实 BOM 行写入生产准备单任务',
)

const contextSource = readFileSync(new URL('../src/pages/tech-pack/context.ts', import.meta.url), 'utf8')
const eventsSource = readFileSync(new URL('../src/pages/tech-pack/events.ts', import.meta.url), 'utf8')
const persistBlock = contextSource.slice(
  contextSource.indexOf("if (options.persist !== false && state.currentTechnicalVersionId && !state.compatibilityMode)"),
  contextSource.indexOf('return true', contextSource.indexOf("if (options.persist !== false && state.currentTechnicalVersionId && !state.compatibilityMode)")),
)
assert.match(
  persistBlock,
  /saveTechnicalDataVersionContentWithEngineeringLinkage\([\s\S]*state\.currentTechnicalVersionId!?,[\s\S]*state\.bomItems/,
  '真实技术包保存链必须通过跨仓原子联动入口',
)
assert.doesNotMatch(persistBlock, /applyEngineeringTaskLinkageFromBomForTechnicalVersion\(/, '页面保存链不得分别写两个仓库')
assert.match(eventsSource, /action === 'save-bom'[\s\S]*syncMaterialCostRows\(\)[\s\S]*syncTechPackToStore\(\)/, 'BOM 新增/编辑弹窗必须进入通用保存链')
assert.match(eventsSource, /action === 'delete-bom'[\s\S]*syncMaterialCostRows\(\)[\s\S]*syncTechPackToStore\(\)/, 'BOM 删除动作必须进入通用保存链')

assert.throws(
  () => createTechnicalDataVersionDraft({
    ...baseVersion,
    technicalVersionId: `TDV-BOM-UNRELATED-${Date.now()}`,
    technicalVersionCode: `TP-BOM-UNRELATED-${Date.now()}`,
    styleId: style.styleId,
    styleCode: style.styleCode,
    sourceProjectId: 'PRODUCT-PROJECT-NOT-MASTER',
    createdFromTaskId: '',
    versionStatus: 'DRAFT',
    publishedAt: '',
    publishedBy: '',
  }),
  /必须同时记录来源对象和来源任务|只能由生产准备单生成/,
  '无工程权威来源的技术包不得先写入再尝试联动',
)

const secondStyle = listStyleArchives().find((item) => item.styleId !== style.styleId && listEngineeringMasterPriorResultCandidates(item.styleCode, 'PURE_WOVEN').some(candidate => candidate.engineeringTaskType === 'BASE_PATTERN_WOVEN'))
assert.ok(secondStyle)
const testingFixture = createTestingOrder({ styleId: secondStyle.styleId })
assert.ok(testingFixture.ok)
updateTestingOrder(testingFixture.order!.testingOrderId, { status: '已结束', bulkDecision: '是' }, '专项测试', '设置测试资格')
const secondMaster = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: secondStyle.styleId,
  styleCode: secondStyle.styleCode,
  merchandiserId: 'USER-M-B',
  merchandiserName: '跟单B',
  createdById: 'USER-M-B',
  createdBy: '跟单B',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: { styleCode: secondStyle.styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION', formalSaleSource: '专项测试固定事实', formalProductionSource: '专项测试固定事实', checkedAt: '2026-08-27 09:00:00' },
  bulkProductionQualification: { basisType: 'TEST_APPROVED', triggerBusinessObjectType: '专项测试', triggerBusinessObjectId: `BOM-LINK-${secondStyle.styleCode}`, thresholdQuantity: 1, reachedQuantity: 1, reachedAt: '2026-08-27 09:00:00', reason: '专项测试已满足做大货要求', uniqueTriggerKey: `BOM-LINK-${secondStyle.styleCode}` },
  creationReason: '专项测试创建生产准备单',
}).masterOrderId)

function createSourceVersion(
  suffix: string,
  sourceMaster: typeof master,
  sourceStyle: typeof style,
  contentOverride: TechnicalDataVersionContent = content,
) {
  const technicalVersionId = `TDV-BOM-SOURCE-${suffix}-${Date.now()}`
  createTechnicalDataVersionDraft({
    ...baseVersion,
    technicalVersionId,
    technicalVersionCode: `TP-${technicalVersionId}`,
    styleId: sourceStyle.styleId,
    styleCode: sourceStyle.styleCode,
    sourceProjectId: sourceMaster.masterOrderId,
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: `${sourceMaster.masterOrderId}-TECH_PACK_CONFIRMATION`,
    versionStatus: 'DRAFT',
    publishedAt: '',
    publishedBy: '',
  }, { ...contentOverride, technicalVersionId })
  return technicalVersionId
}

function markTechnicalVersionApproved(technicalVersionId: string): void {
  const record = getTechnicalDataVersionById(technicalVersionId)
  assert.ok(record?.buyerReview)
  assert.ok(record.patternMakerReview)
  assert.ok(record.merchandiserReview)
  updateTechnicalDataVersionRecord(technicalVersionId, {
    reviewStage: '待发布',
    buyerReview: { ...record.buyerReview, status: '审核-已通过' },
    patternMakerReview: { ...record.patternMakerReview, status: '审核-已通过' },
    merchandiserReview: { ...record.merchandiserReview, status: '审核-已通过' },
    reviewUnlockedModuleKeys: [],
  })
}

function toTechnicalBomItems(rows: BomItemRow[]): TechnicalDataVersionContent['bomItems'] {
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.materialName,
    spec: row.spec,
    materialCode: row.materialCode,
    materialSkuId: row.materialSkuId,
    unit: row.unit,
    colorLabel: row.colorLabel,
    unitConsumption: row.usage,
    sampleQuantity: row.sampleQuantity ?? 1,
    lossRate: row.lossRate,
    supplier: '',
    printRequirement: row.printRequirement,
    dyeRequirement: row.dyeRequirement,
    waterSolubleRequirement: row.waterSolubleRequirement,
    printSideMode: row.printSideMode,
    frontPatternDesignId: row.frontPatternDesignId,
    frontPatternDesignIds: row.frontPatternDesignIds,
    insidePatternDesignId: row.insidePatternDesignId,
    insidePatternDesignIds: row.insidePatternDesignIds,
    applicableSkuCodes: row.applicableSkuCodes,
    linkedPatternIds: row.linkedPatternIds,
    usageProcessCodes: row.usageProcessCodes,
  }))
}

assert.throws(
  () => createTechnicalDataVersionDraft({
    ...baseVersion,
    technicalVersionId: `TDV-BOM-MISSING-TASK-${Date.now()}`,
    technicalVersionCode: `TP-BOM-MISSING-TASK-${Date.now()}`,
    styleId: style.styleId,
    styleCode: style.styleCode,
    sourceProjectId: master.masterOrderId,
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: '',
  }),
  /同时记录来源对象和来源任务/,
  '不得创建只有主单而没有来源任务的技术包',
)
assert.throws(
  () => createTechnicalDataVersionDraft({
    ...baseVersion,
    technicalVersionId: `TDV-BOM-CONFLICT-${Date.now()}`,
    technicalVersionCode: `TP-BOM-CONFLICT-${Date.now()}`,
    styleId: style.styleId,
    styleCode: style.styleCode,
    sourceProjectId: master.masterOrderId,
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: `${secondMaster.masterOrderId}-TECH_PACK_CONFIRMATION`,
  }),
  /生产准备单任务不存在/,
  '来源主单与任务不一致时必须在创建阶段阻断',
)

const atomicVersionId = createSourceVersion('ATOMIC', master, style)

const genericAddVersionId = createSourceVersion('GENERIC-ADD', master, style)
markTechnicalVersionApproved(genericAddVersionId)
saveTechnicalDataVersionContentWithEngineeringLinkage(
  genericAddVersionId,
  bomRows,
  { bomItems: toTechnicalBomItems(bomRows) },
  '买手A',
)
assert.equal(
  getTechnicalDataVersionById(genericAddVersionId)?.buyerReview?.status,
  '待审核',
  '技术包 BOM 弹窗新增物料必须通过通用保存链触发买手复审',
)

function captureAtomicStores() {
  return {
    technical: getTechnicalDataVersionStoreSnapshot(),
    engineering: getEngineeringMasterOrderStoreSnapshot(),
    relation: getProjectRelationStoreSnapshot(),
    project: getProjectStoreSnapshot(),
    archive: getProjectArchiveStoreSnapshot(),
    reviewLogs: listTechPackVersionLogs(),
    reviewNotifications: listTechPackReviewNotifications(),
    style: captureStyleArchiveRepositoryState(),
  }
}

function assertAtomicStoresEqual(expected: ReturnType<typeof captureAtomicStores>, message: string) {
  assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), expected.technical, `${message}：技术版本仓`)
  assert.deepEqual(getEngineeringMasterOrderStoreSnapshot(), expected.engineering, `${message}：生产准备单仓`)
  assert.deepEqual(getProjectRelationStoreSnapshot(), expected.relation, `${message}：项目关系仓`)
  assert.deepEqual(captureStyleArchiveRepositoryState(), expected.style, `${message}：款式档案仓`)
  assert.deepEqual(getProjectStoreSnapshot(), expected.project, `${message}：商品项目仓`)
  assert.deepEqual(getProjectArchiveStoreSnapshot(), expected.archive, `${message}：项目归档仓`)
  assert.deepEqual(listTechPackVersionLogs(), expected.reviewLogs, `${message}：技术包审核日志仓`)
  assert.deepEqual(listTechPackReviewNotifications(), expected.reviewNotifications, `${message}：技术包审核通知仓`)
}

function assertOnlyBuyerReviewInvalidated(technicalVersionId: string, message: string): void {
  const record = getTechnicalDataVersionById(technicalVersionId)
  assert.equal(record?.buyerReview?.status, '待审核', `${message}：买手必须复审`)
  assert.equal(record?.patternMakerReview?.status, '审核-已通过', `${message}：版师审核必须保留`)
  assert.equal(record?.merchandiserReview?.status, '审核-已通过', `${message}：跟单审核必须保留`)
  assert.deepEqual(record?.reviewUnlockedModuleKeys, ['BOM', 'COST'], `${message}：只能解锁 BOM 与价格`)
}

const initialTechnicalBomItems = toTechnicalBomItems(bomRows)

const genericDeleteVersionId = createSourceVersion('GENERIC-DELETE', master, style, {
  ...content,
  bomItems: initialTechnicalBomItems,
})
markTechnicalVersionApproved(genericDeleteVersionId)
saveTechnicalDataVersionContentWithEngineeringLinkage(genericDeleteVersionId, [], { bomItems: [] }, '买手A')
assertOnlyBuyerReviewInvalidated(genericDeleteVersionId, '技术包 BOM 弹窗删除物料')

const switchedRows = bomRows.map((row) => ({
  ...row,
  materialSkuId: 'MAT-SKU-SAME-PRICE-002',
  materialName: '同标准价替换物料',
}))
const genericSkuSwitchVersionId = createSourceVersion('GENERIC-SKU', master, style, {
  ...content,
  bomItems: initialTechnicalBomItems,
})
markTechnicalVersionApproved(genericSkuSwitchVersionId)
saveTechnicalDataVersionContentWithEngineeringLinkage(
  genericSkuSwitchVersionId,
  switchedRows,
  { bomItems: toTechnicalBomItems(switchedRows) },
  '买手A',
)
assertOnlyBuyerReviewInvalidated(genericSkuSwitchVersionId, '技术包 BOM 同价换 SKU')

for (const [label, changedRows] of [
  ['修改单位用量', bomRows.map((row) => ({ ...row, usage: row.usage + 0.2 }))],
  ['修改损耗率', bomRows.map((row) => ({ ...row, lossRate: row.lossRate + 0.05 }))],
  ['修改打样数量', bomRows.map((row) => ({ ...row, sampleQuantity: (row.sampleQuantity ?? 1) + 1 }))],
  ['修改用量单位', bomRows.map((row) => ({ ...row, unit: 'Yard' }))],
] as const) {
  const versionId = createSourceVersion(`GENERIC-${label}`, master, style, {
    ...content,
    bomItems: initialTechnicalBomItems,
  })
  markTechnicalVersionApproved(versionId)
  saveTechnicalDataVersionContentWithEngineeringLinkage(
    versionId,
    changedRows,
    { bomItems: toTechnicalBomItems(changedRows) },
    '买手A',
  )
  assertOnlyBuyerReviewInvalidated(versionId, `技术包 BOM 弹窗${label}`)
}

const genericNonBomVersionId = createSourceVersion('GENERIC-NON-BOM', master, style, {
  ...content,
  bomItems: initialTechnicalBomItems,
})
markTechnicalVersionApproved(genericNonBomVersionId)
saveTechnicalDataVersionContentWithEngineeringLinkage(
  genericNonBomVersionId,
  bomRows,
  { patternDesc: '只修改普通技术资料', bomItems: initialTechnicalBomItems.map((item) => ({ ...item })) },
  '买手A',
)
assert.equal(getTechnicalDataVersionById(genericNonBomVersionId)?.buyerReview?.status, '审核-已通过', '打样数量、用量单位同值及非 BOM 内容变化不得触发复审')

async function assertBrowserAtomicFailure(versionId: string, rows: BomItemRow[], patch: Partial<TechnicalDataVersionContent>, mode: 'review' | 'technical' | 'engineering', expected: RegExp) {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.addInitScript('globalThis.__name = (value) => value')
    await page.goto('http://127.0.0.1:5173/pcs/testing/orders')
    await page.getByRole('heading', { name: '测款单', exact: true }).waitFor()
    const error = await page.evaluate(async ({ snapshots, versionId, rows, patch, mode }) => {
      const rt = await import('/src/data/pcs-record-runtime.ts'), db = await import('/src/data/pcs-record-db.ts')
      const context = await import('/src/pages/tech-pack/context.ts')
      const writeback = await import('/src/data/pcs-project-technical-data-writeback.ts')
      const master = await import('/src/data/pcs-engineering-master-repository.ts')
      const style = await import('/src/data/pcs-style-archive-repository.ts')
      const review = await import('/src/data/pcs-tech-pack-bom-price-review-invalidation.ts')
      await rt.ensurePcsRecordState()
      await rt.runPcsRecordCommand(() => { for (const [key, raw] of snapshots) rt.pcsRecordStore.setItem(key, raw) })
      const technical = await import('/src/data/pcs-technical-data-version-repository.ts')
      const relation = await import('/src/data/pcs-project-relation-repository.ts')
      const project = await import('/src/data/pcs-project-repository.ts')
      const archive = await import('/src/data/pcs-project-archive-repository.ts')
      const captureSix = () => JSON.stringify({ technical: technical.getTechnicalDataVersionStoreSnapshot(), engineering: master.getEngineeringMasterOrderStoreSnapshot(), relations: relation.getProjectRelationStoreSnapshot(), projects: project.getProjectStoreSnapshot(), archives: archive.getProjectArchiveStoreSnapshot(), styles: style.listStyleArchives() })
      const beforeSix = captureSix()
      const nativeBefore = JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
      const before = JSON.stringify((await db.readPcsRecords()).records)
      const beforeMaster = JSON.stringify(master.getEngineeringMasterOrderStoreSnapshot())
      const beforeStyles = JSON.stringify(style.listStyleArchives())
      if (mode === 'review') review.setBomPriceReviewInvalidationFailureForTesting(versionId)
      const operations = mode === 'technical' ? { saveTechnicalContent: (id, patch, operator) => { writeback.saveTechnicalDataVersionContent(id, patch, operator); throw new Error('模拟技术包保存中途失败') } }
        : mode === 'engineering' ? { applyEngineeringTasks: (id, rows) => { master.applyBomRequirementsToEngineeringTasks(id, rows); throw new Error('模拟工程同步失败') } } : {}
      let failure = ''
      try { await rt.runPcsRecordCommand(() => context.saveTechnicalDataVersionContentWithEngineeringLinkage(versionId, rows, patch, '买手A', operations)) }
      catch (error) { failure = String(error) }
      finally { review.setBomPriceReviewInvalidationFailureForTesting(null) }
      if (JSON.stringify((await db.readPcsRecords()).records) !== before) throw new Error('跨仓失败后 IndexedDB 记录未完整回滚')
      if (JSON.stringify(master.getEngineeringMasterOrderStoreSnapshot()) !== beforeMaster) throw new Error('跨仓失败后主单工作副本未回滚')
      if (JSON.stringify(style.listStyleArchives()) !== beforeStyles) throw new Error('跨仓失败后款式投影未回滚')
      if (captureSix() !== beforeSix) throw new Error('六类业务仓读取结果未完整回滚')
      if (JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])) !== nativeBefore) throw new Error('失败动作写入了旧存储')
      return failure
    }, { snapshots: PCS_LEGACY_KEYS.map(key => [key, pcsRecordStore.getItem(key)]).filter(([, raw]) => raw !== null), versionId, rows, patch, mode })
    assert.match(error, expected)
  } finally { await browser.close() }
}

const genericInvalidationFailureVersionId = createSourceVersion('GENERIC-INVALIDATION-FAIL', master, style, {
  ...content,
  bomItems: initialTechnicalBomItems,
})
markTechnicalVersionApproved(genericInvalidationFailureVersionId)
const allStoresBeforeInvalidationFailure = captureAtomicStores()
setBomPriceReviewInvalidationFailureForTesting(genericInvalidationFailureVersionId)
try {
  await assertBrowserAtomicFailure(
    genericInvalidationFailureVersionId,
    bomRows.map((row) => ({ ...row, sampleQuantity: (row.sampleQuantity ?? 1) + 1 })),
    { bomItems: initialTechnicalBomItems.map((item) => ({ ...item, sampleQuantity: (item.sampleQuantity ?? 1) + 1 })) },
    'review', /模拟 BOM 与价格审核失效写入失败/,
  )
} finally {
  setBomPriceReviewInvalidationFailureForTesting(null)
}
assertAtomicStoresEqual(allStoresBeforeInvalidationFailure, '审核失效写入失败必须恢复六仓')

const engineeringSnapshotBeforeSaveFailure = getEngineeringMasterOrderStoreSnapshot()
const technicalSnapshotBeforeSaveFailure = getTechnicalDataVersionStoreSnapshot()
assert.throws(
  () => saveTechnicalDataVersionContentWithEngineeringLinkage(
    atomicVersionId,
    bomRows,
    { patternDesc: '不应保存' },
    '买手A',
    {
      saveTechnicalContent: () => {
        throw new Error('模拟技术包保存失败')
      },
    },
  ),
  /模拟技术包保存失败/,
)
assert.deepEqual(getEngineeringMasterOrderStoreSnapshot(), engineeringSnapshotBeforeSaveFailure, '技术包保存失败必须恢复工程仓')
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), technicalSnapshotBeforeSaveFailure, '技术包保存失败必须恢复技术版本仓')

const allStoresBeforeTechnicalSideEffectFailure = captureAtomicStores()
await assertBrowserAtomicFailure(atomicVersionId, bomRows, { patternDesc: '技术包保存副作用不应残留' }, 'technical', /模拟技术包保存中途失败/)

assertAtomicStoresEqual(allStoresBeforeTechnicalSideEffectFailure, '技术包保存中途失败必须恢复所有副作用仓')

const applyFailureVersionId = createSourceVersion('APPLY-FAIL-AFTER-REVIEW', master, style, {
  ...content,
  bomItems: initialTechnicalBomItems,
})
markTechnicalVersionApproved(applyFailureVersionId)
const engineeringSnapshotBeforeApplyFailure = getEngineeringMasterOrderStoreSnapshot()
const technicalSnapshotBeforeApplyFailure = getTechnicalDataVersionStoreSnapshot()
const allStoresBeforeApplyFailure = captureAtomicStores()
await assertBrowserAtomicFailure(
  applyFailureVersionId,
  bomRows.map((row) => ({ ...row, sampleQuantity: (row.sampleQuantity ?? 1) + 1 })),
  { bomItems: initialTechnicalBomItems.map((item) => ({ ...item, sampleQuantity: (item.sampleQuantity ?? 1) + 1 })) },
  'engineering', /模拟工程同步失败/,
)

assert.deepEqual(getEngineeringMasterOrderStoreSnapshot(), engineeringSnapshotBeforeApplyFailure, '工程同步失败必须恢复工程仓')
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), technicalSnapshotBeforeApplyFailure, '工程同步失败必须恢复技术版本仓')
assertAtomicStoresEqual(allStoresBeforeApplyFailure, '技术保存成功后工程同步失败必须恢复所有副作用仓')

const prevalidationVersionId = createSourceVersion('PREVALIDATE', secondMaster, secondStyle)
const secondPatternTaskId = `${secondMaster.masterOrderId}-PATTERN_ARTWORK`
updateEngineeringTaskRecord(secondMaster.masterOrderId, secondPatternTaskId, (_task, current) => {
  current.tasks = current.tasks.filter((item) => item.taskType !== 'PATTERN_ARTWORK')
})
let technicalSaveCalled = false
assert.throws(
  () => saveTechnicalDataVersionContentWithEngineeringLinkage(
    prevalidationVersionId,
    bomRows,
    { patternDesc: '不应进入保存' },
    '买手A',
    {
      saveTechnicalContent: () => {
        technicalSaveCalled = true
        throw new Error('不应调用技术包保存')
      },
    },
  ),
  /缺少.*花型任务.*骨架/,
  '写入技术包前必须先完成工程骨架预校验',
)
assert.equal(technicalSaveCalled, false, '工程预校验失败不得开始技术包保存')

console.log('pcs-engineering-bom-task-linkage-page.spec.ts PASS')
