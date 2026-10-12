import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pcsRecordStore, withPcsDemoData } from '../src/data/pcs-record-runtime.ts'
import { copyEngineeringBomDraftVersion } from '../src/data/pcs-engineering-bom-version.ts'

import {
  getEngineeringBomPricingPlan,
  createEngineeringBomVersionsForOwner,
  captureEngineeringBomRepositoryState,
  restoreEngineeringBomRepositoryState,
  markEngineeringBomVersionsPublished,
  listEngineeringBomVersions,
  listEngineeringBomVersionsByOwner,
  resetEngineeringBomRepository,
  saveEngineeringBomPricingPlan,
} from '../src/data/pcs-engineering-bom-repository.ts'
import {
  confirmEngineeringMasterBomPricingPlan,
  listEngineeringMasterOrders,
} from '../src/data/pcs-engineering-master-repository.ts'
import { ensureEngineeringMasterDemoData } from '../src/data/pcs-engineering-master-view-model.ts'
import {
  renderPcsTechnicalDataBomPricingDetailPage,
  renderPcsTechnicalDataBomPricingPlanDetailPage as renderPcsTechnicalDataBomPricingPlanPage,
  renderPcsTechnicalDataBomPricingPage,
} from '../src/pages/pcs-technical-data.ts'
import {
  listTechnicalDataVersions,
} from '../src/data/pcs-technical-data-version-repository.ts'

// Explicit Node-only Mock assembly. Normal page reads do not create or write demo facts.
// Reuse shipped style/SKU/approved-testing/design-revision facts, then construct 12
// independent preparation owners and copy their color BOMs through the real API.
const shipped = JSON.parse(readFileSync(new URL('../src/data/generated/pcs-record-baseline.json', import.meta.url), 'utf8')) as Record<string, string>
withPcsDemoData(() => { for (const [key, raw] of Object.entries(shipped)) pcsRecordStore.setItem(key, raw) })
const shippedMasters = JSON.parse(shipped['higood-pcs-engineering-master-store-v1'])
const shippedTechnical = JSON.parse(shipped['higood-pcs-technical-data-version-store-v5'])
const sourceMaster = shippedMasters.records[0]
const sourceTechnical = shippedTechnical.records.find((record: any) => record.versionStatus === 'PUBLISHED')
assert(sourceMaster && sourceTechnical, 'Explicit fixture requires published prerequisite Mock facts')
const fixtureMasters = Array.from({ length: 12 }, (_, index) => {
  const master = structuredClone(sourceMaster)
  master.masterOrderId = `EM-EXPLICIT-${index + 1}`
  master.masterOrderCode = `EM-MOCK-${index + 1}`
  master.status = '资料准备中'
  master.bomVersionIds = []
  master.bulkProductionQualification.uniqueTriggerKey = `BULK-MOCK-${index + 1}`
  master.tasks = master.tasks.map((task: any) => ({ ...task, taskId: `${master.masterOrderId}-${task.taskType}`, masterOrderId: master.masterOrderId, sourceId: master.masterOrderId, dependsOnTaskIds: [], dependencySatisfaction: [] }))
  return master
})
const originalBom = captureEngineeringBomRepositoryState()
function assembleFixtureBoms(includeTechnical: boolean): void {
  withPcsDemoData(() => {
    restoreEngineeringBomRepositoryState(structuredClone(originalBom))
    const technicalRecords: any[] = []
    for (const [index, master] of fixtureMasters.entries()) {
      const versions = createEngineeringBomVersionsForOwner({ ownerStage: 'ENGINEERING_MASTER', ownerId: master.masterOrderId, ownerCode: master.masterOrderCode, styleId: master.styleId, buyerId: 'U-BUYER-MOCK', buyerName: 'Mock 买手', createdBy: 'Mock 夹具' })
      master.bomVersionIds = versions.map(version => version.bomDraftVersionId)
      if (!includeTechnical || index === 0) continue
      // Owner 1 remains an editable draft for the confirmation rejection test.
      // The other owners have confirmed Mock BOMs before technical-package copying.
      const confirmed = captureEngineeringBomRepositoryState()
      confirmed.records.filter(record => record.ownerStage === 'ENGINEERING_MASTER' && record.ownerId === master.masterOrderId).forEach(record => { record.versionStatus = 'COMPLETED_CONFIRMED' })
      confirmed.plans.find(plan => plan.ownerStage === 'ENGINEERING_MASTER' && plan.ownerId === master.masterOrderId)!.status = 'COMPLETED_CONFIRMED'
      restoreEngineeringBomRepositoryState(confirmed)
      versions.forEach(version => { version.versionStatus = 'COMPLETED_CONFIRMED' })
      const technical = structuredClone(sourceTechnical)
      technical.technicalVersionId = `TP-EXPLICIT-${index + 1}`
      technical.technicalVersionCode = String(10000 + index)
      technical.styleId = master.styleId; technical.styleCode = master.styleCode; technical.styleName = master.styleName
      technical.sourceProjectId = master.masterOrderId; technical.sourceProjectCode = master.masterOrderCode
      technical.createdFromTaskType = 'ENGINEERING_MASTER'
      technical.createdFromTaskId = `${master.masterOrderId}-TECH_PACK_CONFIRMATION`
      technical.versionStatus = index <= 6 ? 'PUBLISHED' : 'DRAFT'
      createEngineeringBomVersionsForOwner({ ownerStage: 'TECH_PACK_DRAFT', ownerId: technical.technicalVersionId, ownerCode: technical.technicalVersionCode, styleId: master.styleId, buyerId: 'U-BUYER-MOCK', buyerName: 'Mock 买手', createdBy: 'Mock 夹具' })
      const linkedState = captureEngineeringBomRepositoryState()
      linkedState.records = linkedState.records.map(record => {
        if (record.ownerStage !== 'TECH_PACK_DRAFT' || record.ownerId !== technical.technicalVersionId) return record
        const source = versions.find(version => version.productColor === record.productColor)
        assert(source, '技术包颜色 BOM 必须对应本主档的颜色 BOM')
        return { ...record, ...copyEngineeringBomDraftVersion({ source, targetVersionId: record.bomDraftVersionId, copiedAt: record.createdAt, copiedBy: 'Mock 夹具' }), ownerStage: record.ownerStage, ownerId: record.ownerId, ownerCode: record.ownerCode }
      })
      restoreEngineeringBomRepositoryState(linkedState)
      if (technical.versionStatus === 'PUBLISHED') {
        const state = captureEngineeringBomRepositoryState()
        state.records.filter(record => record.ownerStage === 'TECH_PACK_DRAFT' && record.ownerId === technical.technicalVersionId).forEach(record => { record.versionStatus = 'COMPLETED_CONFIRMED' })
        state.plans.find(plan => plan.ownerStage === 'TECH_PACK_DRAFT' && plan.ownerId === technical.technicalVersionId)!.status = 'COMPLETED_CONFIRMED'
        restoreEngineeringBomRepositoryState(state)
        markEngineeringBomVersionsPublished({ ownerStage: 'TECH_PACK_DRAFT', ownerId: technical.technicalVersionId, publishedSnapshotId: `SNAPSHOT-MOCK-${index + 1}`, publishedBy: 'Mock 发布' })
      }
      technicalRecords.push(technical)
    }
    if (includeTechnical) {
      pcsRecordStore.setItem('higood-pcs-engineering-master-store-v1', JSON.stringify({ version: 1, records: fixtureMasters }))
      pcsRecordStore.setItem('higood-pcs-technical-data-version-store-v5', JSON.stringify({ ...shippedTechnical, records: technicalRecords, contents: technicalRecords.map(record => ({ ...structuredClone(shippedTechnical.contents[0]), technicalVersionId: record.technicalVersionId })), pendingItems: [] }))
    }
  })
}
assembleFixtureBoms(true)
ensureEngineeringMasterDemoData()

