import { tmfReferenceMaterials, tmfReferenceSkus } from '../pcs-tmf-material-reference-seeds.ts'
import { createTmfMaterialPurchase, releaseTmfMaterialPurchase, generateTmfBaseOrder, acceptTmfBaseOrder, startTmfBaseOrder, reportTmfBaseProduction, dispatchTmfBaseProduction, getTmfPurchaseState, type TmfPurchaseActor } from '../pms/tmf-material-purchases.ts'

export const TMF_DEMO_SUPERVISOR: TmfPurchaseActor = { id: 'TMF-DEMO-SUPERVISOR', name: '织带厂主管（演示）', role: '织带厂主管' }
const buyer: TmfPurchaseActor = { id: 'TMF-DEMO-BUYER', name: '采购员（演示）', role: '采购员' }

/** 明确点击载入时执行，所有示例仍经真实数据动作形成；不重置已有记录。 */
export function loadTmfBaseDemoPurchases(): void {
  for (let i = 0; i < 36; i++) {
    const no = `TMF-DEMO-PO-${String(i + 1).padStart(3, '0')}`
    if (getTmfPurchaseState().orders.some((item) => item.purchaseOrderNo === no)) continue
    const material = tmfReferenceMaterials[i % 2]
    const sku = tmfReferenceSkus[i % 2]
    const quantity = 100 + i * 10
    createTmfMaterialPurchase({ purchaseOrderNo: no, purchaseLineId: `${no}-L1`, version: 1, supplierId: 'TMF-DEMO-SUPPLIER', supplierName: '织带供货方（演示）',
      factoryOrgId: 'FAC-TMF', materialSkuId: sku.materialSkuId, materialSpuId: material.materialId, accessoryType: i % 2 ? '绳子' : '织带',
      targetWarehouseId: 'TMF-DEMO-ACCESSORY-WH', productionStandard: '参考半成品演示标准；实际材料、幅宽/绳径待确认',
      requirementNo: '', sourceRequirementLineNo: '', sourceProductPurchaseOrderNo: '', materialCode: sku.materialSkuCode, materialName: material.materialName,
      materialType: '辅料', materialImageUrl: sku.skuImageUrl, unit: '米', styleCode: '', styleName: '', styleImageUrl: '', warehouse: '辅料仓（演示）',
      orderedQty: quantity, receivedQty: 0, unitPrice: 1, currency: 'RMB', status: '待采购', orderDate: '2026-09-20', expectedArrivalDate: `2026-09-${String(21 + i % 9).padStart(2, '0')}`,
      buyerName: buyer.name, supplierConfirmed: false, supplierConfirmedAt: '', remark: '原型演示采购；价格1为示例，尺寸未确认，不是真实采购。',
    }, buyer, `${no}:create`)
    releaseTmfMaterialPurchase(no, buyer, `${no}:release`)
    if (i % 4 === 0) continue
    generateTmfBaseOrder(no, TMF_DEMO_SUPERVISOR, `${no}:generate`)
    const base = getTmfPurchaseState().baseOrders.find((item) => item.purchaseOrderNo === no)!
    if (i % 4 === 1) continue
    acceptTmfBaseOrder(base.id, TMF_DEMO_SUPERVISOR, `${no}:accept`)
    startTmfBaseOrder(base.id, TMF_DEMO_SUPERVISOR, `${no}:start`)
    reportTmfBaseProduction(base.id, i % 4 === 2 ? quantity / 2 : quantity, TMF_DEMO_SUPERVISOR, `${no}:produce`)
    if (i % 4 === 3) dispatchTmfBaseProduction({ baseOrderId: base.id, handoverId: `${no}:handover`, batchId: `${no}:batch`, dispatchedMeters: quantity }, TMF_DEMO_SUPERVISOR, `${no}:dispatch`)
  }
}
