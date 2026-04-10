import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import {
  renderDrawer as uiDrawer,
  renderDialog as uiDialog,
  renderLabeledSelect,
  renderLabeledInput,
} from '../components/ui/index.ts'
import { getStyleArchiveById } from '../data/pcs-style-archive-repository.ts'

// ============ 类型定义 ============

export interface SpecificationArchiveRecord {
  id: string
  sku_code: string
  spu_id: string
  spu_code: string
  spu_name: string
  color: string
  size: string
  print: string | null
  status: 'ACTIVE' | 'INACTIVE'
  barcode: string | null
  techpack_version: string
  mapping_health: 'OK' | 'MISSING' | 'CONFLICT'
  channel_mappings: number
  last_listing: string | null
  last_order: string | null
  created_at: string
}

interface SkuState {
  search: string
  statusFilter: string
  mappingHealthFilter: string
  spuFilter: string
  drawerOpen: boolean
  batchDialogOpen: boolean
  createMode: 'single' | 'import'
  formData: {
    spu_id: string
    color: string
    size: string
    print: string
    barcode: string
    code_strategy: string
    manual_code: string
  }
  batchConfig: {
    spu_id: string
    colors: string[]
    sizes: string[]
  }
}

// ============ Mock 数据 ============

const mockSKUs: SpecificationArchiveRecord[] = [
  {
    id: 'SKU-001',
    sku_code: 'SKU-FD-001-RED-S',
    spu_id: 'SPU-FD-001',
    spu_code: 'SPU-FD-001',
    spu_name: '印尼风格碎花连衣裙',
    color: '红色',
    size: 'S',
    print: '碎花A',
    status: 'ACTIVE',
    barcode: '6901234567890',
    techpack_version: 'V2.1',
    mapping_health: 'OK',
    channel_mappings: 3,
    last_listing: '2025-12-18',
    last_order: '2026-01-10',
    created_at: '2025-12-15',
  },
  {
    id: 'SKU-002',
    sku_code: 'SKU-FD-001-RED-M',
    spu_id: 'SPU-FD-001',
    spu_code: 'SPU-FD-001',
    spu_name: '印尼风格碎花连衣裙',
    color: '红色',
    size: 'M',
    print: '碎花A',
    status: 'ACTIVE',
    barcode: '6901234567891',
    techpack_version: 'V2.1',
    mapping_health: 'OK',
    channel_mappings: 3,
    last_listing: '2025-12-18',
    last_order: '2026-01-12',
    created_at: '2025-12-15',
  },
  {
    id: 'SKU-003',
    sku_code: 'SKU-FD-001-BLUE-S',
    spu_id: 'SPU-FD-001',
    spu_code: 'SPU-FD-001',
    spu_name: '印尼风格碎花连衣裙',
    color: '蓝色',
    size: 'S',
    print: '碎花B',
    status: 'ACTIVE',
    barcode: '6901234567892',
    techpack_version: 'V2.1',
    mapping_health: 'MISSING',
    channel_mappings: 1,
    last_listing: '2025-12-20',
    last_order: null,
    created_at: '2025-12-15',
  },
  {
    id: 'SKU-004',
    sku_code: 'SKU-FD-001-BLUE-M',
    spu_id: 'SPU-FD-001',
    spu_code: 'SPU-FD-001',
    spu_name: '印尼风格碎花连衣裙',
    color: '蓝色',
    size: 'M',
    print: '碎花B',
    status: 'INACTIVE',
    barcode: '6901234567893',
    techpack_version: 'V2.1',
    mapping_health: 'OK',
    channel_mappings: 2,
    last_listing: '2025-12-20',
    last_order: '2025-12-28',
    created_at: '2025-12-15',
  },
  {
    id: 'SKU-005',
    sku_code: 'SKU-BS-002-WHITE-L',
    spu_id: 'SPU-BS-002',
    spu_code: 'SPU-BS-002',
    spu_name: '波西米亚风半裙',
    color: '白色',
    size: 'L',
    print: null,
    status: 'ACTIVE',
    barcode: '6901234567900',
    techpack_version: 'V1.0',
    mapping_health: 'CONFLICT',
    channel_mappings: 2,
    last_listing: '2025-12-22',
    last_order: '2026-01-08',
    created_at: '2025-12-20',
  },
  {
    id: 'SKU-006',
    sku_code: 'SKU-TS-003-BLACK-M',
    spu_id: 'SPU-TS-003',
    spu_code: 'SPU-TS-003',
    spu_name: '基础款T恤',
    color: '黑色',
    size: 'M',
    print: null,
    status: 'ACTIVE',
    barcode: null,
    techpack_version: 'V1.2',
    mapping_health: 'MISSING',
    channel_mappings: 0,
    last_listing: null,
    last_order: null,
    created_at: '2025-12-25',
  },
]

