export type ChannelListingImageSource =
  | '项目参考图'
  | '样衣拍摄图片'
  | '上架补充图'
  | '旧链接迁移'

export interface ChannelListingImageRecord {
  listingImageId: string
  listingBatchId: string
  imageId: string
  imageUrl: string
  imageName: string
  sourceType: ChannelListingImageSource
  sortNo: number
  mainFlag: boolean
}

export interface ChannelListingImageInput {
  imageId: string
  sortNo?: number
  mainFlag?: boolean
}
