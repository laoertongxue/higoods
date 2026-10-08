import { pcsRecordStore, registerPcsRepositoryReset } from './pcs-record-runtime.ts'
import type { MaterialArchiveKind } from './pcs-material-archive-types.ts'
import { FLAT_DIMENSION_META, type ConfigLog, type FlatDimensionId } from './pcs-config-dimensions.ts'
import { listConfigDimensionChoices } from './pcs-config-workspace-repository.ts'

// CFG-006..014: 受控模板，不执行用户公式。已创建档案引用固定模板版本。
export interface MaterialTemplateField {
  key: string; label: string; level: 'root' | 'sku' | 'package' | 'process'
  type: 'text' | 'number' | 'select' | 'multiSelect' | 'composition' | 'reference'
  unit?: string; unitId?: string; required: boolean; identity: boolean; options?: string[]; help?: string
  requiredWhen?: 'always' | 'dyed' | 'patterned' | 'optional' | 'button-hole'; dictionaryId?: FlatDimensionId
  valueShape?: 'namedDimensions' | 'equipmentCompatibility'
  integer?: boolean; minimum?: number
  modelBinding?: string
  enumDefinition?: { id: string; version: number; options: Array<{ id: string; value: string; label: string }> }
}
export interface MaterialTemplate {
  templateId: string; version: number; kind: MaterialArchiveKind; category: string
  categoryId?: string; categoryCode?: string
  categoryNames?: Record<string, string>; categoryAliases?: Record<string, string[]>
  name: string; status: 'DRAFT' | 'APPROVED'; fields: MaterialTemplateField[]
  updatedAt: string; updatedBy: string; changeNote: string; logs?: ConfigLog[]; enabled?: boolean
  previousVersionConversions?: Array<{ key: string; fromUnit: string; toUnit: string; factor: number }>
}
export interface MaterialUnitDefinition { id: string; code: string; label: string; dimension: 'length' | 'mass' | 'area' | 'count' | 'package' | 'volume'; precision: number; enabled: boolean; aliases?: string[]; updatedAt?: string; updatedBy?: string; logs?: ConfigLog[] }
export const PCS_MATERIAL_CONFIG_KEY = 'higood-pcs-material-config-v1'
const field = (key: string, label: string, level: MaterialTemplateField['level'], type: MaterialTemplateField['type'] = 'text', unit = '', required = true, identity = true, options?: string[]): MaterialTemplateField => ({ key, label, level, type, unit, required, identity, options })
const color = { ...field('color', '颜色', 'sku', 'select', '', true, true), dictionaryId: 'colors' as const }
const composition = { ...field('composition', '成分与比例', 'root', 'composition', '%'), dictionaryId: 'compositions' as const }
const material = field('material', '材质', 'root')
const fabricFields = [composition, { ...field('construction', '组织', 'root', 'select', '', true, true), dictionaryId: 'constructions' as const }, field('width', '幅宽', 'root', 'number', 'cm'), field('gramWeight', '克重', 'root', 'number', 'g/m²'), field('elasticity', '弹力说明', 'root', 'text', '', false, false), color]
const definitions: Array<[MaterialArchiveKind, string, MaterialTemplateField[]]> = [
  ...['毛织布', '梭织布', '经编布', '里布', '网布', '牛仔布'].map(category => ['fabric', category, fabricFields] as [MaterialArchiveKind, string, MaterialTemplateField[]]),
  ...['花边辅料', '刺绣辅料', '装饰件'].map(category => ['accessory', category, [material, field('construction', '结构 / 款式', 'root'), field('width', '宽度', 'sku', 'number', 'mm', false), color]] as [MaterialArchiveKind, string, MaterialTemplateField[]]),
  ['accessory', '纽扣', [material, field('construction', '款式', 'root'), field('holeCount', '孔数', 'root', 'number', '孔'), field('fastening', '固定方式', 'root'), color, field('diameter', '直径', 'sku', 'number', 'mm'), field('thickness', '厚度', 'sku', 'number', 'mm')]],
  ['accessory', '拉链', [material, field('teeth', '齿型', 'root'), field('opening', '开合方式', 'root'), color, field('length', '长度', 'sku', 'number', 'cm'), field('gauge', '规格号', 'sku')]],
  ...['松紧带', '织带', '绳子'].map(category => ['accessory', category, [material, field('construction', '组织', 'root'), field(category === '绳子' ? 'diameter' : 'width', category === '绳子' ? '直径' : '宽度', 'root', 'number', 'mm'), color]] as [MaterialArchiveKind, string, MaterialTemplateField[]]),
  ...['针织用纱', '车缝线', '包缝线', '绣花线', '织带线'].map(category => ['yarn', category, [composition, { ...field('countSystem', '纱支体系', 'root', 'select', '', true, true), dictionaryId: 'yarnCountSystems' as const }, field('countValue', '纱支数值', 'root', 'number'), field('plies', '股数', 'root', 'number', '股'), field('twist', '捻度', 'root', 'number', '捻/m', false), field('usage', '用途', 'root', 'text', '', false, false), color]] as [MaterialArchiveKind, string, MaterialTemplateField[]]),
  ['consumable', '包装袋', [material, field('length', '长度', 'sku', 'number', 'cm'), field('width', '宽度', 'sku', 'number', 'cm'), field('thickness', '厚度', 'sku', 'number', 'mm')]],
  ['consumable', '胶带', [material, field('width', '宽度', 'sku', 'number', 'mm'), field('length', '标准长度', 'sku', 'number', 'm')]],
  ['consumable', '油剂', [field('model', '产品型号', 'root'), field('grade', '牌号 / 黏度等级', 'sku'), field('netContent', '净含量', 'sku', 'number', 'L')]],
  ...['裁剪耗材', '车缝耗材', '清洁耗材', '辅助耗材'].map(category => ['consumable', category, [material, field('usage', '用途', 'root', 'text', '', false, false), field('model', '型号', 'sku')]] as [MaterialArchiveKind, string, MaterialTemplateField[]]),
  ...['裁床配件', '缝纫机配件', '烫包配件', '检针配件', '通用配件'].map(category => ['parts', category, [field('partType', '部件类型', 'root'), material, { ...field('equipment', '适配设备', 'root', 'multiSelect'), dictionaryId: 'equipmentTypes' as const }, field('model', '型号', 'sku'), field('dimensions', '尺寸', 'sku'), field('interface', '接口 / 安装规格', 'sku')]] as [MaterialArchiveKind, string, MaterialTemplateField[]]),
  ['accessory', '流苏辅料', [material, field('construction', '结构 / 款式', 'root'), field('length', '长度', 'sku', 'number', 'cm'), color]],
  ['accessory', '刺绣花边', [material, field('construction', '结构 / 款式', 'root'), field('width', '宽度', 'sku', 'number', 'mm'), color]],
]
const templates: MaterialTemplate[] = definitions.map(([kind, category, fields], index) => ({ templateId: `material-template-${kind}-${index + 1}`, kind, category, name: `${category}属性`, version: 1, status: 'APPROVED', fields, updatedAt: '2026-10-05 09:00', updatedBy: '原型演示', changeNote: 'R1 分类模板' }))
// Keep published v1 records and their units intact. New archives may adopt v2;
// existing archives continue to read exactly the template version they saved.
const refinedTemplates = templates.filter(item => item.kind !== 'fabric').map(previous => {
  const next: MaterialTemplate = { ...structuredClone(previous), version: 2, updatedAt: '2026-10-05 18:00', changeNote: 'R1 字段核查：条件、单位与结构化规格补齐' }
  next.fields = next.fields.map(item => item.key === 'material' ? { ...item, type: 'select', dictionaryId: 'materialConstructions' } : item.key === 'construction' ? { ...item, type: 'select', dictionaryId: 'materialStructures' } : item.key === 'teeth' ? { ...item, type: 'select', dictionaryId: 'zipperTeeth' } : item.key === 'opening' ? { ...item, type: 'select', dictionaryId: 'zipperOpenings' } : item)
  if (next.category === '纽扣') next.fields = next.fields.map(item => item.key === 'fastening' ? { ...item, type: 'select', options: ['孔式', '脚式'] } : item.key === 'holeCount' ? { ...item, integer: true, minimum: 0, requiredWhen: 'button-hole', help: '孔式维护实际孔数；脚式不填写孔数。' } : item.key === 'thickness' ? { ...item, required: false } : item)
  if (next.category === '包装袋') {
    next.fields = next.fields.map(item => item.key === 'length' || item.key === 'width' ? { ...item, unit: 'mm' } : item.key === 'thickness' ? { ...item, unit: 'μm' } : item)
    next.previousVersionConversions = [{ key: 'length', fromUnit: 'cm', toUnit: 'mm', factor: 10 }, { key: 'width', fromUnit: 'cm', toUnit: 'mm', factor: 10 }, { key: 'thickness', fromUnit: 'mm', toUnit: 'μm', factor: 1000 }]
  }
  if (next.category === '油剂') next.fields = [field('model', '产品型号', 'root'), field('grade', '牌号', 'sku'), field('viscosityGrade', '黏度等级', 'sku'), field('netContent', '净含量', 'sku', 'number', 'L')]
  if (next.kind === 'parts') next.fields = next.fields.map(item => item.key === 'equipment' ? { ...item, label: '设备类型与型号适配', type: 'reference', valueShape: 'equipmentCompatibility' } : item.key === 'dimensions' ? { ...item, label: '命名尺寸', type: 'reference', valueShape: 'namedDimensions', help: '每一项分别填写尺寸名称、数值和单位，例如：外径 20 mm、厚度 3 mm。' } : item)
  if (['花边辅料', '刺绣辅料', '刺绣花边', '装饰件'].includes(next.category)) {
    next.fields = next.fields.map(item => item.key === 'width' ? { ...item, level: 'root', required: next.category !== '装饰件' } : item)
    next.fields.push(field('shape', '形状要求', 'root', 'text', '', false))
  }
  if (next.kind === 'yarn') next.fields = next.fields.map(item => item.key === 'plies' ? { ...item, integer: true } : item.key === 'usage' ? { ...item, type: 'multiSelect', dictionaryId: 'yarnUses' } : item)
  return next
})
templates.push(...refinedTemplates)
const units: MaterialUnitDefinition[] = [
  ['M', '米', 'length', 4], ['Yard', '码', 'length', 4], ['cm', '厘米', 'length', 2], ['mm', '毫米', 'length', 2],
  ['KG', '千克', 'mass', 4], ['g', '克', 'mass', 2], ['PCS', '个', 'count', 0], ['件', '件', 'count', 0], ['套', '套', 'count', 0], ['片', '片', 'count', 0], ['L', '升', 'volume', 4],
  ['包', '包', 'package', 0], ['箱', '箱', 'package', 0], ['卷', '卷', 'package', 0], ['筒', '筒', 'package', 0], ['瓶', '瓶', 'package', 0],
].map(([code, label, dimension, precision]) => ({ id: `unit-${code}`, code: String(code), label: String(label), dimension: dimension as MaterialUnitDefinition['dimension'], precision: Number(precision), enabled: true }))

