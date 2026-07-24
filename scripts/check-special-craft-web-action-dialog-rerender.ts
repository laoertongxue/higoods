import assert from 'node:assert/strict'

import {
  listEnabledAuxiliaryCraftOperationDefinitions,
  listEnabledSpecialTypeCraftOperationDefinitions,
  buildSpecialCraftOperationSlug,
} from '../src/data/fcs/special-craft-operations.ts'
import { getSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { renderSpecialCraftTaskDetailPage } from '../src/pages/process-factory/special-craft/task-detail.ts'
import { renderSpecialCraftTaskOrdersPage } from '../src/pages/process-factory/special-craft/task-orders.ts'

function assertWebActionButtonsSkipPageRerender(html: string, label: string): void {
  const buttonMatches = html.match(/<button[^>]*data-special-craft-web-action="open-web-status-action-dialog"[^>]*>/g) || []
  assert.ok(buttonMatches.length > 0, `${label} 必须渲染特殊工艺 Web 操作按钮`)
  for (const button of buttonMatches) {
    assert.ok(
      button.includes('data-skip-page-rerender="true"'),
      `${label} 的特殊工艺 Web 操作按钮必须跳过整页重绘，避免弹窗刚打开就被清除：${button}`,
    )
  }
}

const operations = [
  listEnabledAuxiliaryCraftOperationDefinitions()[0],
  listEnabledSpecialTypeCraftOperationDefinitions()[0],
].filter(Boolean)

assert.equal(operations.length, 2, '必须同时覆盖辅助工艺工厂和特种工艺工厂')

for (const operation of operations) {
  const operationSlug = buildSpecialCraftOperationSlug(operation)
  const listHtml = renderSpecialCraftTaskOrdersPage(operationSlug)
  assertWebActionButtonsSkipPageRerender(listHtml, `${operation.managementDomainName} ${operation.operationName}加工单列表`)

  const taskOrder = getSpecialCraftTaskOrders(operation.operationId).find((item) => item.status === '加工中')
    || getSpecialCraftTaskOrders(operation.operationId)[0]
  assert.ok(taskOrder, `${operation.managementDomainName} ${operation.operationName} 必须存在加工单 Mock 数据`)

  const detailHtml = renderSpecialCraftTaskDetailPage(operationSlug, taskOrder.taskOrderId)
  assertWebActionButtonsSkipPageRerender(detailHtml, `${operation.managementDomainName} ${operation.operationName}加工单详情`)
}

console.log('[check-special-craft-web-action-dialog-rerender] 特殊工艺 Web 操作弹窗重绘契约通过')
