import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderDetailDrawer as uiDetailDrawer,
  renderLabeledInput,
  renderLabeledSelect,
} from '../components/ui'

// ============ 类型定义 ============

type PlatformStatus = 'CONNECTED' | 'DISCONNECTED' | 'PENDING'
type SyncStatus = 'SUCCESS' | 'FAILED' | 'SYNCING' | 'NEVER'

interface Platform {
  id: string
  name: string
  code: string
  type: string
  status: PlatformStatus
  apiVersion: string
  storeCount: number
  lastSync: string | null
  syncStatus: SyncStatus
  config: {
    appKey?: string
    appSecret?: string
    accessToken?: string
    refreshToken?: string
    tokenExpiry?: string
  }
  createdAt: string
  updatedAt: string
}

interface PlatformState {
  search: string
  statusFilter: string
  typeFilter: string
  drawerOpen: boolean
  detailDrawerOpen: boolean
  selectedPlatform: Platform | null
  syncDialogOpen: boolean
  formData: {
    name: string
    code: string
    type: string
    appKey: string
    appSecret: string
    apiVersion: string
  }
}

// ============ Mock 数据 ============

const mockPlatforms: Platform[] = [
  {
    id: 'PLT-001',
    name: 'Shopee印尼',
    code: 'SHOPEE_ID',
    type: '电商平台',
    status: 'CONNECTED',
    apiVersion: 'v2.0',
    storeCount: 3,
    lastSync: '2026-01-15 10:30',
    syncStatus: 'SUCCESS',
    config: {
      appKey: 'sk_live_xxxxx',
      appSecret: '••••••••',
      accessToken: 'at_xxxxx',
      tokenExpiry: '2026-02-15',
    },
    createdAt: '2025-06-15',
    updatedAt: '2026-01-15',
  },
  {
    id: 'PLT-002',
    name: 'Lazada印尼',
    code: 'LAZADA_ID',
    type: '电商平台',
    status: 'CONNECTED',
    apiVersion: 'v3.0',
    storeCount: 2,
    lastSync: '2026-01-15 09:15',
    syncStatus: 'SUCCESS',
    config: {
      appKey: 'lz_app_xxxxx',
      appSecret: '••••••••',
      accessToken: 'lz_token_xxxxx',
      tokenExpiry: '2026-03-01',
    },
    createdAt: '2025-07-20',
    updatedAt: '2026-01-15',
  },
  {
    id: 'PLT-003',
    name: 'TikTok Shop',
    code: 'TIKTOK_SHOP',
    type: '电商平台',
    status: 'CONNECTED',
    apiVersion: 'v1.0',
    storeCount: 1,
    lastSync: '2026-01-14 16:45',
    syncStatus: 'SUCCESS',
    config: {
      appKey: 'tt_app_xxxxx',
      appSecret: '••••••••',
    },
    createdAt: '2025-09-10',
    updatedAt: '2026-01-14',
  },
  {
    id: 'PLT-004',
    name: 'Tokopedia',
    code: 'TOKOPEDIA',
    type: '电商平台',
    status: 'DISCONNECTED',
    apiVersion: 'v2.5',
    storeCount: 0,
    lastSync: '2025-12-20 11:00',
    syncStatus: 'FAILED',
    config: {
      appKey: 'tp_app_xxxxx',
      appSecret: '••••••••',
    },
    createdAt: '2025-08-05',
    updatedAt: '2025-12-20',
  },
  {
    id: 'PLT-005',
    name: 'ERP-A系统',
    code: 'ERP_A',
    type: 'ERP系统',
    status: 'CONNECTED',
    apiVersion: 'v1.2',
    storeCount: 0,
    lastSync: '2026-01-15 08:00',
    syncStatus: 'SUCCESS',
    config: {
      appKey: 'erp_key_xxxxx',
      appSecret: '••••••••',
    },
    createdAt: '2025-05-01',
    updatedAt: '2026-01-15',
  },
  {
    id: 'PLT-006',
    name: 'WMS仓储系统',
    code: 'WMS',
    type: '仓储系统',
    status: 'PENDING',
    apiVersion: 'v2.0',
    storeCount: 0,
    lastSync: null,
    syncStatus: 'NEVER',
    config: {},
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10',
  },
]

const platformTypes = ['电商平台', 'ERP系统', '仓储系统', '物流系统', '支付系统']

// ============ 状态管理 ============

let state: PlatformState = {
  search: '',
  statusFilter: 'all',
  typeFilter: 'all',
  drawerOpen: false,
  detailDrawerOpen: false,
  selectedPlatform: null,
  syncDialogOpen: false,
  formData: {
    name: '',
    code: '',
    type: '',
    appKey: '',
    appSecret: '',
    apiVersion: '',
  },
}

