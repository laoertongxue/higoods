import assert from 'node:assert/strict'

import {
  listEngineeringBomVersions,
  listEngineeringBomVersionsByOwner,
  resetEngineeringBomRepository,
} from '../src/data/pcs-engineering-bom-repository.ts'
import {
  listEngineeringMasterOrders,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import { ensureEngineeringMasterDemoData } from '../src/data/pcs-engineering-master-view-model.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  renderPcsTechnicalDataBomPricingDetailPage,
  renderPcsTechnicalDataBomPricingPage,
} from '../src/pages/pcs-technical-data.ts'

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
assert.match(listHtml, /BOM 随业务对象自动创建，不提供独立新增/)
assert.doesNotMatch(listHtml, />新增 BOM</)
assert.match(listHtml, /阶段／来源/)
assert.match(listHtml, /条件要求/)
assert.match(listHtml, /10 条\/页/)
assert.match(listHtml, /共 \d+ 条，当前 1-10/)
assert.doesNotMatch(listHtml, /当前 1-30/, 'BOM 列表必须分页，不能一次渲染全部版本')

const allVersions = listEngineeringBomVersions()
const editableVersion = allVersions.find((version) => version.versionStatus === 'DRAFT')
const populatedVersion = allVersions.find((version) => version.materialLines.length > 0)
assert.ok(editableVersion, 'Mock 数据必须保留可维护的 BOM 草稿')
assert.ok(populatedVersion, 'Mock 数据必须包含非空 BOM 方案')

const detailHtml = renderPcsTechnicalDataBomPricingDetailPage(populatedVersion.bomDraftVersionId)
for (const label of ['单位用量', '打样数量', '损耗率', '总需求量', '标准单价', '印花要求', '染色要求', '缩率要求', '水洗要求', '水溶要求', '印花面', '关联花型成果', '适用 SKU', '自定义费用（IDR）', '综合成本 CNY', '综合成本 IDR', '系统最新汇率']) {
  assert.ok(detailHtml.includes(label), `BOM 详情必须展示字段：${label}`)
}
assert.match(detailHtml, /只有买手可以维护/)

const technicalVersions = allVersions.filter((version) => version.ownerStage === 'TECH_PACK_DRAFT')
assert.ok(technicalVersions.length >= 1, '工程主单生成技术包草稿时必须复制 BOM 版本')
assert.ok(technicalVersions.every((version) => version.sourceVersionId), '技术包 BOM 必须保留来源版本')
assert.ok(technicalVersions.every((version) => version.versionStatus === 'COMPLETED_CONFIRMED' || version.versionStatus === 'PUBLISHED_SNAPSHOT'))
assert.ok(technicalVersions.some((version) => version.versionStatus === 'PUBLISHED_SNAPSHOT'), '技术包发布后必须形成正式 BOM 快照')

console.log('pcs-engineering-bom-version-workflow.spec.ts PASS')