const masters = listEngineeringMasterOrders()
assert.ok(masters.length >= 10, 'Mock 数据必须覆盖足够多的生产准备单场景')
masters.forEach((master) => {
  const versions = listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', master.masterOrderId)
  assert.ok(versions.length >= 1, `${master.masterOrderCode} 创建时必须自动生成按颜色管理的 BOM 草稿`)
  assert.deepEqual(new Set(master.bomVersionIds), new Set(versions.map((version) => version.bomDraftVersionId)))
})

const listHtml = renderPcsTechnicalDataBomPricingPage()
assert.match(listHtml, /一张业务单据对应一份整款方案/)
assert.doesNotMatch(listHtml, />新增 BOM</)
assert.match(listHtml, /业务来源/)
assert.match(listHtml, /颜色物料方案/)
assert.match(listHtml, /整款费用/)
assert.match(listHtml, /查看整款方案/)

const allVersions = listEngineeringBomVersions()
const editableVersion = allVersions.find((version) => version.versionStatus === 'DRAFT')
const populatedVersion = allVersions.find((version) => version.materialLines.length > 0)
assert.ok(editableVersion, 'Mock 数据必须保留可维护的 BOM 草稿')
assert.ok(populatedVersion, 'Mock 数据必须包含非空 BOM 方案')

const detailHtml = renderPcsTechnicalDataBomPricingDetailPage(populatedVersion.bomDraftVersionId)
for (const label of ['单位用量', '打样数量', '损耗率', '总需求量', '标准单价', '印花要求', '染色要求', '水溶要求', '印花面', '关联花型成果', '适用 SKU']) {
  assert.ok(detailHtml.includes(label), `BOM 详情必须展示字段：${label}`)
}
assert.doesNotMatch(detailHtml, /确认当前物料方案/, '单个颜色页面只能保存物料，不能承担整款业务确认')

const plan = listEngineeringBomVersionsByOwner(populatedVersion.ownerStage, populatedVersion.ownerId)
assert.ok(plan.length >= 1)
const planHtml = renderPcsTechnicalDataBomPricingPlanPage(populatedVersion.ownerStage, populatedVersion.ownerId)
assert.match(planHtml, /买手/)
for (const label of ['颜色物料方案', '整款自定义费用', '物料成本', '自定义费用', '系统最新汇率', '综合成本 CNY', '综合成本 IDR']) {
  assert.ok(planHtml.includes(label), `整款方案必须展示字段：${label}`)
}