// ============ 工具函数 ============

function getStatusBadge(status: PlatformStatus): string {
  if (status === 'CONNECTED') {
    return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
      <i data-lucide="check-circle-2" class="h-3 w-3"></i>已连接
    </span>`
  }
  if (status === 'DISCONNECTED') {
    return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-red-100 text-red-700">
      <i data-lucide="x-circle" class="h-3 w-3"></i>已断开
    </span>`
  }
  return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700">
    <i data-lucide="clock" class="h-3 w-3"></i>待配置
  </span>`
}

function getSyncStatusBadge(status: SyncStatus): string {
  if (status === 'SUCCESS') {
    return '<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-50 text-green-700">同步成功</span>'
  }
  if (status === 'FAILED') {
    return '<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-red-50 text-red-700">同步失败</span>'
  }
  if (status === 'SYNCING') {
    return '<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700">同步中...</span>'
  }
  return '<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700">从未同步</span>'
}

function getFilteredPlatforms(): Platform[] {
  return mockPlatforms.filter((platform) => {
    const matchesSearch = !state.search ||
      platform.name.toLowerCase().includes(state.search.toLowerCase()) ||
      platform.code.toLowerCase().includes(state.search.toLowerCase())
    const matchesStatus = state.statusFilter === 'all' || platform.status === state.statusFilter
    const matchesType = state.typeFilter === 'all' || platform.type === state.typeFilter
    return matchesSearch && matchesStatus && matchesType
  })
}

function getStats() {
  return {
    total: mockPlatforms.length,
    connected: mockPlatforms.filter((p) => p.status === 'CONNECTED').length,
    disconnected: mockPlatforms.filter((p) => p.status === 'DISCONNECTED').length,
    pending: mockPlatforms.filter((p) => p.status === 'PENDING').length,
    ecommerce: mockPlatforms.filter((p) => p.type === '电商平台').length,
    erp: mockPlatforms.filter((p) => p.type === 'ERP系统').length,
  }
}

// ============ 渲染函数 ============

function renderKpiCards(): string {
  const stats = getStats()
  return `
    <div class="grid grid-cols-6 gap-4">
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-platform-action="filter-all">
        <div class="text-2xl font-bold">${stats.total}</div>
        <div class="text-sm text-gray-500">全部平台</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-platform-action="filter-connected">
        <div class="text-2xl font-bold text-green-600">${stats.connected}</div>
        <div class="text-sm text-gray-500">已连接</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-platform-action="filter-disconnected">
        <div class="text-2xl font-bold text-red-600">${stats.disconnected}</div>
        <div class="text-sm text-gray-500">已断开</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-platform-action="filter-pending">
        <div class="text-2xl font-bold text-yellow-600">${stats.pending}</div>
        <div class="text-sm text-gray-500">待配置</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-platform-action="filter-ecommerce">
        <div class="text-2xl font-bold text-blue-600">${stats.ecommerce}</div>
        <div class="text-sm text-gray-500">电商平台</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-platform-action="filter-erp">
        <div class="text-2xl font-bold text-purple-600">${stats.erp}</div>
        <div class="text-sm text-gray-500">ERP系统</div>
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
            placeholder="搜索平台名称/编码..."
            value="${escapeHtml(state.search)}"
            data-platform-filter="search"
            class="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select data-platform-filter="status" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
          <option value="CONNECTED" ${state.statusFilter === 'CONNECTED' ? 'selected' : ''}>已连接</option>
          <option value="DISCONNECTED" ${state.statusFilter === 'DISCONNECTED' ? 'selected' : ''}>已断开</option>
          <option value="PENDING" ${state.statusFilter === 'PENDING' ? 'selected' : ''}>待配置</option>
        </select>
        <select data-platform-filter="type" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.typeFilter === 'all' ? 'selected' : ''}>全部类型</option>
          ${platformTypes.map((t) => `<option value="${t}" ${state.typeFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <button data-platform-action="reset-filters" class="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 flex items-center gap-2">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>
          重置
        </button>
      </div>
    </div>
  `
}

function renderTable(): string {
  const filteredPlatforms = getFilteredPlatforms()
  
  return `
    <div class="bg-white rounded-lg border overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平台名称</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平台编码</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API版本</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">关联店铺</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最近同步</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">同步状态</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${filteredPlatforms.map((platform) => `
            <tr class="hover:bg-gray-50 cursor-pointer" data-platform-action="view-detail" data-platform-id="${platform.id}">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">${escapeHtml(platform.name)}</div>
              </td>
              <td class="px-4 py-3 font-mono text-sm">${escapeHtml(platform.code)}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700">${escapeHtml(platform.type)}</span>
              </td>
              <td class="px-4 py-3">${getStatusBadge(platform.status)}</td>
              <td class="px-4 py-3 text-sm">${escapeHtml(platform.apiVersion)}</td>
              <td class="px-4 py-3 text-sm">${platform.storeCount > 0 ? `${platform.storeCount} 个` : '-'}</td>
              <td class="px-4 py-3 text-sm text-gray-500">${platform.lastSync || '从未同步'}</td>
              <td class="px-4 py-3">${getSyncStatusBadge(platform.syncStatus)}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button class="p-1 rounded hover:bg-gray-100" title="同步" data-platform-action="sync" data-platform-id="${platform.id}">
                    <i data-lucide="refresh-cw" class="h-4 w-4"></i>
                  </button>
                  <button class="p-1 rounded hover:bg-gray-100" data-platform-action="toggle-menu" data-platform-id="${platform.id}">
                    <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="flex items-center justify-between mt-4">
      <div class="text-sm text-gray-500">共 ${filteredPlatforms.length} 条</div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1 border rounded text-sm" disabled>上一页</button>
        <button class="px-3 py-1 bg-blue-600 text-white rounded text-sm">1</button>
        <button class="px-3 py-1 border rounded text-sm" disabled>下一页</button>
      </div>
    </div>
  `
}

function renderPlatformDrawer(): string {
  if (!state.drawerOpen) return ''
  
  const formContent = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        ${renderLabeledInput('平台名称', { value: state.formData.name, placeholder: '如：Shopee印尼', prefix: 'platform', field: 'name' }, true)}
        ${renderLabeledInput('平台编码', { value: state.formData.code, placeholder: '如：SHOPEE_ID', prefix: 'platform', field: 'code' }, true)}
      </div>
      <div class="grid grid-cols-2 gap-4">
        ${renderLabeledSelect('平台类型', {
          value: state.formData.type,
          options: platformTypes.map(t => ({ value: t, label: t })),
          placeholder: '选择类型',
          prefix: 'platform',
          field: 'type',
        }, true)}
        ${renderLabeledInput('API版本', { value: state.formData.apiVersion, placeholder: '如：v2.0', prefix: 'platform', field: 'apiVersion' })}
      </div>
      ${renderLabeledInput('App Key', { value: state.formData.appKey, placeholder: '输入App Key', prefix: 'platform', field: 'appKey' }, true)}
      ${renderLabeledInput('App Secret', { value: state.formData.appSecret, placeholder: '输入App Secret', prefix: 'platform', field: 'appSecret', type: 'password' }, true)}
      <div class="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
        <i data-lucide="info" class="h-4 w-4 inline mr-1"></i>
        创建后，系统将自动尝试连接平台并验证凭证有效性
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建平台对接',
      subtitle: '配置外部平台的API对接信息',
      closeAction: { prefix: 'platform', action: 'close-drawer' },
      width: 'sm',
    },
    formContent,
    {
      cancel: { prefix: 'platform', action: 'close-drawer' },
      confirm: { prefix: 'platform', action: 'submit-create', label: '创建并连接', variant: 'primary' },
    }
  )
}

function renderPlatformDetailDrawer(): string {
  if (!state.detailDrawerOpen || !state.selectedPlatform) return ''
  
  const platform = state.selectedPlatform
  
  const content = `
    <div class="space-y-6">
      <div>
        <h3 class="text-sm font-medium text-gray-500 mb-3">基本信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">平台类型</div>
            <div class="font-medium mt-1">${escapeHtml(platform.type)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">API版本</div>
            <div class="font-medium mt-1">${escapeHtml(platform.apiVersion)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">关联店铺</div>
            <div class="font-medium mt-1">${platform.storeCount > 0 ? `${platform.storeCount} 个` : '无'}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">同步状态</div>
            <div class="mt-1">${getSyncStatusBadge(platform.syncStatus)}</div>
          </div>
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-gray-500 mb-3">凭证信息</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div class="text-xs text-gray-500">App Key</div>
              <div class="font-mono text-sm mt-1">${escapeHtml(platform.config.appKey || '-')}</div>
            </div>
            <button class="p-1 rounded hover:bg-gray-200">
              <i data-lucide="copy" class="h-4 w-4"></i>
            </button>
          </div>
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div class="text-xs text-gray-500">App Secret</div>
              <div class="font-mono text-sm mt-1">${escapeHtml(platform.config.appSecret || '-')}</div>
            </div>
            <button class="p-1 rounded hover:bg-gray-200">
              <i data-lucide="eye" class="h-4 w-4"></i>
            </button>
          </div>
          ${platform.config.tokenExpiry ? `
            <div class="p-3 bg-gray-50 rounded-lg">
              <div class="text-xs text-gray-500">Token有效期</div>
              <div class="font-medium mt-1">${escapeHtml(platform.config.tokenExpiry)}</div>
            </div>
          ` : ''}
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-gray-500 mb-3">同步记录</h3>
        <div class="space-y-2">
          <div class="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div class="text-sm font-medium">最近同步</div>
              <div class="text-xs text-gray-500">${platform.lastSync || '从未同步'}</div>
            </div>
            ${getSyncStatusBadge(platform.syncStatus)}
          </div>
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-gray-500 mb-3">时间信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">创建时间</div>
            <div class="font-medium mt-1">${escapeHtml(platform.createdAt)}</div>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="text-xs text-gray-500">更新时间</div>
            <div class="font-medium mt-1">${escapeHtml(platform.updatedAt)}</div>
          </div>
        </div>
      </div>
    </div>
  `

  // 自定义底部按钮（包含左侧断开连接按钮）
  const customFooter = `
    <div class="p-6 border-t flex justify-between">
      <button class="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50 flex items-center gap-2">
        <i data-lucide="unplug" class="h-4 w-4"></i>
        断开连接
      </button>
      <div class="flex gap-3">
        <button data-platform-action="close-detail-drawer" class="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">关闭</button>
        <button class="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 flex items-center gap-2">
          <i data-lucide="edit-2" class="h-4 w-4"></i>
          编辑配置
        </button>
        <button class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>
          立即同步
        </button>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: platform.name,
      subtitle: platform.code,
      closeAction: { prefix: 'platform', action: 'close-detail-drawer' },
      width: 'sm',
    },
    content
  ).replace('</div>\n    </div>\n  ', customFooter + '</div>\n    </div>\n  ')
}

// ============ 事件处理 ============

export function handlePlatformConfigEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-platform-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.platformAction
  
  switch (action) {
    case 'open-drawer':
      state.drawerOpen = true
      return true
    case 'close-drawer':
      state.drawerOpen = false
      return true
    case 'close-detail-drawer':
      state.detailDrawerOpen = false
      state.selectedPlatform = null
      return true
    case 'reset-filters':
      state.search = ''
      state.statusFilter = 'all'
      state.typeFilter = 'all'
      return true
    case 'filter-all':
      state.statusFilter = 'all'
      state.typeFilter = 'all'
      return true
    case 'filter-connected':
      state.statusFilter = 'CONNECTED'
      return true
    case 'filter-disconnected':
      state.statusFilter = 'DISCONNECTED'
      return true
    case 'filter-pending':
      state.statusFilter = 'PENDING'
      return true
    case 'filter-ecommerce':
      state.typeFilter = '电商平台'
      return true
    case 'filter-erp':
      state.typeFilter = 'ERP系统'
      return true
    case 'view-detail': {
      const platformId = actionNode.dataset.platformId
      const platform = mockPlatforms.find((p) => p.id === platformId)
      if (platform) {
        state.selectedPlatform = platform
        state.detailDrawerOpen = true
      }
      return true
    }
    case 'submit-create':
      state.drawerOpen = false
      return true
    case 'sync':
      return true
    default:
      return false
  }
}

