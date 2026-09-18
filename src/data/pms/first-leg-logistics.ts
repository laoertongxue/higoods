import {
  applyPmsLogisticsHeadAllocation,
  getPmsMaterialLogisticsRecord,
  listPmsMaterialLogisticsRecords,
  signPmsMaterialLogisticsByBatch,
  type PmsMaterialLogisticsRecord,
} from './material-purchase-orders.ts'
import { appendPmsLog, nextPmsSequence, PmsDomainError, roundPmsQty, type PmsActorRole } from './runtime.ts'

export type PmsFirstLegTransportMethod = '海卡' | '海派' | '空卡' | '空派' | '铁路' | '快递' | '卡航'
export type PmsFirstLegBillingMethod = '计费重' | '实重' | '体积' | '整柜'
export type PmsFirstLegBatchStatus = '待起运' | '已装柜' | '头程中' | '已到仓' | '已完成'
export type PmsFirstLegStatus = '启用' | '停用'
export type PmsFirstLegCurrency = 'RMB' | 'USD' | 'IDR'
export type PmsFirstLegCargoType = '空运' | '海运' | '陆运' | '快递'
export type PmsFirstLegSourceRegion = '中国' | '印尼' | '美国' | '其他'
export type PmsFirstLegInboundStatus = '待交货' | '已交货' | '已发货' | '已入库'

const PMS_SUPPORTED_TRANSPORT_METHODS: PmsFirstLegTransportMethod[] = ['海卡', '海派', '空卡', '空派', '铁路', '快递', '卡航']

function normalizePmsOptionalNonNegative(value: number | undefined, label: string, code: string): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < 0) throw new PmsDomainError(code, `${label}必须是非负数字`)
  return value
}

function normalizePmsOptionalText(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value.trim()
}

function normalizePmsTransportMethods(methods: PmsFirstLegTransportMethod[] | undefined): PmsFirstLegTransportMethod[] | undefined {
  if (methods === undefined) return undefined
  methods.forEach((method) => {
    if (!PMS_SUPPORTED_TRANSPORT_METHODS.includes(method)) throw new PmsDomainError('CARRIER_TRANSPORT_METHOD_INVALID', `运输方式 ${method} 不在可选范围`)
  })
  return [...methods]
}

function normalizePmsDestinations(destinations: string[] | undefined): string[] | undefined {
  if (destinations === undefined) return undefined
  return [...new Set(destinations.map((item) => item.trim()).filter(Boolean))]
}

export interface PmsFirstLegFeeBreakdown {
  logisticsFeeRmb: number
  logisticsFeeUsd: number
  incomeTaxIdr: number
  vatIdr: number
  customsDutyIdr: number
  penaltyIdr: number
  clearanceFeeIdr: number
}

export const PMS_FIRST_LEG_FEE_FIELDS: Array<{ key: keyof PmsFirstLegFeeBreakdown; label: string; currency: PmsFirstLegCurrency }> = [
  { key: 'logisticsFeeRmb', label: '物流费', currency: 'RMB' },
  { key: 'logisticsFeeUsd', label: '物流费', currency: 'USD' },
  { key: 'incomeTaxIdr', label: '所得税', currency: 'IDR' },
  { key: 'vatIdr', label: '增值税', currency: 'IDR' },
  { key: 'customsDutyIdr', label: '关税', currency: 'IDR' },
  { key: 'penaltyIdr', label: '罚款', currency: 'IDR' },
  { key: 'clearanceFeeIdr', label: '清关费', currency: 'IDR' },
]

function emptyPmsFirstLegFees(): PmsFirstLegFeeBreakdown {
  return { logisticsFeeRmb: 0, logisticsFeeUsd: 0, incomeTaxIdr: 0, vatIdr: 0, customsDutyIdr: 0, penaltyIdr: 0, clearanceFeeIdr: 0 }
}

export function pmsFirstLegFeeSubtotal(fees: PmsFirstLegFeeBreakdown, currency: PmsFirstLegCurrency): number {
  return roundPmsQty(
    PMS_FIRST_LEG_FEE_FIELDS.filter((field) => field.currency === currency).reduce((sum, field) => sum + fees[field.key], 0),
    2,
  )
}

function normalizePmsFirstLegFees(input: Partial<PmsFirstLegFeeBreakdown> | undefined): PmsFirstLegFeeBreakdown {
  const fees = emptyPmsFirstLegFees()
  if (!input) return fees
  PMS_FIRST_LEG_FEE_FIELDS.forEach((field) => {
    const value = input[field.key]
    if (value === undefined) return
    if (!Number.isFinite(value) || value < 0) throw new PmsDomainError('BATCH_FEE_ITEM_INVALID', `${field.label}（${field.currency}）必须是非负数字`)
    fees[field.key] = roundPmsQty(value, 2)
  })
  return fees
}

interface PmsFirstLegExtraInput {
  cargoType?: PmsFirstLegCargoType
  sourceRegion?: PmsFirstLegSourceRegion
  inboundStatus?: PmsFirstLegInboundStatus
  estimatedArrivalAt?: string
}

function normalizePmsFirstLegExtra(input: PmsFirstLegExtraInput): { cargoType: PmsFirstLegCargoType; sourceRegion: PmsFirstLegSourceRegion; inboundStatus: PmsFirstLegInboundStatus; estimatedArrivalAt: string } {
  const estimatedArrivalAt = (input.estimatedArrivalAt ?? '').trim()
  if (estimatedArrivalAt && !/^\d{4}-\d{2}-\d{2}$/.test(estimatedArrivalAt)) throw new PmsDomainError('BATCH_ARRIVAL_DATE_INVALID', '预计送达万隆时间格式应为 YYYY-MM-DD')
  return {
    cargoType: input.cargoType ?? '海运',
    sourceRegion: input.sourceRegion ?? '中国',
    inboundStatus: input.inboundStatus ?? '待交货',
    estimatedArrivalAt,
  }
}

export interface PmsContainerPrice {
  containerType: '20GP' | '40GP' | '40HQ' | '45HQ'
  weightLimit: number
  volumeLimit: number
  price: number
  currency: PmsFirstLegCurrency
}

export interface PmsFirstLegCarrier {
  carrierCode: string
  carrierName: string
  shortName: string
  countryOrRegion: '中国' | '印尼' | '美国' | '其他'
  city: string
  level: 'A级' | 'B级' | 'C级'
  contactName: string
  contactPhone: string
  email?: string
  wechat?: string
  address?: string
  settlementCurrency: PmsFirstLegCurrency
  paymentMethod: '月结' | '票结' | '预付' | '到付'
  accountPeriodDays?: number
  invoiceInfo?: string
  bankAccount?: string
  payeeName?: string
  supportedTransportMethods?: PmsFirstLegTransportMethod[]
  supportedDestinations?: string[]
  supportTaxDeclaration?: boolean
  supportCustomsClearance?: boolean
  supportDelivery?: boolean
  status: PmsFirstLegStatus
  remark: string
  createdAt: string
  updatedAt: string
}

export interface PmsFirstLegChannel {
  channelCode: string
  carrierId: string
  carrierName: string
  channelName: string
  transportMethod: PmsFirstLegTransportMethod
  estimatedTransitDays: number
  minTransitDays?: number
  maxTransitDays?: number
  cutoffTime?: string
  departureFrequency?: string
  billingMethod: PmsFirstLegBillingMethod
  chargeWeightFactor?: number
  volumeDivisor?: number
  minChargeWeight?: number
  firstWeightPrice?: number
  additionalWeightPrice?: number
  unitPrice: number
  currency: PmsFirstLegCurrency
  includeTax?: boolean
  includeCustomsClearance?: boolean
  includeDelivery?: boolean
  taxRemark?: string
  taxMethod: '报税' | '不报税'
  containerPrices: PmsContainerPrice[]
  originPlace: string
  destinationCountry?: string
  destinationWarehouse: string
  applicableArea?: string
  transferCenter?: string
  supportBattery?: boolean
  supportLiquid?: boolean
  supportSensitiveGoods?: boolean
  supportNormalGoods?: boolean
  maxBoxWeight?: number
  maxBoxVolume?: number
  status: PmsFirstLegStatus
  remark: string
  updatedAt: string
}

export interface PmsFirstLegBatchRecord {
  recordNo: string
  trackingNo: string
  purchaseOrderNo: string
  materialCode: string
  materialName: string
  styleName: string
  unit: string
  qty: number
  rolls: number
  boxCount: number
}

