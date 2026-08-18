import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { resolveFactoryMobileTodoActionRoute } from '../src/data/fcs/factory-mobile-todo-routes.ts'
import {
  resolveSpecialCraftPdaScan,
  type SpecialCraftPdaScanPurpose,
} from '../src/data/fcs/special-craft-pda-scan.ts'
import {
  listAuxiliaryCraftTaskOrders,
  listSpecialCraftTaskOrders,
  listSpecialTypeCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from '../src/data/fcs/special-craft-task-orders.ts'

const repoRoot = process.cwd()
const source = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8')

const warehouseHomeSource = source('src/pages/pda-warehouse.ts')
const waitProcessSource = source('src/pages/pda-warehouse-wait-process.ts')
const waitHandoverSource = source('src/pages/pda-warehouse-wait-handover.ts')
const execSource = source('src/pages/pda-exec.ts')
const execDetailSource = source('src/pages/pda-exec-detail.ts')
const handoverSource = source('src/pages/pda-handover.ts')
const retiredWarehouseSource = [warehouseHomeSource, waitProcessSource, waitHandoverSource].join('\n')

assert(
  !existsSync(resolve(repoRoot, 'src/data/fcs/special-craft-pda-warehouse-actions.ts')),
  '辅助/特种工艺 PDA 仓库第二套写入文件必须删除',
)
for (const removedText of [
  'special-craft-pda-warehouse-actions',
  'executeSpecialCraftWaitProcessIssue',
  'executeSpecialCraftWaitHandoverSubmit',
  'special-craft-wait-process-issue',
  'special-craft-wait-handover-submit',
  'renderAuxiliaryWaitProcessPage',
  'renderAuxiliaryWaitHandoverPage',
  'confirm-auxiliary-',
  'auxiliary-receive-',
  'auxiliary-issue-',
  'auxiliary-return-',
  'auxiliary-finish-',
  'auxiliary-handover-',
]) {
  assert(!retiredWarehouseSource.includes(removedText), `PDA 仓库第二套逻辑必须完整删除：${removedText}`)
}

assert.equal(
  warehouseHomeSource.match(/if \(isWoolWarehouseRuntime\(runtime\) \|\| isCraftWarehouseRuntime\(runtime\)\) return ''/g)?.length,
  2,
  '辅助/特种工艺仓管首页必须同时隐藏待加工仓和待交出仓操作组',
)
assert(waitProcessSource.includes("renderRouteRedirect('/fcs/pda/handover?tab=pickup'"), '待加工仓旧 URL 必须跳到交接确认接收')
assert(waitHandoverSource.includes("renderRouteRedirect('/fcs/pda/handover?tab=handout'"), '待交出仓旧 URL 必须跳到交接发起交出')
for (const factoryType of ['CENTRAL_AUX', 'CENTRAL_SPECIAL']) {
  assert(waitProcessSource.includes(`factoryType === '${factoryType}'`), `待加工仓缺少 ${factoryType} 退役守卫`)
  assert(waitHandoverSource.includes(`factoryType === '${factoryType}'`), `待交出仓缺少 ${factoryType} 退役守卫`)
}

assert(execSource.includes('renderSpecialCraftExecutionScanHeader'), '加工填报必须提供辅助/特种工艺扫码入口')
assert(handoverSource.includes('renderSpecialCraftHandoverScanPanel'), '确认接收和发起交出必须提供辅助/特种工艺扫码入口')
assert(execSource.includes('data-pda-scan-enter="true"'), '执行扫码必须支持扫码枪回车')
assert(handoverSource.includes('data-pda-scan-enter="true"'), '交接扫码必须支持扫码枪回车')
assert(
  execDetailSource.includes("return actions.filter((action) =>\n    action.action === 'special-process-report' || action.action === 'special-complete-order'"),
  '执行表面只能保留加工填报和完成加工单',
)
assert(
  execDetailSource.includes("if (input.surface === 'HANDOVER_RECEIVE')")
    && execDetailSource.includes("action.action === 'special-confirm-receive'"),
  '交接确认接收表面只能保留确认接收',
)
assert(
  execDetailSource.includes("if (input.surface === 'HANDOVER_HANDOUT')")
    && execDetailSource.includes("action.action === 'special-submit-handover'"),
  '交接发起交出表面只能保留发起交出',
)

assert.equal(
  resolveFactoryMobileTodoActionRoute({ todoType: '待确认接收', executionProcessType: 'SPECIAL_CRAFT', relatedTaskId: 'TASK-SPECIAL-1' }),
  '/fcs/pda/handover?tab=pickup&taskId=TASK-SPECIAL-1',
  '辅助/特种工艺待确认接收待办必须进入交接',
)
assert.equal(
  resolveFactoryMobileTodoActionRoute({ todoType: '待交出', executionProcessType: 'SPECIAL_CRAFT', relatedTaskId: 'TASK-SPECIAL-1' }),
  '/fcs/pda/handover?tab=handout&taskId=TASK-SPECIAL-1',
  '辅助/特种工艺待交出待办必须进入交接',
)
assert.equal(
  resolveFactoryMobileTodoActionRoute({ todoType: '待加工填报', executionProcessType: 'SPECIAL_CRAFT', relatedTaskId: 'TASK-SPECIAL-1' }),
  '/fcs/pda/exec/TASK-SPECIAL-1',
  '辅助/特种工艺待加工填报待办必须进入执行',
)
assert.equal(
  resolveFactoryMobileTodoActionRoute({ todoType: '待完工', executionProcessType: 'SPECIAL_CRAFT', relatedTaskId: 'TASK-SPECIAL-1' }),
  '/fcs/pda/exec/TASK-SPECIAL-1',
  '辅助/特种工艺待完工待办必须进入执行',
)

function isActionable(order: SpecialCraftTaskOrder, purpose: SpecialCraftPdaScanPurpose): boolean {
  if (purpose === 'RECEIVE') return order.status === '待接收'
  if (purpose === 'HANDOVER') return order.status === '加工中' && order.completedQty > (order.returnedQty || 0)
  return order.status === '加工中'
}

const domainOrders = [
  { label: '辅助工艺', orders: listAuxiliaryCraftTaskOrders() },
  { label: '特种工艺', orders: listSpecialTypeCraftTaskOrders() },
]
for (const { label, orders } of domainOrders) {
  assert(orders.length > 0, `${label}必须存在加工单 Mock`)
  for (const purpose of ['RECEIVE', 'EXECUTION', 'HANDOVER'] as const) {
    const actionableOrders = orders.filter((item) => isActionable(item, purpose))
    for (const actionableOrder of actionableOrders) {
      const actionableResult = resolveSpecialCraftPdaScan(
        actionableOrder.taskOrderNo,
        actionableOrder.factoryId,
        purpose,
      )
      assert.equal(actionableResult.status, 'MATCH', `${label}每张 ${purpose} 加工单都必须可精准识别`)
      assert(actionableResult.candidates[0]?.styleImageUrl, `${label}每张 ${purpose} 加工单都必须有真实款式图片`)
    }
    const order = orders.find((item) => isActionable(item, purpose))
    assert(order, `${label}必须存在可用于 ${purpose} 扫码的加工单`)
    const result = resolveSpecialCraftPdaScan(order.taskOrderNo, order.factoryId, purpose)
    assert.equal(result.status, 'MATCH', `${label} ${purpose} 扫加工单号必须唯一命中`)
    assert.equal(result.candidates[0]?.order.taskOrderId, order.taskOrderId)
    assert(result.candidates[0]?.styleImageUrl, `${label} 扫码结果必须有真实款式图片`)
  }
}

const allOrders = listSpecialCraftTaskOrders()
const firstOrder = allOrders[0]
assert(firstOrder, '必须存在辅助/特种工艺加工单')
assert.equal(
  resolveSpecialCraftPdaScan(firstOrder.taskOrderNo, 'OTHER_FACTORY', 'RECEIVE').status,
  'FORBIDDEN',
  '扫码不得操作其他工厂加工单',
)
assert.equal(resolveSpecialCraftPdaScan('NOT-A-SPECIAL-ORDER', firstOrder.factoryId, 'RECEIVE').status, 'NOT_FOUND')

const groupedByProduction = new Map<string, SpecialCraftTaskOrder[]>()
for (const order of allOrders.filter((item) => isActionable(item, 'RECEIVE'))) {
  const key = `${order.factoryId}::${order.productionOrderNo}`
  groupedByProduction.set(key, [...(groupedByProduction.get(key) || []), order])
}
const multipleGroup = [...groupedByProduction.values()].find((orders) => orders.length > 1)
assert(multipleGroup, 'Mock 必须包含同生产单多张可接收加工单')
const multipleResult = resolveSpecialCraftPdaScan(multipleGroup[0].productionOrderNo, multipleGroup[0].factoryId, 'RECEIVE')
assert.equal(multipleResult.status, 'MULTIPLE', '扫生产单命中多张加工单时不得自动选择')
assert.equal(multipleResult.candidates.length, multipleGroup.length)
assert(multipleResult.candidates.every((candidate) => candidate.styleImageUrl), '生产单候选必须全部展示真实款式图片')

console.log('毛织以外辅助/特种工艺 PDA 单一事实、Tab 分工与扫码入口检查通过')