const colorOptions = ['红色', '蓝色', '白色', '黑色', '绿色', '黄色', '粉色']
const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

// ============ 状态管理 ============

let state: SkuState = {
  search: '',
  statusFilter: 'all',
  mappingHealthFilter: 'all',
  spuFilter: 'all',
  drawerOpen: false,
  batchDialogOpen: false,
  createMode: 'single',
  formData: {
    spu_id: '',
    color: '',
    size: '',
    print: '',
    barcode: '',
    code_strategy: 'auto',
    manual_code: '',
  },
  batchConfig: {
    spu_id: 'SPU-FD-001',
    colors: [],
    sizes: [],
  },
}

// ============ 工具函数 ============

function getMappingHealthBadge(health: string): string {
  if (health === 'OK') {
    return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200">
      <i data-lucide="check-circle-2" class="h-3 w-3"></i>正常
    </span>`
  }
  if (health === 'MISSING') {
    return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
      <i data-lucide="alert-triangle" class="h-3 w-3"></i>缺映射
    </span>`
  }
  return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200">
    <i data-lucide="x-circle" class="h-3 w-3"></i>冲突
  </span>`
}

function getFilteredSKUs(): SpecificationArchiveRecord[] {
  return mockSKUs.filter((sku) => {
    const matchesSearch = !state.search ||
      sku.sku_code.toLowerCase().includes(state.search.toLowerCase()) ||
      sku.spu_name.toLowerCase().includes(state.search.toLowerCase()) ||
      sku.barcode?.toLowerCase().includes(state.search.toLowerCase())
    const matchesStatus = state.statusFilter === 'all' || sku.status === state.statusFilter
    const matchesMappingHealth = state.mappingHealthFilter === 'all' || sku.mapping_health === state.mappingHealthFilter
    const matchesSPU = state.spuFilter === 'all' || sku.spu_id === state.spuFilter
    return matchesSearch && matchesStatus && matchesMappingHealth && matchesSPU
  })
}

function getStats() {
  return {
    total: mockSKUs.length,
    active: mockSKUs.filter((s) => s.status === 'ACTIVE').length,
    inactive: mockSKUs.filter((s) => s.status === 'INACTIVE').length,
    mappingOK: mockSKUs.filter((s) => s.mapping_health === 'OK').length,
    mappingMissing: mockSKUs.filter((s) => s.mapping_health === 'MISSING').length,
    mappingConflict: mockSKUs.filter((s) => s.mapping_health === 'CONFLICT').length,
  }
}

export function listSpecificationRecords(): SpecificationArchiveRecord[] {
  return [...mockSKUs]
}

export function listSpecificationRecordsByStyleId(styleId: string): SpecificationArchiveRecord[] {
  const style = getStyleArchiveById(styleId)
  if (style && style.specificationCount === 0) return []
  return mockSKUs.filter((record) => record.spu_id === styleId)
}

export function getSpecificationRecord(specificationId: string): SpecificationArchiveRecord | null {
  return mockSKUs.find((record) => record.id === specificationId) ?? null
}

// ============ 渲染函数 ============

function renderKpiCards(): string {
  const stats = getStats()
  return `
    <div class="grid grid-cols-6 gap-4">
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow" data-sku-action="filter-all">
        <div class="text-2xl font-bold">${stats.total}</div>
        <div class="text-sm text-gray-500">全部规格</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow" data-sku-action="filter-active">
        <div class="text-2xl font-bold text-green-600">${stats.active}</div>
        <div class="text-sm text-gray-500">启用中</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow" data-sku-action="filter-inactive">
        <div class="text-2xl font-bold text-gray-500">${stats.inactive}</div>
        <div class="text-sm text-gray-500">已停用</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow" data-sku-action="filter-mapping-ok">
        <div class="text-2xl font-bold text-green-600">${stats.mappingOK}</div>
        <div class="text-sm text-gray-500">映射正常</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow" data-sku-action="filter-mapping-missing">
        <div class="text-2xl font-bold text-yellow-600">${stats.mappingMissing}</div>
        <div class="text-sm text-gray-500">缺渠道映射</div>
      </div>
      <div class="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow" data-sku-action="filter-mapping-conflict">
        <div class="text-2xl font-bold text-red-600">${stats.mappingConflict}</div>
        <div class="text-sm text-gray-500">映射冲突</div>
      </div>
    </div>
  `
}

function renderFilters(): string {
  return `
    <div class="bg-white rounded-lg border p-4">
      <div class="flex items-center gap-4">
        <div class="relative flex-1 max-w-sm">
          <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"></i>
          <input
            type="text"
            placeholder="搜索规格编码/条码/款式名称..."
            value="${escapeHtml(state.search)}"
            data-sku-filter="search"
            class="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select data-sku-filter="spu" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.spuFilter === 'all' ? 'selected' : ''}>全部款式</option>
          <option value="SPU-FD-001" ${state.spuFilter === 'SPU-FD-001' ? 'selected' : ''}>SPU-FD-001</option>
          <option value="SPU-BS-002" ${state.spuFilter === 'SPU-BS-002' ? 'selected' : ''}>SPU-BS-002</option>
          <option value="SPU-TS-003" ${state.spuFilter === 'SPU-TS-003' ? 'selected' : ''}>SPU-TS-003</option>
        </select>
        <select data-sku-filter="status" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
          <option value="ACTIVE" ${state.statusFilter === 'ACTIVE' ? 'selected' : ''}>启用</option>
          <option value="INACTIVE" ${state.statusFilter === 'INACTIVE' ? 'selected' : ''}>停用</option>
        </select>
        <select data-sku-filter="mapping" class="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all" ${state.mappingHealthFilter === 'all' ? 'selected' : ''}>全部映射状态</option>
          <option value="OK" ${state.mappingHealthFilter === 'OK' ? 'selected' : ''}>正常</option>
          <option value="MISSING" ${state.mappingHealthFilter === 'MISSING' ? 'selected' : ''}>缺映射</option>
          <option value="CONFLICT" ${state.mappingHealthFilter === 'CONFLICT' ? 'selected' : ''}>冲突</option>
        </select>
        <button class="p-2 border rounded-md hover:bg-gray-50">
          <i data-lucide="filter" class="h-4 w-4"></i>
        </button>
        <button data-sku-action="reset-filters" class="p-2 border rounded-md hover:bg-gray-50">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>
        </button>
      </div>
    </div>
  `
}

function renderTable(): string {
  const filteredSKUs = getFilteredSKUs()
  
  return `
    <div class="bg-white rounded-lg border overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">规格编码</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属款式</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">规格组合</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">条码</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">技术资料版本</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">映射健康</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">渠道映射数</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最近上架</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最近订单</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${filteredSKUs.map((sku) => `
            <tr class="hover:bg-gray-50 cursor-pointer" data-sku-action="view-detail" data-sku-id="${sku.id}">
              <td class="px-4 py-3 font-medium">
                <div class="flex items-center gap-2">
                  <i data-lucide="package" class="h-4 w-4 text-gray-400"></i>
                  ${escapeHtml(sku.sku_code)}
                </div>
              </td>
              <td class="px-4 py-3">
                <div class="font-medium">${escapeHtml(sku.spu_code)}</div>
                <div class="text-xs text-gray-500">${escapeHtml(sku.spu_name)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border">${escapeHtml(sku.color)}</span>
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border">${escapeHtml(sku.size)}</span>
                  ${sku.print ? `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border">${escapeHtml(sku.print)}</span>` : ''}
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${sku.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                  ${sku.status === 'ACTIVE' ? '启用' : '停用'}
                </span>
              </td>
              <td class="px-4 py-3 font-mono text-sm">${sku.barcode || '-'}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border">${escapeHtml(sku.techpack_version)}</span>
              </td>
              <td class="px-4 py-3">${getMappingHealthBadge(sku.mapping_health)}</td>
              <td class="px-4 py-3">${sku.channel_mappings}</td>
              <td class="px-4 py-3">${sku.last_listing || '-'}</td>
              <td class="px-4 py-3">${sku.last_order || '-'}</td>
              <td class="px-4 py-3 text-right">
                <button class="p-1 rounded hover:bg-gray-100" data-sku-action="toggle-menu" data-sku-id="${sku.id}">
                  <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderSkuDrawer(): string {
  if (!state.drawerOpen) return ''
  
  const isImport = state.createMode === 'import'
  
  const formContent = `
    <div class="space-y-6">
      <!-- 所属款式 -->
      ${renderLabeledSelect('所属款式', {
        value: state.formData.spu_id,
        options: [
          { value: 'SPU-FD-001', label: 'SPU-FD-001 - 印尼风格碎花连衣裙' },
          { value: 'SPU-BS-002', label: 'SPU-BS-002 - 波西米亚风半裙' },
          { value: 'SPU-TS-003', label: 'SPU-TS-003 - 基础款T恤' },
        ],
          placeholder: '选择款式',
        prefix: 'sku',
        field: 'spu_id',
      }, true)}
      
      ${isImport ? `
        ${renderLabeledInput('历史规格编码', { placeholder: '输入历史规格编码', prefix: 'sku', field: 'legacy_code' }, true)}
        ${renderLabeledSelect('老系统名称', {
          options: [
            { value: 'erp_v1', label: 'ERP V1' },
            { value: 'wms_old', label: '旧 WMS' },
          ],
          placeholder: '选择老系统',
          prefix: 'sku',
          field: 'legacy_system',
        })}
        <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <i data-lucide="alert-triangle" class="h-4 w-4 text-yellow-600 mt-0.5"></i>
          <div class="text-sm text-yellow-800">
            <div class="font-medium">映射规则说明</div>
            <div class="mt-1">同一历史规格编码在同一时间段只能映射到一个规格档案，系统将自动检测冲突。</div>
          </div>
        </div>
      ` : `
        <div class="grid grid-cols-2 gap-4">
          ${renderLabeledSelect('颜色', {
            value: state.formData.color,
            options: colorOptions.map(c => ({ value: c, label: c })),
            placeholder: '选择颜色',
            prefix: 'sku',
            field: 'color',
          }, true)}
          ${renderLabeledSelect('尺码', {
            value: state.formData.size,
            options: sizeOptions.map(s => ({ value: s, label: s })),
            placeholder: '选择尺码',
            prefix: 'sku',
            field: 'size',
          }, true)}
        </div>
        ${renderLabeledInput('花型/色系（可选）', { value: state.formData.print, placeholder: '如：碎花A、条纹B', prefix: 'sku', field: 'print' })}
        ${renderLabeledSelect('规格编码策略', {
          value: state.formData.code_strategy,
          options: [
            { value: 'auto', label: '自动生成（推荐）' },
            { value: 'manual', label: '手工输入' },
          ],
          prefix: 'sku',
          field: 'code_strategy',
        })}
        ${state.formData.code_strategy === 'manual' ? renderLabeledInput('规格编码', { value: state.formData.manual_code, placeholder: '输入唯一的规格编码', prefix: 'sku', field: 'manual_code' }, true) : ''}
        ${renderLabeledInput('条码（可选）', { value: state.formData.barcode, placeholder: '商品条形码', prefix: 'sku', field: 'barcode' })}
      `}
    </div>
  `

  return uiDrawer(
    {
      title: isImport ? '导入/绑定历史规格档案' : '新建规格档案',
      subtitle: isImport ? '从历史系统导入或绑定已有规格编码' : '围绕款式创建单个规格档案',
      closeAction: { prefix: 'sku', action: 'close-drawer' },
      width: 'sm',
    },
    formContent,
    {
      cancel: { prefix: 'sku', action: 'close-drawer' },
      confirm: { prefix: 'sku', action: 'submit-create', label: isImport ? '绑定并创建' : '创建规格', variant: 'primary' },
    }
  )
}

function renderSkuBatchDialog(): string {
  if (!state.batchDialogOpen) return ''
  
  const count = state.batchConfig.colors.length * state.batchConfig.sizes.length
  
  const content = `
    <div class="space-y-6">
      ${renderLabeledSelect('所属款式', {
        value: state.batchConfig.spu_id,
        options: [
          { value: 'SPU-FD-001', label: 'SPU-FD-001 - 印尼风格碎花连衣裙' },
          { value: 'SPU-BS-002', label: 'SPU-BS-002 - 波西米亚风半裙' },
          { value: 'SPU-TS-003', label: 'SPU-TS-003 - 基础款T恤' },
        ],
        prefix: 'sku',
        filter: 'batch_spu_id',
      }, true)}
      <div class="space-y-2">
        <label class="text-sm font-medium">选择颜色 *</label>
        <div class="flex flex-wrap gap-2">
          ${colorOptions.map((color) => `
            <label class="flex items-center gap-2">
              <input type="checkbox" data-sku-batch-color="${color}" ${state.batchConfig.colors.includes(color) ? 'checked' : ''} class="rounded border-gray-300" />
              <span class="text-sm">${color}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">选择尺码 *</label>
        <div class="flex flex-wrap gap-2">
          ${sizeOptions.map((size) => `
            <label class="flex items-center gap-2">
              <input type="checkbox" data-sku-batch-size="${size}" ${state.batchConfig.sizes.includes(size) ? 'checked' : ''} class="rounded border-gray-300" />
              <span class="text-sm">${size}</span>
            </label>
          `).join('')}
        </div>
      </div>
      ${count > 0 ? `
        <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          将生成 <span class="font-bold">${count}</span> 条规格档案（${state.batchConfig.colors.length} 颜色 × ${state.batchConfig.sizes.length} 尺码）
        </div>
      ` : ''}
    </div>
  `

  return uiDialog(
    {
      title: '批量生成规格档案',
      description: '选择颜色和尺码组合，系统将自动生成当前款式下的全部规格档案',
      closeAction: { prefix: 'sku', action: 'close-batch-dialog' },
      width: 'md',
    },
    content,
    `
      <div class="flex justify-end gap-3">
        <button data-sku-action="close-batch-dialog" class="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">取消</button>
        <button data-sku-action="submit-batch" class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 ${count === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${count === 0 ? 'disabled' : ''}>批量生成</button>
      </div>
    `
  )
}

// ============ 事件处理 ============

export function handleProductSkuEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-sku-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.skuAction
  
  switch (action) {
    case 'open-drawer':
      state.drawerOpen = true
      state.createMode = 'single'
      return true
    case 'open-drawer-import':
      state.drawerOpen = true
      state.createMode = 'import'
      return true
    case 'close-drawer':
      state.drawerOpen = false
      return true
    case 'open-batch-dialog':
      state.batchDialogOpen = true
      return true
    case 'close-batch-dialog':
      state.batchDialogOpen = false
      return true
    case 'reset-filters':
      state.search = ''
      state.statusFilter = 'all'
      state.mappingHealthFilter = 'all'
      state.spuFilter = 'all'
      return true
    case 'filter-all':
      state.statusFilter = 'all'
      return true
    case 'filter-active':
      state.statusFilter = 'ACTIVE'
      return true
    case 'filter-inactive':
      state.statusFilter = 'INACTIVE'
      return true
    case 'filter-mapping-ok':
      state.mappingHealthFilter = 'OK'
      return true
    case 'filter-mapping-missing':
      state.mappingHealthFilter = 'MISSING'
      return true
    case 'filter-mapping-conflict':
      state.mappingHealthFilter = 'CONFLICT'
      return true
    case 'view-detail': {
      const skuId = actionNode.dataset.skuId
      const specification = mockSKUs.find((item) => item.id === skuId)
      if (specification) {
        appStore.navigate(`/pcs/products/styles/${specification.spu_id}?tab=specifications&specId=${encodeURIComponent(specification.id)}`)
      }
      return true
    }
    case 'submit-create':
      state.drawerOpen = false
      return true
    case 'submit-batch':
      state.batchDialogOpen = false
      return true
    default:
      return false
  }
}

export function handleProductSkuInput(target: Element): boolean {
  const filterNode = target.closest<HTMLElement>('[data-sku-filter]')
  if (filterNode) {
    const filter = filterNode.dataset.skuFilter
    const value = (filterNode as HTMLInputElement | HTMLSelectElement).value
    
    switch (filter) {
      case 'search':
        state.search = value
        return true
      case 'status':
        state.statusFilter = value
        return true
      case 'spu':
        state.spuFilter = value
        return true
      case 'mapping':
        state.mappingHealthFilter = value
        return true
    }
  }
  
  const fieldNode = target.closest<HTMLElement>('[data-sku-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.skuField as keyof typeof state.formData
    if (field && field in state.formData) {
      (state.formData as Record<string, string>)[field] = (fieldNode as HTMLInputElement | HTMLSelectElement).value
    }
    return true
  }
  
  // Batch dialog color/size checkboxes
  const colorNode = target.closest<HTMLElement>('[data-sku-batch-color]')
  if (colorNode) {
    const color = colorNode.dataset.skuBatchColor!
    const checked = (colorNode as HTMLInputElement).checked
    if (checked) {
      if (!state.batchConfig.colors.includes(color)) {
        state.batchConfig.colors.push(color)
      }
    } else {
      state.batchConfig.colors = state.batchConfig.colors.filter((c) => c !== color)
    }
    return true
  }
  
  const sizeNode = target.closest<HTMLElement>('[data-sku-batch-size]')
  if (sizeNode) {
    const size = sizeNode.dataset.skuBatchSize!
    const checked = (sizeNode as HTMLInputElement).checked
    if (checked) {
      if (!state.batchConfig.sizes.includes(size)) {
        state.batchConfig.sizes.push(size)
      }
    } else {
      state.batchConfig.sizes = state.batchConfig.sizes.filter((s) => s !== size)
    }
    return true
  }
  
  return false
}

export function isProductSkuDialogOpen(): boolean {
  return state.drawerOpen || state.batchDialogOpen
}

export function renderProductSkuPage(): string {
  return `
    <div class="space-y-6">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500">商品档案 / 规格档案</p>
          <h1 class="mt-2 text-2xl font-bold">规格档案</h1>
          <p class="text-gray-500">围绕款式维护颜色、尺码、条码、渠道挂接与技术资料版本。</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative group">
            <button class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2">
              <i data-lucide="plus" class="h-4 w-4"></i>
              新建规格
              <i data-lucide="chevron-down" class="h-4 w-4"></i>
            </button>
            <div class="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button data-sku-action="open-drawer" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                <i data-lucide="plus" class="h-4 w-4"></i>
                单个创建
              </button>
              <button data-sku-action="open-batch-dialog" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                <i data-lucide="copy" class="h-4 w-4"></i>
                批量生成（颜色×尺码）
              </button>
              <div class="border-t my-1"></div>
              <button data-sku-action="open-drawer-import" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                <i data-lucide="upload" class="h-4 w-4"></i>
                导入/绑定历史规格档案
              </button>
            </div>
          </div>
        </div>
      </div>

      ${renderKpiCards()}
      ${renderFilters()}
      ${renderTable()}
      ${renderSkuDrawer()}
      ${renderSkuBatchDialog()}
    </div>
  `
}