export interface PmsFirstLegBatch {
  batchNo: string
  batchName: string
  transferCenter: string
  destinationWarehouse: string
  carrierId: string
  carrierName: string
  channelId: string
  channelName: string
  transportMethod: PmsFirstLegTransportMethod
  estimatedTransitDays: number
  billingMethod: PmsFirstLegBillingMethod
  taxMethod: '报税' | '不报税'
  feeCurrency: PmsFirstLegCurrency
  status: PmsFirstLegBatchStatus
  creator: string
  createdAt: string
  plannedShipDate: string
  containerLoadedAt: string
  actualShipDate: string
  arrivedAt: string
  completedAt: string
  fee: number
  remark: string
  billOfLadingNo: string
  billOfLadingRemark: string
  shippingLineName: string
  sourceRegion: PmsFirstLegSourceRegion
  warehouse: string
  cargoType: PmsFirstLegCargoType
  area: string
  logisticsCompany: string
  inboundStatus: PmsFirstLegInboundStatus
  estimatedArrivalAt: string
  fees: PmsFirstLegFeeBreakdown
  records: PmsFirstLegBatchRecord[]
  boxCount?: number
  totalWeightKg?: number
  totalVolumeM3?: number
  transitDays?: number
}

interface PmsFirstLegRuntime {
  carriers: PmsFirstLegCarrier[]
  channels: PmsFirstLegChannel[]
  batches: PmsFirstLegBatch[]
}

let runtime: PmsFirstLegRuntime | null = null
let carrierSequence = 0
let channelSequence = 0
let targetBatchNo = ''

const CONTAINER_TYPES: Array<PmsContainerPrice['containerType']> = ['20GP', '40GP', '40HQ', '45HQ']

function containerPrices(basePrice: number, currency: PmsFirstLegCurrency): PmsContainerPrice[] {
  return CONTAINER_TYPES.map((containerType, index) => ({
    containerType,
    weightLimit: [18000, 22000, 22000, 25000][index],
    volumeLimit: [28, 58, 68, 76][index],
    price: roundPmsQty(basePrice * [0.6, 0.9, 1, 1.15][index], 0),
    currency,
  }))
}

