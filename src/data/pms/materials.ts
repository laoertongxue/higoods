import { PMS_MATERIAL_IMAGES, PMS_STYLE_IMAGES } from './images.ts'
import { appendPmsLog, PmsDomainError } from './runtime.ts'

export type PmsMaterialCategory = '面料' | '辅料' | '纱线' | '包材' | '耗材' | '成衣' | '样衣'
export type PmsMaterialStatus = '草稿' | '已启用' | '已停用'
export type PmsPurchaseRegion = '国内' | '印尼' | '其他'

export const PMS_MATERIAL_BRAND_TYPES = ['无品牌', '自有品牌', '授权品牌'] as const
export type PmsMaterialBrandType = (typeof PMS_MATERIAL_BRAND_TYPES)[number]

export const PMS_MATERIAL_PURCHASE_REGIONS: PmsPurchaseRegion[] = ['国内', '印尼', '其他']
export const PMS_MATERIAL_CURRENCIES: Array<'RMB' | 'USD' | 'IDR'> = ['RMB', 'USD', 'IDR']

export const PMS_MATERIAL_SPECIAL_ATTRIBUTES = [
  '普货',
  '带电带磁',
  '带电',
  '带磁',
  '弱磁',
  '纯电池',
  '低功率电池',
  '高功率电池',
  '木制品',
  '纺织品',
  '皮具',
  '粉末',
  '食品',
  '纯液体',
  '带液体',
  '少量液体',
  '带游离液体',
  '危险品',
  '膏体',
  '管制刀具',
  '防疫用品',
  '仿牌',
  '敏感货',
  '车载产品',
  '充电设备',
  '金属',
] as const
export type PmsMaterialSpecialAttribute = (typeof PMS_MATERIAL_SPECIAL_ATTRIBUTES)[number]

export interface PmsMaterialDeclarationInfo {
  chineseClearanceName: string
  englishClearanceName: string
  materialEnglish: string
  usageEnglish: string
  weavingMethod: string
  brandType: string
  brandName: string
  brandEnglishName: string
  productMaterial: string
  productUsage: string
  productModel: string
  otherDeclarationElements: string
  specialAttributes: string[]
}

export interface PmsMaterialCustomsInfo {
  chineseCustomsName: string
  englishCustomsName: string
  originCountryOrRegion: string
  domesticSourcePlace: string
  taxExemptionType: string
  customsMaterial: string
  customsUsage: string
  customsSpecificationModel: string
  needCustomsDeclaration: boolean
  legalSecondUnit: string
  legalSecondUnitValue: number
  otherDeclarationElements: string
  transactionUnit: string
}

