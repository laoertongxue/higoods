import { buildTechnicalVersionListByStyle } from './pcs-technical-data-version-view-model.ts'
import { migrateMaterialMockGallery, migrateMaterialMockImage } from './pcs-reviewed-image-catalog.ts'
import { tmfReferenceMaterials, tmfReferenceSkus, tmfReferenceMaterialLogs } from './pcs-tmf-material-reference-seeds.ts'
import { listStyleArchives } from './pcs-style-archive-repository.ts'
import { pcsRecordStore, readPcsMaterialSnapshot, registerPcsRepositoryReset, getPcsDurableFileReference, runPcsRecordCommand } from './pcs-record-runtime.ts'
import { buildProcessedMaterialCode, canonicalMaterialUnit, checkedMaterialCode, materialCodeSegment, fixedMaterialFactor, materialMoney, materialDecimalAdd, materialDecimalMultiply, materialPackageVolume, validateMaterialRelation, MATERIAL_CODE_RULE_VERSION, MATERIAL_PROCESS_NAMES } from './pcs-material-rules.ts'
import { addMaterialR1Demonstration } from './pcs-material-r1-seeds.ts'
import { getMaterialTemplate, getMaterialTemplateByVersion, listMaterialTemplates, listMaterialUnitDefinitions, listMaterialProcessConfigurations } from './pcs-material-config.ts'
import { getMaterialPatternReference } from './pcs-material-pattern.ts'
import { materialAttributeReferences, materialDictionaryReference, materialTemplateOptionReference, validateMaterialBoundFields, validateMaterialTemplateValues, validateMaterialEquipmentPairs } from './pcs-material-attributes.ts'
import type {
  MaterialArchiveKind,
  MaterialArchiveRecord,
  MaterialArchiveStatus,
  MaterialSkuDraftInput,
  MaterialArchiveStoreSnapshot,
  MaterialLogRecord,
  MaterialSkuRecord,
  MaterialUsageRecord,
  MaterialProcessDraft, MaterialProcessDefinition, MaterialUnitRelation, MaterialPackageSpec, MaterialStandardCostVersion, MaterialCostSnapshot, MaterialAsset, MaterialApprovalStatus, MaterialSpecValues,
} from './pcs-material-archive-types.ts'

export const MATERIAL_ARCHIVE_STORAGE_KEY = 'higood-pcs-material-archive-store-v2'
const MATERIAL_ARCHIVE_STORE_VERSION = 5

const MATERIAL_CATEGORY_OPTIONS: Record<MaterialArchiveKind, string[]> = {
  fabric: ['毛织布', '梭织布', '经编布', '里布', '网布', '牛仔布'],
  accessory: ['花边辅料', '纽扣', '拉链', '刺绣辅料', '松紧带', '织带', '绳子', '装饰件'],
  yarn: ['针织用纱', '车缝线', '包缝线', '绣花线', '织带线'],
  consumable: ['包装袋', '胶带', '油剂', '裁剪耗材', '车缝耗材', '清洁耗材', '辅助耗材'],
  parts: ['裁床配件', '缝纫机配件', '烫包设备配件', '检针设备配件', '通用设备配件'],
}

const MATERIAL_SKU_SPEC_META: Record<
  MaterialArchiveKind,
  {
    primaryLabel: string
    secondaryLabel: string
    primaryPlaceholder: string
    secondaryPlaceholder: string
  }
> = {
  fabric: {
    primaryLabel: '颜色',
    secondaryLabel: '克重',
    primaryPlaceholder: '例如：白色 / 黑色 / 蓝色',
    secondaryPlaceholder: '例如：160g / 180g / 220g',
  },
  accessory: {
    primaryLabel: '颜色',
    secondaryLabel: '规格',
    primaryPlaceholder: '例如：白色 / 金色 / 银色',
    secondaryPlaceholder: '例如：20mm / 标准款 / 左右配套',
  },
  yarn: {
    primaryLabel: '颜色',
    secondaryLabel: '纱支',
    primaryPlaceholder: '例如：白色 / 黑色',
    secondaryPlaceholder: '例如：40s/2 / 50s/2',
  },
  consumable: {
    primaryLabel: '颜色',
    secondaryLabel: '规格',
    primaryPlaceholder: '例如：白色 / 蓝色 / 通用',
    secondaryPlaceholder: '例如：24mm×50m / 标准卷',
  },
  parts: {
    primaryLabel: '适配设备',
    secondaryLabel: '型号 / 规格',
    primaryPlaceholder: '例如：裁床 / 平车 / 烫包台',
    secondaryPlaceholder: '例如：10英寸 / DBx1 11号 / 通用款',
  },
}

const MATERIAL_UNIT_DEFAULTS: Record<MaterialArchiveKind, { mainUnit: string; auxiliaryUnits: string[] }> = {
  fabric: { mainUnit: '米', auxiliaryUnits: ['Yard', '公斤', '卷'] },
  accessory: { mainUnit: 'PCS', auxiliaryUnits: ['米', '卷', '包'] },
  yarn: { mainUnit: '卷', auxiliaryUnits: ['公斤', '筒', '箱'] },
  consumable: { mainUnit: '卷', auxiliaryUnits: ['PCS', '箱', '米'] },
  parts: { mainUnit: 'PCS', auxiliaryUnits: ['把', '盒', '套'] },
}

let memorySnapshot: MaterialArchiveStoreSnapshot | null = null
// A successful command already normalized this exact immutable read view.
// Runtime resets must still check the authoritative string and configuration,
// but need not parse and normalize it again immediately after commit.
let preparedRead: { raw: string | object; config: string | null; snapshot: MaterialArchiveStoreSnapshot } | null = null

function cloneRecord(record: MaterialArchiveRecord): MaterialArchiveRecord { return structuredClone(record) }
function cloneSkuRecord(record: MaterialSkuRecord): MaterialSkuRecord { return structuredClone(record) }
function cloneUsageRecord(record: MaterialUsageRecord): MaterialUsageRecord { return { ...record } }
function cloneLogRecord(record: MaterialLogRecord): MaterialLogRecord { return { ...record } }
function cloneSnapshot(snapshot: MaterialArchiveStoreSnapshot): MaterialArchiveStoreSnapshot { return structuredClone(snapshot) }

function appendMissingByKey<T>(records: T[], seedRecords: T[], getKey: (item: T) => string): T[] {
  const existingKeys = new Set(records.map(getKey))
  return [...records, ...seedRecords.filter((item) => !existingKeys.has(getKey(item)))]
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function normalizeStatus(status: MaterialArchiveStatus): MaterialArchiveStatus {
  return ['INACTIVE', 'ARCHIVED', 'NOT_ENABLED'].includes(status) ? status : 'ACTIVE'
}

function normalizeUnitText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueUnits(units: unknown[]): string[] {
  const seen = new Set<string>()
  return units
    .map(normalizeUnitText)
    .filter((unit) => {
      if (!unit || seen.has(unit)) return false
      seen.add(unit)
      return true
    })
}

function resolveMainUnit(record: MaterialArchiveRecord): string {
  const defaults = MATERIAL_UNIT_DEFAULTS[record.kind]
  return normalizeUnitText(record.mainUnit) || defaults?.mainUnit || normalizeUnitText(record.pricingUnit) || 'PCS'
}

function resolveAuxiliaryUnits(record: MaterialArchiveRecord, mainUnit: string): string[] {
  const defaults = MATERIAL_UNIT_DEFAULTS[record.kind]
  const rawUnits = Array.isArray(record.auxiliaryUnits) ? record.auxiliaryUnits : []
  const baseUnits = rawUnits.length > 0 ? rawUnits : defaults?.auxiliaryUnits || []
  const units = uniqueUnits([...baseUnits, record.pricingUnit]).filter((unit) => unit !== mainUnit)
  const fallbackUnits = uniqueUnits(defaults?.auxiliaryUnits || []).filter((unit) => unit !== mainUnit)
  return units.length > 0 ? units : fallbackUnits
}

function normalizeRecord(record: MaterialArchiveRecord, templates = new Map<string, ReturnType<typeof getMaterialTemplateByVersion>>(), owned = false): MaterialArchiveRecord {
  // Older packaging archives are consumables in R1. Keep their code, category
  // label and attributes; this is a read projection, not a storage migration.
  const legacyPackaging = (record.kind as string) === 'packaging'
  const kind = legacyPackaging ? 'consumable' : record.kind
  const templateCategory = legacyPackaging ? '辅助耗材' : record.categoryName
  const mainUnit = resolveMainUnit(record)
  const templateKey = `${record.templateId || record.kind + ':' + record.categoryName}:${record.templateVersion || 1}`
  let template = templates.get(templateKey)
  if (!template) { template = record.templateId
    ? getMaterialTemplateByVersion(record.templateId, record.templateVersion || 1)
    : (() => {
      // Legacy records predate explicit template binding. Resolve their original
      // schema, even when that category is no longer selectable for new records.
      const original = listMaterialTemplates().find(item => item.kind === kind && item.category === templateCategory && item.version === 1)
      if (!original) throw new Error('档案引用的历史模板不存在，请核对资料。')
      return getMaterialTemplateByVersion(original.templateId, 1)
    })(); templates.set(templateKey, template) }
  // Parsed records (and command-owned drafts) are already private. Normalize
  // that object instead of allocating another dossier and copying its arrays.
  const result = owned ? record : cloneRecord(record)
  return Object.assign(result, {
    kind,
    mainImageUrl: migrateMaterialMockImage(record.materialCode, record.mainImageUrl, 'material'),
    status: normalizeStatus(record.status),
    approvalStatus: record.approvalStatus || 'APPROVED',
    templateId: template.templateId,
    templateVersion: template.version,
    categoryAttributes: result.categoryAttributes || {},
    compositionItems: result.compositionItems || [],
    equipmentCompatibility: result.equipmentCompatibility || [],
    widthValueCm: record.widthValueCm ?? (/cm/i.test(record.widthText || '') ? Number.parseFloat(record.widthText) || null : null),
    gramWeightGsm: record.gramWeightGsm ?? parseMaterialGramWeightGsm(record.gramWeightText),
    materialNameEn: record.materialNameEn || record.materialName,
    processTags: Array.isArray(result.processTags) ? result.processTags : [],
    galleryImageUrls: migrateMaterialMockGallery(record.materialCode, record.galleryImageUrls || []),
    widthText: record.widthText || '-',
    gramWeightText: record.gramWeightText || '-',
    pricingUnit: record.pricingUnit || 'PCS',
    mainUnit,
    auxiliaryUnits: resolveAuxiliaryUnits(record, mainUnit),
    unitConversions: Array.isArray(record.unitConversions)
      ? record.unitConversions
          .filter((item) => item && item.fromUnit?.trim() && item.toUnit?.trim() && Number.isFinite(item.factor) && item.factor > 0)
          .map((item) => ({ fromUnit: item.fromUnit.trim(), toUnit: item.toUnit.trim(), factor: item.factor }))
      : [],
    remark: record.remark || '',
    createdAt: record.createdAt || record.updatedAt || nowText(),
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.createdAt || nowText(),
    updatedBy: record.updatedBy || '系统初始化',
  })
}

/** Old weight text is only a standard areal mass when its unit explicitly says so. */
export function parseMaterialGramWeightGsm(value: string | undefined): number | null {
  const match = value?.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:g\s*\/\s*(?:m[²2]|㎡)|g\s*\/\s*平方[米公尺]+|gsm|克\s*\/\s*平方米)$/i)
  const amount = match ? Number(match[1]) : null
  return amount !== null && Number.isFinite(amount) && amount > 0 ? amount : null
}

function normalizedEffectiveSpecs(values: MaterialSpecValues = {}, owned = false): MaterialSpecValues {
  const result = owned ? values : { ...values }
  if (result.widthCm !== undefined) { result.width = result.widthCm; delete result.widthCm }
  if (result.gramWeightGsm !== undefined) { result.gramWeight = result.gramWeightGsm; delete result.gramWeightGsm }
  return result
}
function normalizeSkuRecord(record: MaterialSkuRecord, owned = false): MaterialSkuRecord {
  const result = owned ? record : cloneSkuRecord(record)
  return Object.assign(result, {
    skuImageUrl: migrateMaterialMockImage(record.materialSkuCode, record.skuImageUrl, 'sku'),
    status: normalizeStatus(record.status),
    approvalStatus: record.approvalStatus || 'APPROVED',
    stage: record.stage || 'BASE',
    mainUnit: canonicalMaterialUnit(record.mainUnit || record.pricingUnit || 'PCS'),
    mainUnitVersion: record.mainUnitVersion || 1,
    codeRuleVersionId: record.codeRuleVersionId || 'legacy-preserved',
    identityValues: result.identityValues || {},
    effectiveSpecValues: normalizedEffectiveSpecs(result.effectiveSpecValues, true),
    barcodeAliases: result.barcodeAliases || [],
    pantoneCode: record.pantoneCode || '',
    patternCode: record.patternCode || '',
    specName: record.specName || '-',
    sizeName: record.sizeName || '-',
    pricingUnit: record.pricingUnit || 'PCS',
    unitConversions: Array.isArray(result.unitConversions) ? result.unitConversions : [],
    costPrice: Number.isFinite(record.costPrice) ? record.costPrice : 0,
    weightKg: Number.isFinite(record.weightKg) ? record.weightKg : 0,
    lengthCm: Number.isFinite(record.lengthCm) ? record.lengthCm : 0,
    widthCm: Number.isFinite(record.widthCm) ? record.widthCm : 0,
    heightCm: Number.isFinite(record.heightCm) ? record.heightCm : 0,
    createdAt: record.createdAt || record.updatedAt || nowText(),
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.createdAt || nowText(),
    updatedBy: record.updatedBy || '系统初始化',
  })
}

function normalizeUsageRecord(record: MaterialUsageRecord): MaterialUsageRecord {
  const rawRecord = record as MaterialUsageRecord & { technicalVersionCode?: string }
  return {
    ...cloneUsageRecord(record),
    technicalVersionId: record.technicalVersionId || '',
    technicalVersionLabel: record.technicalVersionLabel || rawRecord.technicalVersionCode || '未建立',
    updatedAt: record.updatedAt || nowText(),
  }
}

function normalizeLogRecord(record: MaterialLogRecord): MaterialLogRecord {
  return {
    ...cloneLogRecord(record),
    operatorName: record.operatorName || '系统初始化',
    createdAt: record.createdAt || nowText(),
  }
}

function buildUsageRecord(
  materialId: string,
  index: number,
  input: { styleCode: string; consumptionText: string; updatedAt: string },
): MaterialUsageRecord {
  const style = listStyleArchives().find((item) => item.styleCode === input.styleCode)
  const latestVersion = style ? buildTechnicalVersionListByStyle(style.styleId)[0] : null
  return normalizeUsageRecord({
    usageId: `${materialId}-usage-${String(index + 1).padStart(2, '0')}`,
    materialId,
    styleId: style?.styleId || '',
    styleCode: style?.styleCode || input.styleCode,
    styleName: style?.styleName || input.styleCode,
    technicalVersionId: latestVersion?.technicalVersionId || style?.currentTechPackVersionId || '',
    technicalVersionLabel: latestVersion?.versionLabel || style?.currentTechPackVersionLabel || '未建立',
    consumptionText: input.consumptionText,
    updatedAt: input.updatedAt,
  })
}

