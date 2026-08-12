import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  renderPcsTechnicalDataBomPricingPage,
  renderPcsTechnicalDataTechPackListPage,
} from '../src/pages/pcs-technical-data.ts'
import { renderPcsEngineeringChangeDetailPage, renderPcsEngineeringChangeListPage } from '../src/pages/pcs-engineering-change.ts'
import { listEngineeringMasterOrders } from '../src/data/pcs-engineering-master-repository.ts'
import { listEngineeringChangeWorkspaceViews, resetEngineeringChangeWorkspace } from '../src/data/pcs-engineering-change-workspace.ts'

const routeSource = readFileSync('src/router/routes-pcs.ts', 'utf8')
const rendererSource = readFileSync('src/router/route-renderers.ts', 'utf8')
const menuSource = readFileSync('src/data/app-shell-config.ts', 'utf8')
const archiveSource = readFileSync('src/pages/pcs-product-archives.ts', 'utf8')
const technicalDataSource = readFileSync('src/pages/pcs-technical-data.ts', 'utf8')
const changeSource = readFileSync('src/pages/pcs-engineering-change.ts', 'utf8')

for (const route of [
  '/pcs/technical-data/tech-packs',
  '/pcs/technical-data/bom-pricing',
  '/pcs/engineering/changes',
]) {
  assert.ok(routeSource.includes(route), `缺少正式路由：${route}`)
}

for (const title of ['技术资料', '技术包', 'BOM 与价格', '花型库', '部位模板库', '工程变更']) {
  assert.ok(menuSource.includes(title), `菜单缺少：${title}`)
}

assert.doesNotMatch(menuSource, /技术包模板库|pcs-tech-pack-template-library/, '技术资料菜单不得出现技术包模板库')
assert.doesNotMatch(routeSource, /tech-pack-templates|renderPcsTechnicalDataTemplateLibraryPage/, '技术包模板库路由必须删除')
assert.doesNotMatch(rendererSource, /renderPcsTechnicalDataTemplateLibraryPage/, '技术包模板库渲染器必须删除')
assert.doesNotMatch(technicalDataSource, /技术包模板库|TP-TPL-/, '技术资料页面不得保留技术包模板或静态 Mock')

assert.doesNotMatch(archiveSource, /手动新增技术包|新增技术包版本|导入历史技术包/)
assert.doesNotMatch(technicalDataSource, /新增技术包|导入历史技术包/)
assert.match(technicalDataSource, /技术包仅由工程主单或工程变更生成/)

const listHtml = renderPcsTechnicalDataTechPackListPage()
for (const expected of [
  '技术包列表', '技术包 ID / SPU / 工程主单', '全部状态', '全部审核阶段',
  '全部品牌', '全部完整度', '全部做货难度', '全部跟单', '全部版师',
  '创建开始日期', '创建结束日期', '待我审核', 'SPU 去重', '技术包分页',
]) {
  assert.ok(listHtml.includes(expected), `技术包列表缺少：${expected}`)
}
assert.ok(technicalDataSource.includes('data-tech-data-action="open-image"'), '款式缩略图必须支持打开大图')
assert.ok(technicalDataSource.includes('1 CNY =') && technicalDataSource.includes('comprehensiveCostIdr'), 'BOM 与价格必须同时展示汇率及双币种')

for (const expected of [
  '当前使用的技术包', '本次要修改的内容', '当前需处理的团队',
  '具体到用料行、专业成果或技术资料栏目', '这些是真实任务', '下一版技术包',
]) {
  assert.ok(changeSource.includes(expected), `工程变更缺少：${expected}`)
}
for (const status of ['待确认修改内容', '修改中', '待汇总技术包', '技术包审核中', '已生效', '已完成']) {
  assert.ok(changeSource.includes(status), `工程变更缺少业务状态：${status}`)
}
const masterStatuses = new Set(listEngineeringMasterOrders().map((master) => master.status))
assert.ok(masterStatuses.has('待关闭'), '工程主单 Mock 必须覆盖待关闭')
assert.ok(masterStatuses.has('已关闭'), '工程主单 Mock 必须覆盖已关闭')
resetEngineeringChangeWorkspace()
const changeListHtml = renderPcsEngineeringChangeListPage()
assert.doesNotMatch(changeListHtml, /暂无工程变更/)
assert.match(changeListHtml, /data-image-preview-url=/, '工程变更 Mock 必须展示目标款式真实缩略图')
assert.match(changeListHtml, /data-engineering-change-region="image-preview"/, '工程变更列表应提供局部大图弹窗区域')
const changeView = listEngineeringChangeWorkspaceViews()[0]
assert.ok(changeView, '必须有可演示的工程变更')
assert.ok(changeView.workspace.selectedItems.some((item) => item.treatment !== 'PROFESSIONAL_TASK'), 'Mock 必须包含直接修改的具体资料')
assert.ok(changeView.workspace.taskLines.length > 0, 'Mock 必须包含真实专业任务')
const changeDetailHtml = renderPcsEngineeringChangeDetailPage(changeView.change.engineeringChangeTaskId)
assert.match(changeDetailHtml, /type="file"/, '工程变更专业任务必须使用真实本地文件选择器')
assert.match(changeDetailHtml, /data-engineering-change-action="submit-line"/, '真实专业任务必须提供提交成果动作')

console.log('pcs-engineering-technical-data-and-change.spec.ts PASS')
