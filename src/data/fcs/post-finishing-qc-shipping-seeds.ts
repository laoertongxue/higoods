// Explicitly linked prototype facts. These are not online warehouse records.
import { POST_FINISHING_PRODUCTION_SOURCE_FIXTURES } from './post-finishing-production-source-fixtures.ts'
import type { FinishedOutboundOrder } from '../wls/finished-outbound-orders.ts'
import type { PriorityStock } from './post-finishing-qc-shipping-priority.ts'

const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const tomorrow = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.parse(`${today}T00:00:00+07:00`) + 86400000))
export const QC_SHIPPING_SEED_SOURCE = 'qc-shipping-linked-fixtures-v1; baseline excludes all post-finishing receipts'
export const QC_SHIPPING_WAREHOUSES = [{ id: 'WH-AC', name: 'A&C WH' }, { id: 'WH-FM', name: 'F&M WH' }] as const
export const QC_SHIPPING_DESTINATION_SEEDS = POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.map((source, index) => ({
  sourceId: source.no, warehouseId: index === 2 ? 'WH-FM' : 'WH-AC', version: 0,
  operator: '原型固定样本', reason: QC_SHIPPING_SEED_SOURCE,
}))

export const QC_SHIPPING_OUTBOUND_SEEDS: FinishedOutboundOrder[] = POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.flatMap((source, index) =>
  source.skus.flatMap((sku, skuIndex) => [0, 1].map(day => {
    const id = `qc-shipping-demo-${index}-${skuIndex}-${day}`
    return {
      id, outboundOrderNo: `DEMO-QC-DN-${index + 1}-${skuIndex + 1}-${day}`, relatedOrderNo: `DEMO-QC-SALE-${index + 1}-${skuIndex + 1}-${day}`,
      trackingNo: '', warehouse: index === 2 ? 'F&M WH' : 'A&C WH', platform: 'Tiktok', orderType: '预售订单', status: '待处理',
      createdAt: `${today} 08:00:00`, updatedAt: `${today} 08:00:00`, deadline: `${day ? tomorrow : today} 23:59:59`, deadlineTimeZone: 'Asia/Jakarta',
      pickedAt: '', shippedAt: '', cancelledAt: '', labelDownloadedAt: '', printedAt: '', pickOrderNo: '',
      remark: '原型QC紧急度关联样本，不代表真实销售或库存。', isKol: false, printCount: 0, version: 1,
      products: [{ lineId: `${id}:0`, spu: sku.spuCode, sku: sku.skuCode, imageUrl: sku.imageUrl, quantity: day ? 400 : 600, pendingQuantity: 0, locations: [], inventoryUpdatedAt: '' }], logs: [],
    } satisfies FinishedOutboundOrder
  })))

export const QC_SHIPPING_STOCK_SEEDS: PriorityStock[] = POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.flatMap((source, index) => source.skus.map((sku, skuIndex) => ({
  id: `qc-shipping-stock-${index}-${skuIndex}`, sku: sku.skuCode, warehouseId: index === 2 ? 'WH-FM' : 'WH-AC', quantity: 100,
  reservations: [
    { id: `qc-shipping-reserve-${index}-${skuIndex}`, orderLineId: `qc-shipping-demo-${index}-${skuIndex}-0:0`, quantity: 40 },
    { id: `qc-shipping-external-${index}-${skuIndex}`, quantity: 30 },
  ],
})))
