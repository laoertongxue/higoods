import {
  FLAT_DIMENSION_META,
  createInitialConfigData,
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
  nameZh: string
  nameEn?: string
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

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneLog(log: ConfigLog): ConfigLog {
  return { ...log }
}

function cloneOption(option: ConfigOption): ConfigOption {
  return {
    ...option,
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

function persistSnapshot(snapshot: ConfigWorkspaceSnapshot): void {
  memorySnapshot = cloneSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function loadSnapshot(): ConfigWorkspaceSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<ConfigWorkspaceSnapshot>
    if (!parsed.flatOptions || !parsed.categoryNodes) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    memorySnapshot = {
      version: STORE_VERSION,
      flatOptions: Object.fromEntries(
        Object.entries(parsed.flatOptions).map(([dimensionId, items]) => [dimensionId, Array.isArray(items) ? items.map(cloneOption) : []]),
      ) as Record<FlatDimensionId, ConfigOption[]>,
      categoryNodes: Array.isArray(parsed.categoryNodes) ? parsed.categoryNodes.map(cloneCategoryNode) : [],
    }
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = seedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
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
  return (loadSnapshot().flatOptions[dimensionId] || [])
    .map(cloneOption)
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

  if (!optionId) {
    const nextOption: ConfigOption = {
      id: `${dimensionId}-${nextNumericCode(currentItems.map((item) => item.code))}`,
      code: nextNumericCode(currentItems.map((item) => item.code)),
      name_zh: draft.nameZh.trim(),
      name_en: draft.nameEn?.trim() || '',
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
      name_zh: draft.nameZh.trim(),
      name_en: draft.nameEn?.trim() || '',
      sortOrder: draft.sortOrder,
      status: draft.status,
    },
    dimensionName,
    '编辑配置',
    `更新${dimensionName}「${draft.nameZh.trim()}」配置内容。`,
    operatorName,
  )
  snapshot.flatOptions[dimensionId] = currentItems.map((item) => (item.id === optionId ? updated : item))
  persistSnapshot(snapshot)
  return updated
}

export function listProductCategoryNodes(): ProductCategoryNode[] {
  return loadSnapshot().categoryNodes
    .map(cloneCategoryNode)
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
  const subtree = getCategorySubtree(nodeId, listProductCategoryNodes())
  return subtree.every((item) => item.productCount === 0)
}

export function saveProductCategoryNode(
  nodeId: string | null,
  parentId: string | null,
  draft: ProductCategoryDraft,
  operatorName = '当前用户',
): ProductCategoryNode {
  const snapshot = loadSnapshot()
  const currentNodes = snapshot.categoryNodes
  const parent = parentId ? currentNodes.find((item) => item.id === parentId) : null
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

export function resetConfigWorkspaceRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}
