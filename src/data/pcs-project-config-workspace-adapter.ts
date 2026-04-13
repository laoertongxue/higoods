import { createInitialConfigData, type ConfigOption, type FlatDimensionId } from './pcs-config-dimensions.ts'
import {
  getProjectConfigSourceMapping,
  listProjectConfigSourceMappings,
  type PcsProjectConfigSourceKind,
  type PcsProjectConfigSourceMapping,
} from './pcs-project-domain-contract.ts'

export interface ProjectWorkspaceOption {
  id: string
  code: string
  name: string
}

export interface ProjectWorkspaceSourceSummaryItem {
  sourceKind: PcsProjectConfigSourceKind
  fieldCount: number
  fieldKeys: string[]
  fieldLabels: string[]
}

const CONFIG_DATA = createInitialConfigData()

function toWorkspaceOption(option: ConfigOption): ProjectWorkspaceOption {
  return {
    id: option.id,
    code: option.code,
    name: option.name_zh,
  }
}

function listEnabledDimensionOptions(dimensionId: FlatDimensionId): ProjectWorkspaceOption[] {
  return (CONFIG_DATA[dimensionId] ?? [])
    .filter((item) => item.status === 'ENABLED')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toWorkspaceOption)
}

export function listProjectWorkspaceBrands(): ProjectWorkspaceOption[] {
  return listEnabledDimensionOptions('brands')
}

export function listProjectWorkspaceCategories(): ProjectWorkspaceOption[] {
  return listEnabledDimensionOptions('categories')
}

export function listProjectWorkspaceStyles(): ProjectWorkspaceOption[] {
  return listEnabledDimensionOptions('styles')
}

export function listProjectWorkspaceStyleCodes(): ProjectWorkspaceOption[] {
  return listEnabledDimensionOptions('styleCodes')
}

export function listProjectWorkspaceCrowdPositioning(): ProjectWorkspaceOption[] {
  return listEnabledDimensionOptions('crowdPositioning')
}

export function listProjectWorkspaceAges(): ProjectWorkspaceOption[] {
  return listEnabledDimensionOptions('ages')
}

export function listProjectWorkspaceCrowds(): ProjectWorkspaceOption[] {
  return listEnabledDimensionOptions('crowds')
}

export function listProjectWorkspaceProductPositioning(): ProjectWorkspaceOption[] {
  return listEnabledDimensionOptions('productPositioning')
}

export function buildProjectWorkspaceCategoryOptions(): Array<{
  id: string
  name: string
  children: Array<{ id: string; name: string }>
}> {
  return listProjectWorkspaceCategories().map((item) => ({
    id: item.id,
    name: item.name,
    children: [],
  }))
}

export function findProjectWorkspaceOptionById(
  dimensionId: FlatDimensionId,
  optionId: string,
): ProjectWorkspaceOption | null {
  return listEnabledDimensionOptions(dimensionId).find((item) => item.id === optionId) ?? null
}

export function listProjectWorkspaceSourceMappings(): PcsProjectConfigSourceMapping[] {
  return listProjectConfigSourceMappings()
}

export function getProjectWorkspaceSourceMapping(fieldKey: string): PcsProjectConfigSourceMapping | null {
  return getProjectConfigSourceMapping(fieldKey)
}

export function getProjectWorkspaceSourceHintText(fieldKey: string): string {
  const mapping = getProjectWorkspaceSourceMapping(fieldKey)
  if (!mapping) return '当前来源：未定义'
  const prefix = mapping.sourceKind === '配置工作台' ? '数据来源' : '当前来源'
  return `${prefix}：${mapping.sourceKind} / ${mapping.sourceRef}`
}

export function listProjectWorkspaceSourceSummaries(
  fieldKeys?: string[],
): ProjectWorkspaceSourceSummaryItem[] {
  const items = fieldKeys
    ? listProjectWorkspaceSourceMappings().filter((item) => fieldKeys.includes(item.fieldKey))
    : listProjectWorkspaceSourceMappings()
  const bucket = new Map<PcsProjectConfigSourceKind, ProjectWorkspaceSourceSummaryItem>()
  items.forEach((item) => {
    const current =
      bucket.get(item.sourceKind) ??
      {
        sourceKind: item.sourceKind,
        fieldCount: 0,
        fieldKeys: [],
        fieldLabels: [],
      }
    current.fieldCount += 1
    current.fieldKeys.push(item.fieldKey)
    current.fieldLabels.push(item.fieldLabel)
    bucket.set(item.sourceKind, current)
  })
  return Array.from(bucket.values()).sort((a, b) => b.fieldCount - a.fieldCount || a.sourceKind.localeCompare(b.sourceKind))
}

export function getProjectWorkspaceCategoryCompatibilityNote(): string {
  return '当前配置工作台仅提供一级品类维度，兼容二级分类字段保留为空，不做必填，不新增硬编码。'
}
