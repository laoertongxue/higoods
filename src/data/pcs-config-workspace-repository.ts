import { pcsRecordStore, registerPcsRepositoryReset } from './pcs-record-runtime.ts'
import {
  FLAT_DIMENSION_META,
  createInitialConfigData,
  splitCategoryNumberLabel,
  resolveConfigOptionReference,
  type ConfigLog,
  type ConfigOption,
  type ConfigStatus,
  type FlatDimensionId,
} from './pcs-config-dimensions.ts'

export type ConfigWorkspaceDimensionId = 'productCategories' | FlatDimensionId

export interface ProductCategoryNode {
  id: string
  code: string
  name: string
  parentId: string | null
  level: 1 | 2 | 3
  status: ConfigStatus
  sortOrder: number
  productCount: number
  updatedAt: string
  updatedBy: string
  logs: ConfigLog[]
}

export interface ConfigWorkspaceSummaryItem {
  id: ConfigWorkspaceDimensionId
  name: string
  description: string
  count: number | null
  updatedAt: string
  updatedBy: string
}

export interface ConfigWorkspaceOptionDraft {
  code?: string
  aliases?: string[]
  nameZh: string
  nameEn?: string
  nameId?: string
  nameMs?: string
  changeReason?: string
  sortOrder: number
  status: ConfigStatus
}

export interface ProductCategoryDraft {
  name: string
  sortOrder: number
  status: ConfigStatus
}

interface ConfigWorkspaceSnapshot {
  version: number
  flatOptions: Record<FlatDimensionId, ConfigOption[]>
  categoryNodes: ProductCategoryNode[]
}

const STORAGE_KEY = 'higood-pcs-config-workspace-store-v1'
const STORE_VERSION = 1
const OPERATOR_POOL = ['商品中心管理员', '系统配置专员', '商品企划', '类目治理负责人']

let memorySnapshot: ConfigWorkspaceSnapshot | null = null
const usageSnapshotCache = new Map<string, { raw: string; value: Record<string, UsageRecord[]> }>()

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function cloneLog(log: ConfigLog): ConfigLog {
  return structuredClone(log)
}

function cloneOption(option: ConfigOption): ConfigOption {
  return {
    ...option,
    aliases: [...(option.aliases || [])],
    logs: option.logs.map(cloneLog),
  }
}

function cloneCategoryNode(node: ProductCategoryNode): ProductCategoryNode {
  return {
    ...node,
    logs: node.logs.map(cloneLog),
  }
}

function cloneSnapshot(snapshot: ConfigWorkspaceSnapshot): ConfigWorkspaceSnapshot {
  return {
    version: snapshot.version,
    flatOptions: Object.fromEntries(
      Object.entries(snapshot.flatOptions).map(([dimensionId, items]) => [dimensionId, items.map(cloneOption)]),
    ) as Record<FlatDimensionId, ConfigOption[]>,
    categoryNodes: snapshot.categoryNodes.map(cloneCategoryNode),
  }
}

