export interface VideoTestRecord {
  videoRecordId: string
  videoRecordCode: string
  videoTitle: string
  channelName: string
  businessDate: string
  publishedAt: string
  recordStatus: string
  styleCode: string
  spuCode: string
  skuCode: string
  colorCode: string
  sizeCode: string
  exposureQty: number
  clickQty: number
  orderQty: number
  gmvAmount: number
  ownerName: string
  legacyProjectRef: string | null
  legacyProjectId: string | null
}

export interface VideoTestingStoreSnapshot {
  version: number
  records: VideoTestRecord[]
}
