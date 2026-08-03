import { getMaterialArchiveById, getMaterialSkuRecordById } from './pcs-material-archive-repository.ts'
import type {
  EngineeringBomMaterialLineDraft,
  EngineeringBomResolvedMaterialLine,
} from './pcs-engineering-bom-types.ts'

export const MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE = '该物料暂无标准单价，无法加入。请先维护该物料的标准单价。'

function roundCny(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
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
    ? line.usage * line.sampleQuantity * (1 + line.lossRate) * conversion * sku.costPrice
    : null
  return {
    ...line,
    materialCode: sku.materialCode,
    materialSkuCode: sku.materialSkuCode,
    materialName: sku.materialName,
    pricingUnit: sku.pricingUnit,
    conversionToPricingUnit: conversion,
    standardUnitPriceCny: priceValid ? Number(sku.costPrice.toFixed(4)) : null,
    standardUnitPriceCurrency: 'CNY',
    priceStatus: priceValid ? '有效' : '标准单价失效',
    materialCostCny: rawCost === null ? null : roundCny(rawCost),
  }
}
