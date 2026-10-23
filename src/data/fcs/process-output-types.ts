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
  createdBy?: string
  createdByUserId?: string
  updatedAt?: string
  updatedBy?: string
  updatedByUserId?: string
  printedAt?: string
  printedBy?: string
  printedByUserId?: string
  warehouseName?: string
  locationName?: string
  inboundStatus?: '未入库' | '已入库'
  inboundAt?: string
  stagedAt?: string
  stagedBy?: string
  stagedByUserId?: string
  dispatchId?: string
}
export interface ProcessDispatchDocument {
  historical?: boolean
  id: string
  status: '草稿' | '已交出' | '已作废'
  createdAt: string
  operator: string
  operatorUserId?: string
  updatedAt?: string
  updatedBy?: string
  updatedByUserId?: string
  handedOverAt?: string
  handedOverBy?: string
  handedOverByUserId?: string
  scans: { barcode: string; operator: string; operatorUserId?: string; at: string }[]
  transport: { driver: string; vehicle: string; plate: string; note: string }
  voidedAt?: string
  voidedBy?: string
  voidedByUserId?: string
  lines: { orderId: string; orderNo: string; taskNo: string; factoryId: string; factoryName: string; receiver: string; partner: DyePartner; sku: string; unit: string; rolls: ProcessOutputRoll[]; handoverRecordId?: string; receivingSourceId?: string; historicalQty?: number }[]
}