export interface MaterialAttributeUnit { id: string; code: string; label: string; enabled: boolean; aliases?: string[] }
const attributeUnits: MaterialAttributeUnit[] = [
  { id: 'attribute-unit-micrometer', code: 'μm', label: '微米', enabled: true, aliases: ['µm', 'um'] },
  { id: 'attribute-unit-gsm', code: 'g/m²', label: '克每平方米', enabled: true, aliases: ['g/m2', 'g/㎡', 'gsm'] },
  { id: 'attribute-unit-turns-per-meter', code: '捻/m', label: '捻每米', enabled: true },
  { id: 'attribute-unit-percent', code: '%', label: '百分比', enabled: true },
  { id: 'attribute-unit-hole', code: '孔', label: '孔数', enabled: true },
  { id: 'attribute-unit-ply', code: '股', label: '股数', enabled: true },
  { id: 'attribute-unit-cubic-meter', code: 'm³', label: '立方米', enabled: true },
]
export function listMaterialAttributeUnitDefinitions(): MaterialAttributeUnit[] {
  return [...listMaterialUnitDefinitions().map(item => ({ id: item.id, code: item.code, label: item.label, enabled: item.enabled, aliases: item.aliases })), ...structuredClone(attributeUnits)]
}
function attributeUnitForText(value: string, choices = listMaterialAttributeUnitDefinitions()): MaterialAttributeUnit | undefined {
  return choices.find(item => [item.code, ...(item.aliases || []), ...(item.code === 'M' ? ['m'] : [])].includes(value))
}
function projectTemplateFieldReferences(template: MaterialTemplate, choices = listMaterialAttributeUnitDefinitions()): MaterialTemplate {
  const result = structuredClone(template)
  result.fields = result.fields.map(item => {
    if (item.unit && !item.unitId) item.unitId = attributeUnitForText(item.unit, choices)?.id
    if (['select', 'multiSelect'].includes(item.type) && !item.dictionaryId && !item.enumDefinition && item.options?.length) {
      item.enumDefinition = { id: `${template.templateId}:enum:${item.key}`, version: template.version,
        options: item.options.map(value => ({ id: `${template.templateId}:enum:${item.key}:${encodeURIComponent(value)}`, value, label: value })) }
    }
    return item
  })
  return result
}
export function getMaterialBoundFieldDefaults(level: 'package' | 'process'): MaterialTemplateField[] {
  const make = (key: string, label: string, type: MaterialTemplateField['type'], unit = '', required = false, requiredWhen?: MaterialTemplateField['requiredWhen']) => ({ ...field(`${level}.${key}`, label, level, type, unit, required, false), modelBinding: `${level}.${key}`, requiredWhen })
  return level === 'package' ? [
    make('packageTypeId', '包装类型', 'reference', '', true), make('contentQty', '标准包装含量', 'number', '', true),
    make('contentUnitId', '含量单位', 'reference', '', true), make('netWeightPerMainKg', '每主单位净重', 'number', 'KG'),
    make('grossWeightKg', '每包装毛重', 'number', 'KG'), make('lengthCm', '包装长', 'number', 'cm'),
    make('widthCm', '包装宽', 'number', 'cm'), make('heightCm', '包装高', 'number', 'cm'),
    make('volumeM3', '包装体积', 'number', 'm³'), make('measurementBasis', '包装计量依据', 'text', '', true),
  ] : [
    make('inputSkuId', '直接投入 SKU', 'reference', '', true), make('processType', '本道加工类型', 'reference', '', true),
    make('processVersionId', '工艺资料版本', 'text', '', true), make('pantoneCode', 'Pantone 色号', 'reference', '', true, 'dyed'),
    make('patternId', '花型', 'reference', '', true, 'patterned'), make('patternVersionId', '花型版本', 'reference', '', true, 'patterned'),
    make('executionAssetIds', '执行资料', 'reference', '', true, 'patterned'), make('unitBridgeVersionId', '上道成本折算依据', 'reference'),
    make('deliveryRevisionSegment', '交付版次', 'text'),
  ]
}
// New metadata is published as a new version. Already referenced versions retain
// their field lists, units and local enum values without being rewritten.
const latestInitialTemplates = [...new Map(templates.map(item => [item.templateId, item])).values()]
templates.push(...latestInitialTemplates.map(previous => projectTemplateFieldReferences({ ...structuredClone(previous), version: previous.version + 1,
  changeNote: 'R1 完整字段契约：四层归属、稳定单位与受控字典',
  previousVersionConversions: [],
  fields: [...previous.fields.map(item => previous.category === '拉链' && item.key === 'gauge' ? { ...item, type: 'select' as const, dictionaryId: 'zipperGauges' as const } : structuredClone(item)), ...getMaterialBoundFieldDefaults('package'), ...getMaterialBoundFieldDefaults('process')] }, [...units, ...attributeUnits])))

