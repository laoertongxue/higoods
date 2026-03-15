import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderFormDrawer,
  renderInput,
  renderSelect,
  renderLabeledInput,
  renderLabeledSelect,
  renderCheckbox,
  renderSearchInput,
  renderTable as uiTable,
  type TableColumn,
  type DrawerConfig,
} from '../components/ui'

// ============ 类型定义 ============

interface SpuVersion {
  code: string
  effectiveAt: string
}

interface Spu {
  id: string
  code: string
  name: string
  category: string
  styleTags: string[]
  priceBand: string
  status: 'ACTIVE' | 'ARCHIVED'
  effectiveVersion: SpuVersion | null
  skuCount: number
  mappingHealth: 'OK' | 'MISSING' | 'CONFLICT'
  legacyMapping: string | null
  channelCount: number
  onSaleCount: number
  lastListingTime: string | null
  originProject: string | null
  updatedAt: string
}

interface SpuState {
  search: string
  statusFilter: string
  versionFilter: string
  mappingFilter: string
  drawerOpen: boolean
  createMode: 'new' | 'project' | 'legacy'
  formData: {
    name: string
    category: string
    styleTags: string
    priceBand: string
    projectId: string
    legacySystem: string
    legacyCode: string
    createVersion: boolean
  }
}

// ============ Mock 数据 ============

const mockSPUs: Spu[] = [
  {
    id: 'SPU-20260101-001',
    code: 'SPU-20260101-001',
    name: '印尼风格碎花连衣裙',
    category: '裙装/连衣裙',
    styleTags: ['波西米亚', '碎花', '度假风'],
    priceBand: '¥299-399',
    status: 'ACTIVE',
    effectiveVersion: { code: 'V2.1', effectiveAt: '2026-01-10' },
    skuCount: 12,
    mappingHealth: 'OK',
    legacyMapping: 'ERP-A: SKU10086',
    channelCount: 3,
    onSaleCount: 8,
    lastListingTime: '2026-01-12',
    originProject: 'PRJ-20251216-001',
    updatedAt: '2026-01-14 10:30',
  },
  {
    id: 'SPU-20260102-002',
    code: 'SPU-20260102-002',
    name: '复古格纹西装外套',
    category: '上装/外套',
    styleTags: ['复古', '格纹', '通勤'],
    priceBand: '¥499-699',
    status: 'ACTIVE',
    effectiveVersion: { code: 'V1.0', effectiveAt: '2026-01-05' },
    skuCount: 8,
    mappingHealth: 'MISSING',
    legacyMapping: null,
    channelCount: 2,
    onSaleCount: 4,
    lastListingTime: '2026-01-08',
    originProject: 'PRJ-20251220-003',
    updatedAt: '2026-01-13 16:20',
  },
  {
    id: 'SPU-20260103-003',
    code: 'SPU-20260103-003',
    name: '简约针织开衫',
    category: '上装/开衫',
    styleTags: ['简约', '百搭', '休闲'],
    priceBand: '¥199-299',
    status: 'ACTIVE',
    effectiveVersion: { code: 'V1.2', effectiveAt: '2026-01-08' },
    skuCount: 15,
    mappingHealth: 'CONFLICT',
    legacyMapping: 'ERP-A: SKU10102 (冲突)',
    channelCount: 4,
    onSaleCount: 12,
    lastListingTime: '2026-01-11',
    originProject: 'PRJ-20251218-002',
    updatedAt: '2026-01-12 09:15',
  },
  {
    id: 'SPU-20260104-004',
    code: 'SPU-20260104-004',
    name: '高腰阔腿牛仔裤',
    category: '裤装/牛仔裤',
    styleTags: ['复古', '显瘦', '百搭'],
    priceBand: '¥249-349',
    status: 'ACTIVE',
    effectiveVersion: null,
    skuCount: 6,
    mappingHealth: 'OK',
    legacyMapping: 'ERP-B: JK20086',
    channelCount: 0,
    onSaleCount: 0,
    lastListingTime: null,
    originProject: 'PRJ-20251225-005',
    updatedAt: '2026-01-10 14:00',
  },
  {
    id: 'SPU-20260105-005',
    code: 'SPU-20260105-005',
    name: '法式蕾丝衬衫',
    category: '上装/衬衫',
    styleTags: ['法式', '蕾丝', '优雅'],
    priceBand: '¥299-399',
    status: 'ARCHIVED',
    effectiveVersion: { code: 'V3.0', effectiveAt: '2025-12-20' },
    skuCount: 10,
    mappingHealth: 'OK',
    legacyMapping: 'ERP-A: SKU10055',
    channelCount: 1,
    onSaleCount: 0,
    lastListingTime: '2025-12-25',
    originProject: 'PRJ-20251201-001',
    updatedAt: '2026-01-05 11:30',
  },
  {
    id: 'SPU-20260106-006',
    code: 'SPU-20260106-006',
    name: '运动休闲套装',
    category: '套装/运动套装',
    styleTags: ['运动', '休闲', '舒适'],
    priceBand: '¥399-499',
    status: 'ACTIVE',
    effectiveVersion: { code: 'V1.0', effectiveAt: '2026-01-12' },
    skuCount: 9,
    mappingHealth: 'OK',
    legacyMapping: 'ERP-A: SKU10120',
    channelCount: 2,
    onSaleCount: 6,
    lastListingTime: '2026-01-13',
    originProject: null,
    updatedAt: '2026-01-14 08:00',
  },
]

