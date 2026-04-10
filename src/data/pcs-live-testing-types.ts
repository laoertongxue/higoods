export interface LiveSessionRecord {
  liveSessionId: string
  liveSessionCode: string
  sessionTitle: string
  channelName: string
  hostName: string
  sessionStatus: string
  businessDate: string
  startedAt: string
  endedAt: string
  ownerName: string
  createdAt: string
  updatedAt: string
  purposes: string[]
  itemCount: number
  testItemCount: number
  testAccountingStatus: string
  gmvAmount: number | null
  legacyProjectRef: string | null
  legacyProjectId: string | null
}

export interface LiveProductLine {
  liveLineId: string
  liveLineCode: string
  liveSessionId: string
  liveSessionCode: string
  lineNo: number
  productTitle: string
  styleCode: string
  spuCode: string
  skuCode: string
  colorCode: string
  sizeCode: string
  exposureQty: number
  clickQty: number
  orderQty: number
  gmvAmount: number
  businessDate: string
  ownerName: string
  sessionStatus: string
  legacyProjectRef: string | null
  legacyProjectId: string | null
}

export interface LiveTestingStoreSnapshot {
  version: number
  sessions: LiveSessionRecord[]
  productLines: LiveProductLine[]
}
