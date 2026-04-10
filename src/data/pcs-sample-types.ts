export const SAMPLE_LEDGER_EVENT_TYPE_LIST = [
  { code: 'RECEIVE_ARRIVAL', name: '到样签收' },
  { code: 'CHECKIN_VERIFY', name: '核对入库' },
  { code: 'RESERVE_LOCK', name: '预占锁定' },
  { code: 'CANCEL_RESERVE', name: '取消预占' },
  { code: 'CHECKOUT_BORROW', name: '领用出库' },
  { code: 'RETURN_CHECKIN', name: '归还入库' },
  { code: 'SHIP_OUT', name: '寄出' },
  { code: 'DELIVER_SIGNED', name: '签收' },
  { code: 'STOCKTAKE', name: '盘点' },
  { code: 'DISPOSAL', name: '处置' },
  { code: 'RETURN_SUPPLIER', name: '退货' },
] as const

export type SampleLedgerEventType = (typeof SAMPLE_LEDGER_EVENT_TYPE_LIST)[number]['code']

export const SAMPLE_LEDGER_EVENT_NAME_MAP: Record<SampleLedgerEventType, string> = SAMPLE_LEDGER_EVENT_TYPE_LIST.reduce(
  (map, item) => {
    map[item.code] = item.name
    return map
  },
  {} as Record<SampleLedgerEventType, string>,
)

export const SAMPLE_TRANSFER_EVENT_CODE_MAP: Record<string, SampleLedgerEventType> = {
  ARRIVAL_SIGN: 'RECEIVE_ARRIVAL',
  CHECK_IN: 'CHECKIN_VERIFY',
  BORROW_OUT: 'CHECKOUT_BORROW',
  RETURN_IN: 'RETURN_CHECKIN',
  SHIP: 'SHIP_OUT',
  SIGN: 'DELIVER_SIGNED',
  RETURN_VENDOR: 'RETURN_SUPPLIER',
}

export type SampleInventoryStatus =
  | '在途'
  | '在库待核对'
  | '在库可用'
  | '预占锁定'
  | '借出占用'
  | '在途待签收'
  | '待处置'
  | '已退货'
  | '维修中'
  | '已处置'

export type SampleAvailabilityStatus = '可用' | '不可用'
export type SampleLocationType = '仓库' | '外部保管' | '在途' | '处置区'
export type SampleCustodianType = '仓管' | '内部人员' | '外部主体' | '系统'
export type SampleSourceDocType =
  | '样衣获取单'
  | '样衣使用申请'
  | '首版样衣打样任务'
  | '产前版样衣任务'
  | '样衣退回单'
  | '样衣处置单'
  | '盘点单'

export interface SampleAssetRecord {
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  sampleType: string
  responsibleSite: string
  inventoryStatus: SampleInventoryStatus
  availabilityStatus: SampleAvailabilityStatus
  locationType: SampleLocationType
  locationCode: string
  locationDisplay: string
  custodianType: SampleCustodianType
  custodianName: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  sourceDocType: SampleSourceDocType | ''
  sourceDocId: string
  sourceDocCode: string
  lastEventId: string
  lastEventType: SampleLedgerEventType | ''
  lastEventTime: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  legacyProjectRef: string
  legacyWorkItemInstanceId: string
}

export interface SampleLedgerEventRecord {
  ledgerEventId: string
  ledgerEventCode: string
  eventType: SampleLedgerEventType
  eventName: string
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  quantity: number
  responsibleSite: string
  inventoryStatusBefore: string
  inventoryStatusAfter: string
  availabilityBefore: string
  availabilityAfter: string
  locationBefore: string
  locationAfter: string
  sourceModule: string
  sourceDocType: SampleSourceDocType | ''
  sourceDocId: string
  sourceDocCode: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  operatorId: string
  operatorName: string
  businessDate: string
  note: string
  legacyProjectRef: string
  legacyWorkItemInstanceId: string
  createdAt: string
  createdBy: string
}

export interface SampleWritebackPendingItem {
  pendingId: string
  sourcePage: string
  sourceDocType: string
  sourceDocCode: string
  sampleCode: string
  rawProjectField: string
  rawWorkItemField: string
  reason: string
  discoveredAt: string
}

export interface SampleAssetStoreSnapshot {
  version: number
  assets: SampleAssetRecord[]
}

export interface SampleLedgerStoreSnapshot {
  version: number
  events: SampleLedgerEventRecord[]
  pendingItems: SampleWritebackPendingItem[]
}

export interface SampleLedgerWriteInput {
  ledgerEventId?: string
  ledgerEventCode?: string
  eventType: SampleLedgerEventType
  sampleAssetId?: string
  sampleCode: string
  sampleName: string
  sampleType?: string
  quantity?: number
  responsibleSite: string
  sourcePage: string
  sourceModule: string
  sourceDocType: SampleSourceDocType | ''
  sourceDocId: string
  sourceDocCode: string
  projectId?: string
  projectCode?: string
  projectName?: string
  projectNodeId?: string
  workItemTypeCode?: string
  workItemTypeName?: string
  operatorId?: string
  operatorName?: string
  businessDate: string
  note?: string
  inventoryStatusBefore?: string
  inventoryStatusAfter?: SampleInventoryStatus
  availabilityBefore?: SampleAvailabilityStatus
  availabilityAfter?: SampleAvailabilityStatus
  locationBefore?: string
  locationAfter?: string
  locationType?: SampleLocationType
  locationCode?: string
  locationDisplay?: string
  custodianType?: SampleCustodianType
  custodianName?: string
  legacyProjectRef?: string
  legacyWorkItemInstanceId?: string
}
