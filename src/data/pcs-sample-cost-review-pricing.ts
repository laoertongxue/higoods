export type SampleCostCurrency = 'RMB' | 'IDR'
export type SampleCostGarmentCategory = '梭织' | '毛织' | '毛织&梭织'
export type SampleCostMaterialType = 'fabric' | 'yarn'
export type SampleCostFabricFinishType = 'dye' | 'print'
export type SampleCostPrintSide = 'single' | 'double'

export interface SampleCostMoneyValue {
  amount: number
  currency: SampleCostCurrency
}

export interface SampleCostMaterialOption {
  sku: string
  type: SampleCostMaterialType
  commonName: string
  costPriceCny: number
  components?: string[]
  weightGsm?: number
  finishType?: SampleCostFabricFinishType
  printSide?: SampleCostPrintSide
}

export interface SampleCostMaterialLineInput {
  materialSku?: string
  usage?: string | number | null
}

export interface SampleCostOptionalProcessInput {
  processName?: string
  costAmount?: string | number | null
  costCurrency?: SampleCostCurrency | string
}

export interface SampleCostReviewInput {
  spuCode?: string
  productName?: string
  buyerName?: string
  brandName?: string
  garmentCategory?: SampleCostGarmentCategory | string
  exchangeRate?: string | number | null
  materialLines?: SampleCostMaterialLineInput[]
  auxiliaryCostAmount?: string | number | null
  auxiliaryCostCurrency?: SampleCostCurrency | string
  sewingCostAmount?: string | number | null
  sewingCostCurrency?: SampleCostCurrency | string
  optionalProcessLines?: SampleCostOptionalProcessInput[]
  salesPrice?: string | number | null
  salesCurrency?: SampleCostCurrency | string
  costNote?: string
}

export interface SampleCostMaterialLineRecord {
  id: string
  materialSku: string
  materialType: SampleCostMaterialType
  materialTypeLabel: string
  materialName: string
  usage: number
  costPriceCny: number
  materialCostCny: number
  dyeingCost: SampleCostMoneyValue
  dyeingCostCny: number
  dyeingRuleText: string
  materialLineText: string
  dyeingRuleLineText: string
}

export interface SampleCostProcessLineRecord {
  id: string
  processName: string
  cost: SampleCostMoneyValue
  costCny: number
  lineText: string
}

export interface SampleCostReviewPricingResult {
  spuCode: string
  productName: string
  buyerName: string
  brandName: string
  garmentCategory: SampleCostGarmentCategory
  exchangeRate: number
  materialLines: SampleCostMaterialLineRecord[]
  materialCostLines: string[]
  materialCostCny: number
  dyeingRuleLines: string[]
  dyeingCostCny: number
  auxiliaryCost: SampleCostMoneyValue
  auxiliaryCostAmount: number
  auxiliaryCostCurrency: SampleCostCurrency
  auxiliaryCostCny: number
  fixedProcessLines: SampleCostProcessLineRecord[]
  fixedProcessLineTexts: string[]
  fixedProcessCostCny: number
  sewingCost: SampleCostMoneyValue
  sewingCostAmount: number
  sewingCostCurrency: SampleCostCurrency
  sewingCostCny: number
  optionalProcessLines: SampleCostProcessLineRecord[]
  optionalProcessLineTexts: string[]
  optionalProcessCostCny: number
  costTotal: number
  salesPrice: number
  salesCurrency: SampleCostCurrency
  grossMarginRate: number
  reviewStatus: '已核价' | '待复核'
  costNote: string
  payload: Record<string, unknown>
}

export const SAMPLE_COST_DEFAULT_EXCHANGE_RATE = 2200
export const SAMPLE_COST_YARDS_PER_METER = 1.09361
export const SAMPLE_COST_RAW_MATERIAL_ROWS_KEY = 'sampleCostMaterialRows'
export const SAMPLE_COST_RAW_OPTIONAL_PROCESS_ROWS_KEY = 'sampleCostOptionalProcessRows'

