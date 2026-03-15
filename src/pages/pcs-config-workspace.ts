import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderLabeledInput,
  renderLabeledSelect,
} from '../components/ui'

// ============ 类型定义 ============

type ConfigStatus = 'ENABLED' | 'DISABLED'

interface ConfigOption {
  code: string
  name_zh: string
  name_en?: string
  status: ConfigStatus
  sortOrder: number
}

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
}

interface ConfigState {
  selectedDimension: string
  searchTerm: string
  expandedNodes: Set<string>
  editDrawerOpen: boolean
  addDrawerOpen: boolean
  editingCategory: CategoryNode | null
  parentForNew: CategoryNode | null
}

// ============ Mock 数据 ============

const CONFIG_DATA = {
  brands: [
    { code: 'Chicmore', name_zh: 'Chicmore', name_en: 'Chicmore', status: 'ENABLED' as ConfigStatus, sortOrder: 1 },
    { code: 'FADFAD', name_zh: 'FADFAD', name_en: 'FADFAD', status: 'ENABLED' as ConfigStatus, sortOrder: 2 },
    { code: 'Tendblank', name_zh: 'Tendblank', name_en: 'Tendblank', status: 'ENABLED' as ConfigStatus, sortOrder: 3 },
    { code: 'Asaya', name_zh: 'Asaya', name_en: 'Asaya', status: 'ENABLED' as ConfigStatus, sortOrder: 4 },
    { code: 'LUXME', name_zh: 'LUXME', name_en: 'LUXME', status: 'ENABLED' as ConfigStatus, sortOrder: 5 },
    { code: 'MODISH', name_zh: 'MODISH', name_en: 'MODISH', status: 'ENABLED' as ConfigStatus, sortOrder: 6 },
    { code: 'PRIMA', name_zh: 'PRIMA', name_en: 'PRIMA', status: 'ENABLED' as ConfigStatus, sortOrder: 7 },
  ],
  styles: [
    { code: 'casual', name_zh: '休闲', name_en: 'Casual', status: 'ENABLED' as ConfigStatus, sortOrder: 1 },
    { code: 'vacation', name_zh: '度假', name_en: 'Vacation', status: 'ENABLED' as ConfigStatus, sortOrder: 2 },
    { code: 'vintage', name_zh: '复古', name_en: 'Vintage', status: 'ENABLED' as ConfigStatus, sortOrder: 3 },
    { code: 'runway', name_zh: '秀场', name_en: 'Runway', status: 'ENABLED' as ConfigStatus, sortOrder: 4 },
    { code: 'evening', name_zh: '礼服', name_en: 'Evening', status: 'ENABLED' as ConfigStatus, sortOrder: 5 },
    { code: 'socialite', name_zh: '名媛', name_en: 'Socialite', status: 'ENABLED' as ConfigStatus, sortOrder: 6 },
    { code: 'office', name_zh: '通勤', name_en: 'Office', status: 'ENABLED' as ConfigStatus, sortOrder: 7 },
    { code: 'elegant', name_zh: '优雅', name_en: 'Elegant', status: 'ENABLED' as ConfigStatus, sortOrder: 8 },
    { code: 'sexy', name_zh: '性感', name_en: 'Sexy', status: 'ENABLED' as ConfigStatus, sortOrder: 9 },
    { code: 'sweet', name_zh: '甜美', name_en: 'Sweet', status: 'ENABLED' as ConfigStatus, sortOrder: 10 },
    { code: 'street', name_zh: '街头', name_en: 'Street', status: 'ENABLED' as ConfigStatus, sortOrder: 11 },
    { code: 'preppy', name_zh: '学院', name_en: 'Preppy', status: 'ENABLED' as ConfigStatus, sortOrder: 12 },
    { code: 'simple', name_zh: '简约', name_en: 'Simple', status: 'ENABLED' as ConfigStatus, sortOrder: 13 },
  ],
  sizes: [
    { code: 'XS', name_zh: 'XS', name_en: 'XS', status: 'ENABLED' as ConfigStatus, sortOrder: 1 },
    { code: 'S', name_zh: 'S', name_en: 'S', status: 'ENABLED' as ConfigStatus, sortOrder: 2 },
    { code: 'M', name_zh: 'M', name_en: 'M', status: 'ENABLED' as ConfigStatus, sortOrder: 3 },
    { code: 'L', name_zh: 'L', name_en: 'L', status: 'ENABLED' as ConfigStatus, sortOrder: 4 },
    { code: 'XL', name_zh: 'XL', name_en: 'XL', status: 'ENABLED' as ConfigStatus, sortOrder: 5 },
    { code: 'XXL', name_zh: 'XXL', name_en: 'XXL', status: 'ENABLED' as ConfigStatus, sortOrder: 6 },
  ],
  colors: [
    { code: 'red', name_zh: '红色', name_en: 'Red', status: 'ENABLED' as ConfigStatus, sortOrder: 1 },
    { code: 'blue', name_zh: '蓝色', name_en: 'Blue', status: 'ENABLED' as ConfigStatus, sortOrder: 2 },
    { code: 'green', name_zh: '绿色', name_en: 'Green', status: 'ENABLED' as ConfigStatus, sortOrder: 3 },
    { code: 'black', name_zh: '黑色', name_en: 'Black', status: 'ENABLED' as ConfigStatus, sortOrder: 4 },
    { code: 'white', name_zh: '白色', name_en: 'White', status: 'ENABLED' as ConfigStatus, sortOrder: 5 },
    { code: 'pink', name_zh: '粉色', name_en: 'Pink', status: 'ENABLED' as ConfigStatus, sortOrder: 6 },
    { code: 'yellow', name_zh: '黄色', name_en: 'Yellow', status: 'ENABLED' as ConfigStatus, sortOrder: 7 },
  ],
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
        children: [
          { id: 'cat_1_1_1', code: 'women_tshirt', name_zh: 'T恤', name_en: 'T-shirt', status: 'ENABLED', sortOrder: 1, level: 3, parent_id: 'cat_1_1', product_count: 15 },
          { id: 'cat_1_1_2', code: 'women_shirt', name_zh: '衬衫', name_en: 'Shirt', status: 'ENABLED', sortOrder: 2, level: 3, parent_id: 'cat_1_1', product_count: 0 },
          { id: 'cat_1_1_3', code: 'women_blouse', name_zh: '衬衣', name_en: 'Blouse', status: 'ENABLED', sortOrder: 3, level: 3, parent_id: 'cat_1_1', product_count: 8 },
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
        children: [
          { id: 'cat_1_2_1', code: 'women_mini_dress', name_zh: '短款连衣裙', name_en: 'Mini Dress', status: 'ENABLED', sortOrder: 1, level: 3, parent_id: 'cat_1_2', product_count: 12 },
          { id: 'cat_1_2_2', code: 'women_midi_dress', name_zh: '中款连衣裙', name_en: 'Midi Dress', status: 'ENABLED', sortOrder: 2, level: 3, parent_id: 'cat_1_2', product_count: 6 },
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
        children: [
          { id: 'cat_1_3_1', code: 'women_jeans', name_zh: '牛仔裤', name_en: 'Jeans', status: 'ENABLED', sortOrder: 1, level: 3, parent_id: 'cat_1_3', product_count: 10 },
          { id: 'cat_1_3_2', code: 'women_trousers', name_zh: '西裤', name_en: 'Trousers', status: 'DISABLED', sortOrder: 2, level: 3, parent_id: 'cat_1_3', product_count: 0 },
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
        children: [
          { id: 'cat_2_1_1', code: 'men_tshirt', name_zh: 'T恤', name_en: 'T-shirt', status: 'ENABLED', sortOrder: 1, level: 3, parent_id: 'cat_2_1', product_count: 5 },
        ],
      },
    ],
  },
]

