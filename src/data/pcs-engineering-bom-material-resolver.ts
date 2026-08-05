import { getMaterialArchiveById, getMaterialSkuRecordById } from './pcs-material-archive-repository.ts'
import type {
  EngineeringBomMaterialLineDraft,
  EngineeringBomResolvedMaterialLine,
} from './pcs-engineering-bom-types.ts'

export const MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE = '该物料暂无标准单价，无法加入。请先维护该物料的标准单价。'

function roundCny(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateEngineeringBomTotalRequirement(input: {
  usage: number
  sampleQuantity: number
  lossRate: number
  conversionToPricingUnit?: number
}): number {
  if (!Number.isFinite(input.usage) || input.usage <= 0) throw new Error('单位用量必须大于 0。')
  if (!Number.isFinite(input.sampleQuantity) || input.sampleQuantity <= 0) throw new Error('打样数量必须大于 0。')
  if (!Number.isFinite(input.lossRate) || input.lossRate < 0 || input.lossRate >= 1) {
    throw new Error('损耗率必须在 0（含）到 1（不含）之间。')
  }
  const conversion = input.conversionToPricingUnit ?? 1
  if (!Number.isFinite(conversion) || conversion <= 0) throw new Error('单位换算系数必须大于 0。')
  return input.usage * conversion * input.sampleQuantity * (1 + input.lossRate)
}

export function resolveEngineeringBomTechnicalProcessSequence(
  line: Pick<EngineeringBomMaterialLineDraft, 'waterSolubleRequirementText' | 'dyeRequirement'>,
): Array<'水溶' | '染色'> {
  const sequence: Array<'水溶' | '染色'> = []
  const waterSolubleText = line.waterSolubleRequirementText?.trim()
  if (waterSolubleText && !['无', '否', '不需要'].includes(waterSolubleText)) sequence.push('水溶')
  if (line.dyeRequirement === '是') sequence.push('染色')
  return sequence
}

export function resolveEngineeringBomConversion(
  materialSkuId: string,
  usageUnit: string,
  pricingUnit: string,
): number {
  if (usageUnit === pricingUnit) return 1
  const sku = getMaterialSkuRecordById(materialSkuId)
  const archive = sku ? getMaterialArchiveById(sku.materialId) : null
  const conversions = sku?.unitConversions?.length ? sku.unitConversions : archive?.unitConversions ?? []
  const direct = conversions.find((item) => item.fromUnit === usageUnit && item.toUnit === pricingUnit)
  if (direct && Number.isFinite(direct.factor) && direct.factor > 0) return direct.factor
  const reverse = conversions.find((item) => item.fromUnit === pricingUnit && item.toUnit === usageUnit)
  if (reverse && Number.isFinite(reverse.factor) && reverse.factor > 0) return 1 / reverse.factor
  throw new Error(`物料 ${sku?.materialSkuCode || materialSkuId} 缺少 ${usageUnit} 到 ${pricingUnit} 的单位换算关系，无法加入 BOM。`)
}

export function resolveEngineeringBomMaterialLine(
  line: EngineeringBomMaterialLineDraft,
): EngineeringBomResolvedMaterialLine {
  const sku = getMaterialSkuRecordById(line.materialSkuId)
  if (!sku) throw new Error('未找到 BOM 中的物料 SKU。')
  const priceValid = sku.status === 'ACTIVE' && Number.isFinite(sku.costPrice) && sku.costPrice > 0
  let conversion = 0
  try {
    conversion = resolveEngineeringBomConversion(sku.materialSkuId, line.usageUnit, sku.pricingUnit)
  } catch (error) {
    if (priceValid) throw error
  }
  const rawCost = priceValid
    ? calculateEngineeringBomTotalRequirement({ ...line, conversionToPricingUnit: conversion }) * sku.costPrice
    : null
  return {
    ...line,
    applicableSkuIds: [...(line.applicableSkuIds || [])],
    linkedPatternResultIds: [...(line.linkedPatternResultIds || [])],
    materialCode: sku.materialCode,
    materialSkuCode: sku.materialSkuCode,
    materialName: sku.materialName,
    pricingUnit: sku.pricingUnit,
    conversionToPricingUnit: conversion,
    standardUnitPriceCny: priceValid ? Number(sku.costPrice.toFixed(4)) : null,
    standardUnitPriceCurrency: 'CNY',
    priceStatus: priceValid ? '有效' : '标准单价失效',
    materialCostCny: rawCost === null ? null : roundCny(rawCost),
    totalRequirementQuantity: calculateEngineeringBomTotalRequirement({ ...line, conversionToPricingUnit: conversion || 1 }),
    technicalProcessSequence: resolveEngineeringBomTechnicalProcessSequence(line),
  }
}
