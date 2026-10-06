import { getMaterialArchiveById, getMaterialSkuRecordById, freezeMaterialCostSnapshot, readMaterialCostReference, getMaterialUnitFactor, listMaterialUnitRelations } from './pcs-material-archive-repository.ts'
import { canonicalMaterialUnit } from './pcs-material-rules.ts'
import type {
  EngineeringBomMaterialLineDraft,
  EngineeringBomResolvedMaterialLine,
} from './pcs-engineering-bom-types.ts'

export const MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE = '该物料的综合标准成本未维护完整，请先补齐标准采购、基础运输或加工费用。'

function roundCny(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateEngineeringBomTotalRequirement(input: {
  usage: number
  quantityBasis?: 'PER_SAMPLE' | 'ORDER_TOTAL'
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
  return input.usage * conversion * (input.quantityBasis === 'ORDER_TOTAL' ? 1 : input.sampleQuantity) * (1 + input.lossRate)
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
  const factor = getMaterialUnitFactor(materialSkuId, usageUnit, pricingUnit)
  if (factor !== null && Number.isFinite(factor) && factor > 0) return factor
  throw new Error(`物料 ${sku?.materialSkuCode || materialSkuId} 缺少 ${usageUnit} 到 ${pricingUnit} 的单位换算关系，无法加入 BOM。`)
}

/** 仅由保存/确认动作调用；普通读取不更新引用。 */
export function captureEngineeringBomMaterialReference(line: EngineeringBomMaterialLineDraft, mode: 'CURRENT' | 'FROZEN' = 'CURRENT'): EngineeringBomMaterialLineDraft {
  const reference = freezeMaterialCostSnapshot(line.materialSkuId)
  const factor = resolveEngineeringBomConversion(line.materialSkuId, line.usageUnit, reference.pricingUnit)
  return { ...line, materialCostReference: reference, costReferenceMode: mode,
    unitConversionReference: { fromUnit: line.usageUnit, toUnit: reference.pricingUnit, factor,
      relationIds: listMaterialUnitRelations(line.materialSkuId).filter(row => [line.usageUnit, reference.pricingUnit].map(canonicalMaterialUnit).includes(canonicalMaterialUnit(row.auxUnitId))).map(row => row.relationId) } }
}

export function resolveEngineeringBomMaterialLine(
  line: EngineeringBomMaterialLineDraft,
): EngineeringBomResolvedMaterialLine {
  const sku = getMaterialSkuRecordById(line.materialSkuId)
  if (!sku) throw new Error('未找到 BOM 中的物料 SKU。')
  const archive = getMaterialArchiveById(sku.materialId)
  const frozen = line.costReferenceMode === 'FROZEN'
  const missingHistoricalReference = frozen && !line.materialCostReference
  const reference = missingHistoricalReference ? null : readMaterialCostReference(sku.materialSkuId, line.materialCostReference, frozen)
  const price = reference?.totalStandardCny ?? null
  const priceValid = Boolean(reference && reference.completeness.length === 0 && price !== null && Number.isFinite(price) && price >= 0)
  const pricingUnit = reference?.pricingUnit || line.materialCostReference?.pricingUnit || sku.pricingUnit
  let conversion = 0
  let conversionMessage = ''
  try {
    if (frozen) {
      const captured = line.unitConversionReference
      if (!captured || captured.fromUnit !== line.usageUnit || captured.toUnit !== pricingUnit) throw new Error('历史单位换算引用缺失。')
      conversion = captured.factor
    } else conversion = resolveEngineeringBomConversion(sku.materialSkuId, line.usageUnit, pricingUnit)
  } catch (error) {
    conversionMessage = error instanceof Error ? error.message : '缺少单位关系。'
  }
  const valid = priceValid && Number.isFinite(conversion) && conversion > 0
  const changed = !frozen && Boolean(reference?.changed || line.unitConversionReference && line.unitConversionReference.factor !== conversion)
  const rawCost = valid
    ? calculateEngineeringBomTotalRequirement({ ...line, conversionToPricingUnit: conversion }) * price!
    : null
  return {
    ...line,
    applicableSkuIds: [...(line.applicableSkuIds || [])],
    linkedPatternResultIds: [...(line.linkedPatternResultIds || [])],
    materialCode: sku.materialCode,
    materialSkuCode: sku.materialSkuCode,
    materialName: sku.materialName,
    materialImageUrl: line.materialImageUrl || sku.skuImageUrl || archive?.mainImageUrl || '',
    materialCostReference: reference ? { materialSkuId: reference.materialSkuId, costVersionId: reference.costVersionId, pricingUnit: reference.pricingUnit, totalStandardCny: reference.totalStandardCny, completeness: [...reference.completeness], lines: structuredClone(reference.lines), adoptedVersionIds: [...reference.adoptedVersionIds], evaluatedAt: reference.evaluatedAt } : undefined,
    pricingUnit,
    conversionToPricingUnit: conversion,
    standardUnitPriceCny: valid ? price : null,
    standardUnitPriceCurrency: 'CNY',
    priceStatus: valid ? '有效' : '标准单价失效',
    standardCostChanged: changed,
    standardCostMessage: missingHistoricalReference ? '历史成本引用缺失，未使用当前价格补写。' : conversionMessage || (reference?.completeness.join('、')) || (frozen ? '采用确认 / 发布时的标准成本与单位版本' : changed ? '标准成本参考已更新，当前为最新值' : '采用当前综合标准成本（含税）'),
    materialCostCny: rawCost === null ? null : roundCny(rawCost),
    totalRequirementQuantity: calculateEngineeringBomTotalRequirement({ ...line, conversionToPricingUnit: conversion || 1 }),
    technicalProcessSequence: resolveEngineeringBomTechnicalProcessSequence(line),
  }
}
