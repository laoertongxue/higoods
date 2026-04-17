export type MaterialArchiveKind = 'fabric' | 'accessory' | 'yarn' | 'consumable'
export type MaterialArchiveStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'

export interface MaterialArchiveRecord {
  materialId: string
  kind: MaterialArchiveKind
  materialCode: string
  materialName: string
  materialNameEn: string
  categoryName: string
  specSummary: string
  composition: string
  processTags: string[]
  widthText: string
  gramWeightText: string
  pricingUnit: string
  mainImageUrl: string
  galleryImageUrls: string[]
  status: MaterialArchiveStatus
  skuCount: number
  usedStyleCount: number
  usedTechPackCount: number
  barcodeTemplateCode: string
  remark: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface MaterialSkuRecord {
  materialSkuId: string
  materialId: string
  materialCode: string
  materialSkuCode: string
  materialName: string
  colorName: string
  specName: string
  sizeName: string
  skuImageUrl: string
  costPrice: number
  freightCost: number
  pricingUnit: string
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
  barcode: string
  status: MaterialArchiveStatus
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface MaterialUsageRecord {
  usageId: string
  materialId: string
  styleId: string
  styleCode: string
  styleName: string
  technicalVersionId: string
  technicalVersionLabel: string
  consumptionText: string
  updatedAt: string
}

export interface MaterialSkuDraftInput {
  colorName: string
  specName: string
  sizeName: string
  skuImageUrl: string
  costPrice: number
  freightCost: number
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
  barcode: string
}

export interface MaterialLogRecord {
  logId: string
  materialId: string
  operatorName: string
  title: string
  detail: string
  createdAt: string
}

export interface MaterialArchiveStoreSnapshot {
  version: number
  records: MaterialArchiveRecord[]
  skuRecords: MaterialSkuRecord[]
  usageRecords: MaterialUsageRecord[]
  logRecords: MaterialLogRecord[]
}