const DIMENSION_LIST = [
  { id: 'category_tree', name: '商品类目', count: 0, type: 'tree' },
  { id: 'brands', name: '品牌', count: CONFIG_DATA.brands.length, type: 'flat' },
  { id: 'styles', name: '风格', count: CONFIG_DATA.styles.length, type: 'flat' },
  { id: 'sizes', name: '尺码', count: CONFIG_DATA.sizes.length, type: 'flat' },
  { id: 'colors', name: '颜色', count: CONFIG_DATA.colors.length, type: 'flat' },
]

// ============ 状态管理 ============

let state: ConfigState = {
  selectedDimension: 'category_tree',
  searchTerm: '',
  expandedNodes: new Set(['cat_1', 'cat_1_1']),
  editDrawerOpen: false,
  addDrawerOpen: false,
  editingCategory: null,
  parentForNew: null,
}

// ============ 工具函数 ============

function canDeleteCategory(node: CategoryNode): { canDelete: boolean; reason?: string } {
  if (node.children && node.children.length > 0) {
    return { canDelete: false, reason: '该类目下有子类目，不能删除' }
  }
  if (node.product_count && node.product_count > 0) {
    return { canDelete: false, reason: `该类目下有 ${node.product_count} 个商品，不能删除` }
  }
  return { canDelete: true }
}