const engineeringMasterIds = new Set(masters.map((master) => master.masterOrderId))
const generatedTechPacks = listTechnicalDataVersions()
  .filter((version) =>
    version.createdFromTaskType === 'ENGINEERING_MASTER'
      && engineeringMasterIds.has(version.sourceProjectId),
  )
const generatedTechPackIds = new Set(generatedTechPacks.map((version) => version.technicalVersionId))
const technicalVersions = allVersions.filter((version) =>
  version.ownerStage === 'TECH_PACK_DRAFT' && generatedTechPackIds.has(version.ownerId),
)
assert.ok(technicalVersions.length >= 1, '生产准备单生成技术包草稿时必须复制 BOM 版本')
assert.ok(technicalVersions.every((version) => version.sourceVersionId), '技术包 BOM 必须保留来源版本')
generatedTechPacks.forEach((techPack) => {
  const linkedVersions = technicalVersions.filter((version) => version.ownerId === techPack.technicalVersionId)
  assert.ok(linkedVersions.length >= 1, `${techPack.technicalVersionCode} 必须关联颜色物料方案`)
  if (techPack.versionStatus === 'PUBLISHED') {
    assert.ok(linkedVersions.every((version) => version.versionStatus === 'PUBLISHED_SNAPSHOT'), '正式技术包必须冻结 BOM 与价格快照')
  } else {
    assert.ok(linkedVersions.every((version) => version.versionStatus === 'DRAFT' || version.versionStatus === 'COMPLETED_CONFIRMED'), '审核中的技术包只能保留草稿或买手已确认状态')
  }
})
assert.ok(technicalVersions.some((version) => version.versionStatus === 'PUBLISHED_SNAPSHOT'), '技术包发布后必须形成正式 BOM 快照')

const editableMaster = masters.find((master) =>
  getEngineeringBomPricingPlan('ENGINEERING_MASTER', master.masterOrderId)?.status === 'DRAFT',
)
assert.ok(editableMaster, 'Mock 数据必须保留一张可验证整款确认门禁的生产准备单')
const editablePlan = getEngineeringBomPricingPlan('ENGINEERING_MASTER', editableMaster.masterOrderId)!
saveEngineeringBomPricingPlan({
  ownerStage: 'ENGINEERING_MASTER',
  ownerId: editableMaster.masterOrderId,
  role: '买手',
  userId: editablePlan.buyerId || 'BUYER-MASTER-GATE',
  userName: editablePlan.buyerName || '门禁测试买手',
  customCostDecision: 'HAS_CUSTOM_COST',
  customCosts: [],
})
const masterBeforeRejectedConfirmation = listEngineeringMasterOrders().find((master) => master.masterOrderId === editableMaster.masterOrderId)
assert.throws(
  () => confirmEngineeringMasterBomPricingPlan({
    masterOrderId: editableMaster.masterOrderId,
    role: '买手',
    userId: editablePlan.buyerId || 'BUYER-MASTER-GATE',
    userName: editablePlan.buyerName || '门禁测试买手',
  }),
  /至少填写一项费用/,
  '生产准备单整款确认必须阻断“选择有费用但没有费用明细”',
)
assert.equal(getEngineeringBomPricingPlan('ENGINEERING_MASTER', editableMaster.masterOrderId)?.status, 'DRAFT', '生产准备单确认失败后整款方案必须保持可编辑')
assert.ok(
  listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', editableMaster.masterOrderId).every((version) => version.versionStatus === 'DRAFT'),
  '生产准备单确认失败后所有颜色物料方案不得部分确认',
)
assert.deepEqual(
  listEngineeringMasterOrders().find((master) => master.masterOrderId === editableMaster.masterOrderId),
  masterBeforeRejectedConfirmation,
  '生产准备单 BOM 与价格确认失败不得启用或改写任何专业任务',
)

// Millisecond-resolution ids must stay unique even when source-plan copying
// replaces several draft rows with fewer rows during a dense Mock seed.
const originalNow = Date.now
try {
  Date.now = () => 1790208000000
  resetEngineeringBomRepository()
  assembleFixtureBoms(false)
  ensureEngineeringMasterDemoData()
  const seededMasters = listEngineeringMasterOrders()
  const seededVersions = listEngineeringBomVersions()
  assert.equal(new Set(seededVersions.map((version) => version.bomDraftVersionId)).size, seededVersions.length,
    '同一毫秒连续生成时 BOM ID 不得重复')
  seededMasters.forEach((master) => {
    assert.ok(listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', master.masterOrderId).length > 0,
      `${master.masterOrderCode} 不能因 BOM ID 冲突而丢失草稿`)
  })
} finally {
  Date.now = originalNow
}

console.log('pcs-engineering-bom-version-workflow.spec.ts PASS')
