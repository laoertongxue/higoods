import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderLabeledInput,
  renderLabeledSelect,
} from '../components/ui'
import {
  createInitialConfigData,
  FLAT_DIMENSION_META,
  type ConfigLog,
  type ConfigOption,
  type ConfigStatus,
  type FlatDimensionId,
} from '../data/pcs-config-dimensions'

type ConfigDimensionId = 'category_tree' | FlatDimensionId
type FlatDrawerMode = 'create' | 'edit' | 'log'
type CategoryDrawerMode = 'edit' | 'log'

interface CategoryNode {
  id: string
  code: string
  name_zh: string
  name_en?: string
  status: ConfigStatus
  sortOrder: number
  level: 1 | 2 | 3
  parent_id: string | null
  children?: CategoryNode[]
  product_count?: number
  updatedAt: string
  updatedBy: string
  logs: ConfigLog[]
}

interface FlatConfigForm {
  code: string
  name_zh: string
  name_en: string
  sortOrder: string
  status: ConfigStatus
}

interface ConfigState {
  selectedDimension: ConfigDimensionId
  searchTerm: string
  expandedNodes: Set<string>
  editDrawerOpen: boolean
  categoryDrawerMode: CategoryDrawerMode
  addDrawerOpen: boolean
  editingCategory: CategoryNode | null
  categoryForm: FlatConfigForm
  parentForNew: CategoryNode | null
  flatDrawerOpen: boolean
  flatDrawerMode: FlatDrawerMode
  flatDrawerDimension: FlatDimensionId | null
  flatEditingItemId: string | null
  flatForm: FlatConfigForm
  flatPagination: Record<FlatDimensionId, { page: number }>
}

const CONFIG_DATA = createInitialConfigData()
const FLAT_PAGE_SIZE = 20
const INITIAL_FLAT_PAGINATION: Record<FlatDimensionId, { page: number }> = FLAT_DIMENSION_META.reduce((acc, item) => {
  acc[item.id] = { page: 1 }
  return acc
}, {} as Record<FlatDimensionId, { page: number }>)

const CATEGORY_OPERATOR_POOL = ['类目治理负责人', '商品中心管理员', '商品企划', '系统配置专员']