export function getMaterialBoundFields(template: MaterialTemplate, level: 'package' | 'process'): MaterialTemplateField[] {
  const configured = template.fields.filter(item => item.level === level)
  return getMaterialBoundFieldDefaults(level).map(fallback => structuredClone(configured.find(item => item.modelBinding === fallback.modelBinding) || fallback))
}
export const MATERIAL_PROCESS_DEFINITIONS = [
  { id: 'DYEING', name: '染色', segment: '颜色-PantonePT', material: true, cutPiece: false },
  { id: 'PRINTING', name: '印花', segment: '花型-A/AB-[ST]YH', material: true, cutPiece: true },
  { id: 'EMBROIDERY', name: '绣花', segment: '花型XH', material: true, cutPiece: true },
  { id: 'HEAT_TRANSFER', name: '烫画', segment: '花型TH', material: true, cutPiece: true },
  { id: 'PLEATING', name: '压褶', segment: '', material: false, cutPiece: true },
  { id: 'SMOCKING', name: '打揽', segment: '', material: false, cutPiece: true },
] as const
export interface MaterialProcessConfiguration { id: string; name: string; segment: string; material: boolean; cutPiece: boolean; enabled: boolean; updatedAt?: string; updatedBy?: string; logs?: ConfigLog[] }
export interface MaterialEquipmentModel { id: string; equipmentTypeId: string; code: string; name: string; enabled: boolean; updatedAt?: string; updatedBy?: string }
interface Snapshot { version: number; templates: MaterialTemplate[]; units: MaterialUnitDefinition[]; processes: MaterialProcessConfiguration[]; equipmentModels?: MaterialEquipmentModel[] }
let cache: Snapshot | null = null
function snapshot(): Snapshot {
  if (cache) return cache
  const raw = pcsRecordStore.getItem(PCS_MATERIAL_CONFIG_KEY)
  const seed = { version: 2, templates: structuredClone(templates), units: structuredClone(units), processes: MATERIAL_PROCESS_DEFINITIONS.map(item => ({ ...item, enabled: true })), equipmentModels: [] }
  cache = raw ? { ...seed, ...JSON.parse(raw) } as Snapshot : seed
  return cache
}
export function getMaterialConfigSnapshot(): Snapshot { return structuredClone(snapshot()) }
export function resetMaterialConfigCache(): void { cache = null }
registerPcsRepositoryReset(resetMaterialConfigCache)
export function listMaterialTemplates(): MaterialTemplate[] { return snapshot().templates.map(item => materialTemplateCategoryIdentity(item)) }
export function listMaterialEquipmentModels(equipmentTypeId?: string): MaterialEquipmentModel[] { return structuredClone((snapshot().equipmentModels || []).filter(item => !equipmentTypeId || item.equipmentTypeId === equipmentTypeId)) }
export function saveMaterialEquipmentModel(input: MaterialEquipmentModel, operator: string): MaterialEquipmentModel {
  if (!listConfigDimensionChoices('equipmentTypes').some(item => item.id === input.equipmentTypeId && item.status === 'ENABLED') || !input.code.trim() || !input.name.trim()) throw new Error('请选择启用的设备类型，并填写型号编码和名称。')
  const previous = listMaterialEquipmentModels().find(item => item.id === input.id)
  if (previous && (previous.equipmentTypeId !== input.equipmentTypeId || previous.code !== input.code.trim())) throw new Error('已有型号的设备类型与编码不能更改。')
  if (listMaterialEquipmentModels().some(item => item.id !== input.id && item.equipmentTypeId === input.equipmentTypeId && item.code === input.code.trim())) throw new Error('同一设备类型下的型号编码不能重复。')
  const saved = { ...input, id: input.id || `equipment-model-${crypto.randomUUID()}`, code: input.code.trim(), name: input.name.trim(), updatedAt: new Date().toISOString(), updatedBy: operator }
  const next = getMaterialConfigSnapshot(); next.equipmentModels = [...(next.equipmentModels || []).filter(item => item.id !== saved.id), saved]
  pcsRecordStore.setItem(PCS_MATERIAL_CONFIG_KEY, JSON.stringify(next)); cache = next; return structuredClone(saved)
}
export function getMaterialTemplate(kind: MaterialArchiveKind, category: string): MaterialTemplate {
  const candidates = snapshot().templates.filter(item => item.kind === kind && item.status === 'APPROVED')
  const rows = candidates.filter(item => item.category === category)
  const selected = rows.sort((a, b) => b.version - a.version)[0]
  if (!selected || selected.enabled === false) throw new Error('该物料分类没有启用的已审核模板，请先维护基础配置。')
  return resolveTemplateOptions(selected)
}
export function getMaterialTemplateByVersion(templateId: string, version: number): MaterialTemplate {
  const item = snapshot().templates.find(row => row.templateId === templateId && row.version === version)
  if (!item) throw new Error('档案引用的模板版本不存在，请核对资料。')
  return resolveTemplateOptions(item)
}
function resolveTemplateOptions(template: MaterialTemplate): MaterialTemplate {
  // Dictionary selections are immutable between workspace saves. Cache the
  // projection only for that exact source; callers still receive their own copy.
  const dictionarySource = pcsRecordStore.getItem('higood-pcs-config-workspace-store-v1')
  if (dictionarySource !== resolvedDictionarySource) { resolvedTemplateOptions = new WeakMap(); resolvedDictionarySource = dictionarySource }
  const cached = resolvedTemplateOptions.get(template)
  if (cached) return copyMaterialTemplate(cached)
  const result = materialTemplateCategoryIdentity(template)
  for (const item of result.fields) if (item.dictionaryId) item.options = listConfigDimensionChoices(item.dictionaryId).filter(row => row.status === 'ENABLED').map(row => row.name_zh)
  resolvedTemplateOptions.set(template, copyMaterialTemplate(result))
  return result
}
/** Known scalar schema: preserve caller isolation without repeatedly invoking
 * the generic structured-clone serializer for every field in a CSV batch. */
