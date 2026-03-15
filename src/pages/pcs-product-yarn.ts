import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderDetailDrawer as uiDetailDrawer,
  renderLabeledInput,
  renderLabeledSelect,
} from '../components/ui'

// ============ 类型定义 ============

interface Yarn {
  id: string
  code: string
  name: string
  category: string
  material: string
  specification: string
  color: string
  weight: string
  status: 'ACTIVE' | 'INACTIVE'
  supplier: string
  price: string
  stock: number
  unit: string
  createdAt: string
  updatedAt: string
}

interface YarnState {
  search: string
  categoryFilter: string
  statusFilter: string
  drawerOpen: boolean
  detailDrawerOpen: boolean
  selectedYarn: Yarn | null
  formData: {
    code: string
    name: string
    category: string
    material: string
    specification: string
    color: string
    weight: string
    supplier: string
    price: string
    unit: string
  }
}

// ============ Mock 数据 ============

const mockYarns: Yarn[] = [
  {
    id: 'YARN-001',
    code: 'YRN-CT-001',
    name: '精梳棉纱线',
    category: '棉纱',
    material: '100%精梳棉',
    specification: '32S/2',
    color: '本白',
    weight: '500g/筒',
    status: 'ACTIVE',
    supplier: '东莞纺织材料有限公司',
    price: '¥45/kg',
    stock: 2500,
    unit: 'kg',
    createdAt: '2025-10-15',
    updatedAt: '2026-01-10',
  },
  {
    id: 'YARN-002',
    code: 'YRN-WL-002',
    name: '澳洲美利奴羊毛',
    category: '羊毛',
    material: '100%美利奴羊毛',
    specification: '21.5微米',
    color: '米白',
    weight: '250g/绞',
    status: 'ACTIVE',
    supplier: '上海进口毛纱贸易公司',
    price: '¥180/kg',
    stock: 800,
    unit: 'kg',
    createdAt: '2025-09-20',
    updatedAt: '2026-01-08',
  },
  {
    id: 'YARN-003',
    code: 'YRN-PL-003',
    name: '涤纶长丝',
    category: '化纤',
    material: '100%涤纶',
    specification: '150D/48F',
    color: '白色',
    weight: '1000g/筒',
    status: 'ACTIVE',
    supplier: '浙江化纤集团',
    price: '¥25/kg',
    stock: 5000,
    unit: 'kg',
    createdAt: '2025-11-01',
    updatedAt: '2026-01-12',
  },
  {
    id: 'YARN-004',
    code: 'YRN-LN-004',
    name: '亚麻纱线',
    category: '麻纱',
    material: '100%亚麻',
    specification: '24Nm',
    color: '原麻色',
    weight: '300g/筒',
    status: 'ACTIVE',
    supplier: '江苏麻纺织有限公司',
    price: '¥85/kg',
    stock: 600,
    unit: 'kg',
    createdAt: '2025-10-28',
    updatedAt: '2026-01-05',
  },
  {
    id: 'YARN-005',
    code: 'YRN-SK-005',
    name: '真丝绢丝',
    category: '蚕丝',
    material: '100%桑蚕丝',
    specification: '20/22D',
    color: '象牙白',
    weight: '100g/绞',
    status: 'INACTIVE',
    supplier: '苏州丝绸材料厂',
    price: '¥450/kg',
    stock: 150,
    unit: 'kg',
    createdAt: '2025-08-15',
    updatedAt: '2025-12-20',
  },
  {
    id: 'YARN-006',
    code: 'YRN-BL-006',
    name: '棉涤混纺纱',
    category: '混纺',
    material: '65%棉35%涤',
    specification: '40S',
    color: '漂白',
    weight: '500g/筒',
    status: 'ACTIVE',
    supplier: '广州纺织原料商贸',
    price: '¥38/kg',
    stock: 3200,
    unit: 'kg',
    createdAt: '2025-11-10',
    updatedAt: '2026-01-14',
  },
]

const categoryOptions = ['棉纱', '羊毛', '化纤', '麻纱', '蚕丝', '混纺']

// ============ 状态管理 ============

