import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  renderCutPieceFeiTicketConfirmDialog,
  renderGarmentSkuConfirmDialog,
} from '../src/pages/process-factory/special-craft/shared.ts'
import { executeProcessWebAction } from '../src/data/fcs/process-web-status-actions.ts'
import {
  buildSpecialCraftOperationSlug,
  listEnabledSpecialCraftOperationDefinitions,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftTaskOrders,
  listSpecialCraftTaskOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import { validateSpecialCraftMobileTaskBinding } from '../src/data/fcs/process-mobile-task-binding.ts'

function assertIncludes(source: string, token: string, message: string): void {
  assert.ok(source.includes(token), message)
}

const operation = listEnabledSpecialCraftOperationDefinitions()[0]
assert.ok(operation, '缺少特殊工艺 operation')
const operationSlug = buildSpecialCraftOperationSlug(operation)
const workOrder = getSpecialCraftTaskOrders(operation.operationId).find((item) => item.status === '加工中' && item.receivedQty > item.completedQty)
assert.ok(workOrder, '缺少可验证行级剩余完工数量的加工中特殊工艺加工单')

const progressByFeiTicketNo = new Map((workOrder.lineProgress || []).filter((row) => row.feiTicketNo).map((row) => [row.feiTicketNo!, row]))
const feiGroups = [...progressByFeiTicketNo.values()].map((row) => ({
  feiTicketNo: row.feiTicketNo || '',
  partName: row.partName,
  colorName: row.colorName,
  sizeCode: row.sizeCode,
  planQty: row.planQty,
  defaultQty: row.planQty,
  receivedQty: row.receivedQty,
  completedQty: row.completedQty,
  returnedQty: row.returnedQty,
}))
const progressBySkuCode = new Map((workOrder.lineProgress || []).filter((row) => row.skuCode).map((row) => [row.skuCode!, row]))
const skuLines = (workOrder.demandLines || []).map((line) => {
  const progress = progressBySkuCode.get(line.skuCode)
  return {
    ...line,
    receivedQty: progress?.receivedQty || 0,
    completedQty: progress?.completedQty || 0,
    returnedQty: progress?.returnedQty || 0,
  }
})
const detailHtml = workOrder.targetObject === '成衣'
  ? `${renderGarmentSkuConfirmDialog(workOrder.taskOrderId, 'SPECIAL_CRAFT_PROCESS_REPORT', '加工填报', skuLines, 'planPieceQty')}${renderGarmentSkuConfirmDialog(workOrder.taskOrderId, 'SPECIAL_CRAFT_SUBMIT_HANDOVER', '发起交出', skuLines, 'planPieceQty')}`
  : `${renderCutPieceFeiTicketConfirmDialog(workOrder.taskOrderId, 'SPECIAL_CRAFT_PROCESS_REPORT', '加工填报', feiGroups)}${renderCutPieceFeiTicketConfirmDialog(workOrder.taskOrderId, 'SPECIAL_CRAFT_SUBMIT_HANDOVER', '发起交出', feiGroups)}`
;['累计实收数量', '累计完工数量', '本次完工数量', '累计交出数量', '本次交出数量'].forEach((token) => {
  assertIncludes(detailHtml, token, `Web 特殊工艺弹窗缺少行级累计字段：${token}`)
})
assertIncludes(detailHtml, 'data-line-progress-key', 'Web 特殊工艺弹窗必须绑定行级进度 key')
assertIncludes(detailHtml, `max="${Math.max(workOrder.receivedQty - workOrder.completedQty, 0)}`, '加工填报默认上限必须基于累计实收减累计完工')

assert.throws(
  () => executeProcessWebAction({
    sourceType: 'SPECIAL_CRAFT',
    sourceId: workOrder.taskOrderId,
    actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT',
    operatorName: 'Web 端验收员',
    operatedAt: '2026-07-24 15:00',
    objectType: workOrder.targetObject,
    objectQty: Math.max(workOrder.receivedQty - workOrder.completedQty, 0) + 1,
    qtyUnit: workOrder.unit,
  }),
  /完工数量不能超过累计实收未完工数量/,
  '加工填报必须拦截超过累计实收未完工数量',
)

const firstFeiProgress = workOrder.lineProgress?.find((row) => row.feiTicketNo)
assert.ok(firstFeiProgress?.feiTicketNo, '裁片加工单必须存在可写回的菲票行级进度')
const processQty = Math.max(firstFeiProgress.receivedQty - firstFeiProgress.completedQty, 0)
if (processQty > 0) {
  executeProcessWebAction({
    sourceType: 'SPECIAL_CRAFT',
    sourceId: workOrder.taskOrderId,
    actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT',
    operatorName: 'Web 端验收员',
    operatedAt: '2026-07-24 15:05',
    objectType: workOrder.targetObject,
    objectQty: processQty,
    qtyUnit: workOrder.unit,
    feiQtyByTicketNo: { [firstFeiProgress.feiTicketNo]: processQty },
  })
  const updatedWorkOrder = listSpecialCraftTaskOrders().find((item) => item.taskOrderId === workOrder.taskOrderId)
  const updatedLine = updatedWorkOrder?.lineProgress?.find((row) => row.feiTicketNo === firstFeiProgress.feiTicketNo)
  assert.equal(updatedLine?.completedQty, firstFeiProgress.receivedQty, '逐菲票加工填报后行级累计完工必须更新到累计实收')
  assert.equal(updatedWorkOrder?.completedQty, updatedWorkOrder?.lineProgress?.reduce((sum, row) => sum + row.completedQty, 0), '整单累计完工必须由行级累计完工汇总')

  const handoverQty = Math.max((updatedLine?.completedQty || 0) - (updatedLine?.returnedQty || 0), 0)
  if (handoverQty > 0) {
    executeProcessWebAction({
      sourceType: 'SPECIAL_CRAFT',
      sourceId: workOrder.taskOrderId,
      actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
      operatorName: 'Web 端验收员',
      operatedAt: '2026-07-24 15:10',
      objectType: workOrder.targetObject,
      objectQty: handoverQty,
      qtyUnit: workOrder.unit,
      feiQtyByTicketNo: { [firstFeiProgress.feiTicketNo]: handoverQty },
    })
    const handedOverWorkOrder = listSpecialCraftTaskOrders().find((item) => item.taskOrderId === workOrder.taskOrderId)
    const handedOverLine = handedOverWorkOrder?.lineProgress?.find((row) => row.feiTicketNo === firstFeiProgress.feiTicketNo)
    assert.equal(handedOverLine?.returnedQty, handedOverLine?.completedQty, '逐菲票发起交出后行级累计交出必须更新到累计完工')
    assert.equal(handedOverWorkOrder?.returnedQty, handedOverWorkOrder?.lineProgress?.reduce((sum, row) => sum + row.returnedQty, 0), '整单累计交出必须由行级累计交出汇总')
  }
}

const pdaBinding = validateSpecialCraftMobileTaskBinding(workOrder.taskOrderId)
assert.ok(pdaBinding.actualTaskId, '特殊工艺加工单必须绑定 PDA 任务')
const pdaHtml = fs.readFileSync('src/pages/pda-exec-detail.ts', 'utf8')
;['累计实收', '累计完工', '累计交出', '剩余可完工', '剩余可交出'].forEach((token) => {
  assertIncludes(pdaHtml, token, `PDA 特殊工艺详情缺少行级累计字段：${token}`)
})

const garmentOrder = listSpecialCraftTaskOrders().find((item) => item.status === '加工中' && item.targetObject === '成衣' && item.lineProgress?.length)
assert.ok(garmentOrder, '缺少可验证成衣 SKU 行级进度的加工中特殊工艺加工单')
const garmentProgressBySkuCode = new Map((garmentOrder.lineProgress || []).filter((row) => row.skuCode).map((row) => [row.skuCode!, row]))
const garmentLines = (garmentOrder.demandLines || []).map((line) => {
  const skuCode = line.skuCode || `${line.colorName || '成衣'}-${line.sizeCode || '均码'}`
  const progress = garmentProgressBySkuCode.get(skuCode)
  return {
    ...line,
    skuCode,
    receivedQty: progress?.receivedQty || 0,
    completedQty: progress?.completedQty || 0,
    returnedQty: progress?.returnedQty || 0,
  }
})
const garmentProcessHtml = renderGarmentSkuConfirmDialog(garmentOrder.taskOrderId, 'SPECIAL_CRAFT_PROCESS_REPORT', '加工填报', garmentLines, 'planPieceQty')
const garmentHandoverHtml = renderGarmentSkuConfirmDialog(garmentOrder.taskOrderId, 'SPECIAL_CRAFT_SUBMIT_HANDOVER', '发起交出', garmentLines, 'planPieceQty')
assertIncludes(garmentProcessHtml, 'data-sku-code="蓝白印花-S"', '成衣 SKU 缺失时必须用颜色尺码生成稳定行级 key')
assertIncludes(garmentProcessHtml, `max="${Math.max(garmentOrder.receivedQty - garmentOrder.completedQty, 0)}`, '成衣加工填报上限必须基于累计实收减累计完工')
assertIncludes(garmentHandoverHtml, `max="${Math.max(garmentOrder.completedQty - (garmentOrder.returnedQty || 0), 0)}`, '成衣发起交出上限必须基于累计完工减累计交出')

assert.ok(listSpecialCraftTaskOrders().some((item) => item.lineProgress?.length), '特殊工艺加工单必须存在行级进度数据')

console.log('[check-special-craft-line-progress-quantity-dialogs] 特殊工艺行级数量弹窗与 PDA 展示检查通过')
