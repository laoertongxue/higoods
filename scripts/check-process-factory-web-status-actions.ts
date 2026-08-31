import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  getAvailableSpecialCraftWebActions,
} from '../src/data/fcs/process-web-status-actions.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertIncludes(path: string, expected: string, message: string): void {
  const content = read(path)
  assert(content.includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  const content = read(path)
  assert(!content.includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

const modulePath = 'src/data/fcs/process-web-status-actions.ts'
assert(existsSync(join(root, modulePath)), '缺少 process-web-status-actions 模块')
assertIncludes(modulePath, 'listAvailableWebActions', '缺少 listAvailableWebActions')
assertIncludes(modulePath, 'executeProcessWebAction', '缺少 executeProcessWebAction')
assertIncludes(modulePath, 'validateProcessWebAction', '缺少 validateProcessWebAction')
assertIncludes(modulePath, 'ProcessWebOperationRecord', '缺少 ProcessWebOperationRecord')
assertIncludes(modulePath, 'getAvailableSpecialCraftWebActions', '缺少 getAvailableSpecialCraftWebActions')
for (const token of [
  'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  'SPECIAL_CRAFT_PROCESS_REPORT',
  'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  'SPECIAL_CRAFT_COMPLETE_ORDER',
]) {
  assertIncludes(modulePath, token, `特殊工艺缺少四动作定义 ${token}`)
}
assertIncludes(modulePath, 'sourceChannel', 'Web 操作记录必须包含来源')
assertIncludes(modulePath, 'Web 端', 'Web 操作记录来源必须为 Web 端')

assertIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', 'renderSpecialCraftTaskDetailPage', '特殊工艺加工单详情页必须按 workOrderId 直接渲染')
assertNotIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', 'window.location.replace', '特殊工艺加工单详情页不得重定向到任务详情')
assertIncludes('src/pages/process-factory/special-craft/task-detail.ts', 'openProcessWebStatusActionDialog', '特殊工艺加工单页面未接入 Web 操作弹窗')
assertIncludes('src/pages/process-factory/special-craft/task-detail.ts', 'handleProcessWebStatusActionDialogEvent', '特殊工艺加工单页面未接入 Web 操作弹窗确认事件')
assertIncludes('src/pages/process-factory/shared/web-status-action-dialog.ts', 'executeProcessWebAction', '特殊工艺弹窗确认后应通过统一 Web 操作执行')

assertNotIncludes(modulePath, '任意状态', '不得提供自由状态跳转')
assertNotIncludes('src/pages/process-factory/special-craft/task-detail.ts', '<select name="status"', '特殊工艺加工单详情不得提供自由状态下拉')
for (const forbidden of ['SPECIAL_CRAFT_START', 'SPECIAL_CRAFT_REPORT_MILESTONE', 'SPECIAL_CRAFT_COMPLETE_TASK']) {
  assertNotIncludes(modulePath, forbidden, `特殊工艺不得保留任务级动作 ${forbidden}`)
}
assertNotIncludes(modulePath, '开扣眼', '特殊工艺动作不得出现开扣眼')
assertNotIncludes(modulePath, '装扣子', '特殊工艺动作不得出现装扣子')
assertNotIncludes(modulePath, '烫包', '特殊工艺动作不得出现后道烫包')

const specialSampleTask = listSpecialCraftTaskOrders().find((t) => t.status === '加工中')
assert(specialSampleTask, '缺少加工中特殊工艺加工单')
const specialActions = getAvailableSpecialCraftWebActions(specialSampleTask.taskOrderId)
assert(
  JSON.stringify(specialActions.map((action) => action.actionLabel).sort())
    === JSON.stringify(['确认接收', '加工填报', '发起交出', '完成加工单'].sort()),
  `特殊工艺加工中只允许四个简化动作，实际：${specialActions.map((action) => action.actionLabel).join('、')}`,
)

console.log('special craft web status action checks passed')
