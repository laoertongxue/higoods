import type { DyePartner } from './dye-work-order-demo-details.ts'

export interface ProcessOutputRoll {
  id: string
  barcode: string
  rollNo: string
  qty: number
  weightKg: number
  widthCm: number
  gsm: number
  vatNo: string
  remark: string
  createdAt: string
  printedAt?: string
  printedBy?: string
  warehouseName?: string
  locationName?: string
  inboundStatus?: '未入库' | '已入库'
  inboundAt?: string
  stagedAt?: string
  dispatchId?: string
}
export interface ProcessDispatchDocument {
  historical?: boolean
  id: string
  status: '草稿' | '已交出' | '已作废'
  createdAt: string
  operator: string
  handedOverAt?: string
  scans: { barcode: string; operator: string; at: string }[]
  transport: { driver: string; vehicle: string; plate: string; note: string }
  voidedAt?: string
  lines: { orderId: string; orderNo: string; taskNo: string; factoryId: string; factoryName: string; receiver: string; partner: DyePartner; sku: string; unit: string; rolls: ProcessOutputRoll[]; handoverRecordId?: string; receivingSourceId?: string; historicalQty?: number }[]
}