function getFilteredOptions(dimensionId: string): ConfigOption[] {
  const data = CONFIG_DATA[dimensionId as keyof typeof CONFIG_DATA] as ConfigOption[] | undefined
  if (!data) return []
  
  if (!state.searchTerm) return data
  
  return data.filter((item) =>
    item.code.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
    item.name_zh.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
    item.name_en?.toLowerCase().includes(state.searchTerm.toLowerCase())
  )
}

// ============ 渲染函数 ============

function renderDimensionList(): string {
  return `
    <div class="w-64 bg-white border-r p-4 overflow-y-auto">
      <h2 class="text-lg font-semibold mb-4">配置维度</h2>
      <div class="space-y-1">
        ${DIMENSION_LIST.map((dim) => `
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
    
    return `
      <div>
        <div class="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded" style="padding-left: ${level * 24 + 12}px">
          <button data-config-action="toggle-node" data-node-id="${node.id}" class="w-5 h-5 flex items-center justify-center">
            ${hasChildren ? (isExpanded ? '<i data-lucide="chevron-down" class="h-4 w-4"></i>' : '<i data-lucide="chevron-right" class="h-4 w-4"></i>') : '<span class="w-4"></span>'}
          </button>
          <div class="flex-1 flex items-center gap-2">
            <span class="font-medium">${escapeHtml(node.name_zh)}</span>
            <span class="text-sm text-gray-500">(${escapeHtml(node.code)})</span>
            ${node.product_count !== undefined && node.product_count > 0 ? `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100">${node.product_count}个商品</span>` : ''}
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${node.status === 'ENABLED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">${node.status === 'ENABLED' ? '启用' : '停用'}</span>
            <span class="text-xs text-gray-400">L${node.level}</span>
          </div>
          <div class="flex items-center gap-1">
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

function renderFlatTable(dimensionId: string): string {
  const options = getFilteredOptions(dimensionId)
  
  return `
    <div>
      <div class="flex items-center gap-4 mb-4">
        <div class="flex-1 relative">
          <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"></i>
          <input
            type="text"
            placeholder="搜索 code 或名称"
            value="${escapeHtml(state.searchTerm)}"
            data-config-filter="search"
            class="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2">
          <i data-lucide="plus" class="h-4 w-4"></i>
          新建配置项
        </button>
      </div>
      <div class="border rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">中文名称</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">英文名称</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排序</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${options.map((opt) => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-mono text-sm">${escapeHtml(opt.code)}</td>
                <td class="px-4 py-3">${escapeHtml(opt.name_zh)}</td>
                <td class="px-4 py-3 text-gray-500">${escapeHtml(opt.name_en || '-')}</td>
                <td class="px-4 py-3">${opt.sortOrder}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${opt.status === 'ENABLED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">
                    ${opt.status === 'ENABLED' ? '启用' : '停用'}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button class="p-1 rounded hover:bg-gray-100">
                    <i data-lucide="edit-2" class="h-4 w-4"></i>
                  </button>
                  <button class="p-1 rounded hover:bg-gray-100">
                    <i data-lucide="trash-2" class="h-4 w-4 text-red-600"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderContent(): string {
  const dimension = DIMENSION_LIST.find((d) => d.id === state.selectedDimension)
  const isTree = dimension?.type === 'tree'
  
  return `
    <div class="flex-1 p-6 overflow-y-auto">
      <div class="bg-white rounded-lg border p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-semibold">${dimension?.name || '配置工作台'}</h1>
            <p class="text-sm text-gray-500 mt-1">${isTree ? '树形结构管理，支持三级类目' : '配置项管理'}</p>
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
                删除规则：只能删除叶子类目（没有子类目）且该类目下没有商品的类目
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
  
  const formContent = `
    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium text-gray-500">类目层级</label>
        <div class="mt-1 text-sm">L${cat.level} - ${cat.level === 1 ? '一级类目' : cat.level === 2 ? '二级类目' : '三级类目'}</div>
      </div>
      ${renderLabeledInput('Code', { value: cat.code, prefix: 'config', field: 'code' })}
      ${renderLabeledInput('中文名称', { value: cat.name_zh, prefix: 'config', field: 'name_zh' })}
      ${renderLabeledInput('英文名称', { value: cat.name_en || '', placeholder: '可选', prefix: 'config', field: 'name_en' })}
      ${renderLabeledInput('排序', { value: String(cat.sortOrder), type: 'number', prefix: 'config', field: 'sortOrder' })}
      ${renderLabeledSelect('状态', {
        value: cat.status,
        options: [
          { value: 'ENABLED', label: '启用' },
          { value: 'DISABLED', label: '停用' },
        ],
        prefix: 'config',
        field: 'status',
      })}
    </div>
  `

  return uiDrawer(
    {
      title: '编辑类目',
      subtitle: '修改类目基本信息',
      closeAction: { prefix: 'config', action: 'close-edit-drawer' },
      width: 'sm',
    },
    formContent,
    {
      cancel: { prefix: 'config', action: 'close-edit-drawer' },
      confirm: { prefix: 'config', action: 'save-edit', label: '保存', variant: 'primary' },
    }
  )
}

function renderConfigAddDrawer(): string {
  if (!state.addDrawerOpen) return ''
  
  const parent = state.parentForNew
  
  const formContent = `
    <div class="space-y-4">
      ${renderLabeledInput('Code', { placeholder: '输入 code', prefix: 'config', field: 'new_code' }, true)}
      ${renderLabeledInput('中文名称', { placeholder: '输入中文名称', prefix: 'config', field: 'new_name_zh' }, true)}
      ${renderLabeledInput('英文名称', { placeholder: '输入英文名称（可选）', prefix: 'config', field: 'new_name_en' })}
      ${renderLabeledInput('排序', { value: '1', type: 'number', prefix: 'config', field: 'new_sortOrder' })}
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
    }
  )
}

// ============ 查找类目辅助函数 ============

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

// ============ 事件处理 ============

export function handleConfigWorkspaceEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-config-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.configAction
  
  switch (action) {
    case 'select-dimension': {
      const dimension = actionNode.dataset.dimension
      if (dimension) {
        state.selectedDimension = dimension
        state.searchTerm = ''
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
          state.editingCategory = cat
          state.editDrawerOpen = true
        }
      }
      return true
    }
    case 'add-child': {
      const parentId = actionNode.dataset.parentId
      if (parentId) {
        const parent = findCategoryById(CATEGORY_TREE, parentId)
        if (parent) {
          state.parentForNew = parent
          state.addDrawerOpen = true
        }
      }
      return true
    }
    case 'add-root-category':
      state.parentForNew = null
      state.addDrawerOpen = true
      return true
    case 'close-edit-drawer':
      state.editDrawerOpen = false
      state.editingCategory = null
      return true
    case 'close-add-drawer':
      state.addDrawerOpen = false
      state.parentForNew = null
      return true
    case 'save-edit':
      state.editDrawerOpen = false
      state.editingCategory = null
      return true
    case 'save-add':
      state.addDrawerOpen = false
      state.parentForNew = null
      return true
    default:
      return false
  }
}

export function handleConfigWorkspaceInput(target: Element): boolean {
  const filterNode = target.closest<HTMLElement>('[data-config-filter]')
  if (filterNode) {
    const filter = filterNode.dataset.configFilter
    const value = (filterNode as HTMLInputElement).value
    
    if (filter === 'search') {
      state.searchTerm = value
      return true
    }
  }
  
  return false
}

export function isConfigWorkspaceDialogOpen(): boolean {
  return state.editDrawerOpen || state.addDrawerOpen
}

export function renderConfigWorkspacePage(): string {
  return `
    <div class="h-[calc(100vh-180px)] flex bg-gray-50 -m-4 lg:-m-6">
      ${renderDimensionList()}
      ${renderContent()}
      ${renderConfigEditDrawer()}
      ${renderConfigAddDrawer()}
    </div>
  `
}