function buildInitialRuntime(): PmsFirstLegRuntime {
  const carriers: PmsFirstLegCarrier[] = [
    { carrierCode: 'FL-CN-001', carrierName: '深圳市迅达国际物流有限公司', shortName: '迅达物流', countryOrRegion: '中国', city: '深圳', level: 'A级', contactName: '林国强', contactPhone: '13800138001', email: 'lin.guoqiang@xunda-logistics.com', wechat: 'xunda-service', address: '深圳市宝安区福永街道物流园 A3 栋', settlementCurrency: 'RMB', paymentMethod: '月结', accountPeriodDays: 30, invoiceInfo: '增值税专用发票 6%', bankAccount: '中国银行深圳分行 6222 0200 1234 5678', payeeName: '深圳市迅达国际物流有限公司', supportedTransportMethods: ['海派', '空派', '快递'], supportedDestinations: ['印尼', '美国'], supportTaxDeclaration: true, supportCustomsClearance: true, supportDelivery: true, status: '启用', remark: '印尼专线主力货代', createdAt: '2026-01-08 09:00:00', updatedAt: '2026-05-20 10:00:00' },
    { carrierCode: 'FL-CN-002', carrierName: '广州市洋帆国际货运代理有限公司', shortName: '洋帆货运', countryOrRegion: '中国', city: '广州', level: 'A级', contactName: '陈丽华', contactPhone: '13800138002', email: 'chen.lihua@yangfan-freight.com', wechat: 'yangfan-chen', address: '广州市黄埔区港前路 88 号', settlementCurrency: 'RMB', paymentMethod: '票结', accountPeriodDays: 15, invoiceInfo: '增值税普通发票', bankAccount: '工商银行广州分行 6222 0800 8765 4321', payeeName: '广州市洋帆国际货运代理有限公司', supportedTransportMethods: ['海卡', '海派'], supportedDestinations: ['印尼'], supportTaxDeclaration: true, supportCustomsClearance: true, supportDelivery: false, status: '启用', remark: '海运整柜价格稳定', createdAt: '2026-01-08 09:10:00', updatedAt: '2026-05-18 14:00:00' },
    { carrierCode: 'FL-CN-003', carrierName: '义乌市陆港供应链管理有限公司', shortName: '陆港供应链', countryOrRegion: '中国', city: '义乌', level: 'B级', contactName: '周伟', contactPhone: '13800138003', email: 'zhouwei@luguang-supply.com', wechat: 'luguang-zhou', address: '义乌市北苑街道机场路 588 号', settlementCurrency: 'USD', paymentMethod: '预付', invoiceInfo: '增值税专用发票 9%', bankAccount: '建设银行义乌分行 6227 0011 2233 4455', payeeName: '义乌市陆港供应链管理有限公司', supportedTransportMethods: ['空卡', '卡航', '快递'], supportedDestinations: ['印尼', '美国'], supportTaxDeclaration: true, supportCustomsClearance: false, supportDelivery: true, status: '启用', remark: '空派时效快', createdAt: '2026-02-11 10:00:00', updatedAt: '2026-04-22 11:30:00' },
    { carrierCode: 'FL-ID-001', carrierName: 'PT. Nusantara Logistik Jaya', shortName: 'Nusantara', countryOrRegion: '印尼', city: '雅加达', level: 'A级', contactName: 'Andi', contactPhone: '081200010001', email: 'andi@nusantara-logistik.co.id', address: 'Jl. Raya Cakung Cilincing No. 8, Jakarta', settlementCurrency: 'IDR', paymentMethod: '月结', accountPeriodDays: 45, invoiceInfo: '印尼本地增值税发票', bankAccount: 'Bank Mandiri 1370008888999', payeeName: 'PT. Nusantara Logistik Jaya', supportedTransportMethods: ['快递', '海派'], supportedDestinations: ['印尼'], supportTaxDeclaration: false, supportCustomsClearance: true, supportDelivery: true, status: '启用', remark: '印尼清关与派送', createdAt: '2026-01-15 09:30:00', updatedAt: '2026-05-25 16:00:00' },
    { carrierCode: 'FL-CN-004', carrierName: '东莞市顺捷跨境物流有限公司', shortName: '顺捷跨境', countryOrRegion: '中国', city: '东莞', level: 'C级', contactName: '吴敏', contactPhone: '13800138004', email: 'wumin@shunjie-kuajing.com', wechat: 'shunjie-service', address: '东莞市南城街道宏图路 39 号', settlementCurrency: 'RMB', paymentMethod: '到付', accountPeriodDays: 7, invoiceInfo: '增值税普通发票', bankAccount: '农业银行东莞分行 6228 4800 5566 7788', payeeName: '东莞市顺捷跨境物流有限公司', supportedTransportMethods: ['海派'], supportedDestinations: ['印尼'], supportTaxDeclaration: false, supportCustomsClearance: true, supportDelivery: false, status: '停用', remark: '时效不稳定，停用观察', createdAt: '2026-03-02 09:00:00', updatedAt: '2026-05-08 09:00:00' },
  ]
  const channels: PmsFirstLegChannel[] = [
    { channelCode: 'CH-CN-0001', carrierId: 'FL-CN-001', carrierName: '深圳市迅达国际物流有限公司', channelName: '深圳-雅加达 海派专线', transportMethod: '海派', estimatedTransitDays: 12, minTransitDays: 10, maxTransitDays: 14, cutoffTime: '18:00', departureFrequency: '每周二/四/六装柜', billingMethod: '计费重', chargeWeightFactor: 1, volumeDivisor: 6000, minChargeWeight: 21, unitPrice: 9.8, currency: 'RMB', taxMethod: '报税', includeTax: true, includeCustomsClearance: true, includeDelivery: true, taxRemark: '双清包税到仓', containerPrices: [], originPlace: '深圳', destinationCountry: '印尼', destinationWarehouse: '印尼雅加达面辅料仓', applicableArea: '雅加达', transferCenter: '深圳转运中心', supportBattery: false, supportLiquid: false, supportSensitiveGoods: false, supportNormalGoods: true, maxBoxWeight: 30, maxBoxVolume: 0.5, status: '启用', remark: '', updatedAt: '2026-05-20 10:00:00' },
    { channelCode: 'CH-CN-0002', carrierId: 'FL-CN-001', carrierName: '深圳市迅达国际物流有限公司', channelName: '深圳-雅加达 空派专线', transportMethod: '空派', estimatedTransitDays: 5, minTransitDays: 4, maxTransitDays: 7, cutoffTime: '20:00', departureFrequency: '每日发运', billingMethod: '实重', minChargeWeight: 21, firstWeightPrice: 35, additionalWeightPrice: 8, unitPrice: 28, currency: 'RMB', taxMethod: '报税', includeTax: true, includeCustomsClearance: true, includeDelivery: true, containerPrices: [], originPlace: '深圳', destinationCountry: '印尼', destinationWarehouse: '印尼雅加达面辅料仓', applicableArea: '雅加达', transferCenter: '深圳转运中心', supportBattery: false, supportLiquid: false, supportSensitiveGoods: false, supportNormalGoods: true, maxBoxWeight: 30, maxBoxVolume: 0.5, status: '启用', remark: '急单使用', updatedAt: '2026-05-20 10:05:00' },
    { channelCode: 'CH-CN-0003', carrierId: 'FL-CN-002', carrierName: '广州市洋帆国际货运代理有限公司', channelName: '广州-雅加达 海运整柜', transportMethod: '海卡', estimatedTransitDays: 15, minTransitDays: 13, maxTransitDays: 18, cutoffTime: '16:00', departureFrequency: '每周一/四截关', billingMethod: '整柜', unitPrice: 0, currency: 'RMB', taxMethod: '不报税', includeTax: false, includeCustomsClearance: false, includeDelivery: true, taxRemark: '海运整柜运费不含关税与增值税', containerPrices: containerPrices(28000, 'RMB'), originPlace: '广州', destinationCountry: '印尼', destinationWarehouse: '印尼雅加达面辅料仓', applicableArea: '雅加达', transferCenter: '广州转运中心', supportNormalGoods: true, status: '启用', remark: '整柜按箱型计价', updatedAt: '2026-05-18 14:00:00' },
    { channelCode: 'CH-CN-0004', carrierId: 'FL-CN-002', carrierName: '广州市洋帆国际货运代理有限公司', channelName: '广州-泗水 海派专线', transportMethod: '海派', estimatedTransitDays: 14, minTransitDays: 12, maxTransitDays: 17, cutoffTime: '18:00', departureFrequency: '每周三/日装柜', billingMethod: '体积', volumeDivisor: 8000, unitPrice: 1020, currency: 'RMB', taxMethod: '报税', includeTax: true, includeCustomsClearance: true, includeDelivery: true, taxRemark: '含出口报关与印尼清关', containerPrices: [], originPlace: '广州', destinationCountry: '印尼', destinationWarehouse: '印尼泗水原料仓', applicableArea: '泗水', transferCenter: '广州转运中心', supportLiquid: true, supportNormalGoods: true, maxBoxWeight: 30, maxBoxVolume: 0.5, status: '启用', remark: '', updatedAt: '2026-05-18 14:10:00' },
    { channelCode: 'CH-CN-0005', carrierId: 'FL-CN-003', carrierName: '义乌市陆港供应链管理有限公司', channelName: '义乌-雅加达 空卡专线', transportMethod: '空卡', estimatedTransitDays: 6, minTransitDays: 5, maxTransitDays: 8, cutoffTime: '19:00', departureFrequency: '每日发运', billingMethod: '计费重', chargeWeightFactor: 1.2, volumeDivisor: 6000, minChargeWeight: 45, unitPrice: 32, currency: 'USD', taxMethod: '报税', includeTax: true, includeCustomsClearance: true, includeDelivery: false, taxRemark: '带电与敏感货需提前申报', containerPrices: [], originPlace: '义乌', destinationCountry: '印尼', destinationWarehouse: '印尼雅加达面辅料仓', applicableArea: '雅加达', transferCenter: '义乌转运中心', supportBattery: true, supportSensitiveGoods: true, supportNormalGoods: true, maxBoxWeight: 30, maxBoxVolume: 0.5, status: '启用', remark: '', updatedAt: '2026-04-22 11:30:00' },
    { channelCode: 'CH-CN-0006', carrierId: 'FL-CN-003', carrierName: '义乌市陆港供应链管理有限公司', channelName: '义乌-万隆 卡航专线', transportMethod: '卡航', estimatedTransitDays: 9, minTransitDays: 8, maxTransitDays: 11, cutoffTime: '17:00', departureFrequency: '每周二/五发车', billingMethod: '实重', minChargeWeight: 100, firstWeightPrice: 28, additionalWeightPrice: 6, unitPrice: 24, currency: 'USD', taxMethod: '报税', includeTax: false, includeCustomsClearance: true, includeDelivery: true, taxRemark: '报价不含印尼进口关税', containerPrices: [], originPlace: '义乌', destinationCountry: '印尼', destinationWarehouse: '印尼万隆原料仓', applicableArea: '万隆', transferCenter: '义乌转运中心', supportSensitiveGoods: true, supportNormalGoods: true, maxBoxWeight: 25, maxBoxVolume: 0.4, status: '停用', remark: '线路暂停收件', updatedAt: '2026-04-30 09:00:00' },
    { channelCode: 'CH-ID-0001', carrierId: 'FL-ID-001', carrierName: 'PT. Nusantara Logistik Jaya', channelName: '雅加达本地派送', transportMethod: '快递', estimatedTransitDays: 2, minTransitDays: 1, maxTransitDays: 3, cutoffTime: '15:00', departureFrequency: '每日派送', billingMethod: '实重', minChargeWeight: 1, firstWeightPrice: 15000, additionalWeightPrice: 5000, unitPrice: 15000, currency: 'IDR', taxMethod: '报税', includeTax: true, includeCustomsClearance: false, includeDelivery: true, containerPrices: [], originPlace: '雅加达', destinationCountry: '印尼', destinationWarehouse: '印尼雅加达面辅料仓', applicableArea: '雅加达', transferCenter: '雅加达转运中心', supportNormalGoods: true, maxBoxWeight: 20, maxBoxVolume: 0.2, status: '启用', remark: '', updatedAt: '2026-05-25 16:00:00' },
    { channelCode: 'CH-CN-0007', carrierId: 'FL-CN-004', carrierName: '东莞市顺捷跨境物流有限公司', channelName: '东莞-雅加达 海派专线', transportMethod: '海派', estimatedTransitDays: 18, minTransitDays: 15, maxTransitDays: 20, cutoffTime: '17:30', departureFrequency: '每周一/四装柜', billingMethod: '计费重', chargeWeightFactor: 1, volumeDivisor: 6000, minChargeWeight: 21, unitPrice: 8.6, currency: 'RMB', taxMethod: '报税', includeTax: true, includeCustomsClearance: false, includeDelivery: true, containerPrices: [], originPlace: '东莞', destinationCountry: '印尼', destinationWarehouse: '印尼雅加达面辅料仓', applicableArea: '雅加达', transferCenter: '东莞转运中心', supportNormalGoods: true, maxBoxWeight: 30, maxBoxVolume: 0.5, status: '停用', remark: '时效不稳定', updatedAt: '2026-05-08 09:00:00' },
  ]

  const batches: PmsFirstLegBatch[] = [
    {
      batchNo: 'FL-2026-0001', batchName: '深圳-雅加达 海派 6月第一批', transferCenter: '深圳转运中心', destinationWarehouse: '印尼雅加达面辅料仓',
      carrierId: 'FL-CN-001', carrierName: '深圳市迅达国际物流有限公司', channelId: 'CH-CN-0001', channelName: '深圳-雅加达 海派专线', transportMethod: '海派', estimatedTransitDays: 12, billingMethod: '计费重', taxMethod: '报税', feeCurrency: 'RMB',
      status: '待起运', creator: '王采购', createdAt: '2026-06-13T11:00:00+07:00', plannedShipDate: '2026-06-16', containerLoadedAt: '', actualShipDate: '', arrivedAt: '', completedAt: '', fee: 5280, remark: '等货代确认舱位',
      billOfLadingNo: 'SZX2606-0018', billOfLadingRemark: '等货代补发正本提单', shippingLineName: 'SITC 海丰国际', sourceRegion: '中国', warehouse: '深圳蛇口仓', cargoType: '海运', area: 'A区', logisticsCompany: '迅达物流', inboundStatus: '待交货', estimatedArrivalAt: '2026-06-28', fees: { logisticsFeeRmb: 4800, logisticsFeeUsd: 0, incomeTaxIdr: 0, vatIdr: 0, customsDutyIdr: 0, penaltyIdr: 0, clearanceFeeIdr: 0 },
      boxCount: 6, totalWeightKg: 1380, totalVolumeM3: 5.8, transitDays: 12,
      records: [],
    },
    {
      batchNo: 'FL-2026-0002', batchName: '广州-雅加达 整柜 6月柜', transferCenter: '广州转运中心', destinationWarehouse: '印尼雅加达面辅料仓',
      carrierId: 'FL-CN-002', carrierName: '广州市洋帆国际货运代理有限公司', channelId: 'CH-CN-0003', channelName: '广州-雅加达 海运整柜', transportMethod: '海卡', estimatedTransitDays: 15, billingMethod: '整柜', taxMethod: '不报税', feeCurrency: 'RMB',
      status: '已装柜', creator: '王采购', createdAt: '2026-06-10T09:20:00+07:00', plannedShipDate: '2026-06-12', containerLoadedAt: '2026-06-12T16:40:00+07:00', actualShipDate: '', arrivedAt: '', completedAt: '', fee: 28000, remark: '40HQ 一个整柜',
      billOfLadingNo: 'GZ2606-40HQ-01', billOfLadingRemark: '', shippingLineName: 'COSCO 中远海运', sourceRegion: '中国', warehouse: '广州南沙仓', cargoType: '海运', area: 'B区', logisticsCompany: '洋帆货运', inboundStatus: '已交货', estimatedArrivalAt: '2026-06-27', fees: { logisticsFeeRmb: 28000, logisticsFeeUsd: 0, incomeTaxIdr: 0, vatIdr: 0, customsDutyIdr: 0, penaltyIdr: 0, clearanceFeeIdr: 0 },
      boxCount: 8, totalWeightKg: 3800, totalVolumeM3: 32, transitDays: 15,
      records: [],
    },
    {
      batchNo: 'FL-2026-0003', batchName: '义乌-雅加达 空卡 6月急件', transferCenter: '义乌转运中心', destinationWarehouse: '印尼雅加达面辅料仓',
      carrierId: 'FL-CN-003', carrierName: '义乌市陆港供应链管理有限公司', channelId: 'CH-CN-0005', channelName: '义乌-雅加达 空卡专线', transportMethod: '空卡', estimatedTransitDays: 6, billingMethod: '计费重', taxMethod: '报税', feeCurrency: 'USD',
      status: '已到仓', creator: '刘采购', createdAt: '2026-06-04T08:30:00+07:00', plannedShipDate: '2026-06-05', containerLoadedAt: '2026-06-05T10:00:00+07:00', actualShipDate: '2026-06-05T20:00:00+07:00', arrivedAt: '2026-06-11T09:10:00+07:00', completedAt: '', fee: 860, remark: '',
      billOfLadingNo: 'YW-2606-AWB-07', billOfLadingRemark: '急件空运', shippingLineName: '中国国际货运航空', sourceRegion: '中国', warehouse: '义乌保税仓', cargoType: '空运', area: '急件区', logisticsCompany: '陆港供应链', inboundStatus: '已入库', estimatedArrivalAt: '2026-06-11', fees: { logisticsFeeRmb: 0, logisticsFeeUsd: 860, incomeTaxIdr: 0, vatIdr: 0, customsDutyIdr: 0, penaltyIdr: 0, clearanceFeeIdr: 0 },
      boxCount: 5, totalWeightKg: 260, totalVolumeM3: 1.8, transitDays: 6,
      records: [],
    },
  ]

  runtime = { carriers, channels, batches }
  const recordMap = new Map(listPmsMaterialLogisticsRecords().map((record) => [record.recordNo, record]))
  const join = (batchNo: string, allocations: Array<{ recordNo: string; qty: number; rolls: number }>) => {
    const batch = batches.find((item) => item.batchNo === batchNo)
    if (!batch) return
    allocations.forEach((allocation) => {
      const record = recordMap.get(allocation.recordNo)
      if (!record) return
      applyPmsLogisticsHeadAllocation(allocation.recordNo, allocation.qty, allocation.rolls, batchNo)
      batch.records.push(toBatchRecord(record, allocation.qty, allocation.rolls))
    })
  }
  join('FL-2026-0001', [{ recordNo: 'LOG-2026-0001', qty: 552, rolls: 6 }])
  join('FL-2026-0002', [{ recordNo: 'LOG-2026-0002', qty: 996, rolls: 0 }, { recordNo: 'LOG-2026-0005', qty: 5000, rolls: 0 }])
  join('FL-2026-0003', [{ recordNo: 'LOG-2026-0003', qty: 500, rolls: 5 }])
  signPmsMaterialLogisticsByBatch('FL-2026-0003', { id: 'USR-PMS-SYSTEM', name: '系统计算', role: '系统' })
  return runtime
}