let state: YarnState = {
  search: '',
  categoryFilter: 'all',
  statusFilter: 'all',
  drawerOpen: false,
  detailDrawerOpen: false,
  selectedYarn: null,
  formData: {
    code: '',
    name: '',
    category: '',
    material: '',
    specification: '',
    color: '',
    weight: '',
    supplier: '',
    price: '',
    unit: 'kg',
  },
}

// ============ 工具函数 ============

function getFilteredYarns(): Yarn[] {
  return mockYarns.filter((yarn) => {
    const matchesSearch = !state.search ||
      yarn.name.toLowerCase().includes(state.search.toLowerCase()) ||
      yarn.code.toLowerCase().includes(state.search.toLowerCase()) ||
      yarn.material.toLowerCase().includes(state.search.toLowerCase())
    const matchesCategory = state.categoryFilter === 'all' || yarn.category === state.categoryFilter
    const matchesStatus = state.statusFilter === 'all' || yarn.status === state.statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })
}

function getStats() {
  return {
    total: mockYarns.length,
    active: mockYarns.filter((y) => y.status === 'ACTIVE').length,
    inactive: mockYarns.filter((y) => y.status === 'INACTIVE').length,
    cotton: mockYarns.filter((y) => y.category === '棉纱').length,
    wool: mockYarns.filter((y) => y.category === '羊毛').length,
    synthetic: mockYarns.filter((y) => y.category === '化纤').length,
  }
}

// ============ 渲染函数 ============

function renderKpiCards(): string {
  const stats = getStats()
  return `
    <div class="grid grid-cols-6 gap-4">
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-yarn-action="filter-all">
        <div class="text-2xl font-bold">${stats.total}</div>
        <div class="text-sm text-gray-500">全部纱线</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-yarn-action="filter-active">
        <div class="text-2xl font-bold text-green-600">${stats.active}</div>
        <div class="text-sm text-gray-500">启用中</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-yarn-action="filter-inactive">
        <div class="text-2xl font-bold text-gray-500">${stats.inactive}</div>
        <div class="text-sm text-gray-500">已停用</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-yarn-action="filter-cotton">
        <div class="text-2xl font-bold text-blue-600">${stats.cotton}</div>
        <div class="text-sm text-gray-500">棉纱</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-yarn-action="filter-wool">
        <div class="text-2xl font-bold text-amber-600">${stats.wool}</div>
        <div class="text-sm text-gray-500">羊毛</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-yarn-action="filter-synthetic">
        <div class="text-2xl font-bold text-purple-600">${stats.synthetic}</div>
        <div class="text-sm text-gray-500">化纤</div>
      </div>
    </div>
  `
}

function renderFilters(): string {
  return `
    <div class="bg-white rounded-lg border p-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="relative flex-1 min-w-[200px]">
          <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"></i>
          <input
            type="text"
            placeholder="搜索纱线编码/名称/成分..."
            value="${escapeHtml(state.search)}"
            data-yarn-filter="search"
            class="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select data-yarn-filter="category" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.categoryFilter === 'all' ? 'selected' : ''}>全部类别</option>
          ${categoryOptions.map((cat) => `<option value="${cat}" ${state.categoryFilter === cat ? 'selected' : ''}>${cat}</option>`).join('')}
        </select>
        <select data-yarn-filter="status" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
          <option value="ACTIVE" ${state.statusFilter === 'ACTIVE' ? 'selected' : ''}>启用</option>
          <option value="INACTIVE" ${state.statusFilter === 'INACTIVE' ? 'selected' : ''}>停用</option>
        </select>
        <button data-yarn-action="reset-filters" class="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 flex items-center gap-2">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>
          重置
        </button>
      </div>
    </div>
  `
}

