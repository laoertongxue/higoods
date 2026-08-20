import {
  listSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from './special-craft-task-orders.ts'
import { BUTTON_LOOP_OPERATION_ID, BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME } from './button-loop-craft-flow.ts'

const STORAGE_KEY = 'higood:fcs:button-loop-accessory-receipts:v1'

export interface ButtonLoopAccessoryReceiptRecord {
  receiptId: string
  taskOrderId: string
  taskOrderNo: string
  productionOrderNo: string
  fromFactoryName: string
  toWarehouseName: typeof BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME
  handedOverQty: number
  receivedQty: number
  unit: '个'
  receivedBy: string
  receivedAt: string
}

export interface ButtonLoopAccessoryReceiptRow {
  task: SpecialCraftTaskOrder
  handoverNo: string
  handedOverQty: number
  unit: '个'
  destinationWarehouseName: typeof BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME
  receipt?: ButtonLoopAccessoryReceiptRecord
  pendingReceiptQty: number
  status: '待收货' | '已收货'
}

function readReceipts(): ButtonLoopAccessoryReceiptRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ButtonLoopAccessoryReceiptRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeReceipts(receipts: ButtonLoopAccessoryReceiptRecord[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts))
}

export function listButtonLoopAccessoryReceiptRows(): ButtonLoopAccessoryReceiptRow[] {
  const receiptByTaskId = new Map(readReceipts().map((receipt) => [receipt.taskOrderId, receipt]))
  return listSpecialCraftTaskOrders()
    .filter((task) => task.operationId === BUTTON_LOOP_OPERATION_ID && Number(task.handedOverQty || 0) > 0)
    .map((task) => {
      const receipt = receiptByTaskId.get(task.taskOrderId)
      const handedOverQty = Number(task.handedOverQty || 0)
      const receivedQty = Math.min(Number(receipt?.receivedQty || 0), handedOverQty)
      const pendingReceiptQty = Math.max(handedOverQty - receivedQty, 0)
      return {
        task,
        handoverNo: `JCD-${task.taskOrderNo}`,
        handedOverQty,
        unit: '个' as const,
        destinationWarehouseName: BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME,
        receipt,
        pendingReceiptQty,
        status: pendingReceiptQty === 0 ? '已收货' as const : '待收货' as const,
      }
    })
}

export function confirmButtonLoopAccessoryReceipt(input: {
  taskOrderId: string
  receivedBy: string
  receivedAt: string
}): ButtonLoopAccessoryReceiptRecord {
  const row = listButtonLoopAccessoryReceiptRows().find((item) => item.task.taskOrderId === input.taskOrderId)
  if (!row) throw new Error('未找到已交出的盘扣成品，不能收货。')
  if (!Number.isInteger(row.handedOverQty) || row.handedOverQty <= 0) {
    throw new Error('盘扣交出数量必须是大于 0 的整数。')
  }
  if (row.status === '已收货' && row.receipt) return row.receipt
  const receipt: ButtonLoopAccessoryReceiptRecord = {
    receiptId: row.receipt?.receiptId || `BL-RECEIPT-${row.task.taskOrderId}`,
    taskOrderId: row.task.taskOrderId,
    taskOrderNo: row.task.taskOrderNo,
    productionOrderNo: row.task.productionOrderNo,
    fromFactoryName: row.task.factoryName,
    toWarehouseName: BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME,
    handedOverQty: row.handedOverQty,
    receivedQty: row.handedOverQty,
    unit: '个',
    receivedBy: input.receivedBy.trim() || '中央辅料仓收货人员',
    receivedAt: input.receivedAt,
  }
  writeReceipts([
    ...readReceipts().filter((item) => item.taskOrderId !== row.task.taskOrderId),
    receipt,
  ])
  return receipt
}