function toBatchRecord(record: PmsMaterialLogisticsRecord, qty: number, rolls: number): PmsFirstLegBatchRecord {
  return {
    recordNo: record.recordNo,
    trackingNo: record.trackingNo,
    purchaseOrderNo: record.purchaseOrderNo,
    materialCode: record.materialCode,
    materialName: record.materialName,
    styleName: record.styleName,
    unit: record.unit,
    qty,
    rolls,
    boxCount: record.boxCount,
  }
}

function getRuntime(): PmsFirstLegRuntime {
  if (!runtime) {
    listPmsMaterialLogisticsRecords()
    runtime = buildInitialRuntime()
  }
  return runtime
}

export function listPmsFirstLegCarriers(): PmsFirstLegCarrier[] {
  return getRuntime().carriers
}

export function listPmsFirstLegChannels(): PmsFirstLegChannel[] {
  return getRuntime().channels
}

export function listPmsFirstLegBatches(): PmsFirstLegBatch[] {
  return getRuntime().batches
}

export function getPmsFirstLegBatch(batchNo: string): PmsFirstLegBatch | undefined {
  return getRuntime().batches.find((batch) => batch.batchNo === batchNo)
}

export interface PmsFirstLegBatchAggregate {
  boxCount: number | null
  totalWeightKg: number | null
  totalVolumeM3: number | null
  transitDays: number | null
}

export function pmsFirstLegTransitDays(batch: Pick<PmsFirstLegBatch, 'actualShipDate' | 'arrivedAt'>): number | null {
  if (!batch.actualShipDate || !batch.arrivedAt) return null
  const shippedAt = Date.parse(batch.actualShipDate)
  const arrivedAt = Date.parse(batch.arrivedAt)
  if (!Number.isFinite(shippedAt) || !Number.isFinite(arrivedAt) || arrivedAt < shippedAt) return null
  return Math.round((arrivedAt - shippedAt) / 86_400_000)
}

export function pmsFirstLegBatchAggregate(batch: PmsFirstLegBatch): PmsFirstLegBatchAggregate {
  const recordBoxCount = batch.records.reduce((sum, record) => sum + record.boxCount, 0)
  return {
    boxCount: batch.records.length > 0 ? recordBoxCount : batch.boxCount ?? null,
    totalWeightKg: batch.totalWeightKg ?? null,
    totalVolumeM3: batch.totalVolumeM3 ?? null,
    transitDays: pmsFirstLegTransitDays(batch),
  }
}

export function setPmsFirstLegTargetBatchNo(batchNo: string): void {
  targetBatchNo = batchNo
}

export function consumePmsFirstLegTargetBatchNo(): string {
  const value = targetBatchNo
  targetBatchNo = ''
  return value
}

export interface PmsJoinableLogisticsRow {
  record: PmsMaterialLogisticsRecord
  joinableQty: number
  joinableRolls: number
}

export function listPmsJoinableLogisticsRows(): PmsJoinableLogisticsRow[] {
  getRuntime()
  return listPmsMaterialLogisticsRecords()
    .filter((record) => record.domesticSigned && !record.headSigned && record.qty - record.headLogisticsQty > 0)
    .map((record) => ({ record, joinableQty: roundPmsQty(record.qty - record.headLogisticsQty, 2), joinableRolls: Math.max(0, record.rolls - record.headLogisticsRolls) }))
}

export function isPmsLogisticsJoinable(recordNo: string): boolean {
  getRuntime()
  const record = getPmsMaterialLogisticsRecord(recordNo)
  if (!record) return false
  return record.domesticSigned && !record.headSigned && record.qty - record.headLogisticsQty > 0
}