export function handlePlatformConfigInput(target: Element): boolean {
  const filterNode = target.closest<HTMLElement>('[data-platform-filter]')
  if (filterNode) {
    const filter = filterNode.dataset.platformFilter
    const value = (filterNode as HTMLInputElement | HTMLSelectElement).value
    
    switch (filter) {
      case 'search':
        state.search = value
        return true
      case 'status':
        state.statusFilter = value
        return true
      case 'type':
        state.typeFilter = value
        return true
    }
  }
  
  const fieldNode = target.closest<HTMLElement>('[data-platform-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.platformField as keyof typeof state.formData
    if (field && field in state.formData) {
      (state.formData as Record<string, string>)[field] = (fieldNode as HTMLInputElement | HTMLSelectElement).value
    }
    return true
  }
  
  return false
}

export function isPlatformConfigDialogOpen(): boolean {
  return state.drawerOpen || state.detailDrawerOpen
}

export function renderPlatformConfigPage(): string {
  return `
    <div class="space-y-6">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">平台对接配置</h1>
          <p class="text-gray-500">管理外部电商平台、ERP系统、仓储系统等的API对接配置</p>
        </div>
        <div class="flex gap-2">
          <button data-platform-action="open-drawer" class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2">
            <i data-lucide="plus" class="h-4 w-4"></i>
            新建对接
          </button>
        </div>
      </div>

      ${renderKpiCards()}
      ${renderFilters()}
      ${renderTable()}
      ${renderPlatformDrawer()}
      ${renderPlatformDetailDrawer()}
    </div>
  `
}
