import type { FlatDimensionId } from './pcs-config-dimensions.ts'
import { listConfigDimensionChoices } from './pcs-config-workspace-repository.ts'
import { getMaterialBoundFields, listMaterialEquipmentModels, type MaterialTemplate, type MaterialTemplateField } from './pcs-material-config.ts'
import type { MaterialDictionaryReference, MaterialEquipmentCompatibility, MaterialNamedDimension, MaterialSpecValues } from './pcs-material-archive-types.ts'

export function materialFieldRequired(field: MaterialTemplateField, values: MaterialSpecValues, stage = 'BASE'): boolean {
  return field.required && field.requiredWhen !== 'optional'
    && (field.requiredWhen !== 'button-hole' || values.fastening === '孔式')
    && (field.requiredWhen !== 'dyed' || stage === 'DYEING')
    && (field.requiredWhen !== 'patterned' || ['PRINTING', 'EMBROIDERY', 'HEAT_TRANSFER'].includes(stage))
}
export function validateMaterialDimensions(value: unknown): asserts value is MaterialNamedDimension[] {
  if (!Array.isArray(value) || !value.length) throw new Error('请逐项填写尺寸名称、数值和单位。')
  const names = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim() || names.has(item.name.trim())) throw new Error('尺寸名称必填且不能重复。')
    if (typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value <= 0 || !['mm', 'cm', 'M'].includes(item.unit)) throw new Error('每个命名尺寸需要正数和明确的长度单位。')
    names.add(item.name.trim())
  }
}
export function validateMaterialEquipmentPairs(pairs: MaterialEquipmentCompatibility[], required: boolean, previous: MaterialEquipmentCompatibility[] = []): void {
  if (required && !pairs.length) throw new Error('请至少选择一种适配设备类型。')
  const seen = new Set<string>(), types = listConfigDimensionChoices('equipmentTypes'), models = listMaterialEquipmentModels()
  for (const pair of pairs) {
    const identity = `${pair.equipmentTypeId}:${pair.equipmentModelId || ''}`
    if (seen.has(identity)) throw new Error('设备类型与型号的适配组合不能重复。')
    seen.add(identity)
    if (previous.some(item => item.equipmentTypeId === pair.equipmentTypeId && item.equipmentModelId === pair.equipmentModelId)) continue
    if (!types.some(item => item.id === pair.equipmentTypeId && item.status === 'ENABLED')) throw new Error('请选择启用的设备类型。')
    if (pair.equipmentModelId && !models.some(item => item.id === pair.equipmentModelId && item.equipmentTypeId === pair.equipmentTypeId && item.enabled)) throw new Error('设备型号必须属于该类型且处于启用状态。')
  }
}
export function validateMaterialTemplateValues(template: MaterialTemplate, level: 'root'|'sku', values: MaterialSpecValues, complete: boolean, stage = 'BASE'): void {
  for (const field of template.fields.filter(item => item.level === level && item.type !== 'composition' && item.valueShape !== 'equipmentCompatibility')) {
    const raw = values[field.key], empty = raw === undefined || raw === null || raw === '' || Array.isArray(raw) && !raw.length
    if (field.requiredWhen === 'button-hole' && values.fastening === '脚式' && !empty) throw new Error('脚式纽扣不填写孔数，请清空孔数字段。')
    if (empty) { if (complete && materialFieldRequired(field, values, stage)) throw new Error(`提交前请补齐${field.label}。`); continue }
    if (field.type === 'number') {
      if (typeof raw !== 'number' || !Number.isFinite(raw) || (field.minimum !== undefined ? raw < field.minimum : raw <= 0)) throw new Error(`${field.label}需要${field.minimum === 0 ? '非负' : '大于 0 的'}数值。`)
      if (field.integer && !Number.isInteger(raw)) throw new Error(`${field.label}必须为整数。`)
    }
    if (field.valueShape === 'namedDimensions') validateMaterialDimensions(raw)
    if (field.key === 'fastening' && field.options && !field.options.includes(String(raw))) throw new Error('纽扣固定方式请选择孔式或脚式。')
  }
}
export function materialDictionaryReference(dimension: FlatDimensionId, value: string, previous?: MaterialDictionaryReference): MaterialDictionaryReference | undefined {
  if (previous && [previous.id, previous.name, previous.code].includes(value)) return { ...previous }
  const row = listConfigDimensionChoices(dimension).find(item => [item.id, item.name_zh, item.code, ...(item.aliases || [])].some(candidate => candidate.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase()))
  if (!row) return undefined // Existing free text remains visible; never invent an ID.
  if (row.status !== 'ENABLED') throw new Error('新选择的属性已停用，请在基础配置启用或重新选择。')
  return { id: row.id, code: row.code, name: row.name_zh }
}
export function materialAttributeReferences(template: MaterialTemplate, level: 'root'|'sku', values: MaterialSpecValues, previous: Record<string, MaterialDictionaryReference[]> = {}): Record<string, MaterialDictionaryReference[]> {
  const result: Record<string, MaterialDictionaryReference[]> = {}
  for (const field of template.fields.filter(item => item.level === level && (item.dictionaryId || item.enumDefinition) && item.valueShape !== 'equipmentCompatibility')) {
    const value = values[field.key], texts = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : typeof value === 'string' ? [value] : []
    result[field.key] = texts.filter(Boolean).map(text => {
      const old = previous[field.key]?.find(item => [item.id, item.name, item.code].includes(text))
      const reference = materialTemplateOptionReference(field, text, old)
      if (!reference) throw new Error(`请选择基础配置中有效的${field.label}。`)
      return reference
    })
  }
  return result
}
export function materialTemplateOptionReference(field: MaterialTemplateField, value: string, previous?: MaterialDictionaryReference): MaterialDictionaryReference | undefined {
  if (previous && [previous.id, previous.name, previous.code].includes(value)) return { ...previous }
  if (field.dictionaryId) {
    const reference = materialDictionaryReference(field.dictionaryId, value)
    return reference ? { ...reference, dictionaryId: field.dictionaryId } : undefined
  }
  const option = field.enumDefinition?.options.find(item => [item.id, item.value, item.label].includes(value))
  return option ? { id: option.id, code: option.value, name: option.label, dictionaryId: field.enumDefinition!.id, dictionaryVersion: field.enumDefinition!.version } : undefined
}
/** Bound rules validate the existing package/process object, not another data store. */
export function validateMaterialBoundFields(template: MaterialTemplate, level: 'package'|'process', values: Record<string, unknown>, complete: boolean, stage = 'BASE'): void {
  for (const field of getMaterialBoundFields(template, level)) {
    const key = field.modelBinding!.slice(level.length + 1), raw = values[key]
    const empty = raw === undefined || raw === null || raw === '' || Array.isArray(raw) && !raw.length
    if (empty) { if (complete && materialFieldRequired(field, values as MaterialSpecValues, stage)) throw new Error(`请补齐模板要求的${field.label}。`); continue }
    if (field.type === 'number' && (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0)) throw new Error(`${field.label}必须为正数；未知请留空。`)
  }
}