function makeLog(seed: number, action: string, detail: string, time: string): ConfigLog {
  return {
    id: `cfg-log-${seed}-${action}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    action,
    detail,
    operator: OPERATOR_POOL[seed % OPERATOR_POOL.length],
    time,
  }
}

function buildCategoryLogs(itemName: string, seed: number): ConfigLog[] {
  const times = ['2026-03-27 14:00', '2026-03-29 22:00', '2026-04-01 12:00'].map((value, index) => {
    const [datePart, timePart] = value.split(' ')
    const [hour, minute] = timePart.split(':')
    const date = new Date(`${datePart}T${hour}:${minute}:00+08:00`)
    date.setHours(date.getHours() + seed + index * 9)
    const pad = (current: number) => String(current).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  })

  return [
    makeLog(seed, '初始化配置', `完成商品类目「${itemName}」的初始化建档。`, times[0]),
    makeLog(seed + 1, '补充维护', `复核商品类目「${itemName}」排序与展示口径。`, times[1]),
    makeLog(seed + 2, '配置复核', `确认商品类目「${itemName}」启用状态，并留存维护日志。`, times[2]),
  ]
}

function buildCategorySeed(): ProductCategoryNode[] {
  const seeds: Array<Omit<ProductCategoryNode, 'updatedAt' | 'updatedBy' | 'logs'>> = [
    { id: 'product-category-1', code: '1', name: '女装', parentId: null, level: 1, status: 'ENABLED', sortOrder: 1, productCount: 51 },
    { id: 'product-category-2', code: '2', name: '上衣', parentId: 'product-category-1', level: 2, status: 'ENABLED', sortOrder: 1, productCount: 23 },
    { id: 'product-category-3', code: '3', name: 'T恤', parentId: 'product-category-2', level: 3, status: 'ENABLED', sortOrder: 1, productCount: 15 },
    { id: 'product-category-4', code: '4', name: '衬衫', parentId: 'product-category-2', level: 3, status: 'ENABLED', sortOrder: 2, productCount: 0 },
    { id: 'product-category-5', code: '5', name: '衬衣', parentId: 'product-category-2', level: 3, status: 'ENABLED', sortOrder: 3, productCount: 8 },
    { id: 'product-category-6', code: '6', name: '连衣裙', parentId: 'product-category-1', level: 2, status: 'ENABLED', sortOrder: 2, productCount: 18 },
    { id: 'product-category-7', code: '7', name: '半裙', parentId: 'product-category-6', level: 3, status: 'ENABLED', sortOrder: 1, productCount: 7 },
    { id: 'product-category-8', code: '8', name: '长裙', parentId: 'product-category-6', level: 3, status: 'ENABLED', sortOrder: 2, productCount: 11 },
    { id: 'product-category-9', code: '9', name: '裤装', parentId: 'product-category-1', level: 2, status: 'ENABLED', sortOrder: 3, productCount: 10 },
    { id: 'product-category-10', code: '10', name: '长裤', parentId: 'product-category-9', level: 3, status: 'ENABLED', sortOrder: 1, productCount: 6 },
    { id: 'product-category-11', code: '11', name: '短裤', parentId: 'product-category-9', level: 3, status: 'ENABLED', sortOrder: 2, productCount: 4 },
    { id: 'product-category-12', code: '12', name: '男装', parentId: null, level: 1, status: 'ENABLED', sortOrder: 2, productCount: 5 },
    { id: 'product-category-13', code: '13', name: '男装上衣', parentId: 'product-category-12', level: 2, status: 'ENABLED', sortOrder: 1, productCount: 2 },
    { id: 'product-category-14', code: '14', name: '男装裤子', parentId: 'product-category-12', level: 2, status: 'ENABLED', sortOrder: 2, productCount: 1 },
    { id: 'product-category-15', code: '15', name: '男装外套', parentId: 'product-category-12', level: 2, status: 'ENABLED', sortOrder: 3, productCount: 2 },
  ]

  return seeds.map((seed, index) => {
    const logs = buildCategoryLogs(seed.name, index + 1)
    return {
      ...seed,
      updatedAt: logs[logs.length - 1].time,
      updatedBy: logs[logs.length - 1].operator,
      logs,
    }
  })
}

function seedSnapshot(): ConfigWorkspaceSnapshot {
  return {
    version: STORE_VERSION,
    flatOptions: createInitialConfigData(),
    categoryNodes: buildCategorySeed(),
  }
}

/** 每个配置项单独存储；字典分组只存在于读取视图。 */
export function getConfigWorkspaceSnapshot() {
  const current = readSnapshot()
  return { version: STORE_VERSION,
    configuredDimensions: Object.fromEntries(Object.keys(current.flatOptions).map(key => [key, true])),
    options: Object.entries(current.flatOptions).flatMap(([dimensionId, items]) => items.map(item => ({ ...cloneOption(item), dimensionId }))),
    categoryNodes: current.categoryNodes.map(cloneCategoryNode) }
}
export function resetConfigWorkspaceCache(): void { memorySnapshot = null; usageSnapshotCache.clear() }
registerPcsRepositoryReset(resetConfigWorkspaceCache)
function persistSnapshot(snapshot: ConfigWorkspaceSnapshot): void {
  const raw = { version: STORE_VERSION,
    configuredDimensions: Object.fromEntries(Object.keys(snapshot.flatOptions).map(key => [key, true])),
    options: Object.entries(snapshot.flatOptions).flatMap(([dimensionId, items]) => items.map(item => ({ ...item, dimensionId }))),
    categoryNodes: snapshot.categoryNodes }
  pcsRecordStore.setItem(STORAGE_KEY, JSON.stringify(raw))
  memorySnapshot = cloneSnapshot(snapshot)
}
function readSnapshot(): ConfigWorkspaceSnapshot {
  if (memorySnapshot) return memorySnapshot
  const raw = pcsRecordStore.getItem(STORAGE_KEY)
  if (!raw) return memorySnapshot = seedSnapshot()
  const parsed = JSON.parse(raw)
  const initial = seedSnapshot()
  const flatOptions = { ...initial.flatOptions }
  if (Array.isArray(parsed.options)) {
    for (const dimension of FLAT_DIMENSION_META) {
      const items = parsed.options.filter((item: any) => item.dimensionId === dimension.id)
      // 已有维度的删除标记由记录层处理，空列表不恢复种子。
      if (items.length || parsed.configuredDimensions?.[dimension.id]) flatOptions[dimension.id] = items.map((item: ConfigOption) => normalizeOption(dimension.id, item))
    }
  } else if (parsed.flatOptions) {
    for (const [key, values] of Object.entries(parsed.flatOptions)) {
      const dimension = key === 'styleCodes' ? 'categoryNumbers' : key
      if (!FLAT_DIMENSION_META.some(item => item.id === dimension) || !Array.isArray(values)) continue
      flatOptions[dimension as FlatDimensionId] = values.map((item: ConfigOption) => normalizeOption(dimension as FlatDimensionId, item))
    }
  } else throw new Error('基础配置读取失败，请重新读取。')
  return memorySnapshot = { version: STORE_VERSION, flatOptions, categoryNodes: (parsed.categoryNodes || initial.categoryNodes).map(cloneCategoryNode) }
}

function normalizeOption(dimension: FlatDimensionId, item: ConfigOption): ConfigOption {
  // 历史 ID 是引用身份，不因字段改名或重排而改变。
  if (dimension === 'categoryNumbers' && /^\s*\d+[-－]/.test(item.name_zh)) {
    const split = splitCategoryNumberLabel(item.name_zh)
    return { ...cloneOption(item), code: split.code, name_zh: split.nameZh, name_en: split.nameEn,
      aliases: [...new Set([...(item.aliases || []), ...split.aliases])] }
  }
  return cloneOption(item)
}

// 写操作仍复制完整快照；查询只复制即将返回的维度，避免每个款式属性复制整个配置库。
function loadSnapshot(): ConfigWorkspaceSnapshot {
  return cloneSnapshot(readSnapshot())
}

function latestValue<T extends { updatedAt: string; updatedBy: string }>(items: T[]): { updatedAt: string; updatedBy: string } {
  const latest = [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  return {
    updatedAt: latest?.updatedAt || '',
    updatedBy: latest?.updatedBy || '',
  }
}

function nextNumericCode(values: string[]): string {
  const maxValue = values.reduce((current, item) => {
    const value = Number.parseInt(item, 10)
    return Number.isFinite(value) ? Math.max(current, value) : current
  }, 0)
  return String(maxValue + 1)
}

function appendOptionLog(
  option: ConfigOption,
  dimensionName: string,
  action: string,
  detail: string,
  operatorName: string,
): ConfigOption {
  const time = nowText()
  const nextLog: ConfigLog = {
    id: `${option.id}-log-${option.logs.length + 1}`,
    action,
    detail,
    operator: operatorName,
    operatorId: 'pcs-prototype-user',
    time,
  }

  return {
    ...option,
    updatedAt: time,
    updatedBy: operatorName,
    logs: [...option.logs, nextLog],
  }
}

function appendCategoryLog(
  node: ProductCategoryNode,
  action: string,
  detail: string,
  operatorName: string,
): ProductCategoryNode {
  const time = nowText()
  const nextLog: ConfigLog = {
    id: `${node.id}-log-${node.logs.length + 1}`,
    action,
    detail,
    operator: operatorName,
    operatorId: 'pcs-prototype-user',
    time,
  }

  return {
    ...node,
    updatedAt: time,
    updatedBy: operatorName,
    logs: [...node.logs, nextLog],
  }
}

function findDimensionMeta(dimensionId: FlatDimensionId) {
  return FLAT_DIMENSION_META.find((item) => item.id === dimensionId)
}

function getCategoryChildren(categoryId: string, nodes: ProductCategoryNode[]): ProductCategoryNode[] {
  return nodes
    .filter((item) => item.parentId === categoryId)
    .sort((left, right) => left.sortOrder - right.sortOrder || Number(left.code) - Number(right.code))
}

function getCategorySubtree(nodeId: string, nodes: ProductCategoryNode[]): ProductCategoryNode[] {
  const current = nodes.find((item) => item.id === nodeId)
  if (!current) return []
  const children = getCategoryChildren(nodeId, nodes)
  return [current, ...children.flatMap((item) => getCategorySubtree(item.id, nodes))]
}

export function listConfigWorkspaceSummaries(): ConfigWorkspaceSummaryItem[] {
  const snapshot = loadSnapshot()
  const flatSummaries = FLAT_DIMENSION_META.map((meta) => {
    const items = snapshot.flatOptions[meta.id] || []
    const latest = latestValue(items)
    return {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      count: items.length,
      updatedAt: latest.updatedAt,
      updatedBy: latest.updatedBy,
    }
  })

  const categoryLatest = latestValue(snapshot.categoryNodes)
  return [
    {
      id: 'productCategories',
      name: '商品类目',
      description: '树形结构管理，支持三级类目',
      count: null,
      updatedAt: categoryLatest.updatedAt,
      updatedBy: categoryLatest.updatedBy,
    },
    ...flatSummaries,
  ]
}

export function listConfigDimensionOptions(dimensionId: FlatDimensionId): ConfigOption[] {
  return (readSnapshot().flatOptions[dimensionId] || [])
    .map(cloneOption)
    .sort((left, right) => left.sortOrder - right.sortOrder || Number(left.code) - Number(right.code))
}

/** 业务选择器只需身份和展示字段，不复制维护日志。 */
export function listConfigDimensionChoices(dimensionId: FlatDimensionId): Array<Pick<ConfigOption, 'id' | 'code' | 'name_zh' | 'status' | 'sortOrder' | 'aliases'>> {
  return (readSnapshot().flatOptions[dimensionId] || []).map(({ id, code, name_zh, status, sortOrder, aliases }) => ({ id, code, name_zh, status, sortOrder, aliases: [...(aliases || [])] }))
    .sort((left, right) => left.sortOrder - right.sortOrder || Number(left.code) - Number(right.code))
}

export function getConfigDimensionOption(dimensionId: FlatDimensionId, optionId: string): ConfigOption | null {
  return listConfigDimensionOptions(dimensionId).find((item) => item.id === optionId) ?? null
}

export function saveConfigDimensionOption(
  dimensionId: FlatDimensionId,
  optionId: string | null,
  draft: ConfigWorkspaceOptionDraft,
  operatorName = '当前用户',
): ConfigOption {
  const snapshot = loadSnapshot()
  const dimensionName = findDimensionMeta(dimensionId)?.name || '配置维度'
  const currentItems = snapshot.flatOptions[dimensionId] || []
  if (!draft.nameZh.trim()) throw new Error('请填写配置名称。')
  if (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0) throw new Error('排序请输入非负整数。')
  if (!['ENABLED', 'DISABLED'].includes(draft.status)) throw new Error('请选择有效启停状态。')
  const currentOption = currentItems.find(item => item.id === optionId)
  const code = draft.code?.trim() || currentOption?.code || (dimensionId === 'categoryNumbers' ? draft.nameZh.match(/^([0-9]+)[-－]/)?.[1] : '') || nextNumericCode(currentItems.map(item => item.code))
  if (currentItems.some(item => item.id !== optionId && item.code.toLowerCase() === code.toLowerCase())) throw new Error('业务编码已存在，请使用其他编码。')
  if (currentOption && code !== currentOption.code) throw new Error('已建立的业务编码不能修改，请新增配置项。')
  if (dimensionId === 'pantone' && !/^(TCX|TPX)\s+\d{2}-\d{4}$/i.test(code)) throw new Error('Pantone 编码格式为 TCX 19-4003 或 TPX 14-4203。')

  if (!optionId) {
    const nextOption: ConfigOption = {
      id: `${dimensionId}-${crypto.randomUUID()}`,
      code,
      aliases: [...(draft.aliases || [])],
      name_zh: draft.nameZh.trim(),
      name_en: draft.nameEn?.trim() || '',
      name_id: draft.nameId?.trim() || '',
      name_ms: draft.nameMs?.trim() || '',
      sortOrder: draft.sortOrder,
      status: draft.status,
      updatedAt: nowText(),
      updatedBy: operatorName,
      logs: [],
    }
    const created = appendOptionLog(
      nextOption,
      dimensionName,
      '新增配置',
      `新增${dimensionName}「${draft.nameZh.trim()}」，并建立维护日志。`,
      operatorName,
    )
    snapshot.flatOptions[dimensionId] = [...currentItems, created]
    persistSnapshot(snapshot)
    return created
  }

  const current = currentItems.find((item) => item.id === optionId)
  if (!current) {
    throw new Error(`未找到${dimensionName}配置项。`)
  }

  const updated = appendOptionLog(
    {
      ...current,
      aliases: [...(draft.aliases || current.aliases || [])],
      name_zh: draft.nameZh.trim(),
      name_en: draft.nameEn?.trim() || '',
      name_id: draft.nameId === undefined ? current.name_id || '' : draft.nameId.trim(),
      name_ms: draft.nameMs === undefined ? current.name_ms || '' : draft.nameMs.trim(),
      sortOrder: draft.sortOrder,
      status: draft.status,
    },
    dimensionName,
    '编辑配置',
    `更新${dimensionName}「${draft.nameZh.trim()}」配置内容。`,
    operatorName,
  )
  const tracked: Array<[keyof ConfigOption, string]> = [['name_zh', '中文名称'], ['name_en', '英文名称'], ['name_id', '印尼语名称'], ['name_ms', '马来语名称'], ['aliases', '旧值 / 别名'], ['sortOrder', '排序'], ['status', '状态']]
  const lastLog = updated.logs.at(-1)!
  lastLog.changes = tracked.filter(([key]) => JSON.stringify(current[key] ?? '') !== JSON.stringify(updated[key] ?? '')).map(([key, field]) => ({ field, before: structuredClone(current[key] ?? ''), after: structuredClone(updated[key] ?? '') }))
  lastLog.reason = draft.changeReason?.trim() || '资料维护'
  snapshot.flatOptions[dimensionId] = currentItems.map((item) => (item.id === optionId ? updated : item))
  persistSnapshot(snapshot)
  return updated
}

export function listProductCategoryNodes(): ProductCategoryNode[] {
  const nodes = readSnapshot().categoryNodes
  const styles = readConfigUsageRecords('higood-pcs-style-archive-store-v3', 'records')
  return nodes
    .map(node => {
      const subtreeIds = new Set(getCategorySubtree(node.id, nodes).map(child => child.id))
      return { ...cloneCategoryNode(node), productCount: styles.filter(style => subtreeIds.has(style.productCategoryId as string)).length }
    })
    .sort((left, right) => left.level - right.level || left.sortOrder - right.sortOrder || Number(left.code) - Number(right.code))
}

export function getProductCategoryNode(nodeId: string): ProductCategoryNode | null {
  return listProductCategoryNodes().find((item) => item.id === nodeId) ?? null
}

export function listRootProductCategories(): ProductCategoryNode[] {
  return listProductCategoryNodes().filter((item) => item.parentId === null)
}

export function listChildProductCategories(parentId: string): ProductCategoryNode[] {
  return getCategoryChildren(parentId, listProductCategoryNodes())
}

export function canDeleteProductCategoryNode(nodeId: string): boolean {
  const nodes = listProductCategoryNodes()
  const current = nodes.find((item) => item.id === nodeId)
  if (!current) return false
  return getCategoryChildren(nodeId, nodes).length === 0 && current.productCount === 0
}

export function canDisableProductCategoryNode(nodeId: string): boolean {
  return Boolean(getProductCategoryNode(nodeId))
}

export function saveProductCategoryNode(
  nodeId: string | null,
  parentId: string | null,
  draft: ProductCategoryDraft,
  operatorName = '当前用户',
): ProductCategoryNode {
  const snapshot = loadSnapshot()
  const currentNodes = snapshot.categoryNodes
  if (!draft.name.trim()) throw new Error('请输入类目名称。')
  if (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0) throw new Error('排序请输入非负整数。')
  const parent = parentId ? currentNodes.find((item) => item.id === parentId) : null
  if (parentId && !parent) throw new Error('上级类目不存在。')
  if (!nodeId && parent?.status === 'DISABLED') throw new Error('上级类目已停用，请先启用。')
  if (currentNodes.some(item => item.id !== nodeId && item.parentId === parentId && item.name === draft.name.trim())) throw new Error('同一上级下已存在同名类目。')
  const level = parent ? ((parent.level + 1) as 2 | 3) : 1
  if (level > 3) {
    throw new Error('商品类目最多维护到三级。')
  }

  if (!nodeId) {
    const nextCode = nextNumericCode(currentNodes.map((item) => item.code))
    const created = appendCategoryLog(
      {
        id: `product-category-${nextCode}`,
        code: nextCode,
        name: draft.name.trim(),
        parentId,
        level,
        status: draft.status,
        sortOrder: draft.sortOrder,
        productCount: 0,
        updatedAt: nowText(),
        updatedBy: operatorName,
        logs: [],
      },
      '新增类目',
      `新增商品类目「${draft.name.trim()}」。`,
      operatorName,
    )
    snapshot.categoryNodes = [...currentNodes, created]
    persistSnapshot(snapshot)
    return created
  }

  const current = currentNodes.find((item) => item.id === nodeId)
  if (!current) {
    throw new Error('未找到商品类目。')
  }
  if (draft.status === 'DISABLED' && !canDisableProductCategoryNode(nodeId)) {
    throw new Error('当前类目或下级类目已存在商品，不允许停用。')
  }

  const updated = appendCategoryLog(
    {
      ...current,
      name: draft.name.trim(),
      sortOrder: draft.sortOrder,
      status: draft.status,
    },
    '编辑类目',
    `更新商品类目「${draft.name.trim()}」的展示信息。`,
    operatorName,
  )
  snapshot.categoryNodes = currentNodes.map((item) => (item.id === nodeId ? updated : item))
  persistSnapshot(snapshot)
  return updated
}

export function deleteProductCategoryNode(nodeId: string, operatorName = '当前用户'): void {
  if (!canDeleteProductCategoryNode(nodeId)) {
    throw new Error('仅叶子类目且无商品引用时才能删除。')
  }

  const snapshot = loadSnapshot()
  const current = snapshot.categoryNodes.find((item) => item.id === nodeId)
  if (!current) {
    throw new Error('未找到商品类目。')
  }

  const remaining = snapshot.categoryNodes.filter((item) => item.id !== nodeId)
  const parent = current.parentId ? remaining.find((item) => item.id === current.parentId) : null
  snapshot.categoryNodes = remaining
  if (parent) {
    const parentUpdated = appendCategoryLog(
      parent,
      '子级调整',
      `已移除下级类目「${current.name}」。`,
      operatorName,
    )
    snapshot.categoryNodes = snapshot.categoryNodes.map((item) => (item.id === parent.id ? parentUpdated : item))
  }
  persistSnapshot(snapshot)
}

export function resetConfigWorkspaceRepository(): void { persistSnapshot(seedSnapshot()) }

type UsageRecord = Record<string, any>
function readConfigUsageRecords(key: string, group: string): UsageRecord[] {
  const raw = pcsRecordStore.getItem(key)
  if (!raw) return []
  let parsed = usageSnapshotCache.get(key)
  if (!parsed || parsed.raw !== raw) { parsed = { raw, value: JSON.parse(raw) }; usageSnapshotCache.set(key, parsed) }
  return parsed.value[group] || []
}
export interface ConfigUsage { id: string; label: string; kind: string; href?: string }
/** 只统计当前档案中的实际引用；不使用种子中写死的汇总数。 */
export function getConfigOptionUsage(dimensionId: FlatDimensionId, optionId: string): ConfigUsage[] {
  const uses: ConfigUsage[] = []
  const styles = readConfigUsageRecords('higood-pcs-style-archive-store-v3', 'records')
  const options = readSnapshot().flatOptions[dimensionId] || []
  for (const record of styles) if (record.productConfigRefs?.[dimensionId]?.some((id: string) => resolveConfigOptionReference(dimensionId, id, options)?.id === optionId)) uses.push({ id: record.styleId, label: `${record.styleCode} · ${record.styleName}`, kind: '款式', href: `/pcs/products/styles/${encodeURIComponent(record.styleId)}` })
  if (dimensionId === 'sizes' || dimensionId === 'colors') {
    for (const record of readConfigUsageRecords('higood-pcs-sku-archive-store-v1', 'records')) {
      if (record[dimensionId === 'sizes' ? 'sizeId' : 'colorId'] === optionId) uses.push({ id: record.skuId, label: record.skuCode, kind: '商品 SKU', href: `/pcs/products/specifications/${encodeURIComponent(record.skuId)}` })
    }
  }
  { // Attribute templates determine applicability for every independent dictionary.
    const option = getConfigDimensionOption(dimensionId, optionId)
    if (!option) return uses
    const tokens = new Set([option.id, option.code, option.name_zh, option.name_en, ...(option.aliases || [])].filter(Boolean).map(value => String(value).trim().toLowerCase()))
    const matches = (value: unknown): boolean => Array.isArray(value) ? value.some(matches) : value && typeof value === 'object' ? Object.values(value).some(matches) : typeof value === 'string' && tokens.has(value.trim().toLowerCase())
    const roots = readConfigUsageRecords('higood-pcs-material-archive-store-v2', 'records')
    const templates = readConfigUsageRecords('higood-pcs-material-config-v1', 'templates')
    const skus = readConfigUsageRecords('higood-pcs-material-archive-store-v2', 'skuRecords')
    for (const root of roots) {
      const template = templates.find(item => item.templateId === root.templateId && item.version === root.templateVersion)
      const fields: UsageRecord[] = template?.fields?.filter((item: UsageRecord) => item.dictionaryId === dimensionId) || []
      if (fields.some(item => item.level === 'root' && matches(root.categoryAttributes?.[item.key])) ||
          dimensionId === 'compositions' && root.compositionItems?.some((item: UsageRecord) => matches(item.component)) ||
          dimensionId === 'equipmentTypes' && matches(root.equipmentCompatibility)) {
        uses.push({ id: root.materialId, label: `${root.materialCode} · ${root.materialName}`, kind: '物料根属性', href: `/pcs/materials/${root.kind || 'fabric'}/${encodeURIComponent(root.materialId)}` })
      }
      for (const sku of skus.filter(item => item.materialId === root.materialId)) {
        const pantone = `${sku.pantoneSystem || ''} ${sku.pantoneCode || ''}`.trim()
        if (fields.some(item => item.level === 'sku' && matches(sku.effectiveSpecValues?.[item.key] ?? sku.identityValues?.[item.key])) ||
            dimensionId === 'colors' && [sku.colorId, sku.colorCode, sku.colorName].some(matches) ||
            dimensionId === 'pantone' && [sku.pantoneId, pantone].some(matches)) {
          uses.push({ id: sku.materialSkuId, label: sku.materialSkuCode, kind: '物料 SKU', href: `/pcs/materials/${root.kind || 'fabric'}/${encodeURIComponent(root.materialId)}/skus/${encodeURIComponent(sku.materialSkuId)}` })
        }
      }
    }
    if (dimensionId === 'packageTypes') for (const item of readConfigUsageRecords('higood-pcs-material-archive-store-v2', 'packages')) {
      if (matches(item.packageUnit) || matches(item.packageType)) { const sku = skus.find(s => s.materialSkuId === item.materialSkuId), root = roots.find(r => r.materialId === sku?.materialId); uses.push({ id: item.packageSpecId, label: item.name || item.packageSpecId, kind: '物料包装规格', href: root && sku ? `/pcs/materials/${root.kind}/${root.materialId}/skus/${sku.materialSkuId}` : undefined }) }
    }
  }
  return uses
}
