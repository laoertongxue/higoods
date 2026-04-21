export type PcsProjectImageType =
  | '项目参考图'
  | '样衣平铺图'
  | '试穿图'
  | '细节图'
  | '上架图'
  | '款式档案图'
  | '手工补充图'

export type PcsProjectImageSourceType =
  | '商品项目立项'
  | '样衣拍摄与试穿'
  | '商品上架'
  | '生成款式档案'
  | '手工补充'

export type PcsProjectImageUsageScope =
  | '立项参考'
  | '样衣评估'
  | '商品上架'
  | '款式档案'
  | '项目资料归档'

export type PcsProjectImageStatus =
  | '待确认'
  | '可用于上架'
  | '可用于款式档案'
  | '已选为上架图'
  | '已选为档案图'
  | '已弃用'
  | '需重拍'

export type PcsProjectImageStorageType = 'external-url' | 'local-blob'

export interface PcsProjectImageAssetRecord {
  imageId: string
  projectId: string
  projectCode: string
  projectName: string
  imageUrl: string
  storageType?: PcsProjectImageStorageType
  storageKey?: string
  imageName: string
  imageType: PcsProjectImageType
  sourceNodeCode: string
  sourceRecordId: string
  sourceType: PcsProjectImageSourceType
  usageScopes: PcsProjectImageUsageScope[]
  imageStatus: PcsProjectImageStatus
  mainFlag: boolean
  sortNo: number
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface PcsProjectImageAssetSnapshot {
  version: number
  records: PcsProjectImageAssetRecord[]
}