export interface PmsMaterialSystemInfo {
  dataSource: string
  sourceSystem: 'PCS'
  sourceProductCode: string
  syncedAt: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export interface PmsMaterial {
  materialCode: string
  materialName: string
  materialCategory: PmsMaterialCategory
  specification: string
  materialPurpose: string
  composition?: string
  color: string
  colorCode?: string
  styleNo?: string
  size?: string
  baseUnit: string
  purchaseUnit: string
  inventoryUnit: string
  conversionRate?: string
  defaultSupplier: string
  defaultPurchaseRegion: PmsPurchaseRegion
  referencePurchasePrice: number
  currency: 'RMB' | 'USD' | 'IDR'
  minPurchaseQty?: number
  purchaseLeadTimeDays: number
  needInspection: boolean
  inspectionRequirement?: string
  batchManagement?: boolean
  colorSizeManagement?: boolean
  status: PmsMaterialStatus
  imageUrl: string
  totalPurchaseOrders: number
  totalPurchaseQty: number
  totalPurchaseAmount: number
  recentPurchaseOrderNo: string
  recentPurchaseDate: string
  createdBy: string
  createdAt: string
  updatedAt: string
  updatedBy: string
  remark: string
  declarationInfo?: PmsMaterialDeclarationInfo
  customsInfo?: PmsMaterialCustomsInfo
  systemInfo: PmsMaterialSystemInfo
}

interface PmsMaterialSeed {
  materialCode: string
  materialName: string
  materialCategory: PmsMaterialCategory
  specification: string
  materialPurpose: string
  composition?: string
  color: string
  colorCode?: string
  styleNo?: string
  size?: string
  baseUnit: string
  purchaseUnit: string
  conversionRate?: string
  defaultSupplier: string
  referencePurchasePrice: number
  currency: 'RMB' | 'USD' | 'IDR'
  minPurchaseQty?: number
  purchaseLeadTimeDays: number
  needInspection: boolean
  inspectionRequirement?: string
  batchManagement?: boolean
  status: PmsMaterialStatus
  imageUrl: string
  totalPurchaseOrders: number
  totalPurchaseQty: number
  totalPurchaseAmount: number
  recentPurchaseOrderNo: string
  recentPurchaseDate: string
  createdBy: string
  createdAt: string
  updatedAt: string
  remark: string
}

const seeds: PmsMaterialSeed[] = [
  { materialCode: 'FAB-2026-0001', materialName: '180g 纯棉针织布', materialCategory: '面料', specification: '180g / 175cm', materialPurpose: '生产用', composition: '100%棉', color: '白色', colorCode: 'W01', baseUnit: '米', purchaseUnit: '米', conversionRate: '1卷=100米', defaultSupplier: '广州华盛面料有限公司', referencePurchasePrice: 26.5, currency: 'RMB', minPurchaseQty: 500, purchaseLeadTimeDays: 12, needInspection: true, inspectionRequirement: '克重与色差抽检', batchManagement: true, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.cottonJersey, totalPurchaseOrders: 46, totalPurchaseQty: 68000, totalPurchaseAmount: 1802000, recentPurchaseOrderNo: 'CG-2026-0001', recentPurchaseDate: '2026-05-18', createdBy: '商品中心同步任务', createdAt: '2026-01-10 09:20:00', updatedAt: '2026-05-18 14:10:00', remark: '夏季常备面料' },
  { materialCode: 'FAB-2026-0002', materialName: '220g 涤棉卫衣布', materialCategory: '面料', specification: '220g / 185cm', materialPurpose: '生产用', composition: '65%棉35%涤', color: '花灰', colorCode: 'GY01', baseUnit: '米', purchaseUnit: '米', conversionRate: '1卷=80米', defaultSupplier: '绍兴锦达纺织有限公司', referencePurchasePrice: 29.8, currency: 'RMB', minPurchaseQty: 400, purchaseLeadTimeDays: 15, needInspection: true, batchManagement: true, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.fleece, totalPurchaseOrders: 31, totalPurchaseQty: 42000, totalPurchaseAmount: 1251600, recentPurchaseOrderNo: 'CG-2026-0008', recentPurchaseDate: '2026-05-21', createdBy: '商品中心同步任务', createdAt: '2026-01-10 10:20:00', updatedAt: '2026-05-21 11:40:00', remark: '' },
  { materialCode: 'FAB-2026-0003', materialName: '白色府绸', materialCategory: '面料', specification: '120g / 150cm', materialPurpose: '生产用', composition: '100%棉', color: '白色', colorCode: 'W02', baseUnit: '米', purchaseUnit: '米', conversionRate: '1卷=120米', defaultSupplier: '广州华盛面料有限公司', referencePurchasePrice: 18.5, currency: 'RMB', minPurchaseQty: 300, purchaseLeadTimeDays: 11, needInspection: true, batchManagement: true, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.whitePoplin, totalPurchaseOrders: 12, totalPurchaseQty: 15600, totalPurchaseAmount: 288600, recentPurchaseOrderNo: 'CG-2026-0018', recentPurchaseDate: '2026-05-26', createdBy: '商品中心同步任务', createdAt: '2026-02-02 09:00:00', updatedAt: '2026-05-26 10:00:00', remark: '衬衫主面料' },
  { materialCode: 'FAB-2026-0004', materialName: '涤棉里布', materialCategory: '面料', specification: '145cm', materialPurpose: '生产用', composition: '65%涤35%棉', color: '灰色', baseUnit: '米', purchaseUnit: '米', conversionRate: '1卷=100米', defaultSupplier: '绍兴锦达纺织有限公司', referencePurchasePrice: 12.8, currency: 'RMB', minPurchaseQty: 300, purchaseLeadTimeDays: 10, needInspection: true, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.lining, totalPurchaseOrders: 17, totalPurchaseQty: 12400, totalPurchaseAmount: 158720, recentPurchaseOrderNo: 'CG-2026-0019', recentPurchaseDate: '2026-05-25', createdBy: '商品中心同步任务', createdAt: '2026-02-06 10:20:00', updatedAt: '2026-05-25 10:00:00', remark: '' },
  { materialCode: 'FAB-2026-0005', materialName: '灰色罗纹布', materialCategory: '面料', specification: '260g / 90cm', materialPurpose: '生产用', composition: '95%棉5%氨纶', color: '灰色', baseUnit: '公斤', purchaseUnit: '公斤', conversionRate: '1包=20公斤', defaultSupplier: '中山针织制衣有限公司', referencePurchasePrice: 22.4, currency: 'RMB', minPurchaseQty: 100, purchaseLeadTimeDays: 13, needInspection: false, status: '已停用', imageUrl: PMS_MATERIAL_IMAGES.ribKnit, totalPurchaseOrders: 6, totalPurchaseQty: 2400, totalPurchaseAmount: 53760, recentPurchaseOrderNo: 'CG-2026-0005', recentPurchaseDate: '2026-04-28', createdBy: '采购主管', createdAt: '2026-02-15 10:20:00', updatedAt: '2026-05-08 16:20:00', remark: '旧款罗纹停用，改由供应商配套' },
  { materialCode: 'YAR-2026-0001', materialName: '32S 棉纱', materialCategory: '纱线', specification: '32S', materialPurpose: '生产用', composition: '100%棉', color: '本白', baseUnit: '公斤', purchaseUnit: '公斤', conversionRate: '1包=25公斤', defaultSupplier: '宁波恒源纱线有限公司', referencePurchasePrice: 21.2, currency: 'USD', minPurchaseQty: 200, purchaseLeadTimeDays: 18, needInspection: true, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.yarnCone, totalPurchaseOrders: 22, totalPurchaseQty: 12500, totalPurchaseAmount: 265000, recentPurchaseOrderNo: 'CG-2026-0003', recentPurchaseDate: '2026-05-22', createdBy: '商品中心同步任务', createdAt: '2026-01-11 09:20:00', updatedAt: '2026-05-22 16:30:00', remark: '' },
  { materialCode: 'ACC-2026-0001', materialName: 'YKK 5号尼龙拉链', materialCategory: '辅料', specification: '5号 / 60cm', materialPurpose: '生产用', color: '黑色', baseUnit: '个', purchaseUnit: '个', conversionRate: '1箱=500个', defaultSupplier: '东莞宏远辅料有限公司', referencePurchasePrice: 1.2, currency: 'RMB', minPurchaseQty: 10000, purchaseLeadTimeDays: 10, needInspection: true, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.zipper, totalPurchaseOrders: 39, totalPurchaseQty: 350000, totalPurchaseAmount: 420000, recentPurchaseOrderNo: 'CG-2026-0002', recentPurchaseDate: '2026-05-23', createdBy: '商品中心同步任务', createdAt: '2026-01-11 11:00:00', updatedAt: '2026-05-23 15:00:00', remark: '' },
  { materialCode: 'ACC-2026-0002', materialName: '黑色四眼纽扣', materialCategory: '辅料', specification: '12mm', materialPurpose: '生产用', color: '黑色', baseUnit: '个', purchaseUnit: '个', conversionRate: '1盒=1000个', defaultSupplier: '东莞宏远辅料有限公司', referencePurchasePrice: 0.18, currency: 'RMB', minPurchaseQty: 50000, purchaseLeadTimeDays: 8, needInspection: true, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.button, totalPurchaseOrders: 27, totalPurchaseQty: 580000, totalPurchaseAmount: 104400, recentPurchaseOrderNo: 'CG-2026-0009', recentPurchaseDate: '2026-05-24', createdBy: '商品中心同步任务', createdAt: '2026-01-12 14:00:00', updatedAt: '2026-05-24 10:20:00', remark: '' },
  { materialCode: 'ACC-2026-0003', materialName: '白色织唛', materialCategory: '辅料', specification: '3x5cm', materialPurpose: '包装用', color: '白色', colorCode: 'W01', baseUnit: '个', purchaseUnit: '个', conversionRate: '1包=200个', defaultSupplier: '东莞宏远辅料有限公司', referencePurchasePrice: 0.23, currency: 'RMB', minPurchaseQty: 10000, purchaseLeadTimeDays: 9, needInspection: false, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.label, totalPurchaseOrders: 2, totalPurchaseQty: 20000, totalPurchaseAmount: 4600, recentPurchaseOrderNo: 'CG-2026-0013', recentPurchaseDate: '2026-05-26', createdBy: '商品中心同步任务', createdAt: '2026-03-05 12:10:00', updatedAt: '2026-05-26 09:00:00', remark: '待确认新工艺' },
  { materialCode: 'ACC-2026-0004', materialName: '涤纶缝纫线', materialCategory: '辅料', specification: '40S/2', materialPurpose: '生产用', color: '白色', colorCode: 'W01', baseUnit: '卷', purchaseUnit: '卷', conversionRate: '1箱=120卷', defaultSupplier: '泉州瑞达服装辅料有限公司', referencePurchasePrice: 13, currency: 'RMB', minPurchaseQty: 60, purchaseLeadTimeDays: 9, needInspection: false, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.stitchingYarn, totalPurchaseOrders: 14, totalPurchaseQty: 7500, totalPurchaseAmount: 97500, recentPurchaseOrderNo: 'CG-2026-0015', recentPurchaseDate: '2026-05-17', createdBy: '商品中心同步任务', createdAt: '2026-02-10 15:00:00', updatedAt: '2026-05-17 10:10:00', remark: '' },
  { materialCode: 'ACC-2026-0005', materialName: '2.5cm 弹力松紧带', materialCategory: '辅料', specification: '2.5cm', materialPurpose: '生产用', color: '黑色', baseUnit: '米', purchaseUnit: '卷', conversionRate: '1卷=50米', defaultSupplier: '东莞宏远辅料有限公司', referencePurchasePrice: 0.85, currency: 'RMB', minPurchaseQty: 500, purchaseLeadTimeDays: 9, needInspection: true, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.elasticBand, totalPurchaseOrders: 9, totalPurchaseQty: 12600, totalPurchaseAmount: 10710, recentPurchaseOrderNo: 'CG-2026-0017', recentPurchaseDate: '2026-05-27', createdBy: '商品中心同步任务', createdAt: '2026-02-18 11:00:00', updatedAt: '2026-05-27 15:00:00', remark: '裤腰与卫衣帽口使用' },
  { materialCode: 'PKG-2026-0002', materialName: '40×60cm 透明胶袋', materialCategory: '包材', specification: '40x60cm', materialPurpose: '包装用', color: '透明', baseUnit: '个', purchaseUnit: '个', conversionRate: '1包=50个', defaultSupplier: '深圳优品包材有限公司', referencePurchasePrice: 0.3, currency: 'RMB', minPurchaseQty: 5000, purchaseLeadTimeDays: 7, needInspection: false, status: '已启用', imageUrl: PMS_MATERIAL_IMAGES.polyBag, totalPurchaseOrders: 16, totalPurchaseQty: 180000, totalPurchaseAmount: 54000, recentPurchaseOrderNo: 'CG-2026-0014', recentPurchaseDate: '2026-05-19', createdBy: '商品中心同步任务', createdAt: '2026-01-14 09:30:00', updatedAt: '2026-05-19 10:00:00', remark: '' },
  { materialCode: 'SAM-2026-0001', materialName: '男款圆领T恤样衣', materialCategory: '样衣', specification: 'L', materialPurpose: '样衣开发', color: '白色', colorCode: 'W01', styleNo: 'TS-SAMPLE-01', size: 'L', baseUnit: '件', purchaseUnit: '件', defaultSupplier: '杭州样衣开发中心', referencePurchasePrice: 260, currency: 'RMB', purchaseLeadTimeDays: 20, needInspection: true, status: '已启用', imageUrl: PMS_STYLE_IMAGES.tshirt, totalPurchaseOrders: 9, totalPurchaseQty: 560, totalPurchaseAmount: 145600, recentPurchaseOrderNo: 'CG-2026-0010', recentPurchaseDate: '2026-05-26', createdBy: '采购员', createdAt: '2026-01-16 13:20:00', updatedAt: '2026-05-26 18:10:00', remark: '' },
  { materialCode: 'GAR-2026-0001', materialName: '女款休闲裤成衣', materialCategory: '成衣', specification: 'M', materialPurpose: '成衣采购', color: '藏青', colorCode: 'NV01', styleNo: 'PT-GAR-02', size: 'M', baseUnit: '件', purchaseUnit: '件', defaultSupplier: '佛山成衣加工厂', referencePurchasePrice: 120, currency: 'RMB', purchaseLeadTimeDays: 25, needInspection: true, status: '已启用', imageUrl: PMS_STYLE_IMAGES.pants, totalPurchaseOrders: 13, totalPurchaseQty: 8200, totalPurchaseAmount: 984000, recentPurchaseOrderNo: 'CG-2026-0006', recentPurchaseDate: '2026-05-25', createdBy: '采购员', createdAt: '2026-01-17 09:30:00', updatedAt: '2026-05-25 13:30:00', remark: '' },
]

export const pmsMaterials: PmsMaterial[] = seeds.map((seed, index) => ({
  ...seed,
  inventoryUnit: seed.baseUnit,
  colorSizeManagement: seed.materialCategory === '成衣' || seed.materialCategory === '样衣',
  defaultPurchaseRegion: index % 4 === 0 ? '印尼' : '国内',
  updatedBy: index % 3 === 0 ? '王采购' : '商品中心同步任务',
  declarationInfo:
    index % 3 === 2
      ? undefined
      : {
          chineseClearanceName: seed.materialName,
          englishClearanceName: `${seed.materialCategory} material`,
          materialEnglish: seed.composition || seed.materialCategory,
          usageEnglish: seed.materialPurpose || 'production',
          weavingMethod: seed.materialCategory === '面料' ? 'knitted' : '',
          brandType: index % 3 === 0 ? '自有品牌' : index % 4 === 1 ? '授权品牌' : '无品牌',
          brandName: index % 2 === 0 ? 'HiGood' : '',
          brandEnglishName: index % 2 === 0 ? 'HiGood Apparel' : '',
          productMaterial: seed.composition || seed.materialCategory,
          productUsage: seed.materialPurpose,
          productModel: seed.specification,
          otherDeclarationElements: seed.materialCategory === '面料' || seed.materialCategory === '纱线' ? '成分含量、织造方式' : '品牌类型、出口享惠情况',
          specialAttributes: seed.materialCategory === '面料' || seed.materialCategory === '纱线' ? ['普货', '纺织品'] : ['普货'],
        },
  customsInfo:
    index % 4 === 3
      ? undefined
      : {
          chineseCustomsName: seed.materialName,
          englishCustomsName: `${seed.materialCategory} material`,
          originCountryOrRegion: '中国 / CN',
          domesticSourcePlace: index % 2 === 0 ? '广东广州' : '浙江绍兴',
          taxExemptionType: '照章征税',
          customsMaterial: seed.composition || seed.materialCategory,
          customsUsage: seed.materialPurpose,
          customsSpecificationModel: seed.specification,
          needCustomsDeclaration: index % 6 !== 5,
          legalSecondUnit: seed.materialCategory === '面料' || seed.materialCategory === '纱线' ? '千克' : '',
          legalSecondUnitValue: seed.materialCategory === '面料' ? 210 : seed.materialCategory === '纱线' ? 25 : 0,
          otherDeclarationElements: '品牌类型、出口享惠情况',
          transactionUnit: seed.purchaseUnit,
        },
  systemInfo: {
    dataSource: '商品中心同步',
    sourceSystem: 'PCS' as const,
    sourceProductCode: `PCS-MAT-2026-${String(index + 1).padStart(4, '0')}`,
    syncedAt: `2026-06-${String(12 - (index % 5)).padStart(2, '0')} 10:30:00`,
    createdBy: seed.createdBy,
    createdAt: seed.createdAt,
    updatedBy: index % 3 === 0 ? '王采购' : '商品中心同步任务',
    updatedAt: seed.updatedAt,
  },
}))

export function listPmsMaterials(): PmsMaterial[] {
  return pmsMaterials
}

export function getPmsMaterial(materialCode: string): PmsMaterial | undefined {
  return pmsMaterials.find((material) => material.materialCode === materialCode)
}

export function updatePmsMaterialProcurementInfo(
  materialCode: string,
  patch: {
    defaultSupplier?: string
    defaultPurchaseRegion?: PmsPurchaseRegion
    referencePurchasePrice?: number
    currency?: 'RMB' | 'USD' | 'IDR'
    purchaseLeadTimeDays?: number
    minPurchaseQty?: number
    inventoryUnit?: string
    conversionRate?: string
    needInspection?: boolean
    remark?: string
  },
  actor: { id: string; name: string; role: '采购员' | '采购主管' | '财务' | '系统' },
): PmsMaterial {
  const material = getPmsMaterial(materialCode)
  if (!material) throw new PmsDomainError('MATERIAL_NOT_FOUND', `物料 ${materialCode} 不存在`)
  const beforeValue = `供应商 ${material.defaultSupplier} · 参考价 ${material.referencePurchasePrice} · 提前期 ${material.purchaseLeadTimeDays} 天 · 库存单位 ${material.inventoryUnit} · 需质检 ${material.needInspection ? '是' : '否'}`
  if (patch.defaultSupplier !== undefined) {
    if (!patch.defaultSupplier.trim()) throw new PmsDomainError('MATERIAL_SUPPLIER_REQUIRED', '默认供应商不能为空')
    material.defaultSupplier = patch.defaultSupplier.trim()
  }
  if (patch.defaultPurchaseRegion !== undefined) {
    if (!PMS_MATERIAL_PURCHASE_REGIONS.includes(patch.defaultPurchaseRegion)) throw new PmsDomainError('MATERIAL_REGION_INVALID', `采购区域必须是 ${PMS_MATERIAL_PURCHASE_REGIONS.join(' / ')} 之一`)
    material.defaultPurchaseRegion = patch.defaultPurchaseRegion
  }
  if (patch.referencePurchasePrice !== undefined) {
    if (!Number.isFinite(patch.referencePurchasePrice) || patch.referencePurchasePrice < 0) throw new PmsDomainError('MATERIAL_PRICE_INVALID', '参考采购价不能为负数')
    material.referencePurchasePrice = patch.referencePurchasePrice
  }
  if (patch.currency !== undefined) {
    if (!PMS_MATERIAL_CURRENCIES.includes(patch.currency)) throw new PmsDomainError('MATERIAL_CURRENCY_INVALID', `币种必须是 ${PMS_MATERIAL_CURRENCIES.join(' / ')} 之一`)
    material.currency = patch.currency
  }
  if (patch.purchaseLeadTimeDays !== undefined) {
    if (!Number.isInteger(patch.purchaseLeadTimeDays) || patch.purchaseLeadTimeDays <= 0) throw new PmsDomainError('MATERIAL_LEAD_TIME_INVALID', '采购提前期必须是大于 0 的天数')
    material.purchaseLeadTimeDays = patch.purchaseLeadTimeDays
  }
  if (patch.minPurchaseQty !== undefined) {
    if (!Number.isFinite(patch.minPurchaseQty) || patch.minPurchaseQty < 0) throw new PmsDomainError('MATERIAL_MIN_QTY_INVALID', '最小起订量不能为负数')
    material.minPurchaseQty = patch.minPurchaseQty
  }
  if (patch.inventoryUnit !== undefined) {
    if (!patch.inventoryUnit.trim()) throw new PmsDomainError('MATERIAL_INVENTORY_UNIT_REQUIRED', '库存单位不能为空')
    material.inventoryUnit = patch.inventoryUnit.trim()
  }
  if (patch.conversionRate !== undefined) material.conversionRate = patch.conversionRate.trim()
  if (patch.needInspection !== undefined) material.needInspection = patch.needInspection
  if (patch.remark !== undefined) material.remark = patch.remark.trim()
  material.updatedAt = new Date().toISOString()
  material.updatedBy = actor.name
  appendPmsLog({
    objectType: 'material',
    objectId: materialCode,
    action: '补充采购、质检与单位信息',
    beforeValue,
    afterValue: `供应商 ${material.defaultSupplier} · 参考价 ${material.referencePurchasePrice} · 提前期 ${material.purchaseLeadTimeDays} 天 · 库存单位 ${material.inventoryUnit} · 需质检 ${material.needInspection ? '是' : '否'}`,
    reason: patch.remark ?? '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return material
}

function defaultDeclarationInfo(material: PmsMaterial): PmsMaterialDeclarationInfo {
  return {
    chineseClearanceName: material.materialName,
    englishClearanceName: `${material.materialCategory} material`,
    materialEnglish: material.composition || material.materialCategory,
    usageEnglish: material.materialPurpose,
    weavingMethod: '',
    brandType: '无品牌',
    brandName: '',
    brandEnglishName: '',
    productMaterial: material.composition || material.materialCategory,
    productUsage: material.materialPurpose,
    productModel: material.specification,
    otherDeclarationElements: '',
    specialAttributes: ['普货'],
  }
}

function defaultCustomsInfo(material: PmsMaterial): PmsMaterialCustomsInfo {
  return {
    chineseCustomsName: material.materialName,
    englishCustomsName: `${material.materialCategory} material`,
    originCountryOrRegion: '中国 / CN',
    domesticSourcePlace: '',
    taxExemptionType: '照章征税',
    customsMaterial: material.composition || material.materialCategory,
    customsUsage: material.materialPurpose,
    customsSpecificationModel: material.specification,
    needCustomsDeclaration: true,
    legalSecondUnit: '',
    legalSecondUnitValue: 0,
    otherDeclarationElements: '',
    transactionUnit: material.purchaseUnit,
  }
}

export interface PmsMaterialCompliancePatch {
  declaration?: Partial<PmsMaterialDeclarationInfo>
  customs?: Partial<PmsMaterialCustomsInfo>
}

export function updatePmsMaterialComplianceInfo(
  materialCode: string,
  patch: PmsMaterialCompliancePatch,
  actor: { id: string; name: string; role: '采购员' | '采购主管' | '财务' | '系统' },
): PmsMaterial {
  const material = getPmsMaterial(materialCode)
  if (!material) throw new PmsDomainError('MATERIAL_NOT_FOUND', `物料 ${materialCode} 不存在`)
  const beforeValue = `申报 ${material.declarationInfo?.chineseClearanceName ?? '待补'} · 报关 ${material.customsInfo ? (material.customsInfo.needCustomsDeclaration ? '报关' : '不报关') : '待补'}`
  if (patch.declaration) {
    const base = material.declarationInfo ?? defaultDeclarationInfo(material)
    const merged = { ...base, ...patch.declaration }
    if (!merged.chineseClearanceName.trim()) throw new PmsDomainError('MATERIAL_DECL_NAME_REQUIRED', '申报中文品名不能为空')
    if (!merged.englishClearanceName.trim()) throw new PmsDomainError('MATERIAL_DECL_EN_REQUIRED', '申报英文品名不能为空')
    const brandType = merged.brandType.trim()
    if (brandType && !(PMS_MATERIAL_BRAND_TYPES as readonly string[]).includes(brandType)) {
      throw new PmsDomainError('MATERIAL_BRAND_TYPE_INVALID', `品牌类型必须是 ${PMS_MATERIAL_BRAND_TYPES.join(' / ')} 之一`)
    }
    const specialAttributes = Array.from(new Set(merged.specialAttributes.map((item) => item.trim()).filter(Boolean)))
    const invalidAttribute = specialAttributes.find((item) => !(PMS_MATERIAL_SPECIAL_ATTRIBUTES as readonly string[]).includes(item))
    if (invalidAttribute) throw new PmsDomainError('MATERIAL_SPECIAL_ATTRIBUTE_INVALID', `申报特殊属性「${invalidAttribute}」不在允许范围`)
    material.declarationInfo = {
      ...merged,
      chineseClearanceName: merged.chineseClearanceName.trim(),
      englishClearanceName: merged.englishClearanceName.trim(),
      brandType,
      brandName: merged.brandName.trim(),
      brandEnglishName: merged.brandEnglishName.trim(),
      productMaterial: merged.productMaterial.trim() || base.productMaterial,
      productUsage: merged.productUsage.trim() || base.productUsage,
      weavingMethod: merged.weavingMethod.trim(),
      productModel: merged.productModel.trim(),
      otherDeclarationElements: merged.otherDeclarationElements.trim(),
      specialAttributes,
    }
  }
  if (patch.customs) {
    const base = material.customsInfo ?? defaultCustomsInfo(material)
    const merged = { ...base, ...patch.customs }
    const legalSecondUnit = merged.legalSecondUnit.trim()
    if (!Number.isFinite(merged.legalSecondUnitValue) || merged.legalSecondUnitValue < 0) {
      throw new PmsDomainError('MATERIAL_SECOND_UNIT_VALUE_INVALID', '法定第二计量单位数值不能为负数')
    }
    if (legalSecondUnit && merged.legalSecondUnitValue <= 0) {
      throw new PmsDomainError('MATERIAL_SECOND_UNIT_VALUE_INVALID', '填写法定第二计量单位后，数值必须是正数')
    }
    if (!legalSecondUnit && merged.legalSecondUnitValue > 0) {
      throw new PmsDomainError('MATERIAL_SECOND_UNIT_REQUIRED', '填写法定第二计量单位数值时必须填写法定第二计量单位')
    }
    if (merged.needCustomsDeclaration) {
      if (!merged.chineseCustomsName.trim()) throw new PmsDomainError('MATERIAL_CUSTOMS_NAME_REQUIRED', '报关中文品名不能为空')
      if (!merged.englishCustomsName.trim()) throw new PmsDomainError('MATERIAL_CUSTOMS_EN_REQUIRED', '报关英文品名不能为空')
      if (!merged.transactionUnit.trim()) throw new PmsDomainError('MATERIAL_CUSTOMS_UNIT_REQUIRED', '成交单位不能为空')
    }
    material.customsInfo = {
      ...merged,
      chineseCustomsName: merged.chineseCustomsName.trim(),
      englishCustomsName: merged.englishCustomsName.trim(),
      originCountryOrRegion: merged.originCountryOrRegion.trim() || base.originCountryOrRegion,
      domesticSourcePlace: merged.domesticSourcePlace.trim(),
      taxExemptionType: merged.taxExemptionType.trim() || base.taxExemptionType,
      customsMaterial: merged.customsMaterial.trim() || base.customsMaterial,
      customsUsage: merged.customsUsage.trim() || base.customsUsage,
      customsSpecificationModel: merged.customsSpecificationModel.trim() || base.customsSpecificationModel,
      legalSecondUnit,
      otherDeclarationElements: merged.otherDeclarationElements.trim(),
      transactionUnit: merged.transactionUnit.trim(),
    }
  }
  material.updatedAt = new Date().toISOString()
  material.updatedBy = actor.name
  appendPmsLog({
    objectType: 'material',
    objectId: materialCode,
    action: '补充申报与报关信息',
    beforeValue,
    afterValue: `申报 ${material.declarationInfo?.chineseClearanceName ?? '待补'} · 品牌 ${material.declarationInfo?.brandType ?? '—'} · 报关 ${material.customsInfo ? (material.customsInfo.needCustomsDeclaration ? '报关' : '不报关') : '待补'}`,
    reason: '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return material
}