function copyMaterialTemplate(template: MaterialTemplate): MaterialTemplate {
  const copy: MaterialTemplate = { ...template,
    fields: template.fields.map(field => {
      const item = { ...field }
      if (field.options) item.options = [...field.options]
      if (field.enumDefinition) item.enumDefinition = { ...field.enumDefinition, options: field.enumDefinition.options.map(option => ({ ...option })) }
      return item
    }),
  }
  if (template.categoryNames) copy.categoryNames = { ...template.categoryNames }
  if (template.categoryAliases) copy.categoryAliases = Object.fromEntries(Object.entries(template.categoryAliases).map(([key, values]) => [key, [...values]]))
  if (template.logs) copy.logs = structuredClone(template.logs)
  if (template.previousVersionConversions) copy.previousVersionConversions = template.previousVersionConversions.map(item => ({ ...item }))
  return copy
}
let resolvedDictionarySource: string | null | undefined
let resolvedTemplateOptions = new WeakMap<MaterialTemplate, MaterialTemplate>()
/** Legacy templates receive stable read projections, never a read-time migration. */
function materialTemplateCategoryIdentity(template: MaterialTemplate): MaterialTemplate {
  const suffix = template.templateId.replace(/^material-template-/, '')
  return { ...projectTemplateFieldReferences(template), categoryNames: { zh: template.category, ...template.categoryNames }, categoryAliases: structuredClone(template.categoryAliases || {}), categoryId: template.categoryId || `material-category-${suffix}`, categoryCode: template.categoryCode || `MC-${suffix.toUpperCase()}` }
}
export function listMaterialUnitDefinitions(): MaterialUnitDefinition[] {
  // Unit records contain scalars plus aliases and audit entries. Preserve
  // caller isolation without invoking the generic serializer for every SKU in
  // an import; configuration saves still replace the source snapshot.
  return snapshot().units.map(unit => ({ ...unit,
    ...(unit.aliases ? { aliases: [...unit.aliases] } : {}),
    ...(unit.logs ? { logs: structuredClone(unit.logs) } : {}),
  }))
}
export function listFixedMaterialConversions(): Array<{ fromUnit: string; toUnit: string; factor: number }> {
  return [{ fromUnit: 'Yard', toUnit: 'M', factor: 0.9144 }, { fromUnit: 'cm', toUnit: 'M', factor: 0.01 }, { fromUnit: 'mm', toUnit: 'M', factor: 0.001 }, { fromUnit: 'g', toUnit: 'KG', factor: 0.001 }]
}
export function saveMaterialTemplateVersion(template: MaterialTemplate, operator: string): MaterialTemplate {
  const previous = snapshot().templates.filter(item => item.templateId === template.templateId)
  const current = previous.find(item => item.version === template.version)
  const currentView = current ? materialTemplateCategoryIdentity(current) : undefined
  template = structuredClone(template)
  if (!template.category.trim() || !template.fields.length) throw new Error('请输入分类与至少一个属性。')
  for (const level of ['package', 'process'] as const) if (!template.fields.some(item => item.level === level)) template.fields.push(...getMaterialBoundFieldDefaults(level))
  const choices = listMaterialAttributeUnitDefinitions()
  const keys = new Set<string>()
  for (const item of template.fields) {
    const old = currentView?.fields.find(row => row.key === item.key)
    if (!item.key || !item.label || keys.has(item.key)) throw new Error('属性键和名称必填，属性键不得重复。')
    if (!['text', 'number', 'select', 'multiSelect', 'composition', 'reference'].includes(item.type)) throw new Error('请选择支持的属性类型。')
    if (!['root', 'sku', 'package', 'process'].includes(item.level)) throw new Error('属性归属只能是主档、SKU、包装或工艺。')
    if (item.level === 'package' || item.level === 'process') {
      const contract = getMaterialBoundFieldDefaults(item.level).find(row => row.modelBinding === item.modelBinding && row.key === item.key)
      if (!contract || contract.type !== item.type || item.identity || contract.unit !== item.unit || contract.required && (!item.required || (item.requiredWhen || 'always') !== (contract.requiredWhen || 'always'))) throw new Error('包装与工艺使用固定业务字段：可维护名称、帮助及更严格的必填要求，不能改变绑定、类型、单位或放宽核心要求。')
    } else if (item.modelBinding) throw new Error('包装与工艺绑定不能移到主档或 SKU。')
    if (item.unit?.trim()) {
      const projected = item.unitId ? choices.find(row => row.id === item.unitId) : attributeUnitForText(item.unit, choices)
      if (!projected || !projected.enabled && old?.unitId !== projected.id) throw new Error('请选择有效的属性单位。旧版未知单位需明确选择后保存新版本。')
      if (!item.unitId && !old && !item.modelBinding) throw new Error('新数值属性请选择稳定单位，不直接填写单位文字。')
      if (![projected.code, ...(projected.aliases || []), ...(projected.code === 'M' ? ['m'] : [])].includes(item.unit)) throw new Error('属性单位 ID 与单位文字不一致。')
      item.unitId = projected.id
    } else if (item.unitId) throw new Error('属性单位 ID 必须同时保留明确单位名称。')
    if (['select', 'multiSelect'].includes(item.type)) {
      if (item.dictionaryId) {
        if (!FLAT_DIMENSION_META.some(row => row.id === item.dictionaryId)) throw new Error('请选择有效的独立取值字典。')
        item.enumDefinition = undefined; item.options = undefined
      } else {
        const prior = old?.enumDefinition
        if (!prior || item.enumDefinition?.id !== prior.id) throw new Error('新选择型属性必须关联独立取值字典；旧版自有枚举需保留明确枚举引用。')
        const values = item.options || item.enumDefinition.options.map(row => row.value)
        if (!values.length || values.some(value => !value.trim()) || new Set(values).size !== values.length) throw new Error('旧版枚举选项不得为空或重复。')
        item.enumDefinition = { id: prior.id, version: current?.status === 'DRAFT' ? current.version : Math.max(0, ...previous.map(row => row.version)) + 1,
          options: values.map(value => ({ id: prior.options.find(row => row.value === value)?.id || `${prior.id}:${encodeURIComponent(value)}`, value, label: value })) }
        item.options = values
      }
    }
    if (item.requiredWhen && !['always', 'dyed', 'patterned', 'optional', 'button-hole'].includes(item.requiredWhen)) throw new Error('必填条件只能使用已支持的业务条件。')
    if (item.valueShape && !['namedDimensions', 'equipmentCompatibility'].includes(item.valueShape)) throw new Error('请选择支持的结构化字段格式。')
    if (item.valueShape && item.type !== 'reference') throw new Error('结构化字段需要使用引用类型。')
    if (item.minimum !== undefined && (!Number.isFinite(item.minimum) || item.type !== 'number')) throw new Error('最小值仅适用于数值属性。')
    if (item.type === 'composition' && item.unit !== '%') throw new Error('成分比例单位必须是百分比。')
    if (/^(emptyDifference|effectiveWidth|widthDeduction)$/i.test(item.key)) throw new Error('幅宽只保留一个字段，不维护额外扣减。')
    if (item.type === 'number' && ['width', 'length', 'diameter', 'thickness', 'gramWeight', 'twist'].includes(item.key) && !item.unit?.trim()) throw new Error('数值规格需要明确单位。')
    keys.add(item.key)
  }
  for (const level of ['package', 'process'] as const) if (getMaterialBoundFieldDefaults(level).some(field => !template.fields.some(item => item.modelBinding === field.modelBinding))) throw new Error('包装与工艺固定字段不能删除；请通过模板说明和可选要求维护。')
  const conversionKeys = new Set<string>()
  for (const conversion of template.previousVersionConversions || []) {
    const target = template.fields.find(item => item.key === conversion.key)
    if (conversionKeys.has(conversion.key) || !target || target.type !== 'number' || !conversion.fromUnit.trim() || target.unit !== conversion.toUnit || !Number.isFinite(conversion.factor) || conversion.factor <= 0) throw new Error('版本换算依据需对应唯一数值属性、明确原单位及匹配的新单位，并采用正数系数。')
    conversionKeys.add(conversion.key)
  }
  // A published version's transition describes how that version was reached.
  // Cloning it without another unit change must not apply the same factor again.
  if (current?.status === 'APPROVED') template.previousVersionConversions = (template.previousVersionConversions || []).filter(conversion => {
    const inherited = current.previousVersionConversions?.some(old => old.key === conversion.key && old.fromUnit === conversion.fromUnit && old.toUnit === conversion.toUnit && old.factor === conversion.factor)
    return !inherited || current.fields.find(item => item.key === conversion.key)?.unit !== template.fields.find(item => item.key === conversion.key)?.unit
  })
  if (!['fabric', 'accessory', 'yarn', 'consumable', 'parts'].includes(template.kind)) throw new Error('物料大类只能使用面料、辅料、纱线、耗材、配件。')
  const category = materialTemplateCategoryIdentity(template), priorCategory = current ? materialTemplateCategoryIdentity(current) : previous[0] ? materialTemplateCategoryIdentity(previous[0]) : undefined
  for (const [language, name] of Object.entries(category.categoryNames || {})) if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language) || !name.trim()) throw new Error('分类多语名称需要有效语言代码及非空名称。')
  if (category.categoryNames?.zh !== category.category) throw new Error('中文分类名称需与所属分类一致，其他语言名称请单独维护。')
  for (const [language, aliases] of Object.entries(category.categoryAliases || {})) if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language) || !Array.isArray(aliases) || aliases.some(value => !value.trim()) || new Set(aliases).size !== aliases.length) throw new Error('分类语言别名需要有效语言代码，别名不能为空或重复。')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(category.categoryCode!)) throw new Error('分类业务编码仅使用字母、数字、点、下划线或短横线。')
  if (priorCategory && (category.categoryId !== priorCategory.categoryId || category.categoryCode !== priorCategory.categoryCode)) throw new Error('已有分类的稳定 ID 和业务编码不能变更。')
  if (snapshot().templates.some(item => item.templateId !== template.templateId && (materialTemplateCategoryIdentity(item).categoryId === category.categoryId || materialTemplateCategoryIdentity(item).categoryCode === category.categoryCode))) throw new Error('分类 ID 与业务编码须在物料分类中唯一。')
  if (current && (current.kind !== template.kind || current.category !== template.category)) throw new Error('已有模板不能变更所属大类或分类，请新建分类模板。')
  if (!previous.length && snapshot().templates.some(item => item.kind === template.kind && item.category === template.category.trim())) throw new Error('该分类已有模板，请从现有模板建立新版本。')
  if (previous.some(item => item.status === 'DRAFT' && item.version !== template.version)) throw new Error('此模板已有待审核版本，请先完成该版本。')
  const editingDraft = current?.status === 'DRAFT'
  const next = { ...category, category: template.category.trim(), version: editingDraft ? current.version : Math.max(0, ...previous.map(item => item.version)) + 1, status: 'DRAFT' as const, updatedAt: new Date().toISOString(), updatedBy: operator,
    logs: [...(editingDraft ? current.logs || [] : []), materialConfigLog('保存模板草稿', template.changeNote || '维护分类属性', operator)] }
  const result = { ...getMaterialConfigSnapshot(), templates: [...snapshot().templates.filter(item => !(editingDraft && item.templateId === next.templateId && item.version === next.version)), next] }
  pcsRecordStore.setItem(PCS_MATERIAL_CONFIG_KEY, JSON.stringify(result)); cache = result
  return next
}
export function approveMaterialTemplate(templateId: string, version: number, operator: string): void {
  const result = getMaterialConfigSnapshot()
  const target = result.templates.find(item => item.templateId === templateId && item.version === version)
  if (!target || target.status !== 'DRAFT') throw new Error('请选择待审核模板版本。')
  target.status = 'APPROVED'; target.updatedBy = operator; target.updatedAt = new Date().toISOString()
  target.logs = [...(target.logs || []), materialConfigLog('审核通过', `模板 v${version}供新建档案使用，旧档案保留引用版本。`, operator)]
  pcsRecordStore.setItem(PCS_MATERIAL_CONFIG_KEY, JSON.stringify(result)); cache = result
}
export function saveMaterialUnit(unit: MaterialUnitDefinition, operator = '当前用户'): void {
  if (!unit.code.trim() || !unit.label.trim() || !Number.isInteger(unit.precision) || unit.precision < 0 || unit.precision > 8) throw new Error('请填写单位编码、名称和 0–8 位精度。')
  const result = getMaterialConfigSnapshot()
  const current = result.units.find(item => item.id === unit.id)
  if (current && (current.code !== unit.code || current.dimension !== unit.dimension)) throw new Error('既有单位编码和量纲不可改变，请新增单位。')
  if (result.units.some(item => item.id !== unit.id && item.code === unit.code)) throw new Error('单位编码已存在。')
  if (!['length', 'mass', 'area', 'count', 'package', 'volume'].includes(unit.dimension)) throw new Error('请选择有效量纲。')
  if (['count', 'package'].includes(unit.dimension) && unit.precision !== 0) throw new Error('计数和包装单位不支持小数数量。')
  result.units = [...result.units.filter(item => item.id !== unit.id), { ...structuredClone(unit), updatedAt: new Date().toISOString(), updatedBy: operator,
    logs: [...(current?.logs || []), materialConfigLog(current ? '维护单位' : '新增单位', `${unit.code} · ${unit.label} · ${unit.enabled ? '启用' : '停用'}`, operator)] }]
  pcsRecordStore.setItem(PCS_MATERIAL_CONFIG_KEY, JSON.stringify(result)); cache = result
}