export const sampleCostCurrencyOptions: Array<{ label: SampleCostCurrency; value: SampleCostCurrency }> = [
  { label: 'RMB', value: 'RMB' },
  { label: 'IDR', value: 'IDR' },
]

export const sampleCostGarmentCategoryOptions: Array<{ label: SampleCostGarmentCategory; value: SampleCostGarmentCategory }> = [
  { label: '梭织', value: '梭织' },
  { label: '毛织', value: '毛织' },
  { label: '毛织&梭织', value: '毛织&梭织' },
]

export const sampleCostMaterialTypeLabels: Record<SampleCostMaterialType, string> = {
  fabric: '面料',
  yarn: '纱线',
}

export const sampleCostMaterialOptions: SampleCostMaterialOption[] = [
  {
    sku: 'FAB-CNIDML076',
    type: 'fabric',
    commonName: '未加工面料 CNIDML076',
    costPriceCny: 3.56,
    components: ['涤纶'],
    weightGsm: 160,
    finishType: 'dye',
  },
  {
    sku: 'FAB-CNIDCT021',
    type: 'fabric',
    commonName: '棉感梭织 CNIDCT021',
    costPriceCny: 4.2,
    components: ['棉'],
    weightGsm: 190,
    finishType: 'dye',
  },
  {
    sku: 'FAB-CNIDPR113',
    type: 'fabric',
    commonName: '单面印花坯布 CNIDPR113',
    costPriceCny: 5.18,
    components: ['涤纶'],
    weightGsm: 145,
    finishType: 'print',
    printSide: 'single',
  },
  {
    sku: 'FAB-CNIDPR220',
    type: 'fabric',
    commonName: '双面印花坯布 CNIDPR220',
    costPriceCny: 5.82,
    components: ['涤纶', '氨纶'],
    weightGsm: 170,
    finishType: 'print',
    printSide: 'double',
  },
  { sku: 'YARN-MZ-018', type: 'yarn', commonName: '毛织纱线 MZ-018', costPriceCny: 2.86 },
  { sku: 'YARN-MZ-043', type: 'yarn', commonName: '混纺纱线 MZ-043', costPriceCny: 3.24 },
]

export const sampleCostOptionalProcessOptions = [
  '定位裁',
  '激光切',
  '压褶',
  '印花',
  '染色',
  '烫画',
  '直喷',
  '打揽',
  '打条',
  '绣花',
  '洗水',
  '缩水',
  '曲牙',
  '贝壳绣',
]

const fixedProcessItems: Record<SampleCostGarmentCategory, Array<{ label: string; amount: number }>> = {
  梭织: [
    { label: '裁剪费', amount: 1000 },
    { label: '包装材料', amount: 2000 },
    { label: '后道', amount: 3000 },
    { label: '缝纫线', amount: 1000 },
    { label: '仓库发货费', amount: 2000 },
  ],
  毛织: [
    { label: '包装材料', amount: 2000 },
    { label: '后道', amount: 3000 },
    { label: '缝纫线', amount: 1000 },
    { label: '仓库发货费', amount: 2000 },
  ],
  '毛织&梭织': [
    { label: '裁剪费', amount: 1000 },
    { label: '包装材料', amount: 2000 },
    { label: '后道', amount: 3000 },
    { label: '缝纫线', amount: 1000 },
    { label: '仓库发货费', amount: 2000 },
  ],
}

