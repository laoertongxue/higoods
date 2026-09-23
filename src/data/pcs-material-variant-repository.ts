import type {
  MaterialVariantCreateInput,
  MaterialVariantProcessStep,
  MaterialVariantRecord,
  MaterialVariantResult,
} from './pcs-material-variant-types.ts'
import { getMaterialSkuRecordById } from './pcs-material-archive-repository.ts'
import {
  MATERIAL_VARIANT_DUPLICATE_PROCESS_MESSAGE,
  MATERIAL_VARIANT_NO_PREDECESSOR_MESSAGE,
  MATERIAL_VARIANT_PROCESS_TYPE_LABELS,
} from './pcs-material-variant-types.ts'

const variantStore = new Map<string, MaterialVariantRecord>()
let sequence = 0
let loaded = false
const STORAGE_KEY = 'higood-pcs-material-variant-store-v1'

function ensureLoaded(): void {
  if (loaded) return
  loaded = true
  try {
    if (typeof localStorage === 'undefined') return
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as MaterialVariantRecord[]
    if (Array.isArray(records)) records.forEach((item) => {
      if (item?.variantId && item.materialId && item.baseSkuCode) variantStore.set(item.variantId, item)
    })
  } catch {
    // 存储损坏时保留空的原型运行态，由现有 BOM 行重新建立基础变种。
  }
}

