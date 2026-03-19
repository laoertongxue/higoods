// 工艺名称映射兼容层
// 说明：主真相源已收口到 process-craft-dict.ts，本文件负责将旧名称/老系统值归一化到工艺层。

import {
  getProcessCraftByCode,
  getProcessCraftByLegacyValue,
  listProcessCraftDefinitions,
  type ProcessCraftDefinition,
} from './process-craft-dict'

export type MappingSource = 'LEGACY_TECH_PACK' | 'NEW_TECH_PACK' | 'CRAFT_DICT'
export type MappingType = 'EXACT' | 'ALIAS' | 'SPLIT' | 'MERGE' | 'UNMAPPED'
export type MappingConfidence = 'HIGH' | 'MED' | 'LOW'

export interface ProcessMapping {
  id: string
  source: MappingSource
  legacyNameRaw: string
  legacyNameNorm: string
  mapType: MappingType
  processCodes: string[]
  confidence: MappingConfidence
  craftCode?: string
  processCode?: string
  stageCode?: string
  assignmentGranularity?: 'ORDER' | 'COLOR' | 'SKU'
  legacyValue?: number
  ruleJson?: {
    seqOrder?: string[]
  }
}

// 规范化名称：去空格、统一符号
export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/，/g, ',')
    .toLowerCase()
}

function toMappingFromCraft(craft: ProcessCraftDefinition): ProcessMapping {
  return {
    id: `PM-${craft.craftCode}`,
    source: 'CRAFT_DICT',
    legacyNameRaw: craft.legacyCraftName,
    legacyNameNorm: normalizeName(craft.legacyCraftName),
    mapType: 'EXACT',
    processCodes: [craft.systemProcessCode],
    confidence: 'HIGH',
    craftCode: craft.craftCode,
    processCode: craft.processCode,
    stageCode: craft.stageCode,
    assignmentGranularity: craft.assignmentGranularity,
    legacyValue: craft.legacyValue,
  }
}

const craftMappings = listProcessCraftDefinitions().map(toMappingFromCraft)

const aliasMappings: ProcessMapping[] = [
  {
    id: 'PM-ALIAS-SEW',
    source: 'LEGACY_TECH_PACK',
    legacyNameRaw: '缝制',
    legacyNameNorm: normalizeName('缝制'),
    mapType: 'ALIAS',
    processCodes: ['PROC_SEW'],
    confidence: 'MED',
    processCode: 'SEW',
    assignmentGranularity: 'SKU',
  },
  {
    id: 'PM-ALIAS-CUT',
    source: 'LEGACY_TECH_PACK',
    legacyNameRaw: '裁剪',
    legacyNameNorm: normalizeName('裁剪'),
    mapType: 'ALIAS',
    processCodes: ['PROC_CUT'],
    confidence: 'MED',
    processCode: 'CUT_PANEL',
    assignmentGranularity: 'ORDER',
  },
]

export const processMappings: ProcessMapping[] = [...craftMappings, ...aliasMappings]

// 根据名称获取映射（优先命中字典工艺）
export function getMappingByName(name: string): ProcessMapping | undefined {
  const norm = normalizeName(name)
  return processMappings.find((m) => m.legacyNameNorm === norm || normalizeName(m.legacyNameRaw) === norm)
}

export function getMappingByLegacyValue(legacyValue: number): ProcessMapping | undefined {
  const craft = getProcessCraftByLegacyValue(legacyValue)
  if (!craft) return undefined
  return processMappings.find((m) => m.craftCode === craft.craftCode)
}

export function getCraftByName(name: string): ProcessCraftDefinition | undefined {
  const mapping = getMappingByName(name)
  if (!mapping?.craftCode) return undefined
  return getProcessCraftByCode(mapping.craftCode)
}

// 批量映射
export function mapProcessNames(names: string[]): { name: string; mapping: ProcessMapping | null }[] {
  return names.map((name) => ({
    name,
    mapping: getMappingByName(name) || null,
  }))
}

// 添加临时映射（运行时）
export function addTemporaryMapping(legacyName: string, processCodes: string[]): ProcessMapping {
  const newMapping: ProcessMapping = {
    id: `PM-TEMP-${Date.now()}`,
    source: 'NEW_TECH_PACK',
    legacyNameRaw: legacyName,
    legacyNameNorm: normalizeName(legacyName),
    mapType: processCodes.length > 1 ? 'SPLIT' : 'EXACT',
    processCodes,
    confidence: 'LOW',
  }
  processMappings.push(newMapping)
  return newMapping
}