export interface PmsCreateCarrierInput {
  carrierCode?: string
  carrierName: string
  shortName: string
  countryOrRegion: '中国' | '印尼' | '美国' | '其他'
  city: string
  level: 'A级' | 'B级' | 'C级'
  contactName: string
  contactPhone: string
  email?: string
  wechat?: string
  address?: string
  settlementCurrency: PmsFirstLegCurrency
  paymentMethod: '月结' | '票结' | '预付' | '到付'
  accountPeriodDays?: number
  invoiceInfo?: string
  bankAccount?: string
  payeeName?: string
  supportedTransportMethods?: PmsFirstLegTransportMethod[]
  supportedDestinations?: string[]
  supportTaxDeclaration?: boolean
  supportCustomsClearance?: boolean
  supportDelivery?: boolean
  remark: string
}

function validateCarrierInput(input: PmsCreateCarrierInput): void {
  if (!input.carrierName.trim()) throw new PmsDomainError('CARRIER_NAME_REQUIRED', '物流商名称不能为空')
  if (!input.contactName.trim()) throw new PmsDomainError('CARRIER_CONTACT_REQUIRED', '联系人不能为空')
  if (!input.contactPhone.trim()) throw new PmsDomainError('CARRIER_PHONE_REQUIRED', '联系电话不能为空')
}

interface PmsFirstLegCarrierExtras {
  email: string
  wechat: string
  address: string
  accountPeriodDays?: number
  invoiceInfo: string
  bankAccount: string
  payeeName: string
  supportedTransportMethods: PmsFirstLegTransportMethod[]
  supportedDestinations: string[]
  supportTaxDeclaration?: boolean
  supportCustomsClearance?: boolean
  supportDelivery?: boolean
}

function normalizePmsCarrierExtras(input: PmsCreateCarrierInput): PmsFirstLegCarrierExtras {
  return {
    email: normalizePmsOptionalText(input.email) ?? '',
    wechat: normalizePmsOptionalText(input.wechat) ?? '',
    address: normalizePmsOptionalText(input.address) ?? '',
    accountPeriodDays: normalizePmsOptionalNonNegative(input.accountPeriodDays, '账期天数', 'CARRIER_ACCOUNT_PERIOD_INVALID'),
    invoiceInfo: normalizePmsOptionalText(input.invoiceInfo) ?? '',
    bankAccount: normalizePmsOptionalText(input.bankAccount) ?? '',
    payeeName: normalizePmsOptionalText(input.payeeName) ?? '',
    supportedTransportMethods: normalizePmsTransportMethods(input.supportedTransportMethods) ?? [],
    supportedDestinations: normalizePmsDestinations(input.supportedDestinations) ?? [],
    supportTaxDeclaration: input.supportTaxDeclaration,
    supportCustomsClearance: input.supportCustomsClearance,
    supportDelivery: input.supportDelivery,
  }
}