function persistDefaultStore(store: Map<string, MaterialVariantRecord>): void {
  if (store !== variantStore) return
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify([...variantStore.values()]))
  } catch {
    // 预览环境可能禁用浏览器存储，当前页面仍可使用内存态。
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}_${Date.now().toString(36)}_${sequence}`
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9一-龥-]/g, '')
}

export function buildDyeVariantCode(baseSkuCode: string, colorName: string, pantoneRef: string): string {
  const color = slugify(colorName)
  const pantone = pantoneRef.trim().toUpperCase().replace(/\s+/g, '')
  return `${baseSkuCode}-${color}-${pantone}PT`
}

export function buildAppendedVariantCode(predecessorCode: string, step: MaterialVariantProcessStep): string {
  const segment = step.patternCode || step.craftCode || step.processCode
  return `${predecessorCode}+${segment}`
}

function cloneStep(step: MaterialVariantProcessStep): MaterialVariantProcessStep {
  return { ...step }
}

function collectChain(store: Map<string, MaterialVariantRecord>, variantId: string): MaterialVariantRecord[] {
  const chain: MaterialVariantRecord[] = []
  const seen = new Set<string>()
  let cursor: string | undefined = variantId
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const record = store.get(cursor)
    if (!record) break
    chain.push(record)
    cursor = record.predecessorVariantId
  }
  return chain
}

function hasDuplicateProcessType(
  store: Map<string, MaterialVariantRecord>,
  predecessorId: string | undefined,
  processType: MaterialVariantProcessStep['processType'],
): boolean {
  if (!predecessorId) return false
  return collectChain(store, predecessorId).some((node) =>
    node.processes.some((step) => step.processType === processType),
  )
}

export function createMaterialVariant(
  input: MaterialVariantCreateInput,
  store: Map<string, MaterialVariantRecord> = variantStore,
): MaterialVariantResult {
  if (store === variantStore) ensureLoaded()
  if (!input.materialId || !input.baseSkuCode) {
    return { ok: false, error: 'REQUIRED_FIELD', message: '物料与基础 SKU 编码为必填。' }
  }

  if (input.chainCategory === 'process') {
    if (!input.processType || !input.processCode) {
      return { ok: false, error: 'REQUIRED_FIELD', message: '加工链变种需要选择工艺类型与工艺编码。' }
    }
    if (hasDuplicateProcessType(store, input.predecessorVariantId, input.processType)) {
      return { ok: false, error: 'DUPLICATE_PROCESS_TYPE', message: MATERIAL_VARIANT_DUPLICATE_PROCESS_MESSAGE }
    }
    if (input.predecessorVariantId && !store.has(input.predecessorVariantId)) {
      return { ok: false, error: 'MISSING_PREDECESSOR', message: MATERIAL_VARIANT_NO_PREDECESSOR_MESSAGE }
    }
  }

  const step: MaterialVariantProcessStep | undefined =
    input.chainCategory === 'process'
      ? {
          processType: input.processType!,
          processCode: input.processCode!,
          processName: input.processName || MATERIAL_VARIANT_PROCESS_TYPE_LABELS[input.processType!],
          craftCode: input.craftCode,
          patternCode: input.patternCode,
        }
      : undefined

  let variantCode: string
  let layerIndex = 0
  let processes: MaterialVariantProcessStep[] = []

  if (step && step.processType === 'dye') {
    if (!input.colorName || !input.pantoneRef) {
      return { ok: false, error: 'INVALID_CODE_INPUT', message: '染色变种需要颜色名与 Pantone 号。' }
    }
    variantCode = buildDyeVariantCode(input.baseSkuCode, input.colorName, input.pantoneRef)
    layerIndex = 1
    processes = [step]
  } else if (step) {
    const predecessor = input.predecessorVariantId ? store.get(input.predecessorVariantId) : undefined
    if (!predecessor) {
      if (step.processType === 'finish') {
        variantCode = buildAppendedVariantCode(input.baseSkuCode, step)
        layerIndex = 1
        processes = [step]
      } else {
        return { ok: false, error: 'MISSING_PREDECESSOR', message: MATERIAL_VARIANT_NO_PREDECESSOR_MESSAGE }
      }
    } else {
      variantCode = buildAppendedVariantCode(predecessor.variantCode, step)
      layerIndex = predecessor.layerIndex + 1
      processes = [...predecessor.processes.map(cloneStep), step]
    }
  } else {
    variantCode = `${input.baseSkuCode}-BASE`
    layerIndex = 0
    processes = []
  }

  const record: MaterialVariantRecord = {
    variantId: nextId('mvar'),
    materialId: input.materialId,
    materialSkuId: input.materialSkuId,
    baseSkuCode: input.baseSkuCode,
    variantCode,
    displayName: input.colorName
      ? `${input.colorName}${step ? ` · ${step.processName}` : ' · 基础态'}`
      : step
        ? step.processName
        : '基础态',
    colorName: input.colorName,
    pantoneRef: input.pantoneRef,
    chainCategory: input.chainCategory,
    layerIndex,
    predecessorVariantId: input.chainCategory === 'process' ? input.predecessorVariantId : undefined,
    processes,
    remark: input.remark,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  store.set(record.variantId, record)
  persistDefaultStore(store)
  return { ok: true, variant: record }
}

export function listMaterialVariants(
  materialId?: string,
  store: Map<string, MaterialVariantRecord> = variantStore,
): MaterialVariantRecord[] {
  if (store === variantStore) ensureLoaded()
  const all = [...store.values()]
  const filtered = materialId ? all.filter((item) => item.materialId === materialId) : all
  return filtered.sort((a, b) => a.layerIndex - b.layerIndex || a.variantCode.localeCompare(b.variantCode))
}

export function getMaterialVariantById(
  variantId: string,
  store: Map<string, MaterialVariantRecord> = variantStore,
): MaterialVariantRecord | null {
  if (store === variantStore) ensureLoaded()
  return store.get(variantId) || null
}

export function listVariantLineage(
  variantId: string,
  store: Map<string, MaterialVariantRecord> = variantStore,
): MaterialVariantRecord[] {
  if (store === variantStore) ensureLoaded()
  return collectChain(store, variantId).reverse()
}

export function migrateLegacyBomLinesToBaseVariants(
  materialId: string,
  baseSkuCode: string,
  materialSkuId = '',
  store: Map<string, MaterialVariantRecord> = variantStore,
): MaterialVariantRecord[] {
  if (store === variantStore) ensureLoaded()
  const existing = listMaterialVariants(materialId, store).find(
    (item) => item.baseSkuCode === baseSkuCode && item.chainCategory === 'plain'
      && (!materialSkuId || !item.materialSkuId || item.materialSkuId === materialSkuId),
  )
  if (existing) return [existing]
  const result = createMaterialVariant(
    {
      materialId,
      materialSkuId: materialSkuId || undefined,
      baseSkuCode,
      chainCategory: 'plain',
      remark: '存量 BOM 行一次性映射为基础态变种',
    },
    store,
  )
  return result.variant ? [result.variant] : []
}

/** MAT-010：只映射有明确物料 SKU 身份的存量 BOM 行，幂等保留已绑定的变种。 */
export function mapLegacyBomItemsToBaseVariants<T extends { materialSkuId?: string; variantId?: string }>(
  lines: T[],
): T[] {
  return lines.map((line) => {
    if (line.variantId || !line.materialSkuId) return { ...line }
    const sku = getMaterialSkuRecordById(line.materialSkuId)
    if (!sku) return { ...line }
    const variant = migrateLegacyBomLinesToBaseVariants(sku.materialId, sku.materialSkuCode, sku.materialSkuId)[0]
    return variant ? { ...line, variantId: variant.variantId } : { ...line }
  })
}

export function resetMaterialVariantStore(): void {
  variantStore.clear()
  sequence = 0
  loaded = true
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 与内存态保持一致。
  }
}
