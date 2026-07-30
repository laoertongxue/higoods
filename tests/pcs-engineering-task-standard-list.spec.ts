import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  renderPcsFirstOrderSampleTaskPage,
  renderPcsFirstSampleTaskPage,
  renderPcsPatternTaskPage,
  renderPcsPlateMakingTaskPage,
  renderPcsRevisionTaskPage,
  resetPcsEngineeringTaskState,
} from '../src/pages/pcs-engineering-tasks.ts'

const pageSource = fs.readFileSync('src/pages/pcs-engineering-tasks.ts', 'utf8')
const handlerSource = fs.readFileSync('src/main-handlers/pcs-handlers.ts', 'utf8')

assert.match(pageSource, /^\/\/ @page-pattern: list\s*$/m, '工程专业任务页必须声明标准列表页模式')
for (const contract of ['renderStandardListPage', 'renderStandardListTable', 'renderTablePagination']) {
  assert.ok(pageSource.includes(contract), `工程专业任务页必须使用 ${contract}`)
}

resetPcsEngineeringTaskState()
const pages = [
  ['改版任务', renderPcsRevisionTaskPage()],
  ['制版任务', renderPcsPlateMakingTaskPage()],
  ['花型任务', renderPcsPatternTaskPage()],
  ['首版样衣打样', renderPcsFirstSampleTaskPage()],
  ['首单样衣打样', renderPcsFirstOrderSampleTaskPage()],
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

const revisionHtml = pages[0][1]
const revisionStatusOptions = revisionHtml.match(
  /data-pcs-engineering-field="revision-status"[\s\S]*?<\/select>/,
)?.[0] ?? ''
for (const status of ['进行中', '待确认', '已确认', '已生成技术包', '已完成']) {
  assert.ok(revisionStatusOptions.includes(status), `改版筛选缺少专用状态：${status}`)
}
assert.doesNotMatch(revisionStatusOptions, /异常待处理|已取消/, '改版筛选不得混入其他专业类型状态')

const plateHtml = pages[1][1]
const plateStatusOptions = plateHtml.match(
  /data-pcs-engineering-field="plate-status"[\s\S]*?<\/select>/,
)?.[0] ?? ''
assert.match(plateStatusOptions, /异常待处理/, '制版筛选仍需保留自身异常状态')
assert.match(plateStatusOptions, /已取消/, '制版筛选仍需保留自身取消状态')

for (const route of [
  '/pcs/patterns/revision',
  '/pcs/patterns/plate-making',
  '/pcs/patterns/colors',
  '/pcs/samples/first-sample',
  '/pcs/samples/first-order',
]) {
  assert.ok(pageSource.includes(`higood:list-page:${route}`), `缺少按路由持久化键：${route}`)
}
assert.match(pageSource, /loadListColumnPreferences/, '列表页进入时必须读取列偏好')
assert.match(pageSource, /saveListColumnPreferences/, '列偏好与每页条数变化后必须保存')
assert.match(pageSource, /resetStandardListEntryTransientStateOnRouteEntry/, '页码和排序必须在重新进入路由时复位')
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