function renderTable(): string {
  const filteredYarns = getFilteredYarns()
  
  return `
    <div class="bg-white rounded-lg border overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">编码/名称</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类别</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">成分</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">规格</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">颜色</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">供应商</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单价</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">库存</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${filteredYarns.map((yarn) => `
            <tr class="hover:bg-gray-50 cursor-pointer" data-yarn-action="view-detail" data-yarn-id="${yarn.id}">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">${escapeHtml(yarn.name)}</div>
                <div class="text-xs text-gray-500">${escapeHtml(yarn.code)}</div>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700">${escapeHtml(yarn.category)}</span>
              </td>
              <td class="px-4 py-3 text-sm">${escapeHtml(yarn.material)}</td>
              <td class="px-4 py-3 text-sm">${escapeHtml(yarn.specification)}</td>
              <td class="px-4 py-3 text-sm">${escapeHtml(yarn.color)}</td>
              <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(yarn.supplier)}</td>
              <td class="px-4 py-3 text-sm font-medium">${escapeHtml(yarn.price)}</td>
              <td class="px-4 py-3">
                <span class="${yarn.stock < 500 ? 'text-red-600 font-medium' : ''}">${yarn.stock} ${yarn.unit}</span>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${yarn.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                  ${yarn.status === 'ACTIVE' ? '启用' : '停用'}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <button class="p-1 rounded hover:bg-gray-100" data-yarn-action="toggle-menu" data-yarn-id="${yarn.id}">
                  <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="flex items-center justify-between mt-4">
      <div class="text-sm text-gray-500">共 ${filteredYarns.length} 条</div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1 border rounded text-sm" disabled>上一页</button>
        <button class="px-3 py-1 bg-blue-600 text-white rounded text-sm">1</button>
        <button class="px-3 py-1 border rounded text-sm" disabled>下一页</button>
      </div>
    </div>
  `
}

function renderYarnDrawer(): string {
  if (!state.drawerOpen) return ''
  
  const formContent = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        ${renderLabeledInput('纱线编码', { value: state.formData.code, placeholder: '如：YRN-CT-001', prefix: 'yarn', field: 'code' }, true)}
        ${renderLabeledInput('纱线名称', { value: state.formData.name, placeholder: '输入纱线名称', prefix: 'yarn', field: 'name' }, true)}
      </div>
      <div class="grid grid-cols-2 gap-4">
        ${renderLabeledSelect('类别', {
          value: state.formData.category,
          options: categoryOptions.map(cat => ({ value: cat, label: cat })),
          placeholder: '选择类别',
          prefix: 'yarn',
          field: 'category',
        }, true)}
        ${renderLabeledInput('成分', { value: state.formData.material, placeholder: '如：100%精梳棉', prefix: 'yarn', field: 'material' }, true)}
      </div>
      <div class="grid grid-cols-2 gap-4">
        ${renderLabeledInput('规格', { value: state.formData.specification, placeholder: '如：32S/2', prefix: 'yarn', field: 'specification' })}
        ${renderLabeledInput('颜色', { value: state.formData.color, placeholder: '如：本白', prefix: 'yarn', field: 'color' })}
      </div>
      ${renderLabeledInput('供应商', { value: state.formData.supplier, placeholder: '输入供应商名称', prefix: 'yarn', field: 'supplier' })}
      <div class="grid grid-cols-2 gap-4">
        ${renderLabeledInput('单价', { value: state.formData.price, placeholder: '如：¥45/kg', prefix: 'yarn', field: 'price' })}
        ${renderLabeledSelect('单位', {
          value: state.formData.unit,
          options: [
            { value: 'kg', label: 'kg' },
            { value: 'g', label: 'g' },
            { value: '米', label: '米' },
          ],
          prefix: 'yarn',
          field: 'unit',
        })}
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建纱线档案',
      subtitle: '录入纱线原料基础信息',
      closeAction: { prefix: 'yarn', action: 'close-drawer' },
      width: 'sm',
    },
    formContent,
    {
      cancel: { prefix: 'yarn', action: 'close-drawer' },
      confirm: { prefix: 'yarn', action: 'submit-create', label: '创建', variant: 'primary' },
    }
  )
}

function renderYarnDetailDrawer(): string {
  if (!state.detailDrawerOpen || !state.selectedYarn) return ''
  
  const yarn = state.selectedYarn
  
  const content = `
    <div class="space-y-6">
      <div>
        <h3 class="text-sm font-medium text-gray-500 mb-3">基本信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">类别</div>
            <div class="font-medium mt-1">${escapeHtml(yarn.category)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">成分</div>
            <div class="font-medium mt-1">${escapeHtml(yarn.material)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">规格</div>
            <div class="font-medium mt-1">${escapeHtml(yarn.specification)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">颜色</div>
            <div class="font-medium mt-1">${escapeHtml(yarn.color)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">重量</div>
            <div class="font-medium mt-1">${escapeHtml(yarn.weight)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">单价</div>
            <div class="font-medium mt-1">${escapeHtml(yarn.price)}</div>
          </div>
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-gray-500 mb-3">供应信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">供应商</div>
            <div class="font-medium mt-1">${escapeHtml(yarn.supplier)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">当前库存</div>
            <div class="font-medium mt-1 ${yarn.stock < 500 ? 'text-red-600' : ''}">${yarn.stock} ${yarn.unit}</div>
          </div>
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-gray-500 mb-3">时间信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">创建时间</div>
            <div class="font-medium mt-1">${escapeHtml(yarn.createdAt)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">更新时间</div>
            <div class="font-medium mt-1">${escapeHtml(yarn.updatedAt)}</div>
          </div>
        </div>
      </div>
    </div>
  `

  return uiDetailDrawer(
    {
      title: yarn.name,
      subtitle: yarn.code,
      closeAction: { prefix: 'yarn', action: 'close-detail-drawer' },
      width: 'sm',
    },
    content,
    `<button class="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 flex items-center gap-2" data-yarn-action="edit">
      <i data-lucide="edit-2" class="h-4 w-4"></i>
      编辑
    </button>`
  )
}

// ============ 事件处理 ============

export function handleProductYarnEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-yarn-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.yarnAction
  
  switch (action) {
    case 'open-drawer':
      state.drawerOpen = true
      return true
    case 'close-drawer':
      state.drawerOpen = false
      return true
    case 'close-detail-drawer':
      state.detailDrawerOpen = false
      state.selectedYarn = null
      return true
    case 'reset-filters':
      state.search = ''
      state.categoryFilter = 'all'
      state.statusFilter = 'all'
      return true
    case 'filter-all':
      state.categoryFilter = 'all'
      state.statusFilter = 'all'
      return true
    case 'filter-active':
      state.statusFilter = 'ACTIVE'
      return true
    case 'filter-inactive':
      state.statusFilter = 'INACTIVE'
      return true
    case 'filter-cotton':
      state.categoryFilter = '棉纱'
      return true
    case 'filter-wool':
      state.categoryFilter = '羊毛'
      return true
    case 'filter-synthetic':
      state.categoryFilter = '化纤'
      return true
    case 'view-detail': {
      const yarnId = actionNode.dataset.yarnId
      const yarn = mockYarns.find((y) => y.id === yarnId)
      if (yarn) {
        state.selectedYarn = yarn
        state.detailDrawerOpen = true
      }
      return true
    }
    case 'submit-create':
      state.drawerOpen = false
      return true
    default:
      return false
  }
}

export function handleProductYarnInput(target: Element): boolean {
  const filterNode = target.closest<HTMLElement>('[data-yarn-filter]')
  if (filterNode) {
    const filter = filterNode.dataset.yarnFilter
    const value = (filterNode as HTMLInputElement | HTMLSelectElement).value
    
    switch (filter) {
      case 'search':
        state.search = value
        return true
      case 'category':
        state.categoryFilter = value
        return true
      case 'status':
        state.statusFilter = value
        return true
    }
  }
  
  const fieldNode = target.closest<HTMLElement>('[data-yarn-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.yarnField as keyof typeof state.formData
    if (field && field in state.formData) {
      (state.formData as Record<string, string>)[field] = (fieldNode as HTMLInputElement | HTMLSelectElement).value
    }
    return true
  }
  
  return false
}

export function isProductYarnDialogOpen(): boolean {
  return state.drawerOpen || state.detailDrawerOpen
}

export function renderProductYarnPage(): string {
  return `
    <div class="space-y-6">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">原料档案 - 纱线</h1>
          <p class="text-gray-500">管理纱线原料的基础档案、成分、规格与供应信息</p>
        </div>
        <div class="flex gap-2">
          <button data-yarn-action="open-drawer" class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2">
            <i data-lucide="plus" class="h-4 w-4"></i>
            新建纱线
          </button>
          <button class="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 flex items-center gap-2">
            <i data-lucide="upload" class="h-4 w-4"></i>
            批量导入
          </button>
        </div>
      </div>

      ${renderKpiCards()}
      ${renderFilters()}
      ${renderTable()}
      ${renderYarnDrawer()}
      ${renderYarnDetailDrawer()}
    </div>
  `
}
