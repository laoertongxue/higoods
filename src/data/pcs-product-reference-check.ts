import type { PmsProductPurchaseOrder } from './pms/product-purchase-orders.ts'
import type { DemandSnapshot } from './fcs/production-orders.ts'

type ProductReferenceKind = 'style' | 'sku'

async function readProductCode(kind: ProductReferenceKind, id: string): Promise<string> {
  const code = kind === 'style'
    ? (await import('./pcs-style-archive-repository.ts')).getStyleArchiveById(id)?.styleCode
    : (await import('./pcs-sku-archive-repository.ts')).getSkuArchiveById(id)?.skuCode
  if (!code?.trim()) throw new Error('商品档案或编码无法读取，未归档。请重新读取后重试。')
  return code
}

async function readPurchaseReferences(kind: ProductReferenceKind, code: string): Promise<string[]> {
  try {
    const [repository, storage] = await Promise.all([
      import('./pms/product-purchase-orders.ts'),
      import('./pms/idb-storage.ts'),
    ])
    // 不使用旧 hydrate：它会吞掉读取错误，并在 finally 保存待写队列。
    const stored = await storage.pmsAll<PmsProductPurchaseOrder>(storage.PMS_STORES.pmsProductPurchaseOrders)
    const byNumber = new Map<string, PmsProductPurchaseOrder>()
    for (const order of [...repository.listPmsProductPurchaseOrders(), ...stored]) {
      if (!order?.purchaseOrderNo) throw new Error('商品采购单缺少单号')
      byNumber.set(order.purchaseOrderNo, order)
    }
    const references: string[] = []
    for (const order of byNumber.values()) {
      if (order.status === '已完成' || order.status === '已关闭') continue
      if (typeof order.spu !== 'string' || !Array.isArray(order.lines)
        || order.lines.some(line => typeof line?.sku !== 'string')) throw new Error('商品采购单缺少商品编码明细')
      const matches = kind === 'style' ? order.spu === code : order.lines.some(line => line.sku === code)
      if (matches) references.push(`商品采购单 ${order.purchaseOrderNo}`)
    }
    return references
  } catch (cause) {
    throw new Error('无法核对商品采购引用，未归档。请重新读取后重试。', { cause })
  }
}

function snapshotMatches(snapshot: DemandSnapshot, kind: ProductReferenceKind, code: string): boolean {
  if (typeof snapshot?.spuCode !== 'string' || !Array.isArray(snapshot.skuLines)
    || snapshot.skuLines.some(line => typeof line?.skuCode !== 'string')) throw new Error('生产单缺少商品编码快照')
  return kind === 'style' ? snapshot.spuCode === code : snapshot.skuLines.some(line => line.skuCode === code)
}

async function readProductionReferences(kind: ProductReferenceKind, code: string): Promise<string[]> {
  try {
    const [repository, storage] = await Promise.all([
      import('./fcs/production-orders.ts'),
      import('./fcs/production-context-records.ts'),
    ])
    // 先注册 productionOrders 的读取监听，再以只读事务承接持久覆盖。
    await storage.hydrateProductionContextRecords()
    const references = new Map<string, string>()
    for (const order of repository.productionOrders) {
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') continue
      if (!order.productionOrderId || !order.productionOrderNo) throw new Error('生产单缺少身份')
      const snapshots = [order.demandSnapshot, ...(order.sourceDemandSnapshots || [])]
      if (snapshots.some(snapshot => snapshotMatches(snapshot, kind, code))) {
        references.set(order.productionOrderId, `生产单 ${order.productionOrderNo}`)
      }
    }
    return [...references.values()]
  } catch (cause) {
    throw new Error('无法核对生产单引用，未归档。请重新读取后重试。', { cause })
  }
}

/** 归档前即时只读核对外部活动单据；不缓存结论、不创建单据、不改动 PCS 或外部记录。 */
export async function getProductExternalActiveReferences(kind: ProductReferenceKind, id: string): Promise<string[]> {
  const code = await readProductCode(kind, id)
  const results = await Promise.allSettled([
    readPurchaseReferences(kind, code),
    readProductionReferences(kind, code),
  ])
  // 等两侧读取均结束后再交还页面，避免一侧失败时另一侧仍占用读取锁。
  const references: string[] = []
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason
    references.push(...result.value)
  }
  return [...new Set(references)]
}
