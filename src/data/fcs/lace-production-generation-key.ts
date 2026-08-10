export function buildLaceProductionGenerationKey(purchaseOrderId: string, skuId: string): string {
  const normalizedPurchaseOrderId = purchaseOrderId.trim().toUpperCase()
  const normalizedSkuId = skuId.trim().toUpperCase()

  if (!normalizedPurchaseOrderId || !normalizedSkuId) {
    throw new Error('花边生产单唯一键必须同时包含采购单 ID 和 SKU ID')
  }

  return `${normalizedPurchaseOrderId}::${normalizedSkuId}`
}