function buildLegacySeedSnapshot(): MaterialArchiveStoreSnapshot {
  const records: MaterialArchiveRecord[] = [
    {
      materialId: 'material_fabric_001',
      kind: 'fabric',
      materialCode: 'CNIDML360',
      materialName: '经编8坑-C2813',
      materialNameEn: 'Warp Wool Rib C2813',
      categoryName: '经编布',
      specSummary: '白色主布 / 可分色扩展',
      composition: '100% polyester',
      processTags: ['经编', '基础弹力'],
      widthText: '155cm',
      gramWeightText: '90g',
      pricingUnit: 'Yard',
      mainUnit: 'Yard',
      auxiliaryUnits: ['米', '公斤', '卷'],
      mainImageUrl: '/materials/archive/4595f8e168082d676f32f9b977984a2a.png',
      galleryImageUrls: ['/materials/archive/4595f8e168082d676f32f9b977984a2a.png'],
      status: 'ACTIVE',
      skuCount: 2,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'CNIDML360-white-1',
      remark: '老系统导出白色主布样例，沉淀为正式面料主档。',
      createdAt: '2026-04-15 15:40',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:10',
      updatedBy: '系统初始化',
    },
    {
      materialId: 'material_fabric_002',
      kind: 'fabric',
      materialCode: 'FAB-COTTON-180',
      materialName: '纯棉毛织布 180g',
      materialNameEn: 'Cotton Jersey 180g',
      categoryName: '毛织布',
      specSummary: 'T 恤主布 / 黑白双色',
      composition: '100% cotton',
      processTags: ['毛织', '匹染'],
      widthText: '180cm',
      gramWeightText: '180g/m²',
      pricingUnit: '米',
      mainUnit: '米',
      auxiliaryUnits: ['Yard', '公斤', '卷'],
      mainImageUrl: '/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg',
      galleryImageUrls: [
        '/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg',
        '/materials/archive/e0f7c7ce28085289101a5aaab57e8b72.jpg',
      ],
      status: 'ACTIVE',
      skuCount: 2,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'FAB-COTTON-180-WHT',
      remark: '从当前技术包主布抽象出的正式面料档案。',
      createdAt: '2026-04-10 10:00',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 08:45',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_accessory_001',
      kind: 'accessory',
      materialCode: 'FLSZ26041134',
      materialName: '欧根纱刺绣蕾丝小花',
      materialNameEn: 'Organza Embroidery Flower Lace',
      categoryName: '刺绣花边',
      specSummary: 'blue / pink / apricot / white',
      composition: 'polyester',
      processTags: ['刺绣', '蕾丝'],
      widthText: '4.5cm',
      gramWeightText: '-',
      pricingUnit: 'PCS',
      mainUnit: 'PCS',
      auxiliaryUnits: ['米', '卷', '包'],
      mainImageUrl: '/materials/archive/8e7910031d7e27bed3951f0369555a83.png',
      galleryImageUrls: [
        '/materials/archive/8e7910031d7e27bed3951f0369555a83.png',
        '/materials/archive/e6a76d165ac01ac683f40377e1515351.jpg',
        '/materials/archive/aee58e719c2f35faab770954c5d809ba.png',
      ],
      status: 'ACTIVE',
      skuCount: 4,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'FLSZ26041134-white',
      remark: '老系统导出辅料样例，当前沉淀为正式辅料主档。',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_accessory_002',
      kind: 'accessory',
      materialCode: 'FLSZ26041135',
      materialName: '20.5cm刺绣花边辅料',
      materialNameEn: '20.5cm Embroidery Lace Trim',
      categoryName: '花边辅料',
      specSummary: 'same as photo',
      composition: 'polyester',
      processTags: ['刺绣', '花边'],
      widthText: '20.5cm',
      gramWeightText: '-',
      pricingUnit: 'PCS',
      mainUnit: 'PCS',
      auxiliaryUnits: ['米', '卷', '包'],
      mainImageUrl: '/materials/archive/23c0221901139951ff63a0071c75267c.gif',
      galleryImageUrls: ['/materials/archive/23c0221901139951ff63a0071c75267c.gif'],
      status: 'ACTIVE',
      skuCount: 1,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'FLSZ26041135-sameasphoto',
      remark: '用于领口 / 袖口装饰，已进入 BOM 反查链路。',
      createdAt: '2026-04-13 15:25',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:26',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_accessory_003',
      kind: 'accessory',
      materialCode: 'FLSZ26031315',
      materialName: '130CM流苏',
      materialNameEn: '130CM Tassel Trim',
      categoryName: '流苏辅料',
      specSummary: '103 / SC-Khaki / PF-Pink',
      composition: 'polyester',
      processTags: ['流苏', '装饰辅料'],
      widthText: '130cm',
      gramWeightText: '-',
      pricingUnit: 'PCS',
      mainUnit: 'PCS',
      auxiliaryUnits: ['条', '米', '包'],
      mainImageUrl: '/materials/archive/f5271db2483941df347bce4c5ee60d64.jpg',
      galleryImageUrls: [
        '/materials/archive/f5271db2483941df347bce4c5ee60d64.jpg',
        '/materials/archive/597cd021cdc26b4c4ec98d67ea289851.png',
      ],
      status: 'ACTIVE',
      skuCount: 3,
      usedStyleCount: 1,
      usedTechPackCount: 1,
      barcodeTemplateCode: 'FLSZ26031315-103',
      remark: '来自老系统导出的流苏辅料，当前用于中式与节庆款装饰。',
      createdAt: '2026-03-14 18:51',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:32',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_accessory_elastic_001',
      kind: 'accessory',
      materialCode: 'ACC-ELASTIC-42CM',
      materialName: '腰口定长橡筋',
      materialNameEn: 'Waistband Elastic Tape',
      categoryName: '松紧带',
      specSummary: '本白 / 连续卷装来料 / 42cm 定长加工',
      composition: '78% polyester / 22% elastodiene',
      processTags: ['橡筋', '定长切割'],
      widthText: '6mm',
      gramWeightText: '-',
      pricingUnit: '米',
      mainUnit: '米',
      auxiliaryUnits: ['卷', '条'],
      mainImageUrl: '/materials/accessory-elastic-band.jpg',
      galleryImageUrls: ['/materials/accessory-elastic-band.jpg'],
      status: 'ACTIVE',
      skuCount: 1,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'ACC-ELASTIC-42CM-WHITE',
      remark: '腰口橡筋按米投入，进入生产阶段橡筋定长切割加工单。',
      createdAt: '2026-09-09 11:20',
      createdBy: '系统初始化',
      updatedAt: '2026-09-09 11:20',
      updatedBy: '系统初始化',
    },
    {
      materialId: 'material_yarn_001',
      kind: 'yarn',
      materialCode: 'THREAD-40S-002',
      materialName: '缝纫线 40s/2',
      materialNameEn: 'Sewing Thread 40s/2',
      categoryName: '车缝线',
      specSummary: 'Black / White',
      composition: 'polyester',
      processTags: ['车缝', '基础辅线'],
      widthText: '-',
      gramWeightText: '-',
      pricingUnit: '卷',
      mainUnit: '卷',
      auxiliaryUnits: ['公斤', '筒', '箱'],
      mainImageUrl: '/materials/archive/291197a6d0717c9d8832fff8b329299e.jpg',
      galleryImageUrls: ['/materials/archive/291197a6d0717c9d8832fff8b329299e.jpg'],
      status: 'ACTIVE',
      skuCount: 2,
      usedStyleCount: 4,
      usedTechPackCount: 4,
      barcodeTemplateCode: 'THREAD-40S-002-WHT',
      remark: '统一沉淀车缝线，不再散落于技术包自由文本。',
      createdAt: '2026-04-12 17:40',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:42',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_consumable_001',
      kind: 'consumable',
      materialCode: 'CONS-TAPE-001',
      materialName: '裁剪定位纸胶带',
      materialNameEn: 'Cutting Positioning Masking Tape',
      categoryName: '裁剪耗材',
      specSummary: '白色 / 24mm×50m',
      composition: '纸基胶带',
      processTags: ['裁剪辅助', '低值耗材'],
      widthText: '24mm×50m',
      gramWeightText: '-',
      pricingUnit: '卷',
      mainUnit: '卷',
      auxiliaryUnits: ['PCS', '箱', '米'],
      mainImageUrl: '/materials/archive/f8f3566efc82709add4e08fe108b7dfc.jpg',
      galleryImageUrls: ['/materials/archive/f8f3566efc82709add4e08fe108b7dfc.jpg'],
      status: 'ACTIVE',
      skuCount: 1,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'CONS-TAPE-001-WHT',
      remark: '车间裁剪定位、临时标记使用的低值耗材，不归入服装包材。',
      createdAt: '2026-04-12 18:10',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:48',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_parts_001',
      kind: 'parts',
      materialCode: 'PART-CUT-KNIFE-10IN',
      materialName: '裁床直刀 10英寸',
      materialNameEn: 'Cutting Machine Straight Knife 10in',
      categoryName: '裁床配件',
      specSummary: '10英寸 / 高碳钢 / 通用直刀机',
      composition: '高碳钢',
      processTags: ['裁床', '刀片', '设备配件'],
      widthText: '10英寸',
      gramWeightText: '-',
      pricingUnit: 'PCS',
      mainUnit: 'PCS',
      auxiliaryUnits: ['把', '盒', '套'],
      mainImageUrl: '/materials/archive/291197a6d0717c9d8832fff8b329299e.jpg',
      galleryImageUrls: ['/materials/archive/291197a6d0717c9d8832fff8b329299e.jpg'],
      status: 'ACTIVE',
      skuCount: 1,
      usedStyleCount: 0,
      usedTechPackCount: 0,
      barcodeTemplateCode: 'PART-CUT-KNIFE-10IN',
      remark: '生产车间设备使用的维修配件，用于裁床日常更换和备件管理。',
      createdAt: '2026-04-14 11:30',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 10:12',
      updatedBy: '设备管理员',
    },
  ]

  const skuRecords: MaterialSkuRecord[] = [
    {
      materialSkuId: 'material_fabric_001_sku_001',
      materialId: 'material_fabric_001',
      materialCode: 'CNIDML360',
      materialSkuCode: 'CNIDML360-white-1',
      materialName: '经编8坑-C2813',
      colorName: 'white',
      specName: '主布',
      sizeName: '1#',
      skuImageUrl: '/materials/archive/4595f8e168082d676f32f9b977984a2a.png',
      costPrice: 6.38,
      freightCost: 1.18,
      pricingUnit: 'Yard',
      weightKg: 0.28,
      lengthCm: 155,
      widthCm: 155,
      heightCm: 1,
      barcode: 'CNIDML360-white-1',
      status: 'ACTIVE',
      createdAt: '2026-04-15 15:40',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:10',
      updatedBy: '系统初始化',
    },
    {
      materialSkuId: 'material_fabric_001_sku_002',
      materialId: 'material_fabric_001',
      materialCode: 'CNIDML360',
      materialSkuCode: 'CNIDML360-blue-1',
      materialName: '经编8坑-C2813',
      colorName: 'blue',
      specName: '扩展色',
      sizeName: '1#',
      skuImageUrl: '/materials/archive/cf4795cd9b8a6964c389b1708d66678a.png',
      costPrice: 6.58,
      freightCost: 1.18,
      pricingUnit: 'Yard',
      weightKg: 0.28,
      lengthCm: 155,
      widthCm: 155,
      heightCm: 1,
      barcode: 'CNIDML360-blue-1',
      status: 'ACTIVE',
      createdAt: '2026-04-15 15:41',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:12',
      updatedBy: '系统初始化',
    },
    {
      materialSkuId: 'material_fabric_002_sku_001',
      materialId: 'material_fabric_002',
      materialCode: 'FAB-COTTON-180',
      materialSkuCode: 'FAB-COTTON-180-WHT',
      materialName: '纯棉毛织布 180g',
      colorName: 'White',
      specName: '主布',
      sizeName: '180g',
      skuImageUrl: '/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg',
      costPrice: 23.6,
      freightCost: 1.8,
      pricingUnit: '米',
      weightKg: 0.35,
      lengthCm: 180,
      widthCm: 180,
      heightCm: 1,
      barcode: 'FAB-COTTON-180-WHT',
      status: 'ACTIVE',
      createdAt: '2026-04-10 10:00',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 08:45',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_fabric_002_sku_002',
      materialId: 'material_fabric_002',
      materialCode: 'FAB-COTTON-180',
      materialSkuCode: 'FAB-COTTON-180-BLK',
      materialName: '纯棉毛织布 180g',
      colorName: 'Black',
      specName: '主布',
      sizeName: '180g',
      skuImageUrl: '/materials/archive/e0f7c7ce28085289101a5aaab57e8b72.jpg',
      costPrice: 24.2,
      freightCost: 1.8,
      pricingUnit: '米',
      weightKg: 0.35,
      lengthCm: 180,
      widthCm: 180,
      heightCm: 1,
      barcode: 'FAB-COTTON-180-BLK',
      status: 'ACTIVE',
      createdAt: '2026-04-10 10:02',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 08:45',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_001_sku_001',
      materialId: 'material_accessory_001',
      materialCode: 'FLSZ26041134',
      materialSkuCode: 'FLSZ26041134-blue',
      materialName: '欧根纱刺绣蕾丝小花',
      designRevisionProcesses: [],
      colorName: 'blue',
      specName: '小花刺绣',
      sizeName: '标准',
      skuImageUrl: '/materials/archive/8e7910031d7e27bed3951f0369555a83.png',
      costPrice: 0.46,
      freightCost: 0.03,
      pricingUnit: 'PCS',
      weightKg: 0.02,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 1,
      barcode: 'FLSZ26041134-blue',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_001_sku_002',
      materialId: 'material_accessory_001',
      materialCode: 'FLSZ26041134',
      materialSkuCode: 'FLSZ26041134-pink',
      materialName: '欧根纱刺绣蕾丝小花',
      colorName: 'pink',
      specName: '小花刺绣',
      sizeName: '标准',
      skuImageUrl: '/materials/archive/e6a76d165ac01ac683f40377e1515351.jpg',
      costPrice: 0.46,
      freightCost: 0.03,
      pricingUnit: 'PCS',
      weightKg: 0.02,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 1,
      barcode: 'FLSZ26041134-pink',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_001_sku_003',
      materialId: 'material_accessory_001',
      materialCode: 'FLSZ26041134',
      materialSkuCode: 'FLSZ26041134-apricot',
      materialName: '欧根纱刺绣蕾丝小花',
      colorName: 'apricot',
      specName: '小花刺绣',
      sizeName: '标准',
      skuImageUrl: '/materials/archive/aee58e719c2f35faab770954c5d809ba.png',
      costPrice: 0.46,
      freightCost: 0.03,
      pricingUnit: 'PCS',
      weightKg: 0.02,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 1,
      barcode: 'FLSZ26041134-apricot',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_001_sku_004',
      materialId: 'material_accessory_001',
      materialCode: 'FLSZ26041134',
      materialSkuCode: 'FLSZ26041134-white',
      materialName: '欧根纱刺绣蕾丝小花',
      colorName: 'white',
      specName: '小花刺绣',
      sizeName: '标准',
      skuImageUrl: '/materials/archive/03170a87fd957af3c1672371e197470a.png',
      costPrice: 0.46,
      freightCost: 0.03,
      pricingUnit: 'PCS',
      weightKg: 0.02,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 1,
      barcode: 'FLSZ26041134-white',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_002_sku_001',
      materialId: 'material_accessory_002',
      materialCode: 'FLSZ26041135',
      materialSkuCode: 'FLSZ26041135-sameasphoto',
      materialName: '20.5cm刺绣花边辅料',
      colorName: 'sameasphoto',
      specName: '花边',
      sizeName: '20.5cm',
      skuImageUrl: '/materials/archive/23c0221901139951ff63a0071c75267c.gif',
      costPrice: 5.8,
      freightCost: 0.15,
      pricingUnit: 'PCS',
      weightKg: 0.08,
      lengthCm: 21,
      widthCm: 4,
      heightCm: 1,
      barcode: 'FLSZ26041135-sameasphoto',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:25',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:26',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_003_sku_001',
      materialId: 'material_accessory_003',
      materialCode: 'FLSZ26031315',
      materialSkuCode: 'FLSZ26031315-103',
      materialName: '130CM流苏',
      colorName: '103',
      specName: '流苏',
      sizeName: '130cm',
      skuImageUrl: '/materials/archive/f5271db2483941df347bce4c5ee60d64.jpg',
      costPrice: 0.6,
      freightCost: 0.04,
      pricingUnit: 'PCS',
      weightKg: 0.05,
      lengthCm: 130,
      widthCm: 3,
      heightCm: 1,
      barcode: 'FLSZ26031315-103',
      status: 'ACTIVE',
      createdAt: '2026-03-14 18:51',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:32',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_003_sku_002',
      materialId: 'material_accessory_003',
      materialCode: 'FLSZ26031315',
      materialSkuCode: 'FLSZ26031315-sc-khaki',
      materialName: '130CM流苏',
      colorName: 'SC-Khaki',
      specName: '流苏',
      sizeName: '130cm',
      skuImageUrl: '/materials/archive/f5271db2483941df347bce4c5ee60d64.jpg',
      costPrice: 0.6,
      freightCost: 0.04,
      pricingUnit: 'PCS',
      weightKg: 0.05,
      lengthCm: 130,
      widthCm: 3,
      heightCm: 1,
      barcode: 'FLSZ26031315-sc-khaki',
      status: 'ACTIVE',
      createdAt: '2026-03-14 18:51',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:32',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_003_sku_003',
      materialId: 'material_accessory_003',
      materialCode: 'FLSZ26031315',
      materialSkuCode: 'FLSZ26031315-pf-pink',
      materialName: '130CM流苏',
      colorName: 'PF-Pink',
      specName: '流苏',
      sizeName: '130cm',
      skuImageUrl: '/materials/archive/597cd021cdc26b4c4ec98d67ea289851.png',
      costPrice: 0.6,
      freightCost: 0.04,
      pricingUnit: 'PCS',
      weightKg: 0.05,
      lengthCm: 130,
      widthCm: 3,
      heightCm: 1,
      barcode: 'FLSZ26031315-pf-pink',
      status: 'ACTIVE',
      createdAt: '2026-03-14 18:51',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:32',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_elastic_001_sku_001',
      materialId: 'material_accessory_elastic_001',
      materialCode: 'ACC-ELASTIC-42CM',
      materialSkuCode: 'ACC-ELASTIC-42CM-WHITE',
      materialName: '腰口定长橡筋',
      colorName: '本白',
      specName: '连续卷装来料',
      sizeName: '6mm / 42cm 定长',
      skuImageUrl: '/materials/accessory-elastic-band.jpg',
      costPrice: 0.82,
      freightCost: 0.06,
      pricingUnit: '米',
      weightKg: 0.01,
      lengthCm: 42,
      widthCm: 0.6,
      heightCm: 0.1,
      barcode: 'ACC-ELASTIC-42CM-WHITE',
      status: 'ACTIVE',
      createdAt: '2026-09-09 11:20',
      createdBy: '系统初始化',
      updatedAt: '2026-09-09 11:20',
      updatedBy: '系统初始化',
    },
    {
      materialSkuId: 'material_yarn_001_sku_001',
      materialId: 'material_yarn_001',
      materialCode: 'THREAD-40S-002',
      materialSkuCode: 'THREAD-40S-002-WHT',
      materialName: '缝纫线 40s/2',
      colorName: 'White',
      specName: '40s/2',
      sizeName: '常规',
      skuImageUrl: '/materials/archive/291197a6d0717c9d8832fff8b329299e.jpg',
      costPrice: 0.32,
      freightCost: 0.02,
      pricingUnit: '卷',
      weightKg: 0.06,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 10,
      barcode: 'THREAD-40S-002-WHT',
      status: 'ACTIVE',
      createdAt: '2026-04-12 17:40',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:42',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_yarn_001_sku_002',
      materialId: 'material_yarn_001',
      materialCode: 'THREAD-40S-002',
      materialSkuCode: 'THREAD-40S-002-BLK',
      materialName: '缝纫线 40s/2',
      colorName: 'Black',
      specName: '40s/2',
      sizeName: '常规',
      skuImageUrl: '/materials/archive/766c6496dba8cace985d7b8598a1a5cd.jpg',
      costPrice: 0.32,
      freightCost: 0.02,
      pricingUnit: '卷',
      weightKg: 0.06,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 10,
      barcode: 'THREAD-40S-002-BLK',
      status: 'ACTIVE',
      createdAt: '2026-04-12 17:41',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:42',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_consumable_001_sku_001',
      materialId: 'material_consumable_001',
      materialCode: 'CONS-TAPE-001',
      materialSkuCode: 'CONS-TAPE-001-WHT',
      materialName: '裁剪定位纸胶带',
      colorName: '白色',
      specName: '24mm×50m',
      sizeName: '标准卷',
      skuImageUrl: '/materials/archive/f8f3566efc82709add4e08fe108b7dfc.jpg',
      costPrice: 0.45,
      freightCost: 0.02,
      pricingUnit: '卷',
      weightKg: 0.02,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 2,
      barcode: 'CONS-TAPE-001-WHT',
      status: 'ACTIVE',
      createdAt: '2026-04-12 18:10',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:48',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_parts_001_sku_001',
      materialId: 'material_parts_001',
      materialCode: 'PART-CUT-KNIFE-10IN',
      materialSkuCode: 'PART-CUT-KNIFE-10IN-STD',
      materialName: '裁床直刀 10英寸',
      colorName: '裁床',
      specName: '10英寸直刀',
      sizeName: '通用款',
      skuImageUrl: '/materials/archive/291197a6d0717c9d8832fff8b329299e.jpg',
      costPrice: 68,
      freightCost: 4.5,
      pricingUnit: 'PCS',
      weightKg: 0.18,
      lengthCm: 25,
      widthCm: 3,
      heightCm: 0.3,
      barcode: 'PART-CUT-KNIFE-10IN-STD',
      status: 'ACTIVE',
      createdAt: '2026-04-14 11:30',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 10:12',
      updatedBy: '设备管理员',
    },
  ]

  // 设计改款演示物料：目标 SKU 明确指向加工结果；同一批白坯先染白、再印蓝花。
  const revisionMaterialId = 'material_design_revision_cotton_001'
  const revisionBase = skuRecords[0]
  records.push({ ...records[0], materialId: revisionMaterialId, materialCode: 'DR-COTTON-001', materialName: '设计改款白底蓝花棉布', specSummary: '幅宽 150 cm / 克重 180 g/㎡', composition: '100% 棉', widthText: '150 cm', gramWeightText: '180 g/㎡', mainImageUrl: '/materials/fei-ticket/blue-white-print-cotton.png', galleryImageUrls: ['/materials/fei-ticket/blue-white-print-cotton.png'], unitConversions: [{ fromUnit: '米', toUnit: 'Yard', factor: 1 / 0.9144 }], skuCount: 4, usedStyleCount: 0, usedTechPackCount: 0, remark: '设计改款演示用的白坯、染后中间品与最终印花 SKU。' })
  const revisionSku = (id: string, code: string, image: string, processes: MaterialSkuRecord['designRevisionProcesses'], extra: Partial<MaterialSkuRecord> = {}): MaterialSkuRecord => ({
    ...revisionBase, materialSkuId: id, materialId: revisionMaterialId, materialCode: 'DR-COTTON-001', materialName: '设计改款白底蓝花棉布',
    materialSkuCode: code, barcode: code, skuImageUrl: image, colorName: 'White', specName: '棉布', sizeName: '标准', pricingUnit: 'Yard',
    designRevisionProcesses: processes, ...extra,
  })
  skuRecords.push(
    revisionSku('dr_cotton_raw', 'DR-COTTON-001-RAW', '/materials/fei-ticket/white-poplin.png', []),
    revisionSku('dr_cotton_dyed', 'DR-COTTON-001-WHITE', '/materials/fei-ticket/white-poplin.png', ['DYEING'], { designRevisionRawSkuId: 'dr_cotton_raw', pantoneCode: '11-0601 TPX' }),
    revisionSku('dr_cotton_print', 'DR-COTTON-001-BLUE-PRINT', '/materials/fei-ticket/blue-white-print-cotton.png', ['PRINTING'], { designRevisionRawSkuId: 'dr_cotton_raw', patternCode: 'DR-BLUE-FLOWER-001', patternImageUrl: '/materials/fei-ticket/blue-white-print-cotton.png' }),
    revisionSku('dr_cotton_dye_print', 'DR-COTTON-001-WHITE-BLUE-PRINT', '/materials/fei-ticket/blue-white-print-cotton.png', ['DYEING', 'PRINTING'], { designRevisionRawSkuId: 'dr_cotton_raw', designRevisionDyedSkuId: 'dr_cotton_dyed', pantoneCode: '11-0601 TPX', patternCode: 'DR-BLUE-FLOWER-001', patternImageUrl: '/materials/fei-ticket/blue-white-print-cotton.png' }),
  )

  const usageRecords: MaterialUsageRecord[] = [
    buildUsageRecord('material_fabric_001', 0, { styleCode: 'SPU-SHIRT-086', consumptionText: '1.65 Yard/件', updatedAt: '2026-04-16 09:12' }),
    buildUsageRecord('material_fabric_001', 1, { styleCode: 'SPU-2024-017', consumptionText: '0.35 Yard/件', updatedAt: '2026-04-16 09:12' }),
    buildUsageRecord('material_fabric_002', 0, { styleCode: 'SPU-2024-001', consumptionText: '0.80 米/件', updatedAt: '2026-04-16 08:45' }),
    buildUsageRecord('material_fabric_002', 1, { styleCode: 'SPU-TEE-084', consumptionText: '0.76 米/件', updatedAt: '2026-04-16 08:45' }),
    buildUsageRecord('material_accessory_001', 0, { styleCode: 'SPU-DRESS-083', consumptionText: '2 PCS/件', updatedAt: '2026-04-16 09:20' }),
    buildUsageRecord('material_accessory_001', 1, { styleCode: 'SPU-2026-018', consumptionText: '1 PCS/件', updatedAt: '2026-04-16 09:20' }),
    buildUsageRecord('material_accessory_002', 0, { styleCode: 'SPU-2024-003', consumptionText: '0.6 PCS/件', updatedAt: '2026-04-16 09:26' }),
    buildUsageRecord('material_accessory_002', 1, { styleCode: 'SPU-2026-018', consumptionText: '0.4 PCS/件', updatedAt: '2026-04-16 09:26' }),
    buildUsageRecord('material_accessory_003', 0, { styleCode: 'SPU-2024-005', consumptionText: '1 PCS/件', updatedAt: '2026-04-16 09:32' }),
    buildUsageRecord('material_yarn_001', 0, { styleCode: 'SPU-2024-001', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:42' }),
    buildUsageRecord('material_yarn_001', 1, { styleCode: 'SPU-SHIRT-086', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:42' }),
    buildUsageRecord('material_yarn_001', 2, { styleCode: 'SPU-JACKET-085', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:42' }),
    buildUsageRecord('material_yarn_001', 3, { styleCode: 'SPU-2024-017', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:42' }),
    buildUsageRecord('material_consumable_001', 0, { styleCode: 'SPU-2024-001', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:48' }),
    buildUsageRecord('material_consumable_001', 1, { styleCode: 'SPU-2024-005', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:48' }),
  ]

  const logRecords: MaterialLogRecord[] = records.flatMap((record, index) => [
    {
      logId: `${record.materialId}-log-01`,
      materialId: record.materialId,
      operatorName: index % 2 === 0 ? '系统初始化' : '商品中心管理员',
      title: '初始化建档',
      detail: `完成 ${record.materialCode} / ${record.materialName} 的正式物料主档初始化。`,
      createdAt: record.createdAt,
    },
    {
      logId: `${record.materialId}-log-02`,
      materialId: record.materialId,
      operatorName: '系统同步',
      title: '补齐规格与引用',
      detail: `同步 ${record.skuCount} 条物料 SKU，并建立 ${record.usedStyleCount} 条款式引用关系。`,
      createdAt: record.updatedAt,
    },
  ])

  return {
    version: MATERIAL_ARCHIVE_STORE_VERSION,
    records: [...records, ...tmfReferenceMaterials].map(record => normalizeRecord(record)),
    skuRecords: [...skuRecords, ...tmfReferenceSkus].map(record => normalizeSkuRecord(record)),
    usageRecords: usageRecords.map(normalizeUsageRecord),
    logRecords: [...logRecords, ...tmfReferenceMaterialLogs].map(normalizeLogRecord),
  }
}

let seedCache: MaterialArchiveStoreSnapshot | null = null
function buildSeedSnapshot(): MaterialArchiveStoreSnapshot {
  if (!seedCache) seedCache = hydrateSnapshot(addMaterialR1Demonstration(buildLegacySeedSnapshot()))
  return cloneSnapshot(seedCache)
}
function hydrateSnapshot(snapshot: MaterialArchiveStoreSnapshot, owned = false): MaterialArchiveStoreSnapshot {
  const templates = new Map<string, ReturnType<typeof getMaterialTemplateByVersion>>()
  const records = snapshot.records.map(record => normalizeRecord(record, templates, owned))
  const roots = new Map(records.map(root => [root.materialId, root]))
  const usedRoots = new Set(snapshot.usageRecords.map(row => row.materialId))
  const skus = snapshot.skuRecords.map(raw => {
    const root = roots.get(raw.materialId)
    const record = owned ? raw : cloneSkuRecord(raw)
    record.mainUnit ||= root?.mainUnit || record.pricingUnit
    record.effectiveSpecValues ||= { widthCm: root?.widthValueCm ?? null, gramWeightGsm: root?.gramWeightGsm ?? null }
    record.mainUnitUsed ??= usedRoots.has(record.materialId)
    return normalizeSkuRecord(record, true)
  })
  const processes = [...(snapshot.processDefinitions || [])]
  const skuIds = new Set(skus.map(sku => sku.materialSkuId))
  // The old design-revision records already carry explicit predecessor IDs. Project
  // those references once in memory; never infer lineage by splitting a SKU code.
  for (const sku of skus) {
    if (sku.inputSkuId || !sku.designRevisionProcesses?.length) continue
    const last = sku.designRevisionProcesses.at(-1)!
    const inputId = last === 'PRINTING' && sku.designRevisionProcesses.includes('DYEING') ? sku.designRevisionDyedSkuId : sku.designRevisionRawSkuId
    if (!inputId || !skuIds.has(inputId)) continue
    sku.inputSkuId = inputId; sku.stage = last; sku.processDefinitionId = `legacy-process-${sku.materialSkuId}`
    const pantone = (sku.pantoneCode || '').trim().split(/\s+/)
    if (last === 'DYEING') { sku.pantoneSystem = sku.pantoneSystem || pantone[1] || 'TCX'; sku.pantoneCode = pantone[0] }
    processes.push({ processDefinitionId: sku.processDefinitionId, inputSkuId: inputId, outputSkuId: sku.materialSkuId, objectType: 'MATERIAL', processType: last,
      colorCode: sku.colorCode || sku.colorName, colorName: sku.colorName, pantoneSystem: sku.pantoneSystem, pantoneCode: sku.pantoneCode,
      patternCode: sku.patternCode, patternImageUrl: sku.patternImageUrl, patternVersionId: sku.patternCode ? 'legacy-preserved' : undefined,
      printSide: last === 'PRINTING' ? 'A' : undefined, penetration: false, processVersionId: 'legacy-preserved', executionAssetIds: [], codeRuleVersionId: 'LEGACY', createdAt: sku.createdAt })
  }
  const costs = [...(snapshot.costVersions || [])]
  const latestCosts = new Map(costs.map(cost => [cost.materialSkuId, cost]))
  for (const sku of skus) {
    if (!latestCosts.has(sku.materialSkuId)) { const cost: MaterialStandardCostVersion = {
      costVersionId: `legacy-standard-${sku.materialSkuId}`, materialSkuId: sku.materialSkuId,
      purchaseStandardCny: Number.isFinite(sku.costPrice) ? sku.costPrice : null,
      transportStandardCny: Number.isFinite(sku.freightCost) ? sku.freightCost : null,
      purchaseIncludesTransport: false, processStandardCny: null, pricingUnit: sku.pricingUnit,
      taxIncluded: true, effectiveAt: sku.updatedAt, changeReason: '既有原型标准承接', operatorName: '原型资料',
    }; costs.push(cost); latestCosts.set(sku.materialSkuId, cost) }
    sku.currentCostVersionId = latestCosts.get(sku.materialSkuId)?.costVersionId
  }
  return { version: MATERIAL_ARCHIVE_STORE_VERSION, records, skuRecords: skus,
    usageRecords: snapshot.usageRecords.map(normalizeUsageRecord), logRecords: snapshot.logRecords.map(normalizeLogRecord),
    processDefinitions: processes, unitRelations: [...(snapshot.unitRelations || [])],
    packages: [...(snapshot.packages || [])], costVersions: costs, assets: [...(snapshot.assets || [])] }
}
let materialMutationSnapshot: MaterialArchiveStoreSnapshot | null = null
function ensureSnapshotLoaded(): void {
  if (memorySnapshot) return
  const prepared = readPcsMaterialSnapshot()
  const raw = prepared?.token ?? pcsRecordStore.getItem(MATERIAL_ARCHIVE_STORAGE_KEY)
  if (!raw) { memorySnapshot = buildSeedSnapshot(); return }
  const config = pcsRecordStore.getItem('higood-pcs-material-config-v1')
  if (preparedRead?.raw === raw && preparedRead.config === config) { memorySnapshot = preparedRead.snapshot; return }
  const parsed = (prepared ? prepared.project(value => {
    const source = value as MaterialArchiveStoreSnapshot
    // Read normalization changes top-level dossier fields and effective specs.
    // Copy exactly those branches; all other nested values remain private and
    // read-only. Public getters and command drafts still deep-copy the view.
    return { ...source,
      records: source.records?.map(row => ({ ...row })),
      skuRecords: source.skuRecords?.map(row => ({ ...row, effectiveSpecValues: row.effectiveSpecValues ? { ...row.effectiveSpecValues } : undefined })),
    }
  }) : JSON.parse(raw as string)) as MaterialArchiveStoreSnapshot
  if (!Array.isArray(parsed.records) || !Array.isArray(parsed.skuRecords)) throw new Error('物料档案格式不完整，已保留原数据，请重新读取。')
  memorySnapshot = hydrateSnapshot({ ...parsed, usageRecords: parsed.usageRecords || [], logRecords: parsed.logRecords || [] }, true)
  preparedRead = { raw, config, snapshot: memorySnapshot }
}
function loadSnapshot(): MaterialArchiveStoreSnapshot {
  if (materialMutationSnapshot) return materialMutationSnapshot
  ensureSnapshotLoaded()
  return cloneSnapshot(memorySnapshot!)
}
function persistSnapshot(snapshot: MaterialArchiveStoreSnapshot, normalized = false): void {
  if (materialMutationSnapshot) { materialMutationSnapshot = snapshot; return }
  // loadSnapshot supplied a private command tree, so normalization can own it
  // instead of cloning each record again before serializing the same snapshot.
  const next = normalized ? snapshot : hydrateSnapshot(snapshot, true)
  const raw = JSON.stringify(next)
  pcsRecordStore.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, raw)
  preparedRead = pcsRecordStore.getItem(MATERIAL_ARCHIVE_STORAGE_KEY) === raw
    ? { raw, config: pcsRecordStore.getItem('higood-pcs-material-config-v1'), snapshot: next } : null
  memorySnapshot = next
}
/** Prepare a business import in memory once; the caller owns the record transaction. */
export function withMaterialArchiveMutationBatch<T>(recipe: () => T): T {
  if (materialMutationSnapshot) return recipe()
  materialMutationSnapshot = loadSnapshot()
  try {
    const result = recipe()
    if (result instanceof Promise) throw new Error('物料批量准备必须同步完成。')
    const next = materialMutationSnapshot
    materialMutationSnapshot = null
    persistSnapshot(next)
    return result
  } catch (error) { materialMutationSnapshot = null; throw error }
}
/** New-root imports have no dependencies outside their own root. Prepare that
 * root with the same business commands, without copying every existing record. */
export function prepareNewMaterialArchiveGroup<T>(recipe: () => T): { result: T; snapshot: MaterialArchiveStoreSnapshot } {
  if (materialMutationSnapshot) throw new Error('物料资料正在准备中，请稍后重试。')
  materialMutationSnapshot = { version: MATERIAL_ARCHIVE_STORE_VERSION, records: [], skuRecords: [], usageRecords: [], logRecords: [], processDefinitions: [], unitRelations: [], packages: [], costVersions: [], assets: [] }
  try {
    const result = recipe()
    if (result instanceof Promise) throw new Error('物料批量准备必须同步完成。')
    return { result, snapshot: hydrateSnapshot(materialMutationSnapshot) }
  } finally { materialMutationSnapshot = null }
}
export function getMaterialArchiveStoreSnapshot(): MaterialArchiveStoreSnapshot { return materialMutationSnapshot ? cloneSnapshot(materialMutationSnapshot) : loadSnapshot() }
export function resetMaterialArchiveCache(): void { memorySnapshot = null; materialMutationSnapshot = null }
registerPcsRepositoryReset(resetMaterialArchiveCache)
export function getMaterialArchiveBaseline(): MaterialArchiveStoreSnapshot { return buildSeedSnapshot() }
function nowId(prefix: string): string { return `${prefix}_${crypto.randomUUID()}` }
function log(snapshot: MaterialArchiveStoreSnapshot, materialId: string, title: string, detail: string, operatorName = '商品中心管理员'): void {
  snapshot.logRecords.unshift({ logId: nowId('material-log'), materialId, title, detail, operatorName, createdAt: nowText() })
}
function currentSnapshot(): MaterialArchiveStoreSnapshot { if (materialMutationSnapshot) return materialMutationSnapshot; ensureSnapshotLoaded(); return memorySnapshot! }
/** Review/lifecycle only change scalar fields on the selected dossier and its
 * own children. Copy those records; unrelated normalized dossiers stay read-only. */
function reviewSnapshot(id: string): MaterialArchiveStoreSnapshot {
  if (materialMutationSnapshot) return materialMutationSnapshot
  const source = currentSnapshot()
  return { ...source,
    records: source.records.map(row => row.materialId === id ? cloneRecord(row) : row),
    skuRecords: source.skuRecords.map(row => row.materialSkuId === id || row.materialId === id ? cloneSkuRecord(row) : row),
    logRecords: [...source.logRecords] }
}
/** Import uniqueness checks only need identities, not copies of every dossier. */
export function getMaterialArchiveIdentities(): { rootCodes: Set<string>; skuCodes: Set<string> } {
  const snapshot = currentSnapshot()
  return { rootCodes: new Set(snapshot.records.map(row => row.materialCode)), skuCodes: new Set(snapshot.skuRecords.map(row => row.materialSkuCode)) }
}
/** Only existing parents named in an archive CSV are needed for validation.
 * Never copy unrelated dossiers, cost history or logs for a new-root import. */
export function getMaterialImportReferenceSnapshot(rootCodes: ReadonlySet<string>): Pick<MaterialArchiveStoreSnapshot, 'records' | 'skuRecords' | 'unitRelations' | 'packages' | 'processDefinitions'> {
  const snapshot = currentSnapshot(), records = snapshot.records.filter(root => rootCodes.has(root.materialCode))
  const ids = new Set(records.map(root => root.materialId))
  return { records: records.map(cloneRecord), skuRecords: snapshot.skuRecords.filter(sku => ids.has(sku.materialId)).map(cloneSkuRecord), unitRelations: [], packages: [], processDefinitions: [] }
}
/** Read indexes belong to one immutable published snapshot. Mutable command
 * drafts rebuild their own lookup and never reuse published calculation data. */
function buildMaterialReadIndex(snapshot: MaterialArchiveStoreSnapshot) {
  const skusByRoot = new Map<string, MaterialSkuRecord[]>()
  for (const sku of snapshot.skuRecords) {
    const items = skusByRoot.get(sku.materialId)
    if (items) items.push(sku); else skusByRoot.set(sku.materialId, [sku])
  }
  return { roots: new Map(snapshot.records.map(row => [row.materialId, row])),
    rootsByCode: new Map(snapshot.records.map(row => [row.materialCode, row])),
    skus: new Map(snapshot.skuRecords.map(row => [row.materialSkuId, row])), skusByRoot,
    costs: new Map((snapshot.costVersions || []).map(row => [row.materialSkuId, row])),
    calculatedCosts: new Map<string, MaterialCostSnapshot>() }
}
let indexedSnapshot: MaterialArchiveStoreSnapshot | null = null
let readIndex: ReturnType<typeof buildMaterialReadIndex> | null = null
function materialReadIndex(snapshot = currentSnapshot()) {
  if (snapshot !== memorySnapshot || materialMutationSnapshot) return buildMaterialReadIndex(snapshot)
  if (indexedSnapshot !== snapshot || !readIndex) { indexedSnapshot = snapshot; readIndex = buildMaterialReadIndex(snapshot) }
  return readIndex
}
export function getMaterialArchiveCategoryOptions(kind: MaterialArchiveKind): Array<{ value: string; label: string }> {
  const latest = new Map<string, ReturnType<typeof listMaterialTemplates>[number]>()
  for (const item of listMaterialTemplates().filter(item => item.kind === kind && item.status === 'APPROVED')) if (!latest.has(item.templateId) || latest.get(item.templateId)!.version < item.version) latest.set(item.templateId, item)
  return [...new Set([...latest.values()].filter(item => item.enabled !== false).map(item => item.category))].map(value => ({ value, label: value }))
}
export function getMaterialSkuSpecMeta(kind: MaterialArchiveKind) { return { ...MATERIAL_SKU_SPEC_META[kind] } }
export function listMaterialArchives(kind?: MaterialArchiveKind): MaterialArchiveRecord[] {
  const snapshot = currentSnapshot()
  return snapshot.records.filter(item => !kind || item.kind === kind).map(item => ({ ...cloneRecord(item), skuCount: materialReadIndex(snapshot).skusByRoot.get(item.materialId)?.length || 0 })).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))
}
export function getMaterialArchiveByCode(materialCode: string): MaterialArchiveRecord | null {
  const record = materialReadIndex().rootsByCode.get(materialCode)
  return record ? cloneRecord(record) : null
}
export function getMaterialArchiveById(materialId: string): MaterialArchiveRecord | null {
  const record = materialReadIndex().roots.get(materialId)
  return record ? cloneRecord(record) : null
}
export function listAllMaterialSkuRecords(): MaterialSkuRecord[] { return currentSnapshot().skuRecords.map(cloneSkuRecord) }
export function listMaterialSkuRecordsByMaterialId(materialId: string): MaterialSkuRecord[] {
  return (materialReadIndex().skusByRoot.get(materialId) || []).map(cloneSkuRecord)
}
export function getMaterialSkuRecordById(materialSkuId: string): MaterialSkuRecord | null {
  const record = materialReadIndex().skus.get(materialSkuId)
  return record ? cloneSkuRecord(record) : null
}
export function resolveMaterialSkuIdentity(codeOrId: string): MaterialSkuRecord | null {
  const key = codeOrId.replace(/^pcs-material-sku:/, '').trim()
  const record = currentSnapshot().skuRecords.find(sku => [sku.materialSkuId, sku.materialSkuCode, sku.barcode, ...(sku.barcodeAliases || [])].includes(key))
  return record ? cloneSkuRecord(record) : null
}
export function listMaterialUsageRecordsByMaterialId(id: string): MaterialUsageRecord[] { return currentSnapshot().usageRecords.filter(item => item.materialId === id).map(cloneUsageRecord) }
export function listMaterialUsageRecordsByStyleCode(code: string): MaterialUsageRecord[] { return currentSnapshot().usageRecords.filter(item => item.styleCode === code).map(cloneUsageRecord) }
export function listMaterialLogRecordsByMaterialId(id: string): MaterialLogRecord[] { return currentSnapshot().logRecords.filter(item => item.materialId === id).map(cloneLogRecord) }
export function getMaterialStats(kind: MaterialArchiveKind) {
  const records = currentSnapshot().records.filter(item => item.kind === kind), ids = new Set(records.map(item => item.materialId))
  const skus = currentSnapshot().skuRecords.filter(item => ids.has(item.materialId)), usages = currentSnapshot().usageRecords.filter(item => ids.has(item.materialId))
  return { total: records.length, active: records.filter(item => item.status === 'ACTIVE').length, skuCount: skus.length, usageCount: usages.length,
    linkedStyleCount: new Set(usages.map(item => item.styleCode)).size, pending: records.filter(item => item.approvalStatus === 'PENDING').length + skus.filter(item => item.approvalStatus === 'PENDING').length,
    incompleteCost: skus.filter(item => getMaterialStandardCost(item.materialSkuId).completeness.length).length }
}
export interface MaterialListFilter {
  view: 'root' | 'sku'; search?: string; category?: string; stage?: string; process?: string
  color?: string; pantone?: string; pattern?: string; approval?: string; status?: string; cost?: string
}
export type MaterialRootListRow = Pick<MaterialArchiveRecord, 'materialId' | 'materialCode' | 'materialName' | 'categoryName' | 'specSummary' | 'mainImageUrl' | 'skuCount' | 'approvalStatus' | 'status' | 'updatedAt'>
export type MaterialSkuListRow = Pick<MaterialSkuRecord, 'materialId' | 'materialCode' | 'materialName' | 'materialSkuId' | 'materialSkuCode' | 'skuImageUrl' | 'colorName' | 'pantoneCode' | 'pantoneSystem' | 'patternCode' | 'stage' | 'inputSkuId' | 'mainUnit' | 'approvalStatus' | 'status' | 'updatedAt'>
/** List/export selection is computed from one snapshot. Return scalar list
 * projections, not whole dossiers, execution files and version histories. */
export function queryMaterialArchiveList(kind: MaterialArchiveKind, f: MaterialListFilter, options: { rows?: 'all' | 'current-view' } = {}) {
  const snapshot = currentSnapshot(), index = materialReadIndex(snapshot)
  const roots: MaterialRootListRow[] = [], skus: MaterialSkuListRow[] = []
  const projectRoots = options.rows !== 'current-view' || f.view === 'root'
  const projectSkus = options.rows !== 'current-view' || f.view === 'sku'
  let total = 0, skuCount = 0, pending = 0, incompleteCost = 0
  const search = f.search?.toLowerCase(), color = f.color?.toLowerCase()
  const matchesText = (parts: (string | undefined)[]) => !search || parts.join(' ').toLowerCase().includes(search)
  const hasProcess = (sku: MaterialSkuRecord) => {
    const seen = new Set<string>()
    let cursor: MaterialSkuRecord | undefined = sku
    while (cursor && !seen.has(cursor.materialSkuId)) {
      if (cursor.stage === f.process) return true
      seen.add(cursor.materialSkuId); cursor = cursor.inputSkuId ? index.skus.get(cursor.inputSkuId) : undefined
    }
    return false
  }
  for (const root of snapshot.records) {
    if (root.kind !== kind || f.category && root.categoryName !== f.category) continue
    if (f.view === 'root' && (f.approval && root.approvalStatus !== f.approval || f.status && root.status !== f.status)) continue
    const children = index.skusByRoot.get(root.materialId) || []
    let matched = 0
    for (const sku of children) {
      if (search && !matchesText([sku.materialSkuCode, sku.materialName, root.materialCode, ...(root.legacyCodes || []), ...(sku.barcodeAliases || [])])
        || f.stage && (sku.stage || 'BASE') !== f.stage || f.process && !hasProcess(sku)
        || color && !sku.colorName.toLowerCase().includes(color) || f.pantone && !sku.pantoneCode?.includes(f.pantone)
        || f.pattern && !sku.patternCode?.includes(f.pattern)
        || f.view === 'sku' && (f.approval && sku.approvalStatus !== f.approval || f.status && sku.status !== f.status)) continue
      const missingCost = materialCostIsIncomplete(snapshot, sku, index)
      if (f.cost && (f.cost === 'complete') === missingCost) continue
      matched++; skuCount++; if (missingCost) incompleteCost++; if (sku.approvalStatus === 'PENDING') pending++
      if (projectSkus) {
        const { materialId, materialCode, materialName, materialSkuId, materialSkuCode, skuImageUrl, colorName, pantoneCode, pantoneSystem, patternCode, stage, inputSkuId, mainUnit, approvalStatus, status, updatedAt } = sku
        skus.push({ materialId, materialCode, materialName, materialSkuId, materialSkuCode, skuImageUrl, colorName, pantoneCode, patternCode, pantoneSystem, stage, inputSkuId, mainUnit, approvalStatus, status, updatedAt })
      }
    }
    const emptyRootMatch = !children.length && f.view === 'root' && !f.stage && !f.process && !f.color && !f.pantone && !f.pattern && !f.cost && matchesText([root.materialCode, root.materialName, ...(root.legacyCodes || [])])
    if (!matched && !emptyRootMatch) continue
    total++
    if (root.approvalStatus === 'PENDING') pending++
    if (projectRoots) {
      const { materialId, materialCode, materialName, categoryName, specSummary, mainImageUrl, approvalStatus, status, updatedAt } = root
      roots.push({ materialId, materialCode, materialName, categoryName, specSummary, mainImageUrl, skuCount: children.length, approvalStatus, status, updatedAt })
    }
  }
  roots.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  skus.sort((a, b) => (index.roots.get(b.materialId)?.updatedAt || '').localeCompare(index.roots.get(a.materialId)?.updatedAt || ''))
  return { roots, skus, stats: { total, skuCount, pending, incompleteCost } }
}
export function buildTmfSemiFinishedSkuCode(input: { spuCode: string; pantoneCode?: string; colorCode: string; patternCode?: string }): string {
  if (!input.spuCode.trim() || !input.colorCode.trim()) throw new Error('TMF 半成品 SKU 至少需要 SPU 和颜色编码。')
  return checkedMaterialCode([input.spuCode, input.pantoneCode, input.colorCode, input.patternCode].filter(Boolean).join('-'))
}
export interface MaterialArchiveDraft {
  kind: MaterialArchiveKind; materialCode?: string; materialName: string; materialNameEn: string; categoryName: string; specSummary: string;
  composition: string; processTags: string[]; widthText: string; gramWeightText: string; pricingUnit: string; mainUnit?: string;
  auxiliaryUnits?: string[]; unitConversions?: MaterialArchiveRecord['unitConversions']; mainImageUrl: string; galleryImageUrls?: string[]; barcodeTemplateCode: string; remark: string;
  categoryAttributes?: MaterialSpecValues; categoryAttributeReferences?: MaterialArchiveRecord['categoryAttributeReferences']; compositionItems?: MaterialArchiveRecord['compositionItems']; equipmentCompatibility?: string[];
  equipmentCompatibilityDetails?: MaterialArchiveRecord['equipmentCompatibilityDetails']; subcategoryId?: string; materialNameTranslations?: Record<string,string>;
  templateId?: string; templateVersion?: number; firstSku?: MaterialSkuDraftInput;
}
function validateRoot(input: MaterialArchiveDraft, previous?: MaterialArchiveRecord): void {
  if (!input.materialName.trim() || !input.categoryName.trim()) throw new Error('请填写物料名称并选择子类。')
  if (input.compositionItems?.length && Math.abs(input.compositionItems.reduce((a,b) => a+b.percentage, 0)-100) > .00001) throw new Error('成分比例合计必须为 100%。')
  if (input.compositionItems?.some(item => !item.component.trim() || !Number.isFinite(item.percentage) || item.percentage < 0 || item.percentage > 100)) throw new Error('成分和比例需有效，单项比例应在 0 至 100% 之间。')
  if (new Set(input.compositionItems?.map(item => item.componentId || item.component.trim()) || []).size !== (input.compositionItems?.length || 0)) throw new Error('同一种成分不能重复，请合并比例。')
  if (input.kind === 'accessory' && ['织带', '绳子'].includes(input.categoryName)) {
    const key = input.categoryName === '绳子' ? 'diameter' : 'width', value = input.categoryAttributes?.[key]
    if (value !== undefined && value !== null && value !== '') {
      const template = input.templateId ? getMaterialTemplateByVersion(input.templateId, input.templateVersion || 1) : getMaterialTemplate(input.kind, input.categoryName)
      const field = template.fields.find(item => item.key === key && item.level === 'root')
      if (!['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) <= 0 || !field?.unit?.trim()) throw new Error(`${input.categoryName === '绳子' ? '绳子直径' : '织带宽度'}需填写大于 0 的数值，并采用属性模板中的明确单位。`)
    } else {
      // Existing TMF records kept their diameter/width in widthText. Do not
      // reinterpret an invalid structured value using an older text value.
      const legacyPattern = input.categoryName === '绳子'
        ? /^(?:[ΦφØø]|直径)?\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|毫米|厘米)\s*$/i
        : /^(-?\d+(?:\.\d+)?)\s*(mm|cm|毫米|厘米)\s*$/i
      const legacy = legacyPattern.exec((input.widthText || '').trim())
      if (!legacy || Number(legacy[1]) <= 0) throw new Error('织带宽度／绳子直径需使用明确的正数和单位。')
    }
  }
  const template = input.templateId ? getMaterialTemplateByVersion(input.templateId, input.templateVersion || 1) : getMaterialTemplate(input.kind, input.categoryName)
  validateMaterialTemplateValues(template, 'root', input.categoryAttributes || {}, false)
  if (template.fields.some(item => item.valueShape === 'equipmentCompatibility')) validateMaterialEquipmentPairs(input.equipmentCompatibilityDetails || [], false, previous?.equipmentCompatibilityDetails)
}
function materialDraftReferences(input: MaterialArchiveDraft, previous?: MaterialArchiveRecord): MaterialArchiveDraft {
  const template = input.templateId ? getMaterialTemplateByVersion(input.templateId, input.templateVersion || 1) : getMaterialTemplate(input.kind, input.categoryName)
  return { ...input, templateId: template.templateId, templateVersion: template.version, subcategoryId: previous?.subcategoryId || template.categoryId,
    materialNameTranslations: { ...previous?.materialNameTranslations, ...input.materialNameTranslations, zh: input.materialName, en: input.materialNameEn },
    categoryAttributeReferences: materialAttributeReferences(template, 'root', input.categoryAttributes || {}, previous?.categoryAttributeReferences),
    compositionItems: input.compositionItems?.map(item => { const prior = previous?.compositionItems?.find(old => old.component === item.component); return prior ? { ...item, componentId: prior.componentId } : { ...item, componentId: item.componentId || materialDictionaryReference('compositions', item.component)?.id } }) }
}
function requireEnabledUnit(unit: string, previousUnit?: string): void {
  if (previousUnit && canonicalMaterialUnit(previousUnit) === canonicalMaterialUnit(unit)) return
  if (!listMaterialUnitDefinitions().some(item => item.enabled && canonicalMaterialUnit(item.code) === canonicalMaterialUnit(unit))) throw new Error('请选择基础配置中已启用的计量单位。')
}
export function createMaterialArchive(input: MaterialArchiveDraft): MaterialArchiveRecord {
  input = materialDraftReferences(input)
  validateRoot(input)
  const snapshot = loadSnapshot(), timestamp = nowText(), prefixes = { fabric: 'FB', accessory: 'AC', yarn: 'YN', consumable: 'CS', parts: 'EP' }
  let sequence = snapshot.records.filter(item => item.kind === input.kind).length + 1
  let code = input.materialCode?.trim() ? materialCodeSegment(input.materialCode, '物料根码') : `MAT-${prefixes[input.kind]}-${String(sequence).padStart(8,'0')}`
  while (!input.materialCode && snapshot.records.some(item => item.materialCode === code)) code = `MAT-${prefixes[input.kind]}-${String(++sequence).padStart(8,'0')}`
  if (snapshot.records.some(item => item.materialCode === code)) throw new Error('该物料编码已存在，请使用不同编码。')
  checkedMaterialCode(code)
  const record = normalizeRecord({ ...input, materialId: nowId(`material-${input.kind}`), materialCode: code, status: 'NOT_ENABLED', approvalStatus: 'DRAFT',
    mainUnit: '', auxiliaryUnits: [], mainImageUrl: input.mainImageUrl, galleryImageUrls: input.galleryImageUrls || (input.mainImageUrl ? [input.mainImageUrl] : []),
    barcodeTemplateCode: input.barcodeTemplateCode || 'material-label-r1', skuCount: 0, usedStyleCount: 0, usedTechPackCount: 0,
    createdAt: timestamp, updatedAt: timestamp, createdBy: '商品中心管理员', updatedBy: '商品中心管理员' })
  snapshot.records.unshift(record)
  if (input.firstSku) snapshot.skuRecords.push(makeBaseSku(snapshot, record, input.firstSku))
  log(snapshot, record.materialId, '新建物料主档', `${record.materialCode}；仅建立物料资料。`)
  persistSnapshot(snapshot)
  return cloneRecord(record)
}
export function updateMaterialArchive(materialId: string, input: MaterialArchiveDraft): MaterialArchiveRecord {
  const snapshot = loadSnapshot(), root = snapshot.records.find(item => item.materialId === materialId)
  if (!root) throw new Error('物料主档不存在。')
  input = materialDraftReferences(input, root)
  validateRoot(input, root)
  if (root.approvalStatus === 'APPROVED' && (input.materialCode && input.materialCode !== root.materialCode || input.categoryName !== root.categoryName || JSON.stringify(input.categoryAttributes || {}) !== JSON.stringify(root.categoryAttributes || {}))) throw new Error('审核后的编码、分类和根技术身份不能直接改变，请新增规格。')
  if (root.approvalStatus === 'APPROVED' && ['composition', 'widthText', 'gramWeightText', 'compositionItems', 'equipmentCompatibility', 'equipmentCompatibilityDetails', 'templateId', 'templateVersion'].some(key => JSON.stringify(input[key as keyof MaterialArchiveDraft] ?? root[key as keyof MaterialArchiveRecord]) !== JSON.stringify(root[key as keyof MaterialArchiveRecord]))) throw new Error('已审核的根技术规格与模板版本已固定，请新增档案承接身份变化。')
  const nextCode = input.materialCode?.trim() ? materialCodeSegment(input.materialCode, '物料根码') : root.materialCode
  if (nextCode !== root.materialCode) {
    checkedMaterialCode(nextCode)
    if (snapshot.records.some(item => item.materialId !== materialId && item.materialCode === nextCode)) throw new Error('该物料根码已存在。')
    const owned = snapshot.skuRecords.filter(item => item.materialId === materialId)
    if (owned.some(item => item.approvalStatus === 'APPROVED' || item.mainUnitUsed) || snapshot.usageRecords.some(item => item.materialId === materialId)) throw new Error('已审核或已被引用的 SKU 使用该根码，不能修改。')
    const codes = new Map<string,string>()
    const derive = (sku: MaterialSkuRecord): string => {
      if (codes.has(sku.materialSkuId)) return codes.get(sku.materialSkuId)!
      const definition = snapshot.processDefinitions?.find(item => item.outputSkuId === sku.materialSkuId)
      const parent = sku.inputSkuId ? owned.find(item => item.materialSkuId === sku.inputSkuId) : null
      const code = definition && parent ? buildProcessedMaterialCode(derive(parent), { ...definition, skuImageUrl: sku.skuImageUrl }) : checkedMaterialCode(`${nextCode}-${sku.baseSpecSegment || sku.materialSkuCode.replace(`${root.materialCode}-`, '')}`)
      if (snapshot.skuRecords.some(item => item.materialId !== materialId && item.materialSkuCode === code)) throw new Error('调整根码后产生重复 SKU 编码。')
      codes.set(sku.materialSkuId, code); return code
    }
    owned.forEach(derive)
    for (const sku of owned) { const code = codes.get(sku.materialSkuId)!; if (sku.barcode === sku.materialSkuCode) sku.barcode = code; sku.materialSkuCode = code; sku.materialCode = nextCode }
  }
  Object.assign(root, input, { materialId, materialCode: nextCode, mainUnit: root.mainUnit, auxiliaryUnits: root.auxiliaryUnits, updatedAt: nowText(), updatedBy: '商品中心管理员' })
  log(snapshot, materialId, '修改物料资料', '保存名称、资料和适用技术属性。'); persistSnapshot(snapshot); return cloneRecord(root)
}
export function copyMaterialArchive(materialId: string): MaterialArchiveRecord {
  const root = getMaterialArchiveById(materialId)
  if (!root) throw new Error('物料主档不存在。')
  const copied = createMaterialArchive({ ...root, materialCode: undefined, materialName: `${root.materialName}（复制）`, firstSku: undefined })
  const snapshot = loadSnapshot()
  const assets = (snapshot.assets || []).filter(item => item.materialId === materialId)
  snapshot.assets ||= []
  snapshot.assets.push(...assets.map(asset => ({ ...asset, assetId: nowId('material-asset'), materialId: copied.materialId, materialSkuId: undefined, createdAt: nowText() })))
  if (assets.length) { log(snapshot, copied.materialId, '复制素材引用', `复用 ${assets.length} 项文件引用；不复制审核或业务历史。`); persistSnapshot(snapshot) }
  return copied
}
export function materialSkuIdentityFingerprint(input: { colorName?: string; colorCode?: string; pantoneCode?: string; pantoneSystem?: string; patternCode?: string; specName?: string; sizeName?: string; identityValues?: MaterialSpecValues }): string {
  return JSON.stringify([input.colorCode || input.colorName || '', input.pantoneSystem || '', input.pantoneCode || '', input.patternCode || '', Object.entries(input.identityValues || {}).sort()])
}
const skuIdentity = materialSkuIdentityFingerprint
function validateTemplateRequired(root: MaterialArchiveRecord, sku?: MaterialSkuRecord): void {
  const template = getMaterialTemplateByVersion(root.templateId!, root.templateVersion || 1)
  const values: MaterialSpecValues = sku ? { ...sku.identityValues, color: sku.colorName } : { ...root.categoryAttributes }
  validateMaterialTemplateValues(template, sku ? 'sku' : 'root', values, true, sku?.stage)
  const references = sku ? sku.identityReferences : root.categoryAttributeReferences
  for (const field of template.fields.filter(item => item.level === (sku ? 'sku' : 'root') && (item.dictionaryId || item.enumDefinition) && item.type !== 'composition' && item.valueShape !== 'equipmentCompatibility')) {
    const value = values[field.key], entries = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : typeof value === 'string' && value ? [value] : []
    if (entries.some(text => !references?.[field.key]?.some(item => [item.id, item.name, item.code].includes(text)) && !materialTemplateOptionReference(field, text))) throw new Error(`请在基础配置中维护并选择有效的${field.label}。`)
  }
  if (!sku && template.fields.some(field => field.type === 'composition' && field.required) && !root.compositionItems?.length) throw new Error('提交前请补齐成分与比例。')
  if (!sku && template.fields.some(field => field.valueShape === 'equipmentCompatibility')) validateMaterialEquipmentPairs(root.equipmentCompatibilityDetails || [], true, root.equipmentCompatibilityDetails)
}
function materialSkuReferences(root: MaterialArchiveRecord, input: MaterialSkuDraftInput, previous?: MaterialSkuRecord): MaterialSkuDraftInput {
  const template = getMaterialTemplateByVersion(root.templateId!, root.templateVersion || 1)
  validateMaterialTemplateValues(template, 'sku', { ...input.identityValues, color: input.colorName }, false)
  const sameColor = !!previous && input.colorName === previous.colorName && input.colorCode === previous.colorCode
  const previousColor = previous?.colorId ? { id: previous.colorId, name: previous.colorName, code: previous.colorCode || '' } : undefined
  const color = materialDictionaryReference('colors', input.colorName, previousColor)
    || (sameColor && input.colorCode ? materialDictionaryReference('colors', input.colorCode) : undefined)
  const samePantone = !!previous && input.pantoneSystem === previous.pantoneSystem && input.pantoneCode === previous.pantoneCode
  const pantone = input.pantoneSystem && input.pantoneCode ? materialDictionaryReference('pantone', `${input.pantoneSystem} ${input.pantoneCode}`, samePantone && previous.pantoneId ? { id: previous.pantoneId, name: `${input.pantoneSystem} ${input.pantoneCode}`, code: input.pantoneCode } : undefined) : undefined
  // An unchanged historical label may differ from the dictionary display name.
  // Retain it with the existing, explicitly matching code; never invent an ID.
  const previousReferences = { ...previous?.identityReferences }
  if (sameColor && color) previousReferences.color = [{ ...color, name: input.colorName }]
  const values: MaterialSpecValues = { ...input.identityValues, color: input.colorName }
  if (sameColor && !color) delete values.color
  return { ...input, colorId: color?.id || (input.colorName === previous?.colorName ? previous?.colorId : undefined), pantoneId: pantone?.id || (input.pantoneCode === previous?.pantoneCode && input.pantoneSystem === previous?.pantoneSystem ? previous?.pantoneId : undefined),
    identityReferences: materialAttributeReferences(template, 'sku', values, previousReferences) }
}
function validateSkuAliases(snapshot: MaterialArchiveStoreSnapshot, aliases: string[] | undefined, materialSkuId = ''): void {
  if (!aliases) return
  if (aliases.some(item => typeof item !== 'string' || !item.trim()) || new Set(aliases).size !== aliases.length) throw new Error('条码别名不能为空或重复。')
  if (snapshot.skuRecords.some(item => item.materialSkuId !== materialSkuId && aliases.some(alias => [item.materialSkuCode, item.barcode, ...(item.barcodeAliases || [])].includes(alias)))) throw new Error('条码别名已被其他 SKU 使用，不能指向多个物料。')
}
function makeBaseSku(snapshot: MaterialArchiveStoreSnapshot, material: MaterialArchiveRecord, input: MaterialSkuDraftInput): MaterialSkuRecord {
  input = materialSkuReferences(material, input)
  validateSkuAliases(snapshot, input.barcodeAliases)
  if (!input.mainUnit?.trim() && !material.mainUnit?.trim()) throw new Error('每个物料 SKU 必须选择一个主计量单位。')
  requireEnabledUnit(input.mainUnit || material.mainUnit)
  const existing = snapshot.skuRecords.filter(item => item.materialId === material.materialId)
  const duplicate = existing.find(item => (item.stage || 'BASE') === 'BASE' && skuIdentity(item) === skuIdentity(input))
  if (duplicate) throw new Error(`该身份规格已存在：${duplicate.materialSkuCode}，请查看原 SKU。`)
  const index = existing.filter(item => (item.stage || 'BASE') === 'BASE').length + 1
  const segment = `B${String(index).padStart(2,'0')}`, timestamp = nowText()
  const code = ['织带', '绳子'].includes(material.categoryName) ? buildTmfSemiFinishedSkuCode({ spuCode: material.materialCode, colorCode: input.colorCode || input.colorName, pantoneCode: input.pantoneCode, patternCode: input.patternCode }) : checkedMaterialCode(`${material.materialCode}-${segment}`)
  const sku = normalizeSkuRecord({ ...input, materialSkuId: nowId('material-sku'), materialId: material.materialId, materialCode: material.materialCode,
    materialSkuCode: code, materialName: input.materialName?.trim() || material.materialName, stage: 'BASE', approvalStatus: 'DRAFT', status: 'NOT_ENABLED', baseSpecSegment: segment,
    mainUnit: canonicalMaterialUnit(input.mainUnit || material.mainUnit), mainUnitUsed: false, pricingUnit: input.pricingUnit || input.mainUnit || material.mainUnit,
    effectiveSpecValues: input.effectiveSpecValues || { ...material.categoryAttributes, widthCm: material.widthValueCm ?? null, gramWeightGsm: material.gramWeightGsm ?? null },
    costPrice: input.purchaseStandardCny ?? input.costPrice ?? 0, freightCost: input.transportStandardCny ?? input.freightCost ?? 0,
    barcode: input.barcode || code, skuImageUrl: input.skuImageUrl || material.mainImageUrl, codeRuleVersionId: MATERIAL_CODE_RULE_VERSION,
    createdAt: timestamp, updatedAt: timestamp, createdBy: '商品中心管理员', updatedBy: '商品中心管理员' })
  snapshot.costVersions ||= []
  snapshot.costVersions.push({ costVersionId: nowId('material-cost'), materialSkuId: sku.materialSkuId,
    purchaseStandardCny: input.purchaseStandardCny === undefined ? materialMoney(input.costPrice) : materialMoney(input.purchaseStandardCny),
    transportStandardCny: input.transportStandardCny === undefined ? materialMoney(input.freightCost) : materialMoney(input.transportStandardCny),
    purchaseIncludesTransport: false, processStandardCny: null, pricingUnit: sku.pricingUnit, taxIncluded: true,
    effectiveAt: timestamp, changeReason: '初始标准', operatorName: '商品中心管理员' })
  return sku
}
export function createMaterialSkuRecord(materialId: string, input: MaterialSkuDraftInput): MaterialSkuRecord | null {
  const snapshot = loadSnapshot(), root = snapshot.records.find(item => item.materialId === materialId)
  if (!root) return null
  const sku = makeBaseSku(snapshot, root, input)
  snapshot.skuRecords.push(sku); log(snapshot, materialId, '新增基础 SKU', sku.materialSkuCode); persistSnapshot(snapshot); return cloneSkuRecord(sku)
}
export function updateMaterialSkuRecord(materialSkuId: string, input: MaterialSkuDraftInput): MaterialSkuRecord | null {
  const snapshot = loadSnapshot(), sku = snapshot.skuRecords.find(item => item.materialSkuId === materialSkuId)
  if (!sku) return null
  const root = snapshot.records.find(item => item.materialId === sku.materialId)!
  input = materialSkuReferences(root, input, sku)
  if (JSON.stringify(input.barcodeAliases) !== JSON.stringify(sku.barcodeAliases)) validateSkuAliases(snapshot, input.barcodeAliases, sku.materialSkuId)
  if (sku.approvalStatus === 'APPROVED' && skuIdentity(input) !== skuIdentity(sku)) throw new Error('审核后交付身份已锁定；改变颜色、色号或规格请新增 SKU。')
  if (sku.inputSkuId && skuIdentity(input) !== skuIdentity(sku)) throw new Error('加工产出的交付身份由加工定义生成；请从直接投入重新生成不同目标 SKU。')
  if (input.mainUnit && canonicalMaterialUnit(input.mainUnit) !== canonicalMaterialUnit(sku.mainUnit || sku.pricingUnit) && (sku.mainUnitUsed || sku.approvalStatus === 'APPROVED')) throw new Error('该 SKU 已审核或已使用，主计量单位不能修改。')
  if (input.netWeightPerMainKg !== undefined && input.netWeightPerMainKg !== null && (!Number.isFinite(input.netWeightPerMainKg) || input.netWeightPerMainKg <= 0)) throw new Error('每主单位净重应为正值；未维护请留空。')
  if (input.mainUnit !== undefined) { if (!input.mainUnit.trim()) throw new Error('主计量单位不能为空。'); requireEnabledUnit(input.mainUnit, sku.mainUnit) }
  if (!sku.inputSkuId && snapshot.skuRecords.some(item => item.materialSkuId !== materialSkuId && item.materialId === sku.materialId && !item.inputSkuId && skuIdentity(item) === skuIdentity(input))) throw new Error('该身份规格已存在，请使用已有 SKU。')
  const keep = { materialSkuCode: sku.materialSkuCode, costPrice: sku.costPrice, freightCost: sku.freightCost, mainUnitUsed: sku.mainUnitUsed || input.mainUnitUsed }
  Object.assign(sku, input, keep, { updatedAt: nowText() })
  log(snapshot, sku.materialId, '修改 SKU 资料', sku.materialSkuCode); persistSnapshot(snapshot); return cloneSkuRecord(sku)
}
export function getMaterialProcessDefinition(skuId: string): MaterialProcessDefinition | null {
  const value = currentSnapshot().processDefinitions?.find(item => item.outputSkuId === skuId)
  return value ? structuredClone(value) : null
}
export function listMaterialSkuLineage(skuId: string): MaterialSkuRecord[] {
  const byId = materialReadIndex().skus, chain: MaterialSkuRecord[] = [], seen = new Set<string>()
  let cursor = byId.get(skuId)
  while (cursor) {
    if (seen.has(cursor.materialSkuId)) throw new Error('加工前驱关系不能成环。')
    seen.add(cursor.materialSkuId); chain.unshift(cloneSkuRecord(cursor)); cursor = cursor.inputSkuId ? byId.get(cursor.inputSkuId) : undefined
  }
  return chain
}
export function createProcessedMaterialSku(input: MaterialProcessDraft): MaterialSkuRecord {
  if (input.processType !== 'DYEING' && input.patternId) {
    const front = getMaterialPatternReference(input.patternId, input.patternVersionId)
    if (input.patternCode && input.patternCode !== front.patternCode) throw new Error('花型编号与所选花型不一致。')
    input = { ...input, ...front, patternImageUrl: input.patternImageUrl || front.patternImageUrl }
    if (input.printSide === 'AB') {
      const back = getMaterialPatternReference(input.backPatternId || front.patternId, input.backPatternVersionId || front.patternVersionId)
      if (input.backPatternCode && input.backPatternCode !== back.patternCode) throw new Error('背面花型编号与所选花型不一致。')
      input = { ...input, backPatternId: back.patternId, backPatternCode: back.patternCode, backPatternVersionId: back.patternVersionId }
    }
  }
  const snapshot = loadSnapshot(), parent = snapshot.skuRecords.find(item => item.materialSkuId === input.inputSkuId)
  if (!parent) throw new Error('请选择存在的直接投入 SKU。')
  const root = snapshot.records.find(item => item.materialId === parent.materialId)!, template = getMaterialTemplateByVersion(root.templateId!, root.templateVersion || 1)
  validateMaterialBoundFields(template, 'process', { ...input, processVersionId: input.processVersionId || '1' }, false, input.processType)
  validateMaterialTemplateValues(template, 'root', input.effectiveSpecValues || {}, false)
  validateMaterialTemplateValues(template, 'sku', input.effectiveSpecValues || {}, false)
  if (!listMaterialProcessConfigurations().some(item => item.id === input.processType && item.enabled && item.material)) throw new Error('请选择已启用且适用于物料的加工工艺。')
  requireEnabledUnit(input.mainUnit || parent.mainUnit || parent.pricingUnit, parent.mainUnit)
  if (input.pricingUnit) requireEnabledUnit(input.pricingUnit, parent.pricingUnit)
  if (parent.status === 'INACTIVE' || parent.status === 'ARCHIVED') throw new Error('停用或归档的投入料不能新增选用。')
  if (listMaterialSkuLineage(parent.materialSkuId).some(item => item.stage === input.processType)) throw new Error('同一物料对象不重复相同工艺。返工记录在执行单；裁片加工请进入裁片工艺。')
  const code = buildProcessedMaterialCode(parent.materialSkuCode, input)
  if (snapshot.skuRecords.some(item => item.materialSkuCode === code)) throw new Error('相同交付规格已存在，请使用已有 SKU；同目标返工不新增永久编码。')
  const id = nowId('material-sku'), processId = nowId('material-process'), timestamp = nowText()
  const process: MaterialProcessDefinition = { ...input, processDefinitionId: processId, outputSkuId: id, objectType: 'MATERIAL',
    colorId: input.processType === 'DYEING' ? materialDictionaryReference('colors', input.colorName || '')?.id : undefined,
    pantoneId: input.processType === 'DYEING' ? materialDictionaryReference('pantone', `${input.pantoneSystem} ${input.pantoneCode}`)?.id : undefined,
    processVersionId: input.processVersionId || '1', executionAssetIds: [...(input.executionAssetIds || [])], codeRuleVersionId: MATERIAL_CODE_RULE_VERSION, createdAt: timestamp }
  const sku = normalizeSkuRecord({ ...parent, materialSkuId: id, materialSkuCode: code, barcode: code, barcodeAliases: [],
    inputSkuId: parent.materialSkuId, processDefinitionId: processId, stage: input.processType, approvalStatus: 'DRAFT', status: 'NOT_ENABLED',
    colorName: input.colorName || parent.colorName, colorCode: input.colorCode || parent.colorCode, pantoneSystem: input.pantoneSystem || parent.pantoneSystem,
    colorId: input.processType === 'DYEING' ? materialDictionaryReference('colors', input.colorName || '')?.id : parent.colorId,
    pantoneId: input.processType === 'DYEING' ? materialDictionaryReference('pantone', `${input.pantoneSystem} ${input.pantoneCode}`)?.id : parent.pantoneId,
    pantoneCode: input.pantoneCode || parent.pantoneCode, patternCode: input.patternCode || parent.patternCode, patternImageUrl: input.patternImageUrl || '',
    skuImageUrl: input.skuImageUrl, effectiveSpecValues: { ...parent.effectiveSpecValues, ...input.effectiveSpecValues },
    mainUnit: input.mainUnit || parent.mainUnit, pricingUnit: input.pricingUnit || parent.pricingUnit, mainUnitUsed: false,
    codeRuleVersionId: MATERIAL_CODE_RULE_VERSION, costPrice: 0, freightCost: 0, createdAt: timestamp, updatedAt: timestamp })
  snapshot.skuRecords.push(sku); snapshot.processDefinitions ||= []; snapshot.processDefinitions.push(process)
  snapshot.costVersions ||= []; snapshot.costVersions.push({ costVersionId: nowId('material-cost'), materialSkuId: id, purchaseStandardCny: null, transportStandardCny: null,
    purchaseIncludesTransport: false, processStandardCny: materialMoney(input.processStandardCny), pricingUnit: sku.pricingUnit, taxIncluded: true,
    effectiveAt: timestamp, changeReason: '新增加工标准', operatorName: '商品中心管理员' })
  log(snapshot, sku.materialId, `新增${MATERIAL_PROCESS_NAMES[input.processType]} SKU`, `${parent.materialSkuCode} → ${code}`); persistSnapshot(snapshot); return cloneSkuRecord(sku)
}
/** Availability belongs to both the exact SKU and its parent, and only gates new use. */
export function isMaterialSkuAvailableForNewUse(sku: MaterialSkuRecord | null | undefined): sku is MaterialSkuRecord {
  if (!sku || sku.status !== 'ACTIVE' || sku.approvalStatus !== 'APPROVED') return false
  const root = getMaterialArchiveById(sku.materialId)
  return root?.status === 'ACTIVE' && root.approvalStatus === 'APPROVED'
}
export function materialProcessOrderIntent(outputSkuId: string) {
  const sku = getMaterialSkuRecordById(outputSkuId), process = getMaterialProcessDefinition(outputSkuId)
  if (!sku || !process) throw new Error('请先完成目标 SKU 的加工定义。')
  if (!isMaterialSkuAvailableForNewUse(sku) || !isMaterialSkuAvailableForNewUse(getMaterialSkuRecordById(process.inputSkuId))) throw new Error('直接投入、目标物料及其主档须已审核并启用，才能新建加工计划。')
  return { inputSkuId: process.inputSkuId, outputSkuId, processDefinitionId: process.processDefinitionId, processType: process.processType,
    executionAssetIds: [...process.executionAssetIds], processVersionId: process.processVersionId }
}
/** A persisted business reference locks its adopted main unit; the referenced document remains owned by its domain. */
export function markMaterialSkuMainUnitUsed(skuIds: string[]): void {
  const snapshot = loadSnapshot()
  let changed = false
  for (const id of new Set(skuIds)) {
    const sku = snapshot.skuRecords.find(item => item.materialSkuId === id)
    if (!sku) throw new Error('引用的物料 SKU 不存在。')
    if (!sku.mainUnitUsed) { sku.mainUnitUsed = true; changed = true }
  }
  if (changed) persistSnapshot(snapshot)
}
export function setMaterialApproval(id: string, action: 'SUBMIT' | 'APPROVE' | 'REJECT', reason = ''): void {
  const snapshot = reviewSnapshot(id), root = snapshot.records.find(item => item.materialId === id), sku = snapshot.skuRecords.find(item => item.materialSkuId === id), record = root || sku
  if (!record) throw new Error('档案不存在。')
  if (action === 'SUBMIT') {
    if (record.approvalStatus === 'APPROVED') throw new Error('该档案已审核通过，新增规格请单独提交审核。')
    if (record.approvalStatus === 'PENDING') throw new Error('该档案已提交审核，请勿重复提交。')
    const targets = root ? snapshot.skuRecords.filter(item => item.materialId === id && item.approvalStatus !== 'APPROVED') : [sku!]
    if (root && (!root.mainImageUrl || !targets.length && !snapshot.skuRecords.some(item => item.materialId === id))) throw new Error('提交前请补齐物料主图及至少一个基础 SKU。')
    if (root && root.approvalStatus !== 'APPROVED') validateTemplateRequired(root)
    for (const target of targets) {
      if (!target.skuImageUrl || !target.mainUnit) throw new Error('提交前请补齐 SKU 识别图与主计量单位。')
      const targetRoot = snapshot.records.find(item => item.materialId === target.materialId)!
      validateTemplateRequired(targetRoot, target)
      const process = snapshot.processDefinitions?.find(item => item.outputSkuId === target.materialSkuId)
      if (process?.processType === 'DYEING' && (!process.pantoneSystem || !process.pantoneCode)) throw new Error('染色必须有 Pantone 体系及色号。')
      if (process?.processType === 'DYEING' && !process.pantoneId && !materialDictionaryReference('pantone', `${process.pantoneSystem} ${process.pantoneCode}`)) throw new Error('请先在 Pantone 字典维护对应体系及色号，再提交审核。')
      if (process && process.processType !== 'DYEING') {
        const front = getMaterialPatternReference(process.patternId || '', process.patternVersionId)
        let hasSavedPatternImage = false
        try { hasSavedPatternImage = Boolean(getPcsDurableFileReference(process.patternImageUrl || front.patternImageUrl)) } catch { /* Unattached preview cannot satisfy a formal image reference. */ }
        if (front.patternCode !== process.patternCode || !hasSavedPatternImage) throw new Error('请关联一致的花型编号、版本及已保存的真实展示图。')
        if (process.printSide === 'AB') {
          const back = getMaterialPatternReference(process.backPatternId || front.patternId, process.backPatternVersionId || front.patternVersionId)
          if (back.patternCode !== process.backPatternCode) throw new Error('背面花型与所选版本不一致。')
        }
        const requiredRole = process.processType === 'PRINTING' ? 'PRINT_FILE' : process.processType === 'EMBROIDERY' ? 'EMBROIDERY_FILE' : 'HEAT_TRANSFER_FILE'
        if (!process.patternVersionId || !process.executionAssetIds.some(id => snapshot.assets?.some(asset => asset.assetId === id && asset.materialId === target.materialId && asset.role === requiredRole))) throw new Error('印花、绣花、烫画提交前须关联花型版本及对应执行工艺资料。')
        if (process.printSide === 'AB' && process.backPatternCode !== process.patternCode && !process.backPatternVersionId) throw new Error('双面不同花必须明确背面花型版本。')
      }
      if (process) validateMaterialBoundFields(getMaterialTemplateByVersion(targetRoot.templateId!, targetRoot.templateVersion || 1), 'process', process as unknown as Record<string, unknown>, true, process.processType)
      target.approvalStatus = 'PENDING'
    }
    record.approvalStatus = 'PENDING'
  } else if (action === 'APPROVE') {
    if (record.approvalStatus !== 'PENDING') throw new Error('请先提交审核。')
    record.approvalStatus = 'APPROVED'
    if (root) snapshot.skuRecords.filter(item => item.materialId === id && item.approvalStatus === 'PENDING').forEach(item => item.approvalStatus = 'APPROVED')
  } else {
    if (!reason.trim()) throw new Error('驳回请填写原因。')
    if (record.approvalStatus !== 'PENDING') throw new Error('只有待审核档案可以驳回。')
    record.approvalStatus = 'DRAFT'
    if (root) snapshot.skuRecords.filter(item => item.materialId === id && item.approvalStatus === 'PENDING').forEach(item => item.approvalStatus = 'DRAFT')
  }
  log(snapshot, root?.materialId || sku!.materialId, action === 'SUBMIT' ? '提交审核' : action === 'APPROVE' ? '审核通过' : '驳回', reason || '身份审核不以标准成本完整为条件。')
  persistSnapshot(snapshot, true)
}
export interface MaterialApprovalBatchResult {
  id: string
  materialId: string
  code: string
  name: string
  objectType: '主档' | 'SKU' | '未知档案'
  ok: boolean
  message: string
}
type MaterialApprovalCommit = (recipe: () => void, operationId: string) => Promise<unknown>

/** Each result is appended only after its own record transaction completes. */
export async function runMaterialApprovalBatch(
  ids: readonly string[],
  action: 'SUBMIT' | 'APPROVE',
  batchId: string,
  commit: MaterialApprovalCommit = runPcsRecordCommand,
): Promise<MaterialApprovalBatchResult[]> {
  const results: MaterialApprovalBatchResult[] = []
  for (const id of new Set(ids)) {
    let result: MaterialApprovalBatchResult = { id, materialId: '', code: id, name: '未能读取档案', objectType: '未知档案', ok: false, message: '' }
    try {
      const root = getMaterialArchiveById(id), sku = root ? null : getMaterialSkuRecordById(id)
      if (root || sku) result = { ...result, materialId: root?.materialId || sku!.materialId, code: root?.materialCode || sku!.materialSkuCode, name: root?.materialName || sku!.materialName, objectType: root ? '主档' : 'SKU' }
      await commit(() => setMaterialApproval(id, action), `material-approval:${batchId}:${action}:${id}`)
      result.ok = true
      result.message = action === 'SUBMIT' ? '已提交审核并保存' : '已审核通过并保存'
    } catch (error) {
      result.message = error instanceof Error ? error.message : '本项未保存，请重试。'
    }
    results.push(result)
  }
  return results
}
export function setMaterialUseStatus(id: string, status: MaterialArchiveStatus): void {
  const snapshot = reviewSnapshot(id), root = snapshot.records.find(item => item.materialId === id), sku = snapshot.skuRecords.find(item => item.materialSkuId === id), record = root || sku
  if (!record) throw new Error('档案不存在。')
  if (status === 'ACTIVE' && record.approvalStatus !== 'APPROVED') throw new Error('审核通过后才能启用。')
  const materialId = root?.materialId || sku!.materialId
  if (status === 'ARCHIVED' && (snapshot.usageRecords.some(item => item.materialId === materialId) || snapshot.skuRecords.some(item => item.inputSkuId && (root ? snapshot.skuRecords.some(s => s.materialId === materialId && s.materialSkuId === item.inputSkuId) : item.inputSkuId === id) && item.status !== 'ARCHIVED'))) throw new Error('尚有活动技术引用，不能归档。')
  record.status = status; log(snapshot, materialId, '调整使用状态', status); persistSnapshot(snapshot, true)
}
export function listMaterialUnitRelations(skuId: string, includeHistory = false): MaterialUnitRelation[] {
  return (currentSnapshot().unitRelations || []).filter(item => item.materialSkuId === skuId && (includeHistory || item.status === 'ACTIVE')).map(item => structuredClone(item))
}
export function saveMaterialUnitRelation(skuId: string, input: Omit<MaterialUnitRelation, 'materialSkuId'|'createdAt'|'version'|'relationId'> & { relationId?: string }): MaterialUnitRelation {
  const snapshot = loadSnapshot(), sku = snapshot.skuRecords.find(item => item.materialSkuId === skuId)
  if (!sku) throw new Error('物料 SKU 不存在。')
  const previous = snapshot.unitRelations?.find(item => item.relationId === input.relationId)
  requireEnabledUnit(input.auxUnitId, previous?.auxUnitId)
  if (previous && !input.changeReason.trim()) throw new Error('调整换算关系请填写原因。')
  const relation: MaterialUnitRelation = { ...input, relationId: nowId('material-unit'), materialSkuId: skuId, version: (previous?.version || 0) + 1, createdAt: nowText() }
  validateMaterialRelation(sku.mainUnit || sku.pricingUnit, relation)
  if (relation.basisType === 'PACKAGE') { const pack = snapshot.packages?.find(p => p.packageSpecId === relation.packageSpecId && p.ownerSkuId === skuId && p.status === 'ACTIVE'); if (!pack) throw new Error('请选择当前 SKU 的有效包装规格。'); if (pack.packageTypeId !== relation.auxUnitId) throw new Error('辅助单位与包装类型不一致。') }
  if (previous && previous.materialSkuId !== skuId) throw new Error('单位关系不属于当前 SKU。')
  snapshot.unitRelations ||= []
  const same = snapshot.unitRelations.filter(item => item.materialSkuId === skuId && item.status === 'ACTIVE' && canonicalMaterialUnit(item.auxUnitId) === canonicalMaterialUnit(input.auxUnitId) && (item.packageSpecId || '') === (input.packageSpecId || ''))
  if (same.some(item => item.relationId !== previous?.relationId)) throw new Error('该辅助单位／包装规格已有有效关系，请编辑原关系以保留版本。')
  if (input.status === 'INACTIVE' && canonicalMaterialUnit(sku.pricingUnit) === canonicalMaterialUnit(input.auxUnitId)) throw new Error('当前计价仍依赖此单位关系，请先调整计价单位。')
  if (input.status === 'INACTIVE' && snapshot.processDefinitions?.some(process => process.inputSkuId === skuId && (process.unitBridgeVersionId === previous?.relationId || canonicalMaterialUnit(snapshot.skuRecords.find(item => item.materialSkuId === process.outputSkuId)?.pricingUnit || '') === canonicalMaterialUnit(input.auxUnitId)))) throw new Error('下游当前标准成本仍依赖此单位关系，请先调整下游计价或换算依据。')
  if (previous) previous.status = 'INACTIVE'
  for (const active of snapshot.unitRelations.filter(item => item.materialSkuId === skuId && item.status === 'ACTIVE')) active.isDefaultForUse = active.isDefaultForUse.filter(use => !relation.isDefaultForUse.includes(use))
  snapshot.unitRelations.push(relation)
  sku.unitConversions = snapshot.unitRelations.filter(item => item.materialSkuId === skuId && item.status === 'ACTIVE' && !item.packageSpecId).map(item => ({ fromUnit: item.auxUnitId, toUnit: sku.mainUnit!, factor: item.mainQtyPerAux }))
  log(snapshot, sku.materialId, '维护 SKU 单位关系', `1 ${relation.auxUnitId} = ${relation.mainQtyPerAux} ${sku.mainUnit}；版本 ${relation.version}`)
  persistSnapshot(snapshot); return structuredClone(relation)
}
/** Old root entry deliberately cannot bulk-overwrite every SKU's unit relationships. */
export function updateMaterialUnitConversions(_materialId: string, _conversions: MaterialArchiveRecord['unitConversions'], _operator: { id: string; name: string }): MaterialArchiveRecord {
  throw new Error('计量单位已归属各物料 SKU，请进入具体 SKU 的“计量单位”维护。')
}
export function getMaterialUnitFactor(skuId: string, fromUnit: string, toUnit: string, relationId?: string): number | null { return materialUnitFactorInSnapshot(currentSnapshot(), skuId, fromUnit, toUnit, relationId) }
export interface MaterialCostUnitConversion {
  factor: number | null
  kind: 'SAME' | 'FIXED' | 'SKU' | 'MISSING' | 'CHOICE'
  relationId?: string
  candidates: MaterialUnitRelation[]
  adoptedRelationIds: string[]
  basis: string
}
/** Preview and saved downstream costs use the same input-SKU conversion. */
export function getMaterialCostUnitConversion(skuId: string, outputUnit: string, upstreamUnit: string, relationId?: string): MaterialCostUnitConversion {
  return costUnitConversionInSnapshot(currentSnapshot(), skuId, outputUnit, upstreamUnit, relationId)
}
function costUnitConversionInSnapshot(snapshot: MaterialArchiveStoreSnapshot, skuId: string, outputUnit: string, upstreamUnit: string, relationId?: string): MaterialCostUnitConversion {
  const base = { candidates: [] as MaterialUnitRelation[], adoptedRelationIds: [] as string[] }
  if (!outputUnit || !upstreamUnit) return { ...base, kind: 'MISSING', factor: null, basis: '请明确加工费计价单位。' }
  const fixed = fixedMaterialFactor(outputUnit, upstreamUnit)
  if (fixed !== null) return { ...base, kind: canonicalMaterialUnit(outputUnit) === canonicalMaterialUnit(upstreamUnit) ? 'SAME' : 'FIXED', factor: fixed, basis: '基础配置 · 固定单位换算' }
  const sku = snapshot.skuRecords.find(item => item.materialSkuId === skuId)
  const relevant = [canonicalMaterialUnit(outputUnit), canonicalMaterialUnit(upstreamUnit)]
  const candidates = (snapshot.unitRelations || []).filter(item => item.materialSkuId === skuId && item.status === 'ACTIVE' && relevant.includes(canonicalMaterialUnit(item.auxUnitId)))
  const previous = relationId ? snapshot.unitRelations?.find(item => item.relationId === relationId && item.materialSkuId === skuId) : undefined
  const selected = previous ? candidates.find(item => item.auxUnitId === previous.auxUnitId && (item.packageSpecId || '') === (previous.packageSpecId || '')) : candidates.length === 1 ? candidates[0] : undefined
  const factor = relationId && !selected ? null : materialUnitFactorInSnapshot(snapshot, skuId, outputUnit, upstreamUnit, selected?.relationId)
  const used = selected ? [selected] : candidates.filter(item => sku && fixedMaterialFactor(item.auxUnitId, sku.mainUnit || sku.pricingUnit) === null)
  return { factor, kind: factor !== null ? 'SKU' : candidates.length > 1 ? 'CHOICE' : 'MISSING', relationId: selected?.relationId,
    candidates: candidates.map(item => ({ ...item })), adoptedRelationIds: used.map(item => item.relationId),
    basis: used.map(item => `${item.basisReference || '计量单位'}（v${item.version}）`).join('；') || '投入物料 SKU · 计量单位' }
}
function materialUnitFactorInSnapshot(snapshot: MaterialArchiveStoreSnapshot, skuId: string, fromUnit: string, toUnit: string, relationId?: string): number | null {
  const sku = snapshot.skuRecords.find(item => item.materialSkuId === skuId)
  if (!sku) return null
  const main = canonicalMaterialUnit(sku.mainUnit || sku.pricingUnit), from = canonicalMaterialUnit(fromUnit), to = canonicalMaterialUnit(toUnit)
  const relations = (snapshot.unitRelations || []).filter(item => item.materialSkuId === skuId && (relationId || item.status === 'ACTIVE'))
  const perMain = (unit: string): number | null => {
    if (unit === main) return 1
    const fixed = fixedMaterialFactor(unit, main)
    if (fixed !== null) return fixed
    const matches = relations.filter(item => canonicalMaterialUnit(item.auxUnitId) === unit && (!relationId || item.relationId === relationId))
    if (matches.length === 1) return matches[0].mainQtyPerAux
    const legacy = sku.unitConversions?.find(item => canonicalMaterialUnit(item.fromUnit) === unit && canonicalMaterialUnit(item.toUnit) === main)
    return legacy?.factor || null
  }
  const a = perMain(from), b = perMain(to)
  return a === null || b === null ? null : a / b
}
export function listMaterialPackageSpecs(skuId: string, history = false): MaterialPackageSpec[] {
  return (currentSnapshot().packages || []).filter(item => item.ownerSkuId === skuId && (history || item.status === 'ACTIVE')).map(item => structuredClone(item))
}
export function saveMaterialPackageSpec(skuId: string, input: Omit<MaterialPackageSpec, 'ownerSkuId'|'version'|'packageSpecId'> & { packageSpecId?: string }): MaterialPackageSpec {
  const snapshot = loadSnapshot(), sku = snapshot.skuRecords.find(item => item.materialSkuId === skuId)
  if (!sku) throw new Error('物料 SKU 不存在。')
  const root = snapshot.records.find(item => item.materialId === sku.materialId)!
  validateMaterialBoundFields(getMaterialTemplateByVersion(root.templateId!, root.templateVersion || 1), 'package', { ...input, netWeightPerMainKg: sku.netWeightPerMainKg, volumeM3: materialPackageVolume(input) }, true)
  if (!Number.isFinite(input.contentQty) || input.contentQty <= 0 || !input.contentUnitId || !input.packageTypeId) throw new Error('请填写包装类型、正数含量及含量单位。')
  const precision=listMaterialUnitDefinitions().find(item=>item.code===canonicalMaterialUnit(input.contentUnitId))?.precision
  if(precision!==undefined && Math.abs(input.contentQty-Number(input.contentQty.toFixed(precision)))>1e-9)throw new Error('包装含量的小数位超过该单位允许的数量精度。')
  if([input.lengthCm,input.widthCm,input.heightCm].some(value=>value!==null&&(!Number.isFinite(value)||value<=0)))throw new Error('已填写的包装尺寸必须为正值；未知请留空。')
  const factor = getMaterialUnitFactor(skuId, input.contentUnitId, sku.mainUnit!)
  if (factor === null) throw new Error('包装含量单位尚无对应主单位换算依据。')
  const previous = snapshot.packages?.find(item => item.packageSpecId === input.packageSpecId)
  if (previous && previous.ownerSkuId !== skuId) throw new Error('包装规格不属于当前 SKU。')
  if (!input.measurementBasis.trim()) throw new Error('请填写包装计量依据。')
  const pack: MaterialPackageSpec = { ...input, packageSpecId: nowId('material-package'), ownerSkuId: skuId, volumeM3: materialPackageVolume(input), version: (previous?.version || 0) + 1 }
  if (pack.grossWeightKg !== null && (!Number.isFinite(pack.grossWeightKg) || pack.grossWeightKg <= 0)) throw new Error('包装毛重必须为正值；未知请留空。')
  if (previous) previous.status = 'INACTIVE'
  snapshot.packages ||= []; snapshot.packages.push(pack)
  snapshot.unitRelations ||= []; snapshot.unitRelations.push({ relationId: nowId('material-unit'), materialSkuId: skuId, auxUnitId: pack.packageTypeId,
    mainQtyPerAux: materialDecimalMultiply(input.contentQty, factor), basisType: 'PACKAGE', basisReference: `${pack.contentQty} ${pack.contentUnitId}/包装`, packageSpecId: pack.packageSpecId,
    uses: ['PURCHASE', 'ISSUE'], isDefaultForUse: [], status: 'ACTIVE', version: pack.version, changeReason: '包装标准含量', createdAt: nowText() })
  if (previous) snapshot.unitRelations.filter(item => item.packageSpecId === previous.packageSpecId).forEach(item => item.status = 'INACTIVE')
  log(snapshot, sku.materialId, '维护包装规格', `${pack.packageTypeId}（${pack.contentQty} ${pack.contentUnitId}）；未改变 SKU 身份`); persistSnapshot(snapshot)
  return structuredClone(pack)
}
export function listMaterialCostVersions(skuId: string): MaterialStandardCostVersion[] {
  return (currentSnapshot().costVersions || []).filter(item => item.materialSkuId === skuId).map(item => structuredClone(item))
}
function baseStandardCostAmounts(current: MaterialStandardCostVersion | undefined) {
  return { purchase: current?.purchaseStandardCny ?? null, transport: current?.purchaseIncludesTransport ? 0 : current?.transportStandardCny ?? null }
}
function materialCostIsIncomplete(snapshot: MaterialArchiveStoreSnapshot, sku: MaterialSkuRecord, index: ReturnType<typeof buildMaterialReadIndex>): boolean {
  if (!sku.inputSkuId) {
    const { purchase, transport } = baseStandardCostAmounts(index.costs.get(sku.materialSkuId))
    // A base SKU has no upstream or unit bridge. Its completeness is exactly
    // these two entries; only detail/visible cost cells need amounts and lines.
    // Unexpected legacy values still take the existing full calculation path.
    if ([purchase, transport].every(amount => amount === null || Number.isFinite(amount))) return purchase === null || transport === null
  }
  return calculateCost(snapshot, sku.materialSkuId, index.calculatedCosts, new Set(), index).completeness.length > 0
}
function calculateCost(snapshot: MaterialArchiveStoreSnapshot, skuId: string, memo: Map<string, MaterialCostSnapshot>, visiting = new Set<string>(), index = materialReadIndex(snapshot)): MaterialCostSnapshot {
  const cached = memo.get(skuId); if (cached) return cached
  if (visiting.has(skuId)) throw new Error('成本依赖出现循环，请核对加工前驱。')
  visiting.add(skuId)
  const sku = index.skus.get(skuId)
  if (!sku) throw new Error('物料 SKU 不存在。')
  const current = index.costs.get(skuId)
  const result: MaterialCostSnapshot = { materialSkuId: skuId, costVersionId: current?.costVersionId || '', pricingUnit: current?.pricingUnit || sku.pricingUnit,
    totalStandardCny: null, completeness: [], lines: [], adoptedVersionIds: current ? [current.costVersionId] : [], evaluatedAt: current?.effectiveAt || sku.updatedAt }
  if (sku.inputSkuId) {
    const upstream = calculateCost(snapshot, sku.inputSkuId, memo, visiting, index)
    result.adoptedVersionIds = [...upstream.adoptedVersionIds, ...result.adoptedVersionIds]
    const unitReferenceId = snapshot.processDefinitions?.find(item => item.outputSkuId === skuId)?.unitBridgeVersionId
    const conversion = costUnitConversionInSnapshot(snapshot, sku.inputSkuId, result.pricingUnit, upstream.pricingUnit, unitReferenceId)
    const factor = conversion.factor
    result.adoptedVersionIds.push(...conversion.adoptedRelationIds.map(id => `unit:${id}`))
    if (upstream.completeness.length) result.completeness.push('上道成本不完整')
    if (factor === null) result.completeness.push('缺单位关系')
    result.lines = upstream.lines.map(line => ({ ...line, amountCny: line.amountCny !== null && factor !== null ? materialDecimalMultiply(line.amountCny, factor) : null, pricingUnit: result.pricingUnit }))
    const fee = current?.processStandardCny ?? null
    if (fee === null) result.completeness.push('缺加工费')
    result.lines.push({ materialSkuId: skuId, costVersionId: current?.costVersionId || '', title: `${MATERIAL_PROCESS_NAMES[sku.stage as keyof typeof MATERIAL_PROCESS_NAMES] || '加工'}费（含辅材）`, amountCny: fee, pricingUnit: result.pricingUnit, kind: 'PROCESS' })
    if (!result.completeness.length && upstream.totalStandardCny !== null && factor !== null && fee !== null) result.totalStandardCny = materialDecimalAdd(materialDecimalMultiply(upstream.totalStandardCny, factor), fee)
  } else {
    const { purchase, transport } = baseStandardCostAmounts(current)
    if (purchase === null) result.completeness.push('缺采购价')
    if (transport === null) result.completeness.push('缺基础运输')
    result.lines = [ { materialSkuId: skuId, costVersionId: current?.costVersionId || '', title: '人工标准采购成本', amountCny: purchase, pricingUnit: result.pricingUnit, kind: 'PURCHASE' },
      { materialSkuId: skuId, costVersionId: current?.costVersionId || '', title: current?.purchaseIncludesTransport ? '基础运输（采购价已含）' : '基础标准运输成本', amountCny: transport, pricingUnit: result.pricingUnit, kind: 'TRANSPORT' } ]
    if (purchase !== null && transport !== null) result.totalStandardCny = materialDecimalAdd(purchase, transport)
  }
  visiting.delete(skuId); memo.set(skuId, result); return result
}
export function getMaterialStandardCost(skuId: string): MaterialCostSnapshot { const snapshot = currentSnapshot(), index = materialReadIndex(snapshot); return structuredClone(calculateCost(snapshot, skuId, index.calculatedCosts, new Set(), index)) }
export function freezeMaterialCostSnapshot(skuId: string): MaterialCostSnapshot { return getMaterialStandardCost(skuId) }
export function readMaterialCostReference(skuId: string, frozen?: MaterialCostSnapshot, frozenVersion = false) {
  if (frozenVersion && frozen) return { ...structuredClone(frozen), changed: false, frozen: true }
  const current = getMaterialStandardCost(skuId)
  return { ...current, changed: Boolean(frozen && JSON.stringify(frozen.adoptedVersionIds) !== JSON.stringify(current.adoptedVersionIds)), frozen: false }
}
export function materialStandardCostDisplay(skuId: string, currency: 'CNY'|'IDR'|'USD', rate?: number) {
  const cost = getMaterialStandardCost(skuId)
  if (currency !== 'CNY' && (!rate || !Number.isFinite(rate) || rate <= 0)) return { ...cost, displayCurrency: currency, displayAmount: null, message: '未配置汇率' }
  return { ...cost, displayCurrency: currency, displayAmount: cost.totalStandardCny === null ? null : materialDecimalMultiply(cost.totalStandardCny, currency === 'CNY' ? 1 : rate!), message: '' }
}
function prepareMaterialStandardCost(snapshot: MaterialArchiveStoreSnapshot, sku: MaterialSkuRecord, input: Partial<MaterialStandardCostVersion>, costVersionId: string): MaterialStandardCostVersion {
  const skuId = sku.materialSkuId
  const previous = snapshot.costVersions?.filter(item => item.materialSkuId === skuId).at(-1)
  const next: MaterialStandardCostVersion = { costVersionId: costVersionId, materialSkuId: skuId,
    purchaseStandardCny: materialMoney(input.purchaseStandardCny === undefined ? previous?.purchaseStandardCny : input.purchaseStandardCny),
    transportStandardCny: materialMoney(input.transportStandardCny === undefined ? previous?.transportStandardCny : input.transportStandardCny),
    processStandardCny: materialMoney(input.processStandardCny === undefined ? previous?.processStandardCny : input.processStandardCny),
    purchaseIncludesTransport: input.purchaseIncludesTransport ?? previous?.purchaseIncludesTransport ?? false,
    pricingUnit: input.pricingUnit || previous?.pricingUnit || sku.pricingUnit, pricingUnitRelationId: input.pricingUnitRelationId || (input.pricingUnit && canonicalMaterialUnit(input.pricingUnit) !== canonicalMaterialUnit(previous?.pricingUnit || '') || !snapshot.unitRelations?.some(item=>item.relationId===previous?.pricingUnitRelationId&&item.status==='ACTIVE') ? undefined : previous?.pricingUnitRelationId),
    sourceMoney: input.sourceMoney, taxIncluded: true, effectiveAt: nowText(), changeReason: input.changeReason || '预览', operatorName: input.operatorName || '商品中心管理员' }
  next.pricingUnitRelationId = resolveMaterialPricingRelation(snapshot, sku, next.pricingUnit, next.pricingUnitRelationId)
  if (sku.inputSkuId && (input.purchaseStandardCny !== undefined && input.purchaseStandardCny !== null || input.transportStandardCny !== undefined && input.transportStandardCny !== null)) throw new Error('加工阶段只维护本道加工费，采购和基础运输承接前驱；后段运输不纳入。')
  if (materialUnitFactorInSnapshot(snapshot, skuId, next.pricingUnit, sku.mainUnit || sku.pricingUnit, next.pricingUnitRelationId) === null) throw new Error('计价单位缺少有效换算关系。')
  if (next.sourceMoney) {
    const amount = Number(next.sourceMoney.amount), fx = Number(next.sourceMoney.cnyPerSourceCurrency)
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(fx) || fx <= 0 || !next.sourceMoney.normalizationBasis.trim()) throw new Error('原币金额需保留有效金额、固定折算率及归一依据。')
    const unitFactor = materialUnitFactorInSnapshot(snapshot, skuId, next.pricingUnit, next.sourceMoney.unit)
    if (unitFactor === null) throw new Error('原报价单位缺少换算依据。')
    const normalized = materialDecimalMultiply(materialDecimalMultiply(amount, fx), unitFactor)
    if (sku.inputSkuId) next.processStandardCny = normalized; else next.purchaseStandardCny = normalized
  }
  if (next.purchaseIncludesTransport) next.transportStandardCny = 0
  return next
}
function resolveMaterialPricingRelation(snapshot: MaterialArchiveStoreSnapshot, sku: MaterialSkuRecord, pricingUnit: string, relationId?: string): string | undefined {
  const main = canonicalMaterialUnit(sku.mainUnit || sku.pricingUnit), unit = canonicalMaterialUnit(pricingUnit)
  if (relationId) {
    const selected = snapshot.unitRelations?.find(item => item.relationId === relationId && item.materialSkuId === sku.materialSkuId)
    if (!selected || selected.status !== 'ACTIVE' || !selected.uses.includes('PRICING') || canonicalMaterialUnit(selected.auxUnitId) !== unit) throw new Error('请选择属于本 SKU、已启用且适用于当前计价单位的计价关系。')
    return selected.relationId
  }
  if (unit === main || fixedMaterialFactor(unit, main) !== null) return undefined
  const candidates = (snapshot.unitRelations || []).filter(item => item.materialSkuId === sku.materialSkuId && item.status === 'ACTIVE' && item.uses.includes('PRICING') && canonicalMaterialUnit(item.auxUnitId) === unit)
  const selected = candidates.find(item => item.isDefaultForUse.includes('PRICING')) || (candidates.length === 1 ? candidates[0] : undefined)
  if (!selected) throw new Error('计价单位缺少唯一有效的计价用途关系，请在计量单位中设置。')
  return selected.relationId
}
export function getMaterialPricingRelationId(skuId: string, pricingUnit: string, relationId?: string): string | undefined {
  const source = currentSnapshot(), sku = source.skuRecords.find(item => item.materialSkuId === skuId)
  if (!sku) throw new Error('物料 SKU 不存在。')
  return resolveMaterialPricingRelation(source, sku, pricingUnit, relationId)
}
export function previewMaterialCostChange(skuId: string, input: Partial<MaterialStandardCostVersion>): Array<{ materialSkuId: string; before: number | null; after: number | null }> {
  return previewMaterialCostChangeInSnapshot(currentSnapshot(), skuId, input)
}
/** Pure cost projection for the supplied facts; never publishes versions or changes repository state. */
export function previewMaterialCostChangeInSnapshot(source: MaterialArchiveStoreSnapshot, skuId: string, input: Partial<MaterialStandardCostVersion>): Array<{ materialSkuId: string; before: number | null; after: number | null }> {
  const snapshot = cloneSnapshot(source), sku = snapshot.skuRecords.find(item => item.materialSkuId === skuId)
  if (!sku) throw new Error('标准成本对象不存在。')
  const next = prepareMaterialStandardCost(snapshot, sku, input, 'preview')
  const descendants = new Map<string,string[]>()
  for (const item of snapshot.skuRecords) if (item.inputSkuId) descendants.set(item.inputSkuId, [...(descendants.get(item.inputSkuId) || []), item.materialSkuId])
  const ids = [skuId], seen = new Set(ids)
  for (let index=0; index<ids.length; index++) for (const id of descendants.get(ids[index]) || []) { if(seen.has(id)) throw new Error('成本依赖出现循环，请核对加工前驱。'); seen.add(id); ids.push(id) }
  const beforeMemo = new Map<string,MaterialCostSnapshot>(), previous = new Map(ids.map(id => [id, calculateCost(snapshot, id, beforeMemo).totalStandardCny]))
  snapshot.costVersions ||= []; snapshot.costVersions.push(next)
  const memo = new Map<string, MaterialCostSnapshot>()
  return ids.map(id => ({ materialSkuId: id, before: previous.get(id) ?? null, after: calculateCost(snapshot,id,memo).totalStandardCny }))
}
export function saveMaterialStandardCost(skuId: string, input: Partial<MaterialStandardCostVersion> & { changeReason: string }): MaterialCostSnapshot {
  const snapshot = loadSnapshot(), sku = snapshot.skuRecords.find(item => item.materialSkuId === skuId)
  if (!sku) throw new Error('物料 SKU 不存在。')
  if (!input.changeReason.trim()) throw new Error('请填写标准成本调整原因。')
  const next = prepareMaterialStandardCost(snapshot, sku, input, nowId('material-cost'))
  snapshot.costVersions ||= []; snapshot.costVersions.push(next); sku.currentCostVersionId = next.costVersionId; sku.pricingUnit = next.pricingUnit
  log(snapshot, sku.materialId, '修改标准成本', `${sku.materialSkuCode}：${input.changeReason}；保存后当前下游标准自动采用。`)
  persistSnapshot(snapshot)
  return getMaterialStandardCost(skuId)
}
export function listMaterialAssets(materialId: string, skuId?: string): MaterialAsset[] {
  return (currentSnapshot().assets || []).filter(item => item.materialId === materialId && (!skuId || item.materialSkuId === skuId)).map(item => structuredClone(item)).sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0))
}
export function validateMaterialAssetFile(input: { fileName: string; mimeType: string; sizeBytes: number; role: MaterialAsset['role'] }): void {
  const imageRole = ['IDENTIFICATION','INPUT','PATTERN','COLOR_SAMPLE'].includes(input.role), extension = input.fileName.split('.').at(-1)?.toLowerCase() || ''
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 25 * 1024 * 1024) throw new Error('资料文件需大于 0 且不超过 25 MB。')
  if (imageRole ? !['jpg','jpeg','png','webp','gif'].includes(extension) || !input.mimeType.startsWith('image/') : !['jpg','jpeg','png','webp','gif','svg','pdf','ai','psd','eps','tif','tiff','dst','emb','pes','dxf','plt','prj','xlsx','csv','docx','txt','zip'].includes(extension)) throw new Error(imageRole ? '识别图、花型图与确认色样请选择 JPG、PNG、WebP 或 GIF 图片。' : '请选择受支持的图片、技术文件或执行资料格式。')
}
export function addMaterialAsset(input: Omit<MaterialAsset,'assetId'|'version'|'createdAt'>): MaterialAsset {
  if (!input.name.trim() || !input.url) throw new Error('资料名称与文件不可为空。')
  getPcsDurableFileReference(input.url)
  if (input.fileName !== undefined && input.sizeBytes !== undefined) validateMaterialAssetFile({fileName:input.fileName,mimeType:input.mimeType||'',sizeBytes:input.sizeBytes,role:input.role})
  const snapshot = loadSnapshot()
  if (!snapshot.records.some(root => root.materialId === input.materialId)) throw new Error('物料主档不存在。')
  if (input.materialSkuId && !snapshot.skuRecords.some(sku => sku.materialSkuId === input.materialSkuId && sku.materialId === input.materialId)) throw new Error('资料所属 SKU 与主档不一致。')
  const asset: MaterialAsset = { ...input, assetId: nowId('material-asset'), version: 1, sortOrder: input.sortOrder ?? (snapshot.assets || []).filter(item=>item.materialId===input.materialId&&item.materialSkuId===input.materialSkuId).length, createdAt: nowText() }
  snapshot.assets ||= []; snapshot.assets.push(asset); log(snapshot,input.materialId,'新增资料',`${input.name}（${input.role}）`); persistSnapshot(snapshot); return asset
}
export function reviseMaterialProcessAssets(skuId: string, executionAssetIds: string[], processVersionId: string): void {
  const snapshot = loadSnapshot(), process = snapshot.processDefinitions?.find(item => item.outputSkuId === skuId), sku = snapshot.skuRecords.find(item => item.materialSkuId === skuId)
  if (!process || !sku) throw new Error('加工定义不存在。')
  if (!executionAssetIds.length || !processVersionId.trim()) throw new Error('请明确资料版本及执行资料。')
  const role = process.processType === 'PRINTING' ? 'PRINT_FILE' : process.processType === 'EMBROIDERY' ? 'EMBROIDERY_FILE' : process.processType === 'HEAT_TRANSFER' ? 'HEAT_TRANSFER_FILE' : 'SPECIFICATION'
  if (executionAssetIds.some(id => !snapshot.assets?.some(asset => asset.assetId === id && asset.materialId === sku.materialId && asset.role === role))) throw new Error('执行资料必须属于当前物料，并与该加工工艺的资料用途一致。')
  const changed = JSON.stringify(process.executionAssetIds) !== JSON.stringify(executionAssetIds)
  if (!changed && process.processVersionId === processVersionId) return
  if (process.executionAssetIds.length && process.processVersionId === processVersionId) throw new Error('替换或增加执行资料时请填写新的资料版本；原版本会保留。')
  if (process.documentHistory?.some(item => item.processVersionId === processVersionId)) throw new Error('该资料版本已经存在，请填写新的版本。')
  if (process.executionAssetIds.length) { process.documentHistory ||= []; process.documentHistory.push({processVersionId:process.processVersionId,executionAssetIds:[...process.executionAssetIds],replacedAt:nowText()}) }
  process.executionAssetIds = [...executionAssetIds]; process.processVersionId = processVersionId
  log(snapshot, sku.materialId, '修正加工资料', `${sku.materialSkuCode}；交付身份不变，资料版本 ${processVersionId}`); persistSnapshot(snapshot)
}
