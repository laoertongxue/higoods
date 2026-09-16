import assert from 'node:assert/strict'
import fs from 'node:fs'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  listReusableEngineeringIndependentSamplingResults,
  resetEngineeringIndependentSamplingRepository,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  createEngineeringMasterOrder,
  listEngineeringMasterPriorResultCandidates,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  renderPcsFirstSampleTaskPage,
  renderPcsPatternTaskPage,
  renderPcsPlateMakingTaskPage,
  resetPcsEngineeringTaskState,
} from '../src/pages/pcs-engineering-tasks.ts'
import { renderPcsDesignRevisionListPage } from '../src/pages/pcs-independent-sampling.ts'
import { ENGINEERING_LIST_STORAGE_KEYS } from '../src/pages/pcs-engineering-tasks/shared.ts'

const dispatcherSource = fs.readFileSync('src/pages/pcs-engineering-tasks.ts', 'utf8')
const handlerSource = fs.readFileSync('src/main-handlers/pcs-handlers.ts', 'utf8')

resetStyleArchiveRepository()
resetEngineeringIndependentSamplingRepository(true)
resetEngineeringMasterRepository()
resetPcsEngineeringTaskState()

const style = listStyleArchives().find((candidate) =>
  listReusableEngineeringIndependentSamplingResults(candidate.styleCode).length > 0
  && listEngineeringMasterPriorResultCandidates(candidate.styleCode, 'PURE_WOVEN')
    .some((item) => item.engineeringTaskType === 'BASE_PATTERN_WOVEN'),
)
assert.ok(style, '测试必须存在款式档案')
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
  bulkProductionQualification: { basisType: 'TEST_APPROVED', triggerBusinessObjectType: '专项测试', triggerBusinessObjectId: `TASK-LIST-${style.styleCode}`, thresholdQuantity: 1, reachedQuantity: 1, reachedAt: '2026-08-27 09:00:00', reason: '专项测试已满足做大货要求', uniqueTriggerKey: `TASK-LIST-${style.styleCode}` },
  creationReason: '专项测试创建生产准备单',
}).masterOrderId)

const pages = [
  ['制版任务', renderPcsPlateMakingTaskPage()],
  ['花型任务', renderPcsPatternTaskPage()],
  ['首单样衣任务', renderPcsFirstSampleTaskPage()],
] as const

for (const [label, html] of pages) {
  assert.match(html, /data-standard-list-page/, `${label}必须使用标准列表页骨架`)
  assert.match(html, /data-standard-list-scroll/, `${label}宽表必须只在表格容器内横向滚动`)
  assert.match(html, /data-standard-list-sort-icon="none"/, `${label}可排序列必须显示未排序图标`)
  assert.match(html, /sticky right-0/, `${label}操作列必须固定在右侧`)
  assert.match(html, /列设置/, `${label}必须提供列显示、顺序与冻结设置`)
  assert.match(html, /条\/页/, `${label}必须显示每页条数口径`)
  assert.match(html, /data-skip-page-rerender="true"/, `${label}轻交互必须跳过整页重绘`)
}

const engineeringPages = pages
for (const [label, html] of engineeringPages) {
  assert.match(html, new RegExp(master.masterOrderCode), `${label}必须读取生产准备单编号`)
  assert.match(html, new RegExp(master.styleCode), `${label}必须读取生产准备单款式`)
  assert.match(html, /<span>当前需处理的团队<\/span>/, `${label}必须保留当前需处理团队筛选`)
  assert.doesNotMatch(html, /data-pcs-engineering-field="[^"]+-(?:search|status|source|site)"/, `${label}不得保留其他筛选条件`)
}

const designRevisionHtml = renderPcsDesignRevisionListPage()
assert.match(
  designRevisionHtml,
  /data-design-revision-style-source[\s\S]*data-design-revision-style-arrow[\s\S]*data-design-revision-style-target/,
  '设计改款列表必须按参照款、箭头、目标款三行依次展示',
)
assert.doesNotMatch(
  designRevisionHtml,
  /data-design-revision-style-target-row/,
  '箭头和目标款不得继续挤在同一行',
)
assert.match(
  designRevisionHtml,
  /data-design-revision-design-thumbnail[\s\S]*data-image-url=/,
  '设计稿列必须直接展示可点击查看大图的当前设计稿缩略图',
)
assert.doesNotMatch(
  designRevisionHtml,
  />查看当前设计稿</,
  '设计稿列不得继续只显示文字查看入口',
)
assert.ok(designRevisionHtml.includes('工作项 / 负责团队'), '设计改款列表必须展示工作项及对应负责团队列')
assert.match(
  designRevisionHtml,
  /data-design-revision-work-item[\s\S]*data-design-revision-owner-team/,
  '每个工作项必须与其负责团队在同一信息块展示',
)
assert.ok(designRevisionHtml.includes('<span>时间</span>'), '设计改款列表必须展示完整时间列')
for (const marker of [
  'data-design-revision-created-at',
  'data-design-revision-design-uploaded-at',
  'data-design-revision-material-cost-confirmed-at',
  'data-design-revision-plan-confirmed-at',
  'data-design-revision-work-item-times',
  'data-design-revision-completed-at',
  'data-design-revision-updated-at',
]) {
  assert.match(designRevisionHtml, new RegExp(marker), `设计改款时间列缺少 ${marker}`)
}
for (const label of ['创建', '设计稿上传', '物料费用确认', '工作安排确认', '计划完成', '开始', '提交', '完成', '设计改款完成', '最后更新']) {
  assert.ok(designRevisionHtml.includes(label), `设计改款时间列缺少“${label}”时间口径`)
}

assert.equal(ENGINEERING_LIST_STORAGE_KEYS.pattern, 'higood:list-page:/pcs/production-preparation/artwork', '花型列表偏好必须按正式花型路由持久化')
assert.equal(ENGINEERING_LIST_STORAGE_KEYS.firstSample, 'higood:list-page:/pcs/production-preparation/first-sample', '首单样衣列表偏好必须按正式路由持久化')
assert.doesNotMatch(dispatcherSource, /pattern-master-task/, '薄分派器不得再导入花型第二页面')
assert.match(dispatcherSource, /pcs-engineering-tasks\/pattern-task\.ts/, '薄分派器必须直接导出唯一花型任务页面')
assert.match(dispatcherSource, /ENGINEERING_LIST_STORAGE_KEYS/, '主文件必须引用按路由持久化键常量')
assert.match(
  handlerSource,
  /dispatchPcsPageEvent\(target: HTMLElement, event\?: Event\)/,
  'PCS 事件分发必须把标准列拖动事件传给页面',
)
assert.match(
  handlerSource,
  /handler as \(target: HTMLElement, event\?: Event\)[\s\S]*\(target, event\)/,
  'PCS 页面 handler 必须收到原始标准列拖动事件',
)

console.log('pcs-engineering-task-standard-list.spec.ts PASS')
