import type { MaterialArchiveRecord, MaterialSkuRecord, MaterialLogRecord } from './pcs-material-archive-types.ts'

/** 用户提供的真实半成品实图档案；尺寸仍需按技术包核对，不冒充已确认的 WB20/30/40 规格。 */
const references = [
  { id: 'tmf-webbing-reference', code: 'TMF-WB-REF', name: '白色织带半成品（幅宽待确认）', english: 'White webbing reference', category: '织带', dimension: '幅宽待确认', image: '/materials/tmf/webbing-real-roll.jpg' },
  { id: 'tmf-rope-reference', code: 'TMF-RP-REF', name: '白色绳子半成品（绳径待确认）', english: 'White cord reference', category: '绳子', dimension: '绳径待确认', image: '/materials/tmf/rope-real-bundle.jpg' },
]
const audit = { createdAt: '2026-09-20 00:00', createdBy: '原型参考素材登记', updatedAt: '2026-09-20 00:00', updatedBy: '原型参考素材登记' }
export const tmfReferenceMaterials: MaterialArchiveRecord[] = references.map((item) => ({
  materialId: item.id, kind: 'accessory', materialCode: item.code, materialName: item.name, materialNameEn: item.english,
  categoryName: item.category, specSummary: `用户提供用户提供的真实半成品实图；${item.dimension}，材质待确认`, composition: '待确认', processTags: ['TMF', '半成品参考'],
  widthText: item.dimension, gramWeightText: '待确认', pricingUnit: '米', mainUnit: '米', auxiliaryUnits: [], unitConversions: [],
  mainImageUrl: item.image, galleryImageUrls: [item.image], status: 'ACTIVE', skuCount: 1, usedStyleCount: 0, usedTechPackCount: 0,
  barcodeTemplateCode: `${item.code}-WHT`, remark: '仅用于原型参考与加工规格编辑。宽度/绳径、材质、价格及正式SPU对应尚未确认；不作为定长成品SKU，不与WB20/30/40规格共用实物图。', ...audit,
}))
export const tmfReferenceSkus: MaterialSkuRecord[] = references.map((item) => ({
  materialSkuId: `${item.id}-white`, materialId: item.id, materialCode: item.code, materialSkuCode: `${item.code}-WHT`,
  materialName: item.name, colorName: '白色（参考）', specName: `连续半成品；${item.dimension}`, sizeName: '生产截断长度另列工艺要求',
  skuImageUrl: item.image, costPrice: 0, freightCost: 0, pricingUnit: '米', unitConversions: [], weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0,
  barcode: `${item.code}-WHT`, status: 'ACTIVE', ...audit,
}))
export const tmfReferenceMaterialLogs: MaterialLogRecord[] = references.map((item) => ({
  logId: `${item.id}-reference-registration`, materialId: item.id, operatorName: audit.createdBy, title: '登记半成品参考素材',
  detail: '原样引用用户提供的真实半成品实图；尺寸及材料属性未确认，价格和数值尺寸尚未维护。参考档案不代表真实采购或正式物料审批。', createdAt: audit.createdAt,
}))
