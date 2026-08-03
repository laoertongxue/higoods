import assert from 'node:assert/strict'
import fs from 'node:fs'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  renderPcsFirstSampleTaskPage,
  renderPcsPatternTaskPage,
  renderPcsPlateMakingTaskPage,
  renderPcsRevisionTaskPage,
  resetPcsEngineeringTaskState,
} from '../src/pages/pcs-engineering-tasks.ts'
import { ENGINEERING_LIST_STORAGE_KEYS } from '../src/pages/pcs-engineering-tasks/shared.ts'

const dispatcherSource = fs.readFileSync('src/pages/pcs-engineering-tasks.ts', 'utf8')
const handlerSource = fs.readFileSync('src/main-handlers/pcs-handlers.ts', 'utf8')

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetPcsEngineeringTaskState()

const style = listStyleArchives()[0]
assert.ok(style, '测试必须存在款式档案')
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单A',
}).masterOrderId)

const pages = [
  ['改版任务', renderPcsRevisionTaskPage()],
  ['制版任务', renderPcsPlateMakingTaskPage()],
  ['花型任务', renderPcsPatternTaskPage()],
  ['产前版样衣任务', renderPcsFirstSampleTaskPage()],
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

const engineeringPages = pages.slice(1)
const engineeringStatuses = ['未启用', '待前置', '待开始', '进行中', '待审核', '返工中', '已完成', '因需求变更结束']
for (const [label, html] of engineeringPages) {
  assert.match(html, new RegExp(master.masterOrderCode), `${label}必须读取工程主单编号`)
  assert.match(html, new RegExp(master.styleCode), `${label}必须读取工程主单款式`)
  const statusOptions = html.match(/data-pcs-engineering-field="[^"]+-status"[\s\S]*?<\/select>/)?.[0] ?? ''
  for (const status of engineeringStatuses) {
    assert.ok(statusOptions.includes(status), `${label}状态筛选缺少工程任务状态：${status}`)
  }
  assert.doesNotMatch(statusOptions, /异常待处理|已取消|待确认|已确认/, `${label}不得再暴露旧专业任务状态`)
}

assert.equal(ENGINEERING_LIST_STORAGE_KEYS.pattern, 'higood:list-page:/pcs/patterns/artwork', '花型列表偏好必须按正式花型路由持久化')
assert.equal(ENGINEERING_LIST_STORAGE_KEYS.firstSample, 'higood:list-page:/pcs/samples/first-sample', '产前版样衣列表偏好必须按正式路由持久化')
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