export function toSampleCostNumber(value: string | number | null | undefined, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function roundSampleCostCny(value: number): number {
  return Math.round(value * 100) / 100
}

function roundSampleCostSourceAmount(value: number, currency: SampleCostCurrency): number {
  return currency === 'IDR' ? Math.round(value) : roundSampleCostCny(value)
}

export function formatSampleCostAmount(value: string | number | null | undefined): string {
  const rounded = roundSampleCostCny(toSampleCostNumber(value))
  return rounded.toFixed(2).replace(/\.?0+$/, '')
}

export function formatSampleCostInteger(value: string | number | null | undefined): string {
  return Math.round(toSampleCostNumber(value)).toLocaleString('zh-CN')
}

export function formatSampleCostCny(value: string | number | null | undefined): string {
  return `¥${formatSampleCostAmount(value)}`
}

export function formatSampleCostIdr(value: string | number | null | undefined): string {
  return `Rp ${formatSampleCostInteger(value)}`
}

export function normalizeSampleCostCurrency(value: unknown, fallback: SampleCostCurrency = 'IDR'): SampleCostCurrency {
  const text = String(value || '').trim().toUpperCase()
  if (text === 'CNY' || text === 'RMB') return 'RMB'
  if (text === 'IDR') return 'IDR'
  return fallback
}

export function normalizeSampleCostGarmentCategory(value: unknown): SampleCostGarmentCategory {
  const text = String(value || '').trim()
  if (text.includes('毛织') && text.includes('梭织')) return '毛织&梭织'
  if (/拼接|组合|套装/.test(text)) return '毛织&梭织'
  if (/毛织|针织|毛衣|开衫/.test(text)) return '毛织'
  return '梭织'
}

export function normalizeSampleCostMoney(
  amount: string | number | null | undefined,
  currency: SampleCostCurrency | string | undefined,
  fallbackCurrency: SampleCostCurrency,
): SampleCostMoneyValue {
  const normalizedCurrency = normalizeSampleCostCurrency(currency, fallbackCurrency)
  return {
    amount: roundSampleCostSourceAmount(toSampleCostNumber(amount), normalizedCurrency),
    currency: normalizedCurrency,
  }
}

export function convertSampleCostMoneyToCny(value: SampleCostMoneyValue, exchangeRate: number): number {
  if (value.currency === 'RMB') return roundSampleCostCny(value.amount)
  return exchangeRate > 0 ? roundSampleCostCny(value.amount / exchangeRate) : 0
}

export function formatSampleCostMoney(value: SampleCostMoneyValue): string {
  return value.currency === 'IDR' ? formatSampleCostIdr(value.amount) : formatSampleCostCny(value.amount)
}

export function formatSampleCostSourceAndCny(value: SampleCostMoneyValue, convertedCny: number): string {
  return value.currency === 'RMB'
    ? formatSampleCostCny(convertedCny)
    : `${formatSampleCostMoney(value)} -> ${formatSampleCostCny(convertedCny)}`
}

export function getAllowedSampleCostMaterialOptions(category: SampleCostGarmentCategory): SampleCostMaterialOption[] {
  if (category === '梭织') return sampleCostMaterialOptions.filter((item) => item.type === 'fabric')
  if (category === '毛织') return sampleCostMaterialOptions.filter((item) => item.type === 'yarn')
  return sampleCostMaterialOptions
}

export function getSampleCostMaterialOption(sku?: string): SampleCostMaterialOption | undefined {
  return sampleCostMaterialOptions.find((item) => item.sku === sku)
}

export function getSampleCostMaterialOptionLabel(item: SampleCostMaterialOption): string {
  if (item.type === 'yarn') {
    return `${item.commonName} / cost_price ${formatSampleCostCny(item.costPriceCny)}/Yard`
  }
  const finishText =
    item.finishType === 'print'
      ? `${item.printSide === 'double' ? '双面印' : '单面印'}`
      : `染色 / 成分 ${item.components?.join('+') ?? '-'} / 克重 ${item.weightGsm ?? '-'}g`
  return `${item.commonName} / cost_price ${formatSampleCostCny(item.costPriceCny)}/Yard / ${finishText}`
}

export function createDefaultSampleCostMaterialRows(category: SampleCostGarmentCategory): SampleCostMaterialLineInput[] {
  if (category === '毛织&梭织') {
    return [
      { materialSku: sampleCostMaterialOptions.find((item) => item.type === 'fabric')?.sku, usage: 1 },
      { materialSku: sampleCostMaterialOptions.find((item) => item.type === 'yarn')?.sku, usage: 1 },
    ]
  }
  return [{ materialSku: getAllowedSampleCostMaterialOptions(category)[0]?.sku, usage: 1 }]
}

export function normalizeSampleCostMaterialRows(
  rows: SampleCostMaterialLineInput[] | null | undefined,
  category: SampleCostGarmentCategory,
): SampleCostMaterialLineInput[] {
  const normalizedRows = (rows || [])
    .map((row) => ({
      materialSku: String(row.materialSku || '').trim(),
      usage: toSampleCostNumber(row.usage),
    }))
    .filter((row) => row.materialSku || row.usage > 0)
  return normalizedRows.length > 0 ? normalizedRows : createDefaultSampleCostMaterialRows(category)
}

export function normalizeSampleCostOptionalProcessRows(
  rows: SampleCostOptionalProcessInput[] | null | undefined,
): SampleCostOptionalProcessInput[] {
  return (rows || [])
    .map((row) => ({
      processName: String(row.processName || '').trim(),
      costAmount: toSampleCostNumber(row.costAmount),
      costCurrency: normalizeSampleCostCurrency(row.costCurrency, 'IDR'),
    }))
    .filter((row) => row.processName || toSampleCostNumber(row.costAmount) > 0)
}

function yardsToMeters(usageYards: number): number {
  return usageYards / SAMPLE_COST_YARDS_PER_METER
}

function resolveDyeingUnitPriceIdr(option: SampleCostMaterialOption): { unitPrice: number; ruleName: string } {
  const components = option.components ?? []
  const hasCotton = components.some((item) => item.includes('棉'))
  const hasPolyester = components.some((item) => item.includes('涤纶'))
  const isBlend = components.length >= 2

  if (isBlend) return { unitPrice: 4000, ruleName: '双染混纺' }
  if (hasCotton) return { unitPrice: 4000, ruleName: '单染棉' }
  if (hasPolyester) return { unitPrice: 2000, ruleName: '单染涤纶' }
  return { unitPrice: 3000, ruleName: '单染其他' }
}

function resolveFabricFinishingCost(
  option: SampleCostMaterialOption,
  usageYards: number,
  brandName: string,
): { cost: SampleCostMoneyValue; ruleText: string } {
  if (option.type !== 'fabric' || usageYards <= 0) {
    return { cost: normalizeSampleCostMoney(0, 'IDR', 'IDR'), ruleText: '-' }
  }

  const usageMeters = yardsToMeters(usageYards)

  if (option.finishType === 'print') {
    if (option.printSide === 'double') {
      const amount = roundSampleCostCny(usageMeters * 3.6)
      return {
        cost: normalizeSampleCostMoney(amount, 'RMB', 'RMB'),
        ruleText: `双面印 ¥3.60/米 x ${usageMeters.toFixed(2)}米`,
      }
    }

    const isAsaya = brandName.trim().toLowerCase() === 'asaya'
    const unitPrice = isAsaya ? 2 : 3
    const amount = roundSampleCostCny(usageMeters * unitPrice)
    return {
      cost: normalizeSampleCostMoney(amount, 'RMB', 'RMB'),
      ruleText: `单面印${isAsaya ? ' Asaya' : ' 非Asaya'} ¥${unitPrice.toFixed(2)}/米 x ${usageMeters.toFixed(2)}米`,
    }
  }

  const { unitPrice, ruleName } = resolveDyeingUnitPriceIdr(option)
  const weightMultiplier = (option.weightGsm ?? 0) > 180 ? 1.5 : 1
  const amount = Math.round(usageMeters * unitPrice * weightMultiplier)
  const weightText = weightMultiplier > 1 ? `，克重${option.weightGsm}g > 180g，x1.5` : ''
  return {
    cost: normalizeSampleCostMoney(amount, 'IDR', 'IDR'),
    ruleText: `${ruleName} ${formatSampleCostIdr(unitPrice)}/米${weightText} x ${usageMeters.toFixed(2)}米`,
  }
}

export function resolveSampleCostSalesPrice(input: {
  finalPrice?: string | number | null
  priceRange?: string
  sampleUnitPrice?: string | number | null
}): number {
  const finalPrice = toSampleCostNumber(input.finalPrice)
  if (finalPrice > 0) return roundSampleCostCny(finalPrice)
  const priceNumbers = String(input.priceRange || '')
    .match(/\d+(\.\d+)?/g)
    ?.map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
  if (priceNumbers?.length) return roundSampleCostCny(Math.max(...priceNumbers))
  return Math.max(99, Math.round(toSampleCostNumber(input.sampleUnitPrice, 99) * 1.85))
}

export function calculateSampleCostReview(input: SampleCostReviewInput): SampleCostReviewPricingResult {
  const garmentCategory = normalizeSampleCostGarmentCategory(input.garmentCategory)
  const exchangeRate = toSampleCostNumber(input.exchangeRate, SAMPLE_COST_DEFAULT_EXCHANGE_RATE) || SAMPLE_COST_DEFAULT_EXCHANGE_RATE
  const brandName = String(input.brandName || '').trim() || 'Asaya'
  const allowedMaterials = getAllowedSampleCostMaterialOptions(garmentCategory)
  const materialInputs = normalizeSampleCostMaterialRows(input.materialLines, garmentCategory)

  const materialLines = materialInputs
    .map((line, index) => {
      const selected = getSampleCostMaterialOption(line.materialSku)
      const option = selected && allowedMaterials.some((item) => item.sku === selected.sku) ? selected : allowedMaterials[0]
      if (!option) return null

      const usage = toSampleCostNumber(line.usage)
      const materialCostCny = roundSampleCostCny(option.costPriceCny * usage)
      const finishing = resolveFabricFinishingCost(option, usage, brandName)
      const dyeingCostCny = convertSampleCostMoneyToCny(finishing.cost, exchangeRate)
      const materialTypeLabel = sampleCostMaterialTypeLabels[option.type]
      return {
        id: `${option.sku}-${index}`,
        materialSku: option.sku,
        materialType: option.type,
        materialTypeLabel,
        materialName: option.commonName,
        usage,
        costPriceCny: option.costPriceCny,
        materialCostCny,
        dyeingCost: finishing.cost,
        dyeingCostCny,
        dyeingRuleText: finishing.ruleText,
        materialLineText: `${materialTypeLabel} ${option.commonName} / ${usage.toFixed(2)} Yard / ${formatSampleCostCny(option.costPriceCny)}/Yard / ${formatSampleCostCny(materialCostCny)}`,
        dyeingRuleLineText: `${option.commonName} / ${finishing.ruleText} / ${formatSampleCostSourceAndCny(finishing.cost, dyeingCostCny)}`,
      } satisfies SampleCostMaterialLineRecord
    })
    .filter((item): item is SampleCostMaterialLineRecord => Boolean(item))

  const fixedProcessLines = fixedProcessItems[garmentCategory].map((item, index) => {
    const cost = normalizeSampleCostMoney(item.amount, 'IDR', 'IDR')
    const costCny = convertSampleCostMoneyToCny(cost, exchangeRate)
    return {
      id: `${item.label}-${index}`,
      processName: item.label,
      cost,
      costCny,
      lineText: `${item.label} ${formatSampleCostSourceAndCny(cost, costCny)}`,
    } satisfies SampleCostProcessLineRecord
  })

  const optionalProcessLines = normalizeSampleCostOptionalProcessRows(input.optionalProcessLines).map((line, index) => {
    const processName = String(line.processName || '').trim()
    const cost = normalizeSampleCostMoney(line.costAmount, line.costCurrency, 'IDR')
    const costCny = convertSampleCostMoneyToCny(cost, exchangeRate)
    return {
      id: `${processName}-${index}`,
      processName,
      cost,
      costCny,
      lineText: `${processName} ${formatSampleCostSourceAndCny(cost, costCny)}`,
    } satisfies SampleCostProcessLineRecord
  })

  const auxiliaryCost = normalizeSampleCostMoney(input.auxiliaryCostAmount, input.auxiliaryCostCurrency, 'IDR')
  const sewingCost = normalizeSampleCostMoney(input.sewingCostAmount, input.sewingCostCurrency, 'IDR')
  const materialCostCny = roundSampleCostCny(materialLines.reduce((sum, item) => sum + item.materialCostCny, 0))
  const dyeingCostCny = roundSampleCostCny(materialLines.reduce((sum, item) => sum + item.dyeingCostCny, 0))
  const auxiliaryCostCny = convertSampleCostMoneyToCny(auxiliaryCost, exchangeRate)
  const fixedProcessCostCny = roundSampleCostCny(fixedProcessLines.reduce((sum, item) => sum + item.costCny, 0))
  const sewingCostCny = convertSampleCostMoneyToCny(sewingCost, exchangeRate)
  const optionalProcessCostCny = roundSampleCostCny(optionalProcessLines.reduce((sum, item) => sum + item.costCny, 0))
  const costTotal = roundSampleCostCny(
    materialCostCny + dyeingCostCny + auxiliaryCostCny + fixedProcessCostCny + sewingCostCny + optionalProcessCostCny,
  )
  const salesCurrency = normalizeSampleCostCurrency(input.salesCurrency, 'RMB')
  const salesPrice = roundSampleCostCny(toSampleCostNumber(input.salesPrice))
  const salesPriceCny = convertSampleCostMoneyToCny({ amount: salesPrice, currency: salesCurrency }, exchangeRate)
  const grossMarginRate = salesPriceCny > 0 ? Number((((salesPriceCny - costTotal) / salesPriceCny) * 100).toFixed(1)) : 0
  const reviewStatus = grossMarginRate >= 55 ? '已核价' : '待复核'
  const costNote = String(input.costNote || '').trim()
  const materialCostLines = materialLines.map((item) => item.materialLineText)
  const dyeingRuleLines = materialLines.map((item) => item.dyeingRuleLineText)
  const fixedProcessLineTexts = fixedProcessLines.map((item) => item.lineText)
  const optionalProcessLineTexts = optionalProcessLines.map((item) => item.lineText)

  const payload = {
    spuCode: String(input.spuCode || '').trim(),
    productName: String(input.productName || '').trim(),
    buyerName: String(input.buyerName || '').trim(),
    brandName,
    garmentCategory,
    exchangeRate,
    materialCostCny,
    dyeingCostCny,
    auxiliaryCostAmount: auxiliaryCost.amount,
    auxiliaryCostCurrency: auxiliaryCost.currency,
    auxiliaryCostCny,
    fixedProcessCostCny,
    sewingCostAmount: sewingCost.amount,
    sewingCostCurrency: sewingCost.currency,
    sewingCostCny,
    optionalProcessCostCny,
    costTotal,
    salesPrice,
    salesCurrency,
    grossMarginRate,
    reviewStatus,
    costNote,
  }

  return {
    spuCode: payload.spuCode,
    productName: payload.productName,
    buyerName: payload.buyerName,
    brandName,
    garmentCategory,
    exchangeRate,
    materialLines,
    materialCostLines,
    materialCostCny,
    dyeingRuleLines,
    dyeingCostCny,
    auxiliaryCost,
    auxiliaryCostAmount: auxiliaryCost.amount,
    auxiliaryCostCurrency: auxiliaryCost.currency,
    auxiliaryCostCny,
    fixedProcessLines,
    fixedProcessLineTexts,
    fixedProcessCostCny,
    sewingCost,
    sewingCostAmount: sewingCost.amount,
    sewingCostCurrency: sewingCost.currency,
    sewingCostCny,
    optionalProcessLines,
    optionalProcessLineTexts,
    optionalProcessCostCny,
    costTotal,
    salesPrice,
    salesCurrency,
    grossMarginRate,
    reviewStatus,
    costNote,
    payload,
  }
}
