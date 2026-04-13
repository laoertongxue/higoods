import assert from 'node:assert/strict'
import { buildProjectDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { getProjectStoreSnapshot, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { handlePcsProjectDetailEvent, renderPcsProjectDetailPage } from '../src/pages/pcs-project-detail.ts'

resetProjectRepository()
resetProjectRelationRepository()

const project = getProjectStoreSnapshot().projects.find((item) => item.projectCode === 'PRJ-20251216-025')

assert.ok(project, '应存在终止状态的演示项目 PRJ-20251216-025')

const detail = buildProjectDetailViewModel(project!.projectId)

assert.ok(detail, '应能读取项目详情视图模型')
assert.equal(detail!.currentFocusPhaseCode, 'PHASE_03', '终止项目当前焦点阶段应落在当前阶段')
assert.equal(detail!.currentFocusPhaseName, '商品上架与市场测款', '终止项目当前焦点阶段名称应正确')
assert.equal(detail!.currentFocusNodeName, '测款结论判定', '终止项目默认焦点节点应为测款结论判定')
assert.equal(detail!.currentFocusNodeStatus, '已取消', '终止项目默认焦点节点状态应为已取消')

const focusNode = detail!.phases
  .flatMap((phase) => phase.nodes)
  .find((node) => node.projectNodeId === detail!.currentFocusNodeId)

assert.equal(focusNode?.workItemTypeCode, 'TEST_CONCLUSION', '终止项目默认焦点节点应为 TEST_CONCLUSION')
assert.equal(detail!.timeline[0]?.title, '当前项目所处位置', '项目动态第一条应为当前项目所处位置摘要')
assert.match(detail!.timeline[0]?.detail ?? '', /当前项目状态：已终止/u, '项目动态第一条应展示项目当前状态')
assert.match(detail!.timeline[0]?.detail ?? '', /当前阶段：商品上架与市场测款/u, '项目动态第一条应展示当前阶段')
assert.match(detail!.timeline[0]?.detail ?? '', /当前节点：测款结论判定/u, '项目动态第一条应展示当前节点')
assert.match(detail!.timeline[0]?.detail ?? '', /已取消/u, '项目动态第一条应展示当前节点状态')
assert.ok(detail!.timeline.length <= 8, '项目动态最多保留 8 条')
assert.equal(
  detail!.timeline.filter((item) => item.title.startsWith('节点结果：')).length,
  0,
  '项目动态不应再堆叠旧的节点结果快照条目',
)
assert.equal(
  detail!.timeline.filter((item) => item.time === '2026-04-06 09:50').length > 0,
  true,
  '项目动态应回放真实的 2026-04-06 09:50 业务事件',
)

const initialHtml = renderPcsProjectDetailPage(project!.projectId)

assert.match(
  initialHtml,
  /data-work-item-code="TEST_CONCLUSION"[\s\S]*?data-current-focus="true"/u,
  '左侧导航应明确标出真实当前节点',
)
assert.match(
  initialHtml,
  /data-work-item-code="TEST_CONCLUSION"[\s\S]*?data-selected="true"/u,
  '页面初次打开时默认选中节点应为真实当前节点',
)
assert.match(initialHtml, /当前项目所处位置/u, '右侧应展示当前项目所处位置摘要')
assert.match(initialHtml, /当前阶段：<\/span><span class="font-medium text-blue-900">商品上架与市场测款/u, '右侧摘要应展示当前阶段')
assert.match(initialHtml, /当前节点：<\/span><span class="font-medium text-blue-900">测款结论判定/u, '右侧摘要应展示当前节点')

const historyNode = detail!.phases
  .flatMap((phase) => phase.nodes)
  .find((node) => node.workItemTypeCode === 'TEST_DATA_SUMMARY')

assert.ok(historyNode, '应存在历史节点用于切换详情')

handlePcsProjectDetailEvent({
  closest: () =>
    ({
      dataset: {
        pcsProjectDetailAction: 'select-work-item',
        workItemId: historyNode!.projectNodeId,
      },
    }) as HTMLElement,
} as HTMLElement)

const switchedHtml = renderPcsProjectDetailPage(project!.projectId)

assert.match(
  switchedHtml,
  /data-work-item-code="TEST_DATA_SUMMARY"[\s\S]*?data-selected="true"/u,
  '用户点击历史节点后，中间详情应切换到历史节点',
)
assert.match(
  switchedHtml,
  /data-work-item-code="TEST_CONCLUSION"[\s\S]*?data-current-focus="true"/u,
  '用户点击历史节点后，左侧仍应保留真实当前节点标识',
)
assert.match(switchedHtml, /当前节点：<\/span><span class="font-medium text-blue-900">测款结论判定/u, '用户切换历史节点后，右侧摘要仍应基于真实当前节点')

console.log('pcs-project-detail-current-focus.spec.ts PASS')