function materialConfigLog(action: string, detail: string, operator: string): ConfigLog {
  return { id: crypto.randomUUID(), action, detail, operator, operatorId: 'pcs-prototype-user', time: new Date().toLocaleString('sv-SE') }
}
export function listMaterialProcessConfigurations(): MaterialProcessConfiguration[] { return structuredClone(snapshot().processes) }
export function saveMaterialProcessConfiguration(process: MaterialProcessConfiguration, operator = '当前用户'): void {
  const rule = MATERIAL_PROCESS_DEFINITIONS.find(item => item.id === process.id)
  if (!rule || !process.name.trim()) throw new Error('请选择已支持的工艺并填写名称。')
  if (process.material !== rule.material || process.cutPiece !== rule.cutPiece || process.segment !== rule.segment) throw new Error('加工对象和编码构成受已确认业务规则约束，不可在字典中改变。')
  const result = getMaterialConfigSnapshot()
  const previous = result.processes.find(item => item.id === process.id)
  const next = { ...structuredClone(process), updatedAt: new Date().toISOString(), updatedBy: operator,
    logs: [...(previous?.logs || []), materialConfigLog('维护加工工艺', `${process.name} · ${process.enabled ? '启用' : '停用'}`, operator)] }
  result.processes = result.processes.map(item => item.id === process.id ? next : item)
  pcsRecordStore.setItem(PCS_MATERIAL_CONFIG_KEY, JSON.stringify(result)); cache = result
}
function materialRecords(): { records: Array<Record<string, any>>; skuRecords: Array<Record<string, any>>; unitRelations: Array<Record<string, any>> } {
  const raw = pcsRecordStore.getItem('higood-pcs-material-archive-store-v2')
  return { records: [], skuRecords: [], unitRelations: [], ...(raw ? JSON.parse(raw) : {}) }
}
export function getMaterialTemplateUsage(templateId: string, version: number): Array<{ id: string; label: string; href?: string }> {
  return materialRecords().records.filter(item => item.templateId === templateId && item.templateVersion === version).map(item => ({ id: item.materialId, label: `${item.materialCode} · ${item.materialName}`, href: `/pcs/materials/${item.kind}/${item.materialId}` }))
}
export function getMaterialUnitUsage(code: string): Array<{ id: string; label: string; href?: string }> {
  const records = materialRecords()
  const unit = listMaterialUnitDefinitions().find(item => item.code === code || item.id === code)
  const ids = new Set(records.unitRelations.filter(item => item.auxUnitId === code || item.auxUnitId === unit?.id).map(item => item.materialSkuId))
  return records.skuRecords.filter(item => item.mainUnit === code || item.mainUnit === unit?.code || item.mainUnitId === unit?.id || ids.has(item.materialSkuId)).map(item => ({ id: item.materialSkuId, label: item.materialSkuCode, href: `/pcs/materials/${records.records.find(root => root.materialId === item.materialId)?.kind || 'fabric'}/${item.materialId}/skus/${item.materialSkuId}` }))
}
