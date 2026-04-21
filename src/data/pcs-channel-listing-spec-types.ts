export type ChannelListingSpecLineStatus = '待上传' | '已上传' | '上传失败'

export interface ChannelListingSpecLineRecord {
  specLineId: string
  specLineCode: string
  listingBatchId: string
  colorName: string
  sizeName: string
  printName: string
  sellerSku: string
  priceAmount: number
  currencyCode: string
  stockQty: number
  lineStatus: ChannelListingSpecLineStatus
  upstreamSkuId: string
  uploadResultText: string
}

export interface ChannelListingSpecLineInput {
  specLineId?: string
  specLineCode?: string
  listingBatchId?: string
  colorName?: string
  sizeName?: string
  printName?: string
  sellerSku?: string
  priceAmount?: number
  currencyCode?: string
  stockQty?: number
  lineStatus?: ChannelListingSpecLineStatus
  upstreamSkuId?: string
  uploadResultText?: string
}