export function createPmsFirstLegCarrier(input: PmsCreateCarrierInput, actor: { id: string; name: string; role: PmsActorRole }): PmsFirstLegCarrier {
  validateCarrierInput(input)
  const extras = normalizePmsCarrierExtras(input)
  if (getRuntime().carriers.some((carrier) => carrier.carrierName === input.carrierName.trim())) {
    throw new PmsDomainError('CARRIER_NAME_DUPLICATE', '物流商名称已存在')
  }
  carrierSequence += 1
  const now = new Date().toISOString()
  const carrier: PmsFirstLegCarrier = {
    carrierCode: input.carrierCode?.trim() || `FL-2026-${String(carrierSequence).padStart(3, '0')}`,
    carrierName: input.carrierName.trim(),
    shortName: input.shortName.trim() || input.carrierName.trim(),
    countryOrRegion: input.countryOrRegion,
    city: input.city.trim(),
    level: input.level,
    contactName: input.contactName.trim(),
    contactPhone: input.contactPhone.trim(),
    ...extras,
    settlementCurrency: input.settlementCurrency,
    paymentMethod: input.paymentMethod,
    status: '启用',
    remark: input.remark.trim(),
    createdAt: now,
    updatedAt: now,
  }
  getRuntime().carriers.unshift(carrier)
  appendPmsLog({ objectType: 'first-leg-carrier', objectId: carrier.carrierCode, action: '创建', beforeValue: '', afterValue: carrier.carrierName, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return carrier
}

export function updatePmsFirstLegCarrier(carrierCode: string, patch: Partial<PmsCreateCarrierInput>, actor: { id: string; name: string; role: PmsActorRole }): PmsFirstLegCarrier {
  const carrier = getRuntime().carriers.find((item) => item.carrierCode === carrierCode)
  if (!carrier) throw new PmsDomainError('CARRIER_NOT_FOUND', `物流商 ${carrierCode} 不存在`)
  if (patch.carrierName !== undefined) {
    if (!patch.carrierName.trim()) throw new PmsDomainError('CARRIER_NAME_REQUIRED', '物流商名称不能为空')
    carrier.carrierName = patch.carrierName.trim()
  }
  if (patch.shortName !== undefined) carrier.shortName = patch.shortName.trim()
  if (patch.countryOrRegion !== undefined) carrier.countryOrRegion = patch.countryOrRegion
  if (patch.city !== undefined) carrier.city = patch.city.trim()
  if (patch.level !== undefined) carrier.level = patch.level
  if (patch.contactName !== undefined) carrier.contactName = patch.contactName.trim()
  if (patch.contactPhone !== undefined) carrier.contactPhone = patch.contactPhone.trim()
  if (patch.settlementCurrency !== undefined) carrier.settlementCurrency = patch.settlementCurrency
  if (patch.paymentMethod !== undefined) carrier.paymentMethod = patch.paymentMethod
  if (patch.email !== undefined) carrier.email = patch.email.trim()
  if (patch.wechat !== undefined) carrier.wechat = patch.wechat.trim()
  if (patch.address !== undefined) carrier.address = patch.address.trim()
  if (patch.accountPeriodDays !== undefined) carrier.accountPeriodDays = normalizePmsOptionalNonNegative(patch.accountPeriodDays, '账期天数', 'CARRIER_ACCOUNT_PERIOD_INVALID')
  if (patch.invoiceInfo !== undefined) carrier.invoiceInfo = patch.invoiceInfo.trim()
  if (patch.bankAccount !== undefined) carrier.bankAccount = patch.bankAccount.trim()
  if (patch.payeeName !== undefined) carrier.payeeName = patch.payeeName.trim()
  if (patch.supportedTransportMethods !== undefined) carrier.supportedTransportMethods = normalizePmsTransportMethods(patch.supportedTransportMethods) ?? []
  if (patch.supportedDestinations !== undefined) carrier.supportedDestinations = normalizePmsDestinations(patch.supportedDestinations) ?? []
  if (patch.supportTaxDeclaration !== undefined) carrier.supportTaxDeclaration = patch.supportTaxDeclaration
  if (patch.supportCustomsClearance !== undefined) carrier.supportCustomsClearance = patch.supportCustomsClearance
  if (patch.supportDelivery !== undefined) carrier.supportDelivery = patch.supportDelivery
  if (patch.remark !== undefined) carrier.remark = patch.remark.trim()
  carrier.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'first-leg-carrier', objectId: carrierCode, action: '编辑', beforeValue: '', afterValue: carrier.carrierName, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return carrier
}

export function togglePmsFirstLegCarrierStatus(carrierCode: string, actor: { id: string; name: string; role: PmsActorRole }): PmsFirstLegCarrier {
  const carrier = getRuntime().carriers.find((item) => item.carrierCode === carrierCode)
  if (!carrier) throw new PmsDomainError('CARRIER_NOT_FOUND', `物流商 ${carrierCode} 不存在`)
  const before = carrier.status
  carrier.status = before === '启用' ? '停用' : '启用'
  carrier.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'first-leg-carrier', objectId: carrierCode, action: '启停', beforeValue: before, afterValue: carrier.status, reason: '停用不影响历史头程单', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  return carrier
}

export interface PmsCreateChannelInput {
  channelCode?: string
  carrierId: string
  channelName: string
  transportMethod: PmsFirstLegTransportMethod
  estimatedTransitDays: number
  minTransitDays?: number
  maxTransitDays?: number
  cutoffTime?: string
  departureFrequency?: string
  billingMethod: PmsFirstLegBillingMethod
  chargeWeightFactor?: number
  volumeDivisor?: number
  minChargeWeight?: number
  firstWeightPrice?: number
  additionalWeightPrice?: number
  unitPrice: number
  currency: PmsFirstLegCurrency
  includeTax?: boolean
  includeCustomsClearance?: boolean
  includeDelivery?: boolean
  taxRemark?: string
  taxMethod: '报税' | '不报税'
  containerPrices?: PmsContainerPrice[]
  originPlace: string
  destinationCountry?: string
  destinationWarehouse: string
  applicableArea?: string
  transferCenter?: string
  supportBattery?: boolean
  supportLiquid?: boolean
  supportSensitiveGoods?: boolean
  supportNormalGoods?: boolean
  maxBoxWeight?: number
  maxBoxVolume?: number
  remark: string
}

interface PmsFirstLegChannelExtras {
  minTransitDays?: number
  maxTransitDays?: number
  cutoffTime: string
  departureFrequency: string
  chargeWeightFactor?: number
  volumeDivisor?: number
  minChargeWeight?: number
  firstWeightPrice?: number
  additionalWeightPrice?: number
  includeTax?: boolean
  includeCustomsClearance?: boolean
  includeDelivery?: boolean
  taxRemark: string
  destinationCountry: string
  applicableArea: string
  transferCenter: string
  supportBattery?: boolean
  supportLiquid?: boolean
  supportSensitiveGoods?: boolean
  supportNormalGoods?: boolean
  maxBoxWeight?: number
  maxBoxVolume?: number
}

function normalizePmsChannelExtras(input: PmsCreateChannelInput): PmsFirstLegChannelExtras {
  const minTransitDays = normalizePmsOptionalNonNegative(input.minTransitDays, '最短运输天数', 'CHANNEL_MIN_DAYS_INVALID')
  const maxTransitDays = normalizePmsOptionalNonNegative(input.maxTransitDays, '最长运输天数', 'CHANNEL_MAX_DAYS_INVALID')
  if (minTransitDays !== undefined && maxTransitDays !== undefined && minTransitDays > maxTransitDays) {
    throw new PmsDomainError('CHANNEL_TRANSIT_RANGE_INVALID', '最短运输天数不能大于最长运输天数')
  }
  return {
    minTransitDays,
    maxTransitDays,
    cutoffTime: normalizePmsOptionalText(input.cutoffTime) ?? '',
    departureFrequency: normalizePmsOptionalText(input.departureFrequency) ?? '',
    chargeWeightFactor: normalizePmsOptionalNonNegative(input.chargeWeightFactor, '计费重系数', 'CHANNEL_CHARGE_FACTOR_INVALID'),
    volumeDivisor: normalizePmsOptionalNonNegative(input.volumeDivisor, '体积重除数', 'CHANNEL_VOLUME_DIVISOR_INVALID'),
    minChargeWeight: normalizePmsOptionalNonNegative(input.minChargeWeight, '最低计费重量', 'CHANNEL_MIN_CHARGE_WEIGHT_INVALID'),
    firstWeightPrice: normalizePmsOptionalNonNegative(input.firstWeightPrice, '首重价格', 'CHANNEL_FIRST_WEIGHT_PRICE_INVALID'),
    additionalWeightPrice: normalizePmsOptionalNonNegative(input.additionalWeightPrice, '续重价格', 'CHANNEL_ADDITIONAL_WEIGHT_PRICE_INVALID'),
    includeTax: input.includeTax,
    includeCustomsClearance: input.includeCustomsClearance,
    includeDelivery: input.includeDelivery,
    taxRemark: normalizePmsOptionalText(input.taxRemark) ?? '',
    destinationCountry: normalizePmsOptionalText(input.destinationCountry) ?? '',
    applicableArea: normalizePmsOptionalText(input.applicableArea) ?? '',
    transferCenter: normalizePmsOptionalText(input.transferCenter) ?? '',
    supportBattery: input.supportBattery,
    supportLiquid: input.supportLiquid,
    supportSensitiveGoods: input.supportSensitiveGoods,
    supportNormalGoods: input.supportNormalGoods,
    maxBoxWeight: normalizePmsOptionalNonNegative(input.maxBoxWeight, '最大单箱重量', 'CHANNEL_MAX_BOX_WEIGHT_INVALID'),
    maxBoxVolume: normalizePmsOptionalNonNegative(input.maxBoxVolume, '最大单箱体积', 'CHANNEL_MAX_BOX_VOLUME_INVALID'),
  }
}

function validateChannelInput(input: PmsCreateChannelInput): void {
  if (!input.carrierId.trim()) throw new PmsDomainError('CHANNEL_CARRIER_REQUIRED', '渠道必须归属一个物流商')
  if (!input.channelName.trim()) throw new PmsDomainError('CHANNEL_NAME_REQUIRED', '渠道名称不能为空')
  if (!Number.isFinite(input.estimatedTransitDays) || input.estimatedTransitDays <= 0) throw new PmsDomainError('CHANNEL_DAYS_INVALID', '参考时效必须是大于 0 的天数')
  if (input.billingMethod !== '整柜' && (!Number.isFinite(input.unitPrice) || input.unitPrice < 0)) throw new PmsDomainError('CHANNEL_PRICE_INVALID', '单价不能为负数')
  if (input.billingMethod === '整柜') {
    const prices = input.containerPrices ?? []
    if (prices.length !== 4) throw new PmsDomainError('CHANNEL_CONTAINER_INCOMPLETE', '整柜计费必须完整配置 20GP/40GP/40HQ/45HQ 四个规格')
    prices.forEach((price) => {
      if (!Number.isFinite(price.price) || price.price < 0 || !Number.isFinite(price.weightLimit) || price.weightLimit <= 0 || !Number.isFinite(price.volumeLimit) || price.volumeLimit <= 0) {
        throw new PmsDomainError('CHANNEL_CONTAINER_INVALID', `${price.containerType} 的限重、限体积和价格必须大于 0`)
      }
    })
  }
}

export function createPmsFirstLegChannel(input: PmsCreateChannelInput, actor: { id: string; name: string; role: PmsActorRole }): PmsFirstLegChannel {
  validateChannelInput(input)
  const extras = normalizePmsChannelExtras(input)
  const carrier = getRuntime().carriers.find((item) => item.carrierCode === input.carrierId)
  if (!carrier) throw new PmsDomainError('CARRIER_NOT_FOUND', `物流商 ${input.carrierId} 不存在`)
  channelSequence += 1
  const channel: PmsFirstLegChannel = {
    channelCode: input.channelCode?.trim() || `CH-2026-${String(channelSequence).padStart(4, '0')}`,
    carrierId: carrier.carrierCode,
    carrierName: carrier.carrierName,
    channelName: input.channelName.trim(),
    transportMethod: input.transportMethod,
    estimatedTransitDays: input.estimatedTransitDays,
    billingMethod: input.billingMethod,
    unitPrice: input.billingMethod === '整柜' ? 0 : input.unitPrice,
    currency: input.currency,
    taxMethod: input.taxMethod,
    containerPrices: input.billingMethod === '整柜' ? input.containerPrices ?? [] : [],
    originPlace: input.originPlace.trim(),
    destinationWarehouse: input.destinationWarehouse.trim(),
    ...extras,
    status: '启用',
    remark: input.remark.trim(),
    updatedAt: new Date().toISOString(),
  }
  getRuntime().channels.unshift(channel)
  appendPmsLog({ objectType: 'first-leg-channel', objectId: channel.channelCode, action: '创建', beforeValue: '', afterValue: `${carrier.shortName} · ${channel.channelName}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return channel
}

export function updatePmsFirstLegChannel(channelCode: string, patch: Partial<PmsCreateChannelInput>, actor: { id: string; name: string; role: PmsActorRole }): PmsFirstLegChannel {
  const channel = getRuntime().channels.find((item) => item.channelCode === channelCode)
  if (!channel) throw new PmsDomainError('CHANNEL_NOT_FOUND', `渠道 ${channelCode} 不存在`)
  const merged: PmsCreateChannelInput = {
    carrierId: patch.carrierId ?? channel.carrierId,
    channelName: patch.channelName ?? channel.channelName,
    transportMethod: patch.transportMethod ?? channel.transportMethod,
    estimatedTransitDays: patch.estimatedTransitDays ?? channel.estimatedTransitDays,
    minTransitDays: patch.minTransitDays ?? channel.minTransitDays,
    maxTransitDays: patch.maxTransitDays ?? channel.maxTransitDays,
    cutoffTime: patch.cutoffTime ?? channel.cutoffTime,
    departureFrequency: patch.departureFrequency ?? channel.departureFrequency,
    billingMethod: patch.billingMethod ?? channel.billingMethod,
    chargeWeightFactor: patch.chargeWeightFactor ?? channel.chargeWeightFactor,
    volumeDivisor: patch.volumeDivisor ?? channel.volumeDivisor,
    minChargeWeight: patch.minChargeWeight ?? channel.minChargeWeight,
    firstWeightPrice: patch.firstWeightPrice ?? channel.firstWeightPrice,
    additionalWeightPrice: patch.additionalWeightPrice ?? channel.additionalWeightPrice,
    unitPrice: patch.unitPrice ?? channel.unitPrice,
    currency: patch.currency ?? channel.currency,
    includeTax: patch.includeTax ?? channel.includeTax,
    includeCustomsClearance: patch.includeCustomsClearance ?? channel.includeCustomsClearance,
    includeDelivery: patch.includeDelivery ?? channel.includeDelivery,
    taxRemark: patch.taxRemark ?? channel.taxRemark,
    taxMethod: patch.taxMethod ?? channel.taxMethod,
    containerPrices: patch.containerPrices ?? channel.containerPrices,
    originPlace: patch.originPlace ?? channel.originPlace,
    destinationCountry: patch.destinationCountry ?? channel.destinationCountry,
    destinationWarehouse: patch.destinationWarehouse ?? channel.destinationWarehouse,
    applicableArea: patch.applicableArea ?? channel.applicableArea,
    transferCenter: patch.transferCenter ?? channel.transferCenter,
    supportBattery: patch.supportBattery ?? channel.supportBattery,
    supportLiquid: patch.supportLiquid ?? channel.supportLiquid,
    supportSensitiveGoods: patch.supportSensitiveGoods ?? channel.supportSensitiveGoods,
    supportNormalGoods: patch.supportNormalGoods ?? channel.supportNormalGoods,
    maxBoxWeight: patch.maxBoxWeight ?? channel.maxBoxWeight,
    maxBoxVolume: patch.maxBoxVolume ?? channel.maxBoxVolume,
    remark: patch.remark ?? channel.remark,
  }
  validateChannelInput(merged)
  const extras = normalizePmsChannelExtras(merged)
  const carrier = getRuntime().carriers.find((item) => item.carrierCode === merged.carrierId)
  if (!carrier) throw new PmsDomainError('CARRIER_NOT_FOUND', `物流商 ${merged.carrierId} 不存在`)
  const before = `${channel.channelName} · ${channel.transportMethod}`
  channel.carrierId = carrier.carrierCode
  channel.carrierName = carrier.carrierName
  channel.channelName = merged.channelName.trim()
  channel.transportMethod = merged.transportMethod
  channel.estimatedTransitDays = merged.estimatedTransitDays
  channel.billingMethod = merged.billingMethod
  channel.unitPrice = merged.billingMethod === '整柜' ? 0 : merged.unitPrice
  channel.currency = merged.currency
  channel.taxMethod = merged.taxMethod
  channel.containerPrices = merged.billingMethod === '整柜' ? merged.containerPrices ?? [] : []
  channel.originPlace = merged.originPlace.trim()
  channel.destinationWarehouse = merged.destinationWarehouse.trim()
  Object.assign(channel, extras)
  channel.remark = merged.remark.trim()
  channel.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'first-leg-channel', objectId: channelCode, action: '编辑', beforeValue: before, afterValue: `${channel.channelName} · ${channel.transportMethod}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return channel
}

export function togglePmsFirstLegChannelStatus(channelCode: string, actor: { id: string; name: string; role: PmsActorRole }): PmsFirstLegChannel {
  const channel = getRuntime().channels.find((item) => item.channelCode === channelCode)
  if (!channel) throw new PmsDomainError('CHANNEL_NOT_FOUND', `渠道 ${channelCode} 不存在`)
  const before = channel.status
  channel.status = before === '启用' ? '停用' : '启用'
  channel.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'first-leg-channel', objectId: channelCode, action: '启停', beforeValue: before, afterValue: channel.status, reason: '停用不影响历史头程单', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  return channel
}

export interface PmsFirstLegAllocationInput {
  recordNo: string
  qty: number
  rolls: number
}

export interface PmsCreateBatchInput {
  batchNo: string
  batchName: string
  carrierId: string
  channelId: string
  transferCenter: string
  destinationWarehouse: string
  plannedShipDate: string
  fee: number
  remark: string
  billOfLadingNo?: string
  billOfLadingRemark?: string
  shippingLineName?: string
  sourceRegion?: PmsFirstLegSourceRegion
  warehouse?: string
  cargoType?: PmsFirstLegCargoType
  area?: string
  logisticsCompany?: string
  inboundStatus?: PmsFirstLegInboundStatus
  estimatedArrivalAt?: string
  fees?: Partial<PmsFirstLegFeeBreakdown>
  allocations: PmsFirstLegAllocationInput[]
}

export function validatePmsBatchNo(batchNo: string): string {
  const value = batchNo.trim()
  if (!value) return '头程物流单号不能为空'
  if (getPmsFirstLegBatch(value)) return `头程物流单号 ${value} 已存在`
  return ''
}

export function createPmsFirstLegBatch(input: PmsCreateBatchInput, actor: { id: string; name: string; role: PmsActorRole }): PmsFirstLegBatch {
  const batchNoError = validatePmsBatchNo(input.batchNo)
  if (batchNoError) throw new PmsDomainError('BATCH_NO_INVALID', batchNoError)
  if (input.allocations.length === 0) throw new PmsDomainError('BATCH_ALLOCATION_EMPTY', '请至少选择一条国内物流记录加入头程')
  if (!Number.isFinite(input.fee) || input.fee < 0) throw new PmsDomainError('BATCH_FEE_INVALID', '头程费用不能为负数')
  if (input.plannedShipDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.plannedShipDate)) throw new PmsDomainError('BATCH_DATE_INVALID', '计划起运日期格式应为 YYYY-MM-DD')
  const carrier = getRuntime().carriers.find((item) => item.carrierCode === input.carrierId)
  if (!carrier) throw new PmsDomainError('CARRIER_NOT_FOUND', `物流商 ${input.carrierId} 不存在`)
  if (carrier.status !== '启用') throw new PmsDomainError('CARRIER_DISABLED', `${carrier.carrierName} 已停用，不能新建头程单`)
  const channel = getRuntime().channels.find((item) => item.channelCode === input.channelId)
  if (!channel) throw new PmsDomainError('CHANNEL_NOT_FOUND', `渠道 ${input.channelId} 不存在`)
  if (channel.status !== '启用') throw new PmsDomainError('CHANNEL_DISABLED', `${channel.channelName} 已停用，不能新建头程单`)
  if (channel.carrierId !== carrier.carrierCode) throw new PmsDomainError('CHANNEL_CARRIER_MISMATCH', '渠道与物流商不匹配')

  const allocations = input.allocations.map((allocation) => {
    const record = getPmsMaterialLogisticsRecord(allocation.recordNo)
    if (!record) throw new PmsDomainError('LOGISTICS_NOT_FOUND', `物流记录 ${allocation.recordNo} 不存在`)
    const remainingQty = roundPmsQty(record.qty - record.headLogisticsQty, 2)
    const remainingRolls = Math.max(0, record.rolls - record.headLogisticsRolls)
    if (!Number.isFinite(allocation.qty) || allocation.qty <= 0 || allocation.qty > remainingQty) {
      throw new PmsDomainError('BATCH_QTY_INVALID', `${record.trackingNo} 的加入数量必须在 0 到 ${remainingQty} ${record.unit} 之间`)
    }
    if (!Number.isInteger(allocation.rolls) || allocation.rolls < 0 || allocation.rolls > remainingRolls) {
      throw new PmsDomainError('BATCH_ROLLS_INVALID', `${record.trackingNo} 的卷数必须是 0 到 ${remainingRolls} 的整数`)
    }
    return { record, qty: roundPmsQty(allocation.qty, 2), rolls: allocation.rolls }
  })

  const batch: PmsFirstLegBatch = {
    batchNo: input.batchNo.trim(),
    batchName: input.batchName.trim() || `${carrier.shortName} · ${channel.channelName}`,
    transferCenter: input.transferCenter.trim() || `${carrier.city || '深圳'}转运中心`,
    destinationWarehouse: input.destinationWarehouse.trim() || channel.destinationWarehouse,
    carrierId: carrier.carrierCode,
    carrierName: carrier.carrierName,
    channelId: channel.channelCode,
    channelName: channel.channelName,
    transportMethod: channel.transportMethod,
    estimatedTransitDays: channel.estimatedTransitDays,
    billingMethod: channel.billingMethod,
    taxMethod: channel.taxMethod,
    feeCurrency: channel.currency,
    status: '待起运',
    creator: actor.name,
    createdAt: new Date().toISOString(),
    plannedShipDate: input.plannedShipDate,
    containerLoadedAt: '',
    actualShipDate: '',
    arrivedAt: '',
    completedAt: '',
    fee: roundPmsQty(input.fee, 2),
    remark: input.remark.trim(),
    ...normalizePmsFirstLegExtra(input),
    billOfLadingNo: (input.billOfLadingNo ?? '').trim(),
    billOfLadingRemark: (input.billOfLadingRemark ?? '').trim(),
    shippingLineName: (input.shippingLineName ?? '').trim(),
    warehouse: (input.warehouse ?? '').trim(),
    area: (input.area ?? '').trim(),
    logisticsCompany: (input.logisticsCompany ?? '').trim(),
    fees: normalizePmsFirstLegFees(input.fees),
    records: [],
  }
  getRuntime().batches.unshift(batch)
  allocations.forEach((allocation) => {
    applyPmsLogisticsHeadAllocation(allocation.record.recordNo, allocation.qty, allocation.rolls, batch.batchNo)
    batch.records.push(toBatchRecord(allocation.record, allocation.qty, allocation.rolls))
  })
  appendPmsLog({
    objectType: 'first-leg-batch',
    objectId: batch.batchNo,
    action: '创建头程单',
    beforeValue: '',
    afterValue: `${carrier.shortName} · ${channel.channelName} · ${allocations.length} 条物流`,
    reason: input.remark.trim(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return batch
}

const BATCH_TRANSITIONS: Record<PmsFirstLegBatchStatus, PmsFirstLegBatchStatus[]> = {
  待起运: ['已装柜'],
  已装柜: ['头程中'],
  头程中: ['已到仓'],
  已到仓: ['已完成'],
  已完成: [],
}

export function pmsAllowedBatchNextStatuses(status: PmsFirstLegBatchStatus): PmsFirstLegBatchStatus[] {
  return BATCH_TRANSITIONS[status]
}

export function advancePmsFirstLegBatchStatus(
  batchNo: string,
  nextStatus: PmsFirstLegBatchStatus,
  actor: { id: string; name: string; role: PmsActorRole },
  note = '',
): PmsFirstLegBatch {
  const batch = getPmsFirstLegBatch(batchNo)
  if (!batch) throw new PmsDomainError('BATCH_NOT_FOUND', `头程单 ${batchNo} 不存在`)
  if (!BATCH_TRANSITIONS[batch.status].includes(nextStatus)) {
    throw new PmsDomainError('BATCH_TRANSITION_BLOCKED', `${batch.status} 不能直接流转到 ${nextStatus}`)
  }
  const before = batch.status
  const now = new Date().toISOString()
  batch.status = nextStatus
  if (nextStatus === '已装柜') batch.containerLoadedAt = now
  if (nextStatus === '头程中') batch.actualShipDate = now
  if (nextStatus === '已到仓') {
    batch.arrivedAt = now
    signPmsMaterialLogisticsByBatch(batchNo, actor)
  }
  if (nextStatus === '已完成') batch.completedAt = now
  appendPmsLog({
    objectType: 'first-leg-batch',
    objectId: batchNo,
    action: `状态流转 · ${nextStatus}`,
    beforeValue: before,
    afterValue: nextStatus,
    reason: note,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return batch
}

export interface PmsUpdateFirstLegBatchPatch {
  plannedShipDate?: string
  fee?: number
  remark?: string
  billOfLadingNo?: string
  billOfLadingRemark?: string
  shippingLineName?: string
  sourceRegion?: PmsFirstLegSourceRegion
  warehouse?: string
  cargoType?: PmsFirstLegCargoType
  area?: string
  logisticsCompany?: string
  inboundStatus?: PmsFirstLegInboundStatus
  estimatedArrivalAt?: string
  fees?: Partial<PmsFirstLegFeeBreakdown>
}

export function updatePmsFirstLegBatch(
  batchNo: string,
  patch: PmsUpdateFirstLegBatchPatch,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsFirstLegBatch {
  const batch = getPmsFirstLegBatch(batchNo)
  if (!batch) throw new PmsDomainError('BATCH_NOT_FOUND', `头程单 ${batchNo} 不存在`)
  if (batch.status !== '待起运') throw new PmsDomainError('BATCH_EDIT_BLOCKED', '只有待起运的头程单可以编辑')
  if (patch.plannedShipDate !== undefined) {
    if (patch.plannedShipDate && !/^\d{4}-\d{2}-\d{2}$/.test(patch.plannedShipDate)) throw new PmsDomainError('BATCH_DATE_INVALID', '计划起运日期格式应为 YYYY-MM-DD')
    batch.plannedShipDate = patch.plannedShipDate
  }
  if (patch.fee !== undefined) {
    if (!Number.isFinite(patch.fee) || patch.fee < 0) throw new PmsDomainError('BATCH_FEE_INVALID', '头程费用不能为负数')
    batch.fee = roundPmsQty(patch.fee, 2)
  }
  if (patch.remark !== undefined) batch.remark = patch.remark.trim()
  if (patch.billOfLadingNo !== undefined) batch.billOfLadingNo = patch.billOfLadingNo.trim()
  if (patch.billOfLadingRemark !== undefined) batch.billOfLadingRemark = patch.billOfLadingRemark.trim()
  if (patch.shippingLineName !== undefined) batch.shippingLineName = patch.shippingLineName.trim()
  if (patch.warehouse !== undefined) batch.warehouse = patch.warehouse.trim()
  if (patch.area !== undefined) batch.area = patch.area.trim()
  if (patch.logisticsCompany !== undefined) batch.logisticsCompany = patch.logisticsCompany.trim()
  if (patch.sourceRegion !== undefined || patch.cargoType !== undefined || patch.inboundStatus !== undefined || patch.estimatedArrivalAt !== undefined) {
    const extra = normalizePmsFirstLegExtra({
      cargoType: patch.cargoType ?? batch.cargoType,
      sourceRegion: patch.sourceRegion ?? batch.sourceRegion,
      inboundStatus: patch.inboundStatus ?? batch.inboundStatus,
      estimatedArrivalAt: patch.estimatedArrivalAt ?? batch.estimatedArrivalAt,
    })
    batch.cargoType = extra.cargoType
    batch.sourceRegion = extra.sourceRegion
    batch.inboundStatus = extra.inboundStatus
    batch.estimatedArrivalAt = extra.estimatedArrivalAt
  }
  if (patch.fees !== undefined) batch.fees = normalizePmsFirstLegFees({ ...batch.fees, ...patch.fees })
  appendPmsLog({ objectType: 'first-leg-batch', objectId: batchNo, action: '编辑', beforeValue: '', afterValue: batch.remark, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return batch
}

export interface PmsFirstLegBatchActionOutcome {
  updated: string[]
  skipped: Array<{ batchNo: string; reason: string }>
}

function batchAdvancePmsFirstLegBatches(
  batchNos: string[],
  expected: PmsFirstLegBatchStatus,
  next: PmsFirstLegBatchStatus,
  label: string,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsFirstLegBatchActionOutcome {
  const outcome: PmsFirstLegBatchActionOutcome = { updated: [], skipped: [] }
  batchNos.forEach((batchNo) => {
    const batch = getPmsFirstLegBatch(batchNo)
    if (!batch) {
      outcome.skipped.push({ batchNo, reason: '头程单不存在' })
      return
    }
    if (batch.status !== expected) {
      outcome.skipped.push({ batchNo, reason: `当前状态为${batch.status}，不能${label}` })
      return
    }
    advancePmsFirstLegBatchStatus(batchNo, next, actor, `${label} · 批量操作`)
    outcome.updated.push(batchNo)
  })
  if (outcome.updated.length === 0) throw new PmsDomainError('BATCH_ACTION_EMPTY', `选中的头程单都不能${label}，请检查状态`)
  return outcome
}

export function batchLoadPmsFirstLegBatches(batchNos: string[], actor: { id: string; name: string; role: PmsActorRole }): PmsFirstLegBatchActionOutcome {
  return batchAdvancePmsFirstLegBatches(batchNos, '待起运', '已装柜', '装柜', actor)
}

export function batchShipPmsFirstLegBatches(batchNos: string[], actor: { id: string; name: string; role: PmsActorRole }): PmsFirstLegBatchActionOutcome {
  return batchAdvancePmsFirstLegBatches(batchNos, '已装柜', '头程中', '确认出运', actor)
}
