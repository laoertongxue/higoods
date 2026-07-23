import { PROCESS_WORK_ORDER_SOURCE_LABEL, type ProcessWorkOrderSourceType } from '../../data/fcs/process-work-order-domain.ts'

interface ProcessWorkOrderSourceView {
  sourceType: ProcessWorkOrderSourceType
  sourceSnapshot?: {
    productionOrderNo?: string
    techPackVersionLabel?: string
    bomItemId?: string
    supplementRecordNo?: string
    originalCutOrderNo?: string
  }
  sourceProductionOrderId?: string
  sourceProductionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
  stockMaterial?: { materialName?: string }
  materialSku?: string
  materialName?: string
}

export interface ProcessWorkOrderSourceDetailRow {
  label: string
  value: string
}

export function getProcessWorkOrderSourceObject(order: ProcessWorkOrderSourceView): string {
  if (order.sourceType === 'STOCK') return order.stockMaterialName || order.stockMaterial?.materialName || order.stockMaterialId || order.materialName || '—'
  if (order.sourceType === 'CUT_PIECE_SUPPLEMENT') return order.sourceSnapshot?.supplementRecordNo || '—'
  return order.sourceSnapshot?.productionOrderNo || order.sourceProductionOrderNo || order.sourceProductionOrderId || '—'
}

export function getProcessWorkOrderSourceDetailRows(order: ProcessWorkOrderSourceView): ProcessWorkOrderSourceDetailRow[] {
  const rows: ProcessWorkOrderSourceDetailRow[] = [
    { label: '来源类型', value: PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType] },
  ]
  if (order.sourceType === 'STOCK') {
    rows.push({ label: '备货物料', value: getProcessWorkOrderSourceObject(order) })
    return rows
  }
  if (order.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    rows.push(
      { label: '补料单', value: order.sourceSnapshot?.supplementRecordNo || '-' },
      { label: '原始裁片单', value: order.sourceSnapshot?.originalCutOrderNo || '-' },
    )
  }
  rows.push(
    { label: '所属生产单', value: order.sourceSnapshot?.productionOrderNo || order.sourceProductionOrderNo || order.sourceProductionOrderId || '-' },
    { label: '技术包版本', value: order.sourceSnapshot?.techPackVersionLabel || '-' },
    { label: '物料编码', value: order.materialSku || '-' },
    { label: '物料名称', value: order.materialName || '-' },
  )
  if (order.sourceSnapshot?.bomItemId) rows.push({ label: 'BOM 行标识', value: order.sourceSnapshot.bomItemId })
  return rows
}