function formatAuditTimeBySeed(seed: number): string {
  const base = new Date('2026-03-26T09:30:00+08:00')
  base.setHours(base.getHours() + seed * 6)
  base.setMinutes(base.getMinutes() + seed * 7)
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())} ${pad(base.getHours())}:${pad(base.getMinutes())}`
}

function createCategoryAuditTrail(name: string, seed: number): Pick<CategoryNode, 'updatedAt' | 'updatedBy' | 'logs'> {
  const firstTime = formatAuditTimeBySeed(seed)
  const secondTime = formatAuditTimeBySeed(seed + 2)
  const thirdTime = formatAuditTimeBySeed(seed + 5)
  const logs: ConfigLog[] = [
    {
      id: `category-log-${seed}-1`,
      action: '初始化类目',
      detail: `完成商品类目「${name}」初始化建档。`,
      operator: CATEGORY_OPERATOR_POOL[seed % CATEGORY_OPERATOR_POOL.length],
      time: firstTime,
    },
    {
      id: `category-log-${seed}-2`,
      action: '结构复核',
      detail: `复核商品类目「${name}」层级、排序和展示名称。`,
      operator: CATEGORY_OPERATOR_POOL[(seed + 1) % CATEGORY_OPERATOR_POOL.length],
      time: secondTime,
    },
    {
      id: `category-log-${seed}-3`,
      action: '口径确认',
      detail: `确认商品类目「${name}」启停口径并留存维度日志。`,
      operator: CATEGORY_OPERATOR_POOL[(seed + 2) % CATEGORY_OPERATOR_POOL.length],
      time: thirdTime,
    },
  ]

  return {
    updatedAt: thirdTime,
    updatedBy: logs[2].operator,
    logs,
  }
}

function applyNumericCodesToCategoryTree(nodes: CategoryNode[]): void {
  let nextCode = 1

  const walk = (items: CategoryNode[]) => {
    items.forEach((item) => {
      item.code = String(nextCode++)
      if (item.children?.length) {
        walk(item.children)
      }
    })
  }

  walk(nodes)
}

const CATEGORY_TREE: CategoryNode[] = [
  {
    id: 'cat_1',
    code: 'women',
    name_zh: '女装',
    name_en: "Women's Clothing",
    status: 'ENABLED',
    sortOrder: 1,
    level: 1,
    parent_id: null,
    product_count: 0,
    ...createCategoryAuditTrail('女装', 1),
    children: [
      {
        id: 'cat_1_1',
        code: 'women_tops',
        name_zh: '上衣',
        name_en: 'Tops',
        status: 'ENABLED',
        sortOrder: 1,
        level: 2,
        parent_id: 'cat_1',
        product_count: 0,
        ...createCategoryAuditTrail('上衣', 2),
        children: [
          { id: 'cat_1_1_1', code: 'women_tshirt', name_zh: 'T恤', name_en: 'T-shirt', status: 'ENABLED', sortOrder: 1, level: 3, parent_id: 'cat_1_1', product_count: 15, ...createCategoryAuditTrail('T恤', 3) },
          { id: 'cat_1_1_2', code: 'women_shirt', name_zh: '衬衫', name_en: 'Shirt', status: 'ENABLED', sortOrder: 2, level: 3, parent_id: 'cat_1_1', product_count: 0, ...createCategoryAuditTrail('衬衫', 4) },
          { id: 'cat_1_1_3', code: 'women_blouse', name_zh: '衬衣', name_en: 'Blouse', status: 'ENABLED', sortOrder: 3, level: 3, parent_id: 'cat_1_1', product_count: 8, ...createCategoryAuditTrail('衬衣', 5) },
        ],
      },
      {
        id: 'cat_1_2',
        code: 'women_dress',
        name_zh: '连衣裙',
        name_en: 'Dress',
        status: 'ENABLED',
        sortOrder: 2,
        level: 2,
        parent_id: 'cat_1',
        product_count: 0,
        ...createCategoryAuditTrail('连衣裙', 6),
        children: [
          { id: 'cat_1_2_1', code: 'women_mini_dress', name_zh: '短款连衣裙', name_en: 'Mini Dress', status: 'ENABLED', sortOrder: 1, level: 3, parent_id: 'cat_1_2', product_count: 12, ...createCategoryAuditTrail('短款连衣裙', 7) },
          { id: 'cat_1_2_2', code: 'women_midi_dress', name_zh: '中款连衣裙', name_en: 'Midi Dress', status: 'ENABLED', sortOrder: 2, level: 3, parent_id: 'cat_1_2', product_count: 6, ...createCategoryAuditTrail('中款连衣裙', 8) },
        ],
      },
      {
        id: 'cat_1_3',
        code: 'women_bottoms',
        name_zh: '裤装',
        name_en: 'Bottoms',
        status: 'ENABLED',
        sortOrder: 3,
        level: 2,
        parent_id: 'cat_1',
        product_count: 0,
        ...createCategoryAuditTrail('裤装', 9),
        children: [
          { id: 'cat_1_3_1', code: 'women_jeans', name_zh: '牛仔裤', name_en: 'Jeans', status: 'ENABLED', sortOrder: 1, level: 3, parent_id: 'cat_1_3', product_count: 10, ...createCategoryAuditTrail('牛仔裤', 10) },
          { id: 'cat_1_3_2', code: 'women_trousers', name_zh: '西裤', name_en: 'Trousers', status: 'DISABLED', sortOrder: 2, level: 3, parent_id: 'cat_1_3', product_count: 0, ...createCategoryAuditTrail('西裤', 11) },
        ],
      },
    ],
  },
  {
    id: 'cat_2',
    code: 'men',
    name_zh: '男装',
    name_en: "Men's Clothing",
    status: 'ENABLED',
    sortOrder: 2,
    level: 1,
    parent_id: null,
    product_count: 0,
    ...createCategoryAuditTrail('男装', 12),
    children: [
      {
        id: 'cat_2_1',
        code: 'men_tops',
        name_zh: '上衣',
        name_en: 'Tops',
        status: 'ENABLED',
        sortOrder: 1,
        level: 2,
        parent_id: 'cat_2',
        product_count: 0,
        ...createCategoryAuditTrail('男装上衣', 13),
        children: [
          { id: 'cat_2_1_1', code: 'men_tshirt', name_zh: 'T恤', name_en: 'T-shirt', status: 'ENABLED', sortOrder: 1, level: 3, parent_id: 'cat_2_1', product_count: 5, ...createCategoryAuditTrail('男装T恤', 14) },
        ],
      },
    ],
  },
]

applyNumericCodesToCategoryTree(CATEGORY_TREE)

function createEmptyFlatForm(): FlatConfigForm {
  return {
    code: '',
    name_zh: '',
    name_en: '',
    sortOrder: '1',
    status: 'ENABLED',
  }
}

let state: ConfigState = {
  selectedDimension: 'brands',
  searchTerm: '',
  expandedNodes: new Set(['cat_1', 'cat_1_1']),
  editDrawerOpen: false,
  categoryDrawerMode: 'edit',
  addDrawerOpen: false,
  editingCategory: null,
  categoryForm: createEmptyFlatForm(),
  parentForNew: null,
  flatDrawerOpen: false,
  flatDrawerMode: 'edit',
  flatDrawerDimension: null,
  flatEditingItemId: null,
  flatForm: createEmptyFlatForm(),
  flatPagination: INITIAL_FLAT_PAGINATION,
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatCurrentTime(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function getDimensionMeta(dimensionId: FlatDimensionId) {
  return FLAT_DIMENSION_META.find((item) => item.id === dimensionId) ?? FLAT_DIMENSION_META[0]
}

function getDimensionList() {
  return [
    { id: 'category_tree' as const, name: '商品类目', count: 0, type: 'tree' as const, description: '树形结构管理，支持三级类目' },
    ...FLAT_DIMENSION_META.map((item) => ({
      id: item.id,
      name: item.name,
      count: CONFIG_DATA[item.id].length,
      type: 'flat' as const,
      description: item.description,
    })),
  ]
}

function getFlatOptions(dimensionId: FlatDimensionId): ConfigOption[] {
  return CONFIG_DATA[dimensionId]
}

function getCurrentFlatDimension(): FlatDimensionId | null {
  return state.selectedDimension === 'category_tree' ? null : state.selectedDimension
}

function getCurrentFlatItem(): ConfigOption | null {
  if (!state.flatDrawerDimension || !state.flatEditingItemId) return null
  return getFlatOptions(state.flatDrawerDimension).find((item) => item.id === state.flatEditingItemId) ?? null
}

function parseIncrementCode(code: string): number {
  const value = Number(code)
  return Number.isInteger(value) && value > 0 ? value : 0
}

function getNextFlatCode(dimensionId: FlatDimensionId): string {
  const maxCode = getFlatOptions(dimensionId).reduce((max, item) => Math.max(max, parseIncrementCode(item.code)), 0)
  return String(maxCode + 1)
}

function getNextCategoryCode(): string {
  let maxCode = 0

  const walk = (nodes: CategoryNode[]) => {
    nodes.forEach((node) => {
      maxCode = Math.max(maxCode, parseIncrementCode(node.code))
      if (node.children?.length) {
        walk(node.children)
      }
    })
  }

  walk(CATEGORY_TREE)
  return String(maxCode + 1)
}

function generateCategoryLog(action: string, detail: string): ConfigLog {
  const now = formatCurrentTime()
  return {
    id: `category-log-${Date.now()}`,
    action,
    detail,
    operator: '类目治理负责人',
    time: now,
  }
}

function sortCategoryNodes(nodes: CategoryNode[]): void {
  nodes.sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }
    return left.name_zh.localeCompare(right.name_zh, 'zh-CN')
  })
  nodes.forEach((item) => {
    if (item.children?.length) {
      sortCategoryNodes(item.children)
    }
  })
}

function openAddCategoryDrawer(parent: CategoryNode | null): void {
  state.parentForNew = parent
  state.addDrawerOpen = true
  state.categoryForm = {
    ...createEmptyFlatForm(),
    code: getNextCategoryCode(),
    sortOrder: '1',
    status: 'ENABLED',
  }
}

function createCategoryNode(parent: CategoryNode | null, nameZh: string, nameEn: string, sortOrder: number): CategoryNode {
  const now = formatCurrentTime()
  const node: CategoryNode = {
    id: `cat_${Date.now()}`,
    code: getNextCategoryCode(),
    name_zh: nameZh,
    name_en: nameEn || undefined,
    status: 'ENABLED',
    sortOrder,
    level: (parent ? parent.level + 1 : 1) as 1 | 2 | 3,
    parent_id: parent ? parent.id : null,
    product_count: 0,
    updatedAt: now,
    updatedBy: '类目治理负责人',
    logs: [
      generateCategoryLog('新建类目', `在${parent ? `「${parent.name_zh}」下` : '一级层级'}新增「${nameZh}」，并完成初始化建档。`),
    ],
  }
  return node
}

function addCategoryNode(parent: CategoryNode | null, node: CategoryNode): void {
  const targetList = parent ? (parent.children ?? (parent.children = [])) : CATEGORY_TREE
  targetList.push(node)
  sortCategoryNodes(CATEGORY_TREE)
  if (parent) {
    state.expandedNodes.add(parent.id)
  }
}

function openFlatDrawer(mode: FlatDrawerMode, dimensionId: FlatDimensionId, item?: ConfigOption): void {
  state.flatDrawerOpen = true
  state.flatDrawerMode = mode
  state.flatDrawerDimension = dimensionId
  state.flatEditingItemId = item?.id ?? null
  state.flatForm = item
    ? {
        code: item.code,
        name_zh: item.name_zh,
        name_en: item.name_en || '',
        sortOrder: String(item.sortOrder),
        status: item.status,
      }
    : {
        ...createEmptyFlatForm(),
        code: getNextFlatCode(dimensionId),
        sortOrder: String(getFlatOptions(dimensionId).length + 1),
      }
}

function closeFlatDrawer(): void {
  state.flatDrawerOpen = false
  state.flatDrawerMode = 'edit'
  state.flatDrawerDimension = null
  state.flatEditingItemId = null
  state.flatForm = createEmptyFlatForm()
}

function sortOptions(options: ConfigOption[]): void {
  options.sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }

    return left.name_zh.localeCompare(right.name_zh, 'zh-CN')
  })
}

function getDimensionStats(dimensionId: FlatDimensionId) {
  const options = getFlatOptions(dimensionId)
  const enabledCount = options.filter((item) => item.status === 'ENABLED').length
  const latestItem = options
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]

  return {
    totalCount: options.length,
    enabledCount,
    disabledCount: options.length - enabledCount,
    latestUpdatedAt: latestItem?.updatedAt || '-',
  }
}

function clampFlatPage(dimensionId: FlatDimensionId, total: number): number {
  const maxPage = Math.max(1, Math.ceil(total / FLAT_PAGE_SIZE))
  const pageState = state.flatPagination[dimensionId] ?? { page: 1 }
  return pageState.page < 1 ? 1 : pageState.page > maxPage ? maxPage : pageState.page
}

function setFlatPage(dimensionId: FlatDimensionId, page: number): void {
  const total = getFilteredOptions(dimensionId).length
  const maxPage = Math.max(1, Math.ceil(total / FLAT_PAGE_SIZE))
  const clamped = page < 1 ? 1 : page > maxPage ? maxPage : page
  state.flatPagination[dimensionId] = { page: clamped }
}

function getFlatPageRows(dimensionId: FlatDimensionId): {
  rows: ConfigOption[]
  total: number
  page: number
  totalPages: number
} {
  const rows = getFilteredOptions(dimensionId)
  const total = rows.length
  const page = clampFlatPage(dimensionId, total)
  state.flatPagination[dimensionId] = { page }
  const start = (page - 1) * FLAT_PAGE_SIZE
  return {
    rows: rows.slice(start, start + FLAT_PAGE_SIZE),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / FLAT_PAGE_SIZE)),
  }
}

function canDeleteCategory(node: CategoryNode): { canDelete: boolean; reason?: string } {
  if (node.children && node.children.length > 0) {
    return { canDelete: false, reason: '该类目下有子类目，不能删除' }
  }
  if (getCategoryProductCount(node) > 0) {
    return { canDelete: false, reason: `该类目下有 ${getCategoryProductCount(node)} 个商品，不能删除` }
  }
  return { canDelete: true }
}

function getCategoryProductCount(node: CategoryNode): number {
  const selfCount = node.product_count || 0
  const childCount = node.children?.reduce((sum, child) => sum + getCategoryProductCount(child), 0) || 0
  return selfCount + childCount
}

function canDisableCategory(node: CategoryNode): { canDisable: boolean; reason?: string } {
  const productCount = getCategoryProductCount(node)
  if (productCount > 0) {
    return { canDisable: false, reason: `该类目及下级类目下有 ${productCount} 个商品，不允许停用` }
  }

  return { canDisable: true }
}

function openCategoryDrawer(mode: CategoryDrawerMode, category: CategoryNode): void {
  state.editDrawerOpen = true
  state.categoryDrawerMode = mode
  state.editingCategory = category
  state.categoryForm = {
    code: category.code,
    name_zh: category.name_zh,
    name_en: category.name_en || '',
    sortOrder: String(category.sortOrder),
    status: category.status,
  }
}

function closeCategoryDrawer(): void {
  state.editDrawerOpen = false
  state.categoryDrawerMode = 'edit'
  state.editingCategory = null
  state.categoryForm = createEmptyFlatForm()
}

function getFilteredOptions(dimensionId: FlatDimensionId): ConfigOption[] {
  const data = getFlatOptions(dimensionId)
  const keyword = state.searchTerm.trim().toLowerCase()

  if (!keyword) return data

  return data.filter((item) =>
    item.code.toLowerCase().includes(keyword) ||
    item.name_zh.toLowerCase().includes(keyword) ||
    item.name_en?.toLowerCase().includes(keyword) ||
    item.updatedBy.toLowerCase().includes(keyword),
  )
}

function renderDimensionList(): string {
  const dimensions = getDimensionList()

  return `
    <div class="w-64 bg-white border-r p-4 overflow-y-auto">
      <h2 class="text-lg font-semibold mb-4">配置维度</h2>
      <div class="space-y-1">
        ${dimensions.map((dim) => `
          <button
            data-config-action="select-dimension"
            data-dimension="${dim.id}"
            class="w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between ${state.selectedDimension === dim.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100'}"
          >
            <span>${dim.name}</span>
            ${dim.type === 'flat' ? `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border">${dim.count}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `
}

function renderCategoryTree(nodes: CategoryNode[], level: number = 0): string {
  return nodes.map((node) => {
    const isExpanded = state.expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const check = canDeleteCategory(node)
    const disableCheck = canDisableCategory(node)
    const totalProductCount = getCategoryProductCount(node)

    return `
      <div>
        <div class="flex items-start gap-2 py-2 px-3 hover:bg-gray-50 rounded" style="padding-left: ${level * 24 + 12}px">
          <button data-config-action="toggle-node" data-node-id="${node.id}" class="w-5 h-5 flex items-center justify-center">
            ${hasChildren ? (isExpanded ? '<i data-lucide="chevron-down" class="h-4 w-4"></i>' : '<i data-lucide="chevron-right" class="h-4 w-4"></i>') : '<span class="w-4"></span>'}
          </button>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">${escapeHtml(node.name_zh)}</span>
              <span class="text-sm text-gray-500">(${escapeHtml(node.code)})</span>
              ${totalProductCount > 0 ? `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100">${totalProductCount}个商品</span>` : ''}
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${node.status === 'ENABLED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">${node.status === 'ENABLED' ? '启用' : '停用'}</span>
              <span class="text-xs text-gray-400">L${node.level}</span>
              ${!disableCheck.canDisable ? `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700" title="${escapeHtml(disableCheck.reason || '')}">不可停用</span>` : ''}
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span>更新时间：${escapeHtml(node.updatedAt)}</span>
              <span>更新人：${escapeHtml(node.updatedBy)}</span>
              <button data-config-action="view-category-log" data-category-id="${node.id}" class="rounded border px-2 py-0.5 text-xs hover:bg-gray-100">日志 ${node.logs.length} 条</button>
            </div>
          </div>
          <div class="flex items-center gap-1 pt-0.5">
            ${node.level < 3 ? `
              <button data-config-action="add-child" data-parent-id="${node.id}" class="p-1 rounded hover:bg-gray-200" title="添加子类目">
                <i data-lucide="plus" class="h-4 w-4"></i>
              </button>
            ` : ''}
            <button data-config-action="edit-category" data-category-id="${node.id}" class="p-1 rounded hover:bg-gray-200" title="编辑">
              <i data-lucide="edit-2" class="h-4 w-4"></i>
            </button>
            <button data-config-action="delete-category" data-category-id="${node.id}" class="p-1 rounded hover:bg-gray-200 ${check.canDelete ? '' : 'opacity-50 cursor-not-allowed'}" title="${check.reason || '删除'}" ${!check.canDelete ? 'disabled' : ''}>
              <i data-lucide="trash-2" class="h-4 w-4 ${check.canDelete ? 'text-red-600' : 'text-gray-400'}"></i>
            </button>
          </div>
        </div>
        ${isExpanded && hasChildren ? renderCategoryTree(node.children!, level + 1) : ''}
      </div>
    `
  }).join('')
}

function renderFlatTable(dimensionId: FlatDimensionId): string {
  const dimension = getDimensionMeta(dimensionId)
  const stats = getDimensionStats(dimensionId)
  const pageInfo = getFlatPageRows(dimensionId)
  const rows = pageInfo.rows

  return `
    <div class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <article class="rounded-lg border bg-slate-50 p-4">
          <p class="text-xs text-gray-500">配置项总数</p>
          <p class="mt-2 text-xl font-semibold">${stats.totalCount}</p>
        </article>
        <article class="rounded-lg border bg-slate-50 p-4">
          <p class="text-xs text-gray-500">启用中</p>
          <p class="mt-2 text-xl font-semibold text-green-700">${stats.enabledCount}</p>
        </article>
        <article class="rounded-lg border bg-slate-50 p-4">
          <p class="text-xs text-gray-500">停用中</p>
          <p class="mt-2 text-xl font-semibold text-gray-700">${stats.disabledCount}</p>
        </article>
        <article class="rounded-lg border bg-slate-50 p-4">
          <p class="text-xs text-gray-500">最近更新时间</p>
          <p class="mt-2 text-sm font-semibold">${escapeHtml(stats.latestUpdatedAt)}</p>
        </article>
      </div>

      <div class="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <i data-lucide="shield-check" class="mt-0.5 h-4 w-4"></i>
        <p>${escapeHtml(dimension.name)}维度全部配置项均记录更新时间、更新人和操作日志；Code 由系统按维度自动递增生成，不允许手工维护。</p>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex-1 relative">
          <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"></i>
          <input
            type="text"
            placeholder="搜索 code、配置名称或更新人"
            value="${escapeHtml(state.searchTerm)}"
            data-config-filter="search"
            class="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button data-config-action="create-flat-item" class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2">
          <i data-lucide="plus" class="h-4 w-4"></i>
          新建配置项
        </button>
      </div>

      <div class="border rounded-lg overflow-hidden bg-white">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1260px]">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配置名称</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">别名 / 英文名</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排序</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新人</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${rows.length === 0 ? `
                <tr>
                  <td colspan="8" class="px-4 py-12 text-center text-sm text-gray-500">暂无符合条件的配置项</td>
                </tr>
              ` : rows.map((opt) => `
                <tr class="hover:bg-gray-50 align-top">
                  <td class="px-4 py-3 font-mono text-sm">${escapeHtml(opt.code)}</td>
                  <td class="px-4 py-3">
                    <div class="font-medium">${escapeHtml(opt.name_zh)}</div>
                    <div class="mt-1 text-xs text-gray-500">${escapeHtml(dimension.name)}配置</div>
                  </td>
                  <td class="px-4 py-3 text-gray-500">${escapeHtml(opt.name_en || '-')}</td>
                  <td class="px-4 py-3">${opt.sortOrder}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${opt.status === 'ENABLED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">
                      ${opt.status === 'ENABLED' ? '启用' : '停用'}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm">${escapeHtml(opt.updatedAt)}</td>
                  <td class="px-4 py-3 text-sm">${escapeHtml(opt.updatedBy)}</td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <button data-config-action="edit-flat-item" data-dimension="${dimensionId}" data-item-id="${opt.id}" class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-100">编辑</button>
                      <button data-config-action="view-flat-log" data-dimension="${dimensionId}" data-item-id="${opt.id}" class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-100">日志</button>
                    </div>
                    <p class="mt-2 text-right text-xs text-gray-400">${opt.logs.length} 条日志</p>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between p-3 border-t bg-white">
          <p class="text-xs text-gray-500">共 ${pageInfo.total} 条，第 ${pageInfo.page}/${pageInfo.totalPages} 页（每页 ${FLAT_PAGE_SIZE} 条）</p>
          <div class="flex items-center gap-2">
            <button
              data-config-action="flat-page-prev"
              data-dimension="${dimensionId}"
              class="px-2 py-1.5 border rounded text-sm ${pageInfo.page === 1 ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-100'}"
              ${pageInfo.page === 1 ? 'disabled' : ''}
            >
              上一页
            </button>
            <button
              data-config-action="flat-page-next"
              data-dimension="${dimensionId}"
              class="px-2 py-1.5 border rounded text-sm ${pageInfo.page === pageInfo.totalPages ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-100'}"
              ${pageInfo.page === pageInfo.totalPages ? 'disabled' : ''}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderContent(): string {
  const dimensions = getDimensionList()
  const dimension = dimensions.find((item) => item.id === state.selectedDimension)
  const isTree = dimension?.type === 'tree'

  return `
    <div class="flex-1 p-6 overflow-y-auto">
      <div class="bg-white rounded-lg border p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-semibold">${dimension?.name || '配置工作台'}</h1>
            <p class="text-sm text-gray-500 mt-1">${dimension?.description || (isTree ? '树形结构管理，支持三级类目' : '配置项管理')}</p>
          </div>
          ${isTree ? `
            <button data-config-action="add-root-category" class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2">
              <i data-lucide="plus" class="h-4 w-4"></i>
              新建一级类目
            </button>
          ` : ''}
        </div>

        ${state.selectedDimension === 'category_tree' ? `
          <div class="space-y-2">
            <div class="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <i data-lucide="alert-circle" class="h-4 w-4 text-blue-600 mt-0.5"></i>
              <div class="text-sm text-blue-800">
                删除规则：只能删除叶子类目（没有子类目）且该类目下没有商品的类目；停用规则：类目及下级类目存在商品时不允许停用
              </div>
            </div>
            <div class="border rounded-lg bg-white">${renderCategoryTree(CATEGORY_TREE)}</div>
          </div>
        ` : renderFlatTable(state.selectedDimension)}
      </div>
    </div>
  `
}

function renderConfigEditDrawer(): string {
  if (!state.editDrawerOpen || !state.editingCategory) return ''

  const cat = state.editingCategory
  const readOnly = state.categoryDrawerMode === 'log'
  const disableCheck = canDisableCategory(cat)
  const disableOptionDisabled = !disableCheck.canDisable && state.categoryForm.status !== 'DISABLED'

  const formContent = `
    <div class="space-y-6">
      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-500">类目层级</label>
          <div class="mt-1 text-sm">L${cat.level} - ${cat.level === 1 ? '一级类目' : cat.level === 2 ? '二级类目' : '三级类目'}</div>
        </div>
        ${renderLabeledInput('Code（系统自增）', { value: state.categoryForm.code, prefix: 'config', field: 'code', disabled: true })}
        ${renderLabeledInput('中文名称', { value: state.categoryForm.name_zh, prefix: 'config', field: 'name_zh', disabled: readOnly })}
        ${renderLabeledInput('英文名称', { value: state.categoryForm.name_en, placeholder: '可选', prefix: 'config', field: 'name_en', disabled: readOnly })}
        ${renderLabeledInput('排序', { value: state.categoryForm.sortOrder, type: 'number', prefix: 'config', field: 'sortOrder', disabled: readOnly })}
        ${renderLabeledSelect('状态', {
          value: state.categoryForm.status,
          options: [
            { value: 'ENABLED', label: '启用' },
            { value: 'DISABLED', label: '停用', disabled: disableOptionDisabled },
          ],
          prefix: 'config',
          field: 'status',
          disabled: readOnly,
        })}
        ${!disableCheck.canDisable ? `
          <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ${escapeHtml(disableCheck.reason || '')}
          </div>
        ` : ''}
      </div>

      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold">审计信息</h3>
          <span class="text-xs text-gray-500">${getCategoryProductCount(cat)} 个商品</span>
        </div>
        <div class="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <div>
            <p class="text-xs text-gray-500">更新时间</p>
            <p class="mt-1 font-medium">${escapeHtml(cat.updatedAt)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">更新人</p>
            <p class="mt-1 font-medium">${escapeHtml(cat.updatedBy)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">日志条数</p>
            <p class="mt-1 font-medium">${cat.logs.length} 条</p>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold">操作日志</h3>
          <span class="text-xs text-gray-500">${cat.logs.length} 条</span>
        </div>
        ${cat.logs.map((log) => `
          <article class="rounded-lg border bg-white p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-medium">${escapeHtml(log.action)}</p>
              <p class="text-xs text-gray-500">${escapeHtml(log.time)} ｜ ${escapeHtml(log.operator)}</p>
            </div>
            <p class="mt-2 text-sm text-gray-600">${escapeHtml(log.detail)}</p>
          </article>
        `).join('')}
      </section>
    </div>
  `

  return uiDrawer(
    {
      title: state.categoryDrawerMode === 'log' ? '类目日志详情' : '编辑类目',
      subtitle: state.categoryDrawerMode === 'log' ? `${cat.name_zh} ｜ ${cat.code}` : '修改类目基本信息',
      closeAction: { prefix: 'config', action: 'close-edit-drawer' },
      width: 'md',
    },
    formContent,
    state.categoryDrawerMode === 'log'
      ? {
          cancel: { prefix: 'config', action: 'close-edit-drawer', label: '关闭' },
        }
      : {
          cancel: { prefix: 'config', action: 'close-edit-drawer' },
          confirm: { prefix: 'config', action: 'save-edit', label: '保存', variant: 'primary' },
        },
  )
}

function renderConfigAddDrawer(): string {
  if (!state.addDrawerOpen) return ''

  const parent = state.parentForNew

  const formContent = `
    <div class="space-y-4">
      ${renderLabeledInput('Code（系统自增）', { value: state.categoryForm.code, prefix: 'config', field: 'code', disabled: true }, true)}
      ${renderLabeledInput('中文名称', { value: state.categoryForm.name_zh, placeholder: '输入中文名称', prefix: 'config', field: 'name_zh' }, true)}
      ${renderLabeledInput('英文名称', { value: state.categoryForm.name_en, placeholder: '输入英文名称（可选）', prefix: 'config', field: 'name_en' })}
      ${renderLabeledInput('排序', { value: state.categoryForm.sortOrder, type: 'number', prefix: 'config', field: 'sortOrder' })}
    </div>
  `

  return uiDrawer(
    {
      title: '新建类目',
      subtitle: parent ? `在 "${parent.name_zh}" 下新建 L${parent.level + 1} 类目` : '新建一级类目',
      closeAction: { prefix: 'config', action: 'close-add-drawer' },
      width: 'sm',
    },
    formContent,
    {
      cancel: { prefix: 'config', action: 'close-add-drawer' },
      confirm: { prefix: 'config', action: 'save-add', label: '创建', variant: 'primary' },
    },
  )
}

function renderFlatDrawer(): string {
  if (!state.flatDrawerOpen || !state.flatDrawerDimension) return ''

  const dimension = getDimensionMeta(state.flatDrawerDimension)
  const currentItem = getCurrentFlatItem()
  const readOnly = state.flatDrawerMode === 'log'

  const formContent = `
    <div class="space-y-6">
      <section class="space-y-4">
        ${renderLabeledInput('Code（系统自增）', {
          value: state.flatForm.code,
          placeholder: '系统自动生成',
          prefix: 'config',
          field: 'flat_code',
          disabled: true,
        }, true)}
        ${renderLabeledInput('配置名称', {
          value: state.flatForm.name_zh,
          placeholder: '请输入配置名称',
          prefix: 'config',
          field: 'flat_name_zh',
          disabled: readOnly,
        }, true)}
        ${renderLabeledInput('别名 / 英文名', {
          value: state.flatForm.name_en,
          placeholder: '可选',
          prefix: 'config',
          field: 'flat_name_en',
          disabled: readOnly,
        })}
        <div class="grid gap-4 md:grid-cols-2">
          ${renderLabeledInput('排序', {
            value: state.flatForm.sortOrder,
            type: 'number',
            prefix: 'config',
            field: 'flat_sortOrder',
            disabled: readOnly,
          }, true)}
          ${renderLabeledSelect('状态', {
            value: state.flatForm.status,
            options: [
              { value: 'ENABLED', label: '启用' },
              { value: 'DISABLED', label: '停用' },
            ],
            prefix: 'config',
            field: 'flat_status',
            disabled: readOnly,
          }, true)}
        </div>
      </section>

      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold">审计信息</h3>
          <span class="text-xs text-gray-500">${escapeHtml(dimension.name)}维度</span>
        </div>
        ${currentItem ? `
          <div class="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p class="text-xs text-gray-500">更新时间</p>
              <p class="mt-1 font-medium">${escapeHtml(currentItem.updatedAt)}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">更新人</p>
              <p class="mt-1 font-medium">${escapeHtml(currentItem.updatedBy)}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">日志条数</p>
              <p class="mt-1 font-medium">${currentItem.logs.length} 条</p>
            </div>
          </div>
        ` : `
          <p class="mt-3 text-sm text-gray-600">新建后系统会自动写入更新时间、更新人和首条维度操作日志。</p>
        `}
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold">操作日志</h3>
          <span class="text-xs text-gray-500">${currentItem ? `${currentItem.logs.length} 条` : '新建后自动生成'}</span>
        </div>
        ${currentItem ? currentItem.logs.map((log) => `
          <article class="rounded-lg border bg-white p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-medium">${escapeHtml(log.action)}</p>
              <p class="text-xs text-gray-500">${escapeHtml(log.time)} ｜ ${escapeHtml(log.operator)}</p>
            </div>
            <p class="mt-2 text-sm text-gray-600">${escapeHtml(log.detail)}</p>
          </article>
        `).join('') : `
          <div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-gray-500">保存后可查看完整维度操作日志</div>
        `}
      </section>
    </div>
  `

  return uiDrawer(
    {
      title: state.flatDrawerMode === 'create' ? `新建${dimension.name}` : state.flatDrawerMode === 'log' ? `${dimension.name}日志详情` : `编辑${dimension.name}`,
      subtitle: state.flatDrawerMode === 'create' ? `在${dimension.name}维度新增维护项` : currentItem ? `${currentItem.name_zh} ｜ ${currentItem.code}` : dimension.description,
      closeAction: { prefix: 'config', action: 'close-flat-drawer' },
      width: 'md',
    },
    formContent,
    state.flatDrawerMode === 'log'
      ? {
          cancel: { prefix: 'config', action: 'close-flat-drawer', label: '关闭' },
        }
      : {
          cancel: { prefix: 'config', action: 'close-flat-drawer' },
          confirm: { prefix: 'config', action: 'save-flat-item', label: state.flatDrawerMode === 'create' ? '创建' : '保存', variant: 'primary' },
        },
  )
}

function findCategoryById(nodes: CategoryNode[], id: string): CategoryNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findCategoryById(node.children, id)
      if (found) return found
    }
  }
  return null
}

function closeAllDrawers(): void {
  closeCategoryDrawer()
  state.addDrawerOpen = false
  state.parentForNew = null
  closeFlatDrawer()
}

export function handleConfigWorkspaceEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-config-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.configAction

  switch (action) {
    case 'select-dimension': {
      const dimension = actionNode.dataset.dimension as ConfigDimensionId | undefined
      if (dimension) {
        state.selectedDimension = dimension
        state.searchTerm = ''
        if (dimension !== 'category_tree') {
          setFlatPage(dimension, 1)
        }
      }
      return true
    }
    case 'toggle-node': {
      const nodeId = actionNode.dataset.nodeId
      if (nodeId) {
        if (state.expandedNodes.has(nodeId)) {
          state.expandedNodes.delete(nodeId)
        } else {
          state.expandedNodes.add(nodeId)
        }
      }
      return true
    }
    case 'edit-category': {
      const categoryId = actionNode.dataset.categoryId
      if (categoryId) {
        const cat = findCategoryById(CATEGORY_TREE, categoryId)
        if (cat) {
          openCategoryDrawer('edit', cat)
        }
      }
      return true
    }
    case 'view-category-log': {
      const categoryId = actionNode.dataset.categoryId
      if (categoryId) {
        const cat = findCategoryById(CATEGORY_TREE, categoryId)
        if (cat) {
          openCategoryDrawer('log', cat)
        }
      }
      return true
    }
    case 'add-child': {
      const parentId = actionNode.dataset.parentId
      if (parentId) {
        const parent = findCategoryById(CATEGORY_TREE, parentId)
        if (parent) {
          openAddCategoryDrawer(parent)
        }
      }
      return true
    }
    case 'add-root-category':
      openAddCategoryDrawer(null)
      return true
    case 'create-flat-item': {
      const dimensionId = getCurrentFlatDimension()
      if (dimensionId) {
        openFlatDrawer('create', dimensionId)
      }
      return true
    }
    case 'edit-flat-item': {
      const dimensionId = actionNode.dataset.dimension as FlatDimensionId | undefined
      const itemId = actionNode.dataset.itemId
      if (dimensionId && itemId) {
        const item = getFlatOptions(dimensionId).find((entry) => entry.id === itemId)
        if (item) {
          openFlatDrawer('edit', dimensionId, item)
        }
      }
      return true
    }
    case 'view-flat-log': {
      const dimensionId = actionNode.dataset.dimension as FlatDimensionId | undefined
      const itemId = actionNode.dataset.itemId
      if (dimensionId && itemId) {
        const item = getFlatOptions(dimensionId).find((entry) => entry.id === itemId)
        if (item) {
          openFlatDrawer('log', dimensionId, item)
        }
      }
      return true
    }
    case 'close-edit-drawer':
      closeCategoryDrawer()
      return true
    case 'close-add-drawer':
      state.addDrawerOpen = false
      state.parentForNew = null
      return true
    case 'close-flat-drawer':
      closeFlatDrawer()
      return true
    case 'flat-page-prev':
    case 'flat-page-next': {
      const dimensionId = actionNode.dataset.dimension as FlatDimensionId | undefined
      if (dimensionId) {
        const pageInfo = getFlatPageRows(dimensionId)
        if (action === 'flat-page-prev') {
          setFlatPage(dimensionId, pageInfo.page - 1)
        } else {
          setFlatPage(dimensionId, pageInfo.page + 1)
        }
      }
      return true
    }
    case 'close-dialog':
      closeAllDrawers()
      return true
    case 'save-edit':
      if (!state.editingCategory) return true
      if (state.categoryForm.status === 'DISABLED' && !canDisableCategory(state.editingCategory).canDisable) {
        return true
      }

      state.editingCategory.name_zh = state.categoryForm.name_zh.trim() || state.editingCategory.name_zh
      state.editingCategory.name_en = state.categoryForm.name_en.trim()
      state.editingCategory.sortOrder = Math.max(1, Number(state.categoryForm.sortOrder) || 1)
      state.editingCategory.status = state.categoryForm.status
      state.editingCategory.updatedAt = formatCurrentTime()
      state.editingCategory.updatedBy = '类目治理负责人'
      state.editingCategory.logs = [
        {
          id: `category-log-${state.editingCategory.id}-${Date.now()}`,
          action: '编辑类目',
          detail: `更新商品类目「${state.editingCategory.name_zh}」基础信息、排序或启停状态。`,
          operator: state.editingCategory.updatedBy,
          time: state.editingCategory.updatedAt,
        },
        ...state.editingCategory.logs,
      ]
      sortCategoryNodes(CATEGORY_TREE)
      closeCategoryDrawer()
      return true
    case 'save-add':
      if (!state.categoryForm.name_zh.trim()) {
        return true
      }

      const parentForNew = state.parentForNew
      const targetLevel = parentForNew ? parentForNew.level + 1 : 1
      if (targetLevel > 3) {
        return true
      }

      addCategoryNode(
        parentForNew,
        createCategoryNode(
          parentForNew,
          state.categoryForm.name_zh.trim(),
          state.categoryForm.name_en.trim(),
          Math.max(1, Number(state.categoryForm.sortOrder) || 1),
        ),
      )
      closeAllDrawers()
      return true
    case 'save-flat-item': {
      if (!state.flatDrawerDimension || state.flatDrawerMode === 'log') {
        return true
      }

      const dimension = getDimensionMeta(state.flatDrawerDimension)
      const options = getFlatOptions(state.flatDrawerDimension)
      const now = formatCurrentTime()
      const operator = '商品中心管理员'
      const currentItem = getCurrentFlatItem()
      const code =
        state.flatDrawerMode === 'create'
          ? getNextFlatCode(state.flatDrawerDimension)
          : currentItem?.code || state.flatForm.code.trim() || getNextFlatCode(state.flatDrawerDimension)
      const name = state.flatForm.name_zh.trim() || code
      const sortOrder = Math.max(1, Number(state.flatForm.sortOrder) || 1)

      if (state.flatDrawerMode === 'create') {
        options.push({
          id: `${state.flatDrawerDimension}-${Date.now()}`,
          code,
          name_zh: name,
          name_en: state.flatForm.name_en.trim(),
          status: state.flatForm.status,
          sortOrder,
          updatedAt: now,
          updatedBy: operator,
          logs: [
            {
              id: `log-${Date.now()}`,
              action: '新建配置项',
              detail: `在${dimension.name}维度新增「${name}」配置项，并完成初始化维护。`,
              operator,
              time: now,
            },
          ],
        })
      } else {
        if (currentItem) {
          currentItem.name_zh = name
          currentItem.name_en = state.flatForm.name_en.trim()
          currentItem.status = state.flatForm.status
          currentItem.sortOrder = sortOrder
          currentItem.updatedAt = now
          currentItem.updatedBy = operator
          currentItem.logs = [
            {
              id: `log-${Date.now()}`,
              action: '编辑配置项',
              detail: `更新${dimension.name}维度「${name}」的基础信息、排序或启停状态。`,
              operator,
              time: now,
            },
            ...currentItem.logs,
          ]
        }
      }

      sortOptions(options)
      closeFlatDrawer()
      return true
    }
    default:
      return false
  }
}

export function handleConfigWorkspaceInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-config-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.configField
    const value = (fieldNode as HTMLInputElement | HTMLSelectElement).value

    switch (field) {
      case 'code':
        state.categoryForm.code = value
        return true
      case 'name_zh':
        state.categoryForm.name_zh = value
        return true
      case 'name_en':
        state.categoryForm.name_en = value
        return true
      case 'sortOrder':
        state.categoryForm.sortOrder = value
        return true
      case 'status':
        state.categoryForm.status = value === 'DISABLED' ? 'DISABLED' : 'ENABLED'
        return true
      case 'flat_code':
        state.flatForm.code = value
        return true
      case 'flat_name_zh':
        state.flatForm.name_zh = value
        return true
      case 'flat_name_en':
        state.flatForm.name_en = value
        return true
      case 'flat_sortOrder':
        state.flatForm.sortOrder = value
        return true
      case 'flat_status':
        state.flatForm.status = value === 'DISABLED' ? 'DISABLED' : 'ENABLED'
        return true
      default:
        break
    }
  }

    const filterNode = target.closest<HTMLElement>('[data-config-filter]')
  if (filterNode) {
    const filter = filterNode.dataset.configFilter
    const value = (filterNode as HTMLInputElement).value

    if (filter === 'search') {
      state.searchTerm = value
      const dimensionId = getCurrentFlatDimension()
      if (dimensionId) {
        setFlatPage(dimensionId, 1)
      }
      return true
    }
  }

  return false
}

export function isConfigWorkspaceDialogOpen(): boolean {
  return state.editDrawerOpen || state.addDrawerOpen || state.flatDrawerOpen
}

export function renderConfigWorkspacePage(): string {
  return `
    <div class="h-[calc(100vh-180px)] flex bg-gray-50 -m-4 lg:-m-6">
      ${renderDimensionList()}
      ${renderContent()}
      ${renderConfigEditDrawer()}
      ${renderConfigAddDrawer()}
      ${renderFlatDrawer()}
    </div>
  `
}