// ============ 状态管理 ============

let state: SpuState = {
  search: '',
  statusFilter: 'all',
  versionFilter: 'all',
  mappingFilter: 'all',
  drawerOpen: false,
  createMode: 'new',
  formData: {
    name: '',
    category: '',
    styleTags: '',
    priceBand: '',
    projectId: '',
    legacySystem: '',
    legacyCode: '',
    createVersion: true,
  },
}

// ============ 工具函数 ============

function getStatusBadge(status: string): string {
  if (status === 'ACTIVE') {
    return '<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-800">启用</span>'
  }
  return '<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">已归档</span>'
}

function getMappingHealthBadge(health: string): string {
  if (health === 'OK') {
    return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
      <i data-lucide="check-circle-2" class="h-3 w-3"></i>健康
    </span>`
  }
  if (health === 'MISSING') {
    return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700">
      <i data-lucide="alert-triangle" class="h-3 w-3"></i>缺映射
    </span>`
  }
  return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-red-100 text-red-700">
    <i data-lucide="x-circle" class="h-3 w-3"></i>冲突
  </span>`
}

function getFilteredSPUs(): Spu[] {
  return mockSPUs.filter((spu) => {
    if (state.search && !spu.name.includes(state.search) && !spu.code.includes(state.search)) return false
    if (state.statusFilter !== 'all' && spu.status !== state.statusFilter) return false
    if (state.versionFilter === 'has' && !spu.effectiveVersion) return false
    if (state.versionFilter === 'none' && spu.effectiveVersion) return false
    if (state.mappingFilter !== 'all' && spu.mappingHealth !== state.mappingFilter) return false
    return true
  })
}

function getStats() {
  return {
    total: mockSPUs.length,
    active: mockSPUs.filter((s) => s.status === 'ACTIVE').length,
    hasVersion: mockSPUs.filter((s) => s.effectiveVersion).length,
    noVersion: mockSPUs.filter((s) => !s.effectiveVersion).length,
    mappingOK: mockSPUs.filter((s) => s.mappingHealth === 'OK').length,
    mappingConflict: mockSPUs.filter((s) => s.mappingHealth === 'CONFLICT').length,
  }
}

// ============ 渲染函数 ============

function renderKpiCards(): string {
  const stats = getStats()
  return `
    <div class="grid grid-cols-6 gap-4">
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-spu-action="filter-all">
        <div class="text-2xl font-bold">${stats.total}</div>
        <div class="text-sm text-gray-500">全部SPU</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-spu-action="filter-active">
        <div class="text-2xl font-bold text-green-600">${stats.active}</div>
        <div class="text-sm text-gray-500">启用中</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-spu-action="filter-has-version">
        <div class="text-2xl font-bold text-blue-600">${stats.hasVersion}</div>
        <div class="text-sm text-gray-500">有生效版本</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-spu-action="filter-no-version">
        <div class="text-2xl font-bold text-yellow-600">${stats.noVersion}</div>
        <div class="text-sm text-gray-500">无生效版本</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-spu-action="filter-mapping-ok">
        <div class="text-2xl font-bold text-green-600">${stats.mappingOK}</div>
        <div class="text-sm text-gray-500">映射健康</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-500 transition-colors" data-spu-action="filter-mapping-conflict">
        <div class="text-2xl font-bold text-red-600">${stats.mappingConflict}</div>
        <div class="text-sm text-gray-500">映射冲突</div>
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
            placeholder="搜索SPU编码/名称/款号/老系统编码..."
            value="${escapeHtml(state.search)}"
            data-spu-filter="search"
            class="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select data-spu-filter="status" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
          <option value="ACTIVE" ${state.statusFilter === 'ACTIVE' ? 'selected' : ''}>启用</option>
          <option value="ARCHIVED" ${state.statusFilter === 'ARCHIVED' ? 'selected' : ''}>已归档</option>
        </select>
        <select data-spu-filter="version" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.versionFilter === 'all' ? 'selected' : ''}>全部</option>
          <option value="has" ${state.versionFilter === 'has' ? 'selected' : ''}>有生效版本</option>
          <option value="none" ${state.versionFilter === 'none' ? 'selected' : ''}>无生效版本</option>
        </select>
        <select data-spu-filter="mapping" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.mappingFilter === 'all' ? 'selected' : ''}>全部</option>
          <option value="OK" ${state.mappingFilter === 'OK' ? 'selected' : ''}>健康</option>
          <option value="MISSING" ${state.mappingFilter === 'MISSING' ? 'selected' : ''}>缺映射</option>
          <option value="CONFLICT" ${state.mappingFilter === 'CONFLICT' ? 'selected' : ''}>冲突</option>
        </select>
        <button data-spu-action="reset-filters" class="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 flex items-center gap-2">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>
          重置
        </button>
      </div>
    </div>
  `
}

function renderSpuTable(): string {
  const filteredSPUs = getFilteredSPUs()
  
  return `
    <div class="bg-white rounded-lg border overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SPU编码/名称</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类目/风格</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前生效版本</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">SKU数量</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">映射状态</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最近上架</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">来源项目</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${filteredSPUs.map((spu) => `
            <tr class="hover:bg-gray-50 cursor-pointer" data-spu-action="view-detail" data-spu-id="${spu.id}">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">${escapeHtml(spu.name)}</div>
                <div class="text-xs text-gray-500">${escapeHtml(spu.code)}</div>
              </td>
              <td class="px-4 py-3">
                <div>${escapeHtml(spu.category)}</div>
                <div class="flex gap-1 mt-1">
                  ${spu.styleTags.slice(0, 2).map((tag) => `
                    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border">${escapeHtml(tag)}</span>
                  `).join('')}
                </div>
              </td>
              <td class="px-4 py-3">
                ${spu.effectiveVersion ? `
                  <div>
                    <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100">${escapeHtml(spu.effectiveVersion.code)}</span>
                    <div class="text-xs text-gray-500 mt-1">${escapeHtml(spu.effectiveVersion.effectiveAt)}</div>
                  </div>
                ` : `
                  <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-yellow-50 text-yellow-700">无生效版本</span>
                `}
              </td>
              <td class="px-4 py-3 text-center">${spu.skuCount}</td>
              <td class="px-4 py-3">
                ${getMappingHealthBadge(spu.mappingHealth)}
                ${spu.legacyMapping ? `<div class="text-xs text-gray-500 mt-1">${escapeHtml(spu.legacyMapping)}</div>` : ''}
              </td>
              <td class="px-4 py-3">
                ${spu.channelCount > 0 ? `
                  <div>
                    <div class="text-sm">${spu.channelCount}店铺 / ${spu.onSaleCount}在售</div>
                    <div class="text-xs text-gray-500">${escapeHtml(spu.lastListingTime || '')}</div>
                  </div>
                ` : '<span class="text-gray-400">-</span>'}
              </td>
              <td class="px-4 py-3">
                ${spu.originProject ? `
                  <button class="text-xs text-blue-600 hover:underline" data-spu-action="view-project" data-project-id="${spu.originProject}">${escapeHtml(spu.originProject)}</button>
                ` : '<span class="text-gray-400">-</span>'}
              </td>
              <td class="px-4 py-3">${getStatusBadge(spu.status)}</td>
              <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(spu.updatedAt)}</td>
              <td class="px-4 py-3 text-right">
                <div class="relative inline-block text-left">
                  <button class="p-1 rounded hover:bg-gray-100" data-spu-action="toggle-menu" data-spu-id="${spu.id}">
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
      <div class="text-sm text-gray-500">共 ${filteredSPUs.length} 条</div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1 border rounded text-sm" disabled>上一页</button>
        <button class="px-3 py-1 bg-blue-600 text-white rounded text-sm">1</button>
        <button class="px-3 py-1 border rounded text-sm" disabled>下一页</button>
      </div>
    </div>
  `
}

function renderSpuDrawer(): string {
  if (!state.drawerOpen) return ''
  
  const modeTitle = state.createMode === 'new' ? '新建 SPU' : 
                   state.createMode === 'project' ? '从商品项目生成 SPU' : '绑定老系统 SPU'
  const modeDesc = state.createMode === 'new' ? '手工创建新的商品档案' :
                  state.createMode === 'project' ? '从已归档的商品项目继承信息创建SPU' : '建立与已有业务系统SPU的映射关系'

  const formContent = `
    <div class="space-y-6">
      <!-- 创建方式选择 -->
      <div class="space-y-2">
        <label class="text-sm font-medium">创建方式</label>
        <div class="flex gap-2">
          <button class="px-3 py-1.5 rounded text-sm ${state.createMode === 'new' ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}" data-spu-action="set-mode" data-mode="new">从零新建</button>
          <button class="px-3 py-1.5 rounded text-sm ${state.createMode === 'project' ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}" data-spu-action="set-mode" data-mode="project">从项目生成</button>
          <button class="px-3 py-1.5 rounded text-sm ${state.createMode === 'legacy' ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}" data-spu-action="set-mode" data-mode="legacy">绑定老系统</button>
        </div>
      </div>
      
      <!-- 基础信息 -->
      <div class="space-y-4">
        <h4 class="font-medium">SPU 基础信息</h4>
        ${renderLabeledInput('SPU 名称', { value: state.formData.name, placeholder: '输入商品名称', prefix: 'spu', field: 'name' }, true)}
        <div class="grid grid-cols-2 gap-4">
          ${renderLabeledSelect('类目', {
            value: state.formData.category,
            options: [
              { value: 'dress', label: '裙装/连衣裙' },
              { value: 'top', label: '上装/衬衫' },
              { value: 'pants', label: '裤装/牛仔裤' },
              { value: 'coat', label: '上装/外套' },
            ],
            placeholder: '选择类目',
            prefix: 'spu',
            field: 'category',
          }, true)}
          ${renderLabeledSelect('目标价带', {
            value: state.formData.priceBand,
            options: [
              { value: '99-199', label: '¥99-199' },
              { value: '199-299', label: '¥199-299' },
              { value: '299-399', label: '¥299-399' },
              { value: '399-499', label: '¥399-499' },
            ],
            placeholder: '选择价带',
            prefix: 'spu',
            field: 'priceBand',
          })}
        </div>
        ${renderLabeledInput('风格标签', { value: state.formData.styleTags, placeholder: '多个标签用逗号分隔', prefix: 'spu', field: 'styleTags' })}
      </div>
      
      ${state.createMode === 'project' ? `
        <div class="space-y-4">
          <h4 class="font-medium">来源项目</h4>
          ${renderLabeledSelect('商品项目', {
            value: state.formData.projectId,
            options: [
              { value: 'PRJ-20251216-001', label: 'PRJ-20251216-001 印尼风格碎花连衣裙' },
              { value: 'PRJ-20251220-003', label: 'PRJ-20251220-003 复古格纹西装' },
              { value: 'PRJ-20251218-002', label: 'PRJ-20251218-002 简约针织开衫' },
            ],
            placeholder: '选择已归档的商品项目',
            prefix: 'spu',
            field: 'projectId',
          }, true)}
          <div class="p-3 bg-blue-50 rounded-lg text-sm">
            <p class="font-medium text-blue-700">继承说明</p>
            <p class="text-blue-600 mt-1">将从项目继承：类目、风格标签、目标价带、主图素材、制版/花型/工艺等工作项输出物</p>
          </div>
        </div>
      ` : ''}
      
      ${state.createMode === 'legacy' ? `
        <div class="space-y-4">
          <h4 class="font-medium">老系统映射</h4>
          <div class="grid grid-cols-2 gap-4">
            ${renderLabeledSelect('老系统', {
              value: state.formData.legacySystem,
              options: [
                { value: 'ERP_A', label: 'ERP-A' },
                { value: 'ERP_B', label: 'ERP-B' },
                { value: 'EXTERNAL', label: '外部系统' },
              ],
              placeholder: '选择系统',
              prefix: 'spu',
              field: 'legacySystem',
            }, true)}
            ${renderLabeledInput('老系统SPU编码', { value: state.formData.legacyCode, placeholder: '输入编码', prefix: 'spu', field: 'legacyCode' }, true)}
          </div>
          <div class="p-3 bg-yellow-50 rounded-lg text-sm">
            <p class="font-medium text-yellow-700">映射规则</p>
            <p class="text-yellow-600 mt-1">同一编码在同一时间段只能映射到一个SPU，系统将自动检测冲突</p>
          </div>
        </div>
      ` : ''}
      
      <!-- 版本创建选项 -->
      <div class="space-y-2">
        ${renderCheckbox({ id: 'createVersion', checked: state.formData.createVersion, label: '同时创建生产资料版本 V1（草稿）', prefix: 'spu', field: 'createVersion' })}
        <p class="text-xs text-gray-500 ml-6">
          ${state.createMode === 'project' ? '将从项目工作项继承制版/工艺/BOM/花型等输出物' : '创建空白版本，后续手工填写'}
        </p>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: modeTitle,
      subtitle: modeDesc,
      closeAction: { prefix: 'spu', action: 'close-drawer' },
      width: 'sm',
    },
    formContent,
    {
      cancel: { prefix: 'spu', action: 'close-drawer' },
      confirm: { prefix: 'spu', action: 'submit-create', label: '保存并进入详情', variant: 'primary' },
    }
  )
}

// ============ 事件处理 ============

export function handleProductSpuEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-spu-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.spuAction
  
  switch (action) {
    case 'open-drawer':
      state.drawerOpen = true
      state.createMode = 'new'
      return true
    case 'open-drawer-project':
      state.drawerOpen = true
      state.createMode = 'project'
      return true
    case 'open-drawer-legacy':
      state.drawerOpen = true
      state.createMode = 'legacy'
      return true
    case 'close-drawer':
      state.drawerOpen = false
      return true
    case 'set-mode': {
      const mode = actionNode.dataset.mode as 'new' | 'project' | 'legacy'
      if (mode) state.createMode = mode
      return true
    }
    case 'reset-filters':
      state.search = ''
      state.statusFilter = 'all'
      state.versionFilter = 'all'
      state.mappingFilter = 'all'
      return true
    case 'filter-all':
      state.statusFilter = 'all'
      state.versionFilter = 'all'
      state.mappingFilter = 'all'
      return true
    case 'filter-active':
      state.statusFilter = 'ACTIVE'
      return true
    case 'filter-has-version':
      state.versionFilter = 'has'
      return true
    case 'filter-no-version':
      state.versionFilter = 'none'
      return true
    case 'filter-mapping-ok':
      state.mappingFilter = 'OK'
      return true
    case 'filter-mapping-conflict':
      state.mappingFilter = 'CONFLICT'
      return true
    case 'view-detail': {
      const spuId = actionNode.dataset.spuId
      if (spuId) {
        appStore.navigate(`/pcs/products/spu/${spuId}`)
      }
      return true
    }
    case 'view-project': {
      const projectId = actionNode.dataset.projectId
      if (projectId) {
        appStore.navigate(`/pcs/projects/${projectId}`)
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

export function handleProductSpuInput(target: Element): boolean {
  const filterNode = target.closest<HTMLElement>('[data-spu-filter]')
  if (filterNode) {
    const filter = filterNode.dataset.spuFilter
    const value = (filterNode as HTMLInputElement | HTMLSelectElement).value
    
    switch (filter) {
      case 'search':
        state.search = value
        return true
      case 'status':
        state.statusFilter = value
        return true
      case 'version':
        state.versionFilter = value
        return true
      case 'mapping':
        state.mappingFilter = value
        return true
    }
  }
  
  const fieldNode = target.closest<HTMLElement>('[data-spu-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.spuField as keyof typeof state.formData
    if (field === 'createVersion') {
      state.formData.createVersion = (fieldNode as HTMLInputElement).checked
    } else if (field && field in state.formData) {
      (state.formData as Record<string, string | boolean>)[field] = (fieldNode as HTMLInputElement | HTMLSelectElement).value
    }
    return true
  }
  
  return false
}

export function isProductSpuDialogOpen(): boolean {
  return state.drawerOpen
}

export function renderProductSpuPage(): string {
  return `
    <div class="space-y-6">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">商品档案 - SPU</h1>
          <p class="text-gray-500">管理正式商品档案，含生产资料版本、SKU档案、编码映射</p>
        </div>
        <div class="flex gap-2">
          <div class="relative group">
            <button class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2">
              <i data-lucide="plus" class="h-4 w-4"></i>
              新建 SPU
              <i data-lucide="chevron-down" class="h-4 w-4"></i>
            </button>
            <div class="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button data-spu-action="open-drawer" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                <i data-lucide="plus" class="h-4 w-4"></i>
                从零新建
              </button>
              <button data-spu-action="open-drawer-project" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                <i data-lucide="package" class="h-4 w-4"></i>
                从商品项目生成
              </button>
              <button data-spu-action="open-drawer-legacy" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                <i data-lucide="link-2" class="h-4 w-4"></i>
                绑定老系统SPU
              </button>
            </div>
          </div>
          <button class="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 flex items-center gap-2">
            <i data-lucide="upload" class="h-4 w-4"></i>
            批量导入
          </button>
        </div>
      </div>

      ${renderKpiCards()}
      ${renderFilters()}
      ${renderSpuTable()}
      ${renderSpuDrawer()}
    </div>
  `
}
