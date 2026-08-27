import assert from 'node:assert/strict'

import {
  getEngineeringBomPricingPlan,
  listEngineeringBomVersions,
  listEngineeringBomVersionsByOwner,
  resetEngineeringBomRepository,
  saveEngineeringBomPricingPlan,
} from '../src/data/pcs-engineering-bom-repository.ts'
import {
  confirmEngineeringMasterBomPricingPlan,
  listEngineeringMasterOrders,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import { ensureEngineeringMasterDemoData } from '../src/data/pcs-engineering-master-view-model.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  renderPcsTechnicalDataBomPricingDetailPage,
  renderPcsTechnicalDataBomPricingPlanPage,
  renderPcsTechnicalDataBomPricingPage,
} from '../src/pages/pcs-technical-data.ts'
import { listTechnicalDataVersions } from '../src/data/pcs-technical-data-version-repository.ts'

resetStyleArchiveRepository()
resetEngineeringBomRepository()
resetEngineeringMasterRepository()
ensureEngineeringMasterDemoData()

const masters = listEngineeringMasterOrders()
assert.ok(masters.length >= 10, 'Mock 数据必须覆盖足够多的工程主单场景')
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

const generatedTechPacks = listTechnicalDataVersions()
  .filter((version) => version.createdFromTaskType === 'ENGINEERING_MASTER')
const generatedTechPackIds = new Set(generatedTechPacks.map((version) => version.technicalVersionId))
const technicalVersions = allVersions.filter((version) =>
  version.ownerStage === 'TECH_PACK_DRAFT' && generatedTechPackIds.has(version.ownerId),
)
assert.ok(technicalVersions.length >= 1, '工程主单生成技术包草稿时必须复制 BOM 版本')
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
assert.ok(editableMaster, 'Mock 数据必须保留一张可验证整款确认门禁的工程主单')
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
  '工程主单整款确认必须阻断“选择有费用但没有费用明细”',
)
assert.equal(getEngineeringBomPricingPlan('ENGINEERING_MASTER', editableMaster.masterOrderId)?.status, 'DRAFT', '工程主单确认失败后整款方案必须保持可编辑')
assert.ok(
  listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', editableMaster.masterOrderId).every((version) => version.versionStatus === 'DRAFT'),
  '工程主单确认失败后所有颜色物料方案不得部分确认',
)
assert.deepEqual(
  listEngineeringMasterOrders().find((master) => master.masterOrderId === editableMaster.masterOrderId),
  masterBeforeRejectedConfirmation,
  '工程主单 BOM 与价格确认失败不得启用或改写任何专业任务',
)

console.log('pcs-engineering-bom-version-workflow.spec.ts PASS')
