import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderFormDialog as uiFormDialog,
  renderSecondaryButton,
} from '../components/ui'

// ============ Mock 数据 ============

const mockTasks = [
  {
    id: 'FS-20260109-005',
    title: '首单打样-碎花连衣裙',
    status: 'IN_QC',
    milestone: '验收中',
    project: { code: 'PRJ-20260105-001', name: '印尼风格碎花连衣裙' },
    source: { type: '制版', code: 'PT-20260109-002', version: 'P1' },
    factory: 'JKT-Factory-03',
    targetSite: '雅加达',
    expectedArrival: '2026-01-12',
    trackingNo: 'JNE-884392001',
    arrivedAt: '2026-01-12 15:20',
    stockedInAt: '2026-01-12 17:05',
    sample: { code: 'SY-JKT-00021', name: '碎花连衣裙-P1A1' },
    acceptanceResult: '需改版',
    owner: '王版师',
    isOverdue: false,
  },
  {
    id: 'FS-20260108-003',
    title: '首单打样-基础白T恤',
    status: 'ARRIVED',
    milestone: '已到样待入库',
    project: { code: 'PRJ-20260103-008', name: '基础款白色T恤' },
    source: { type: '制版', code: 'PT-20260108-001', version: 'P2' },
    factory: 'SZ-Factory-01',
    targetSite: '深圳',
    expectedArrival: '2026-01-10',
    trackingNo: 'SF-772819340',
    arrivedAt: '2026-01-10 09:15',
    stockedInAt: null,
    sample: null,
    acceptanceResult: null,
    owner: '李版师',
    isOverdue: false,
  },
  {
    id: 'FS-20260107-001',
    title: '首单打样-波西米亚半身裙',
    status: 'IN_PROGRESS',
    milestone: '在途',
    project: { code: 'PRJ-20260105-002', name: '波西米亚风格半身裙' },
    source: { type: '花型', code: 'AT-20260106-005', version: 'A3' },
    factory: 'JKT-Factory-02',
    targetSite: '雅加达',
    expectedArrival: '2026-01-11',
    trackingNo: 'JNE-991024832',
    arrivedAt: null,
    stockedInAt: null,
    sample: null,
    acceptanceResult: null,
    owner: '张花型师',
    isOverdue: true,
  },
  {
    id: 'FS-20260106-012',
    title: '首单打样-牛仔夹克',
    status: 'COMPLETED',
    milestone: '已完成',
    project: { code: 'PRJ-20260102-005', name: '复古牛仔夹克' },
    source: { type: '制版', code: 'PT-20260105-008', version: 'P1' },
    factory: 'SZ-Factory-02',
    targetSite: '深圳',
    expectedArrival: '2026-01-08',
    trackingNo: 'SF-661728492',
    arrivedAt: '2026-01-08 14:30',
    stockedInAt: '2026-01-08 16:20',
    sample: { code: 'SY-SZ-00157', name: '牛仔夹克-P1' },
    acceptanceResult: '通过',
    owner: '赵版师',
    isOverdue: false,
  },
]

// ============ 类型定义 ============

interface FirstOrderSampleState {
  searchTerm: string
  statusFilter: string
  siteFilter: string
  ownerFilter: string
  activeKpiFilter: string | null
  createDrawerOpen: boolean
  receiptDialogOpen: boolean
  stockInDialogOpen: boolean
  selectedTaskId: string | null
}

let state: FirstOrderSampleState = {
  searchTerm: '',
  statusFilter: 'all',
  siteFilter: 'all',
  ownerFilter: 'all',
  activeKpiFilter: null,
  createDrawerOpen: false,
  receiptDialogOpen: false,
  stockInDialogOpen: false,
  selectedTaskId: null,
}

// ============ 工具函数 ============

function getMilestoneBadge(milestone: string) {
  const map: Record<string, string> = {
    '在途': 'bg-blue-100 text-blue-700',
    '已到样待入库': 'bg-orange-100 text-orange-700',
    '验收中': 'bg-yellow-100 text-yellow-700',
    '已完成': 'bg-green-100 text-green-700',
  }
  return map[milestone] || 'bg-gray-100 text-gray-700'
}

function getKpiStats() {
  return {
    inTransit: mockTasks.filter((t) => t.milestone === '在途').length,
    arrivedPending: mockTasks.filter((t) => t.milestone === '已到样待入库').length,
    inQc: mockTasks.filter((t) => t.milestone === '验收中').length,
    overdue: mockTasks.filter((t) => t.isOverdue).length,
  }
}

function getFilteredTasks() {
  return mockTasks.filter((task) => {
    if (state.searchTerm && !task.id.includes(state.searchTerm) && !task.title.includes(state.searchTerm)) return false
    if (state.statusFilter !== 'all' && task.status !== state.statusFilter) return false
    if (state.siteFilter !== 'all' && task.targetSite !== state.siteFilter) return false
    if (state.ownerFilter !== 'all' && task.owner !== state.ownerFilter) return false
    if (state.activeKpiFilter === 'inTransit' && task.milestone !== '在途') return false
    if (state.activeKpiFilter === 'arrivedPending' && task.milestone !== '已到样待入库') return false
    if (state.activeKpiFilter === 'inQc' && task.milestone !== '验收中') return false
    if (state.activeKpiFilter === 'overdue' && !task.isOverdue) return false
    return true
  })
}

function getSelectedTask() {
  return mockTasks.find((t) => t.id === state.selectedTaskId)
}

// ============ 渲染函数 ============

function renderFirstOrderCreateDrawer() {
  if (!state.createDrawerOpen) return ''

  const formContent = `
    <div class="space-y-6">
      <!-- 基本信息 -->
      <div class="space-y-4">
        <h3 class="font-medium text-foreground border-b pb-2">基本信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">标题 <span class="text-red-500">*</span></label>
            <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="首单打样-款号/项目名" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">负责人 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择负责人</option>
              <option value="wang">王版师</option>
              <option value="li">李版师</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">优先级</label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="high">高</option>
              <option value="medium" selected>中</option>
              <option value="low">低</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">预计到样</label>
            <input type="date" class="w-full h-9 px-3 border rounded-md text-sm" />
          </div>
        </div>
      </div>

      <!-- 来源与绑定 -->
      <div class="space-y-4">
        <h3 class="font-medium text-foreground border-b pb-2">来源与绑定</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">项目 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择项目</option>
              <option value="prj1">PRJ-20260105-001 印尼风格碎花连衣裙</option>
              <option value="prj2">PRJ-20260103-008 基础款白色T恤</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">来源类型 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择来源</option>
              <option value="pattern">来自制版</option>
              <option value="artwork">来自花型</option>
              <option value="revision">来自改版</option>
              <option value="manual">人工创建</option>
            </select>
          </div>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">上游实例（条件必填）</label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择上游实例</option>
            <option value="pt1">PT-20260109-002 制版-印尼碎花连衣裙(P1)</option>
            <option value="at1">AT-20260106-005 花型-波西米亚印花(A3)</option>
          </select>
        </div>
      </div>

      <!-- 打样对象与交期 -->
      <div class="space-y-4">
        <h3 class="font-medium text-foreground border-b pb-2">打样对象与交期</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">工厂/外协 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择工厂</option>
              <option value="jkt1">JKT-Factory-01</option>
              <option value="jkt2">JKT-Factory-02</option>
              <option value="jkt3">JKT-Factory-03</option>
              <option value="sz1">SZ-Factory-01</option>
              <option value="sz2">SZ-Factory-02</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">期望发货时间</label>
            <input type="date" class="w-full h-9 px-3 border rounded-md text-sm" />
          </div>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">打样要求</label>
          <textarea class="w-full px-3 py-2 border rounded-md text-sm min-h-[60px]" placeholder="面料、工艺、注意事项等"></textarea>
        </div>
      </div>

      <!-- 输入包 -->
      <div class="space-y-4">
        <h3 class="font-medium text-foreground border-b pb-2">输入包（至少一个）</h3>
        <div class="space-y-3">
          <div class="space-y-2">
            <label class="block text-sm font-medium">制版包</label>
            <div class="flex gap-2">
              <input type="text" class="flex-1 h-9 px-3 border rounded-md text-sm" placeholder="引用制版包" />
              <button type="button" class="h-9 px-3 text-sm border rounded-md hover:bg-muted">选择</button>
            </div>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">花型包</label>
            <div class="flex gap-2">
              <input type="text" class="flex-1 h-9 px-3 border rounded-md text-sm" placeholder="引用花型包" />
              <button type="button" class="h-9 px-3 text-sm border rounded-md hover:bg-muted">选择</button>
            </div>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">其他附件</label>
            <button type="button" class="h-9 px-3 text-sm border rounded-md hover:bg-muted">上传附件</button>
          </div>
        </div>
      </div>

      <!-- 目标站点与收货信息 -->
      <div class="space-y-4">
        <h3 class="font-medium text-foreground border-b pb-2">目标站点与收货信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">目标站点 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择站点</option>
              <option value="sz">深圳</option>
              <option value="jkt">雅加达</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">收货联系人</label>
            <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="默认：站点仓管" />
          </div>
        </div>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建首单样衣打样',
      closeAction: { prefix: 'first-order', action: 'close-create-drawer' },
      width: 'sm',
    },
    formContent,
    {
      cancel: { prefix: 'first-order', action: 'close-create-drawer', label: '取消' },
      extra: renderSecondaryButton('保存草稿', { prefix: 'first-order', action: 'save-draft' }),
      confirm: { prefix: 'first-order', action: 'submit-create', label: '创建并开始', variant: 'primary' },
    }
  )
}

function renderFirstOrderReceiptDialog() {
  if (!state.receiptDialogOpen) return ''
  const task = getSelectedTask()

  const formContent = `
    <div class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">签收站点（只读）</label>
        <input type="text" class="w-full h-9 px-3 border rounded-md text-sm bg-muted" value="${task?.targetSite || ''}" disabled />
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">签收时间 <span class="text-red-500">*</span></label>
        <input type="datetime-local" class="w-full h-9 px-3 border rounded-md text-sm" />
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">包裹照片/回执附件</label>
        <button type="button" class="h-9 px-3 text-sm border rounded-md hover:bg-muted">上传附件</button>
      </div>
    </div>
  `

  return uiFormDialog(
    {
      title: '到样签收',
      closeAction: { prefix: 'first-order', action: 'close-receipt-dialog' },
      submitAction: { prefix: 'first-order', action: 'submit-receipt', label: '确认签收' },
      width: 'md',
    },
    formContent
  )
}

function renderFirstOrderStockInDialog() {
  if (!state.stockInDialogOpen) return ''

  const formContent = `
    <div class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">仓库 <span class="text-red-500">*</span></label>
        <select class="w-full h-9 px-3 border rounded-md text-sm">
          <option value="">选择仓库</option>
          <option value="sz-main">深圳主仓</option>
          <option value="jkt-main">雅加达主仓</option>
        </select>
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">库位 <span class="text-red-500">*</span></label>
        <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="输入库位编号" />
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">样衣编号（系统生成）</label>
        <input type="text" class="w-full h-9 px-3 border rounded-md text-sm bg-muted" value="SY-SZ-00158" disabled />
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">初检结果</label>
        <select class="w-full h-9 px-3 border rounded-md text-sm">
          <option value="pass" selected>合格</option>
          <option value="fail">不合格</option>
        </select>
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">入库照片</label>
        <button type="button" class="h-9 px-3 text-sm border rounded-md hover:bg-muted">上传照片</button>
      </div>
    </div>
  `

  return uiFormDialog(
    {
      title: '核对入库',
      closeAction: { prefix: 'first-order', action: 'close-stock-in-dialog' },
      submitAction: { prefix: 'first-order', action: 'submit-stock-in', label: '提交入库' },
      width: 'md',
    },
    formContent
  )
}

function renderTaskRow(task: typeof mockTasks[0]) {
  const milestoneClass = getMilestoneBadge(task.milestone)
  return `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-3">
        <button class="font-medium text-blue-600 hover:underline text-sm" data-first-order-action="view-task" data-task-id="${task.id}">${task.id}</button>
        <div class="text-xs text-gray-500 mt-0.5">${escapeHtml(task.title)}</div>
      </td>
      <td class="px-4 py-3">
        <span class="inline-flex px-2 py-0.5 text-xs rounded ${milestoneClass}">${task.milestone}</span>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-gray-900">${task.project.code}</div>
        <div class="text-xs text-gray-500">${escapeHtml(task.project.name)}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-gray-900">${task.source.type}</div>
        <div class="text-xs text-blue-600">${task.source.code} (${task.source.version})</div>
      </td>
      <td class="px-4 py-3 text-sm text-gray-900">${task.factory}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${task.targetSite}</td>
      <td class="px-4 py-3">
        <div class="text-sm ${task.isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}">${task.expectedArrival}</div>
        ${task.isOverdue ? '<span class="inline-flex px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded mt-1">超期</span>' : ''}
      </td>
      <td class="px-4 py-3">
        ${task.trackingNo ? `<button class="text-sm text-blue-600 hover:underline font-mono">${task.trackingNo}</button>` : '<span class="text-sm text-gray-400">-</span>'}
      </td>
      <td class="px-4 py-3 text-sm text-gray-900">${task.arrivedAt || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${task.stockedInAt || '-'}</td>
      <td class="px-4 py-3">
        ${task.sample ? `<button class="text-sm text-blue-600 hover:underline">${task.sample.code}</button>` : '<span class="text-sm text-gray-400">-</span>'}
      </td>
      <td class="px-4 py-3">
        ${task.acceptanceResult ? `<span class="inline-flex px-2 py-0.5 text-xs rounded ${task.acceptanceResult === '通过' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">${task.acceptanceResult}</span>` : '<span class="text-sm text-gray-400">-</span>'}
      </td>
      <td class="px-4 py-3 text-right">
        <div class="flex items-center justify-end gap-2">
          <button class="h-8 px-3 text-sm border rounded-md hover:bg-gray-50" data-first-order-action="view-task" data-task-id="${task.id}">查看</button>
          ${task.milestone === '在途' ? `<button class="h-8 px-3 text-sm border rounded-md hover:bg-gray-50" data-first-order-action="open-receipt-dialog" data-task-id="${task.id}">到样签收</button>` : ''}
          ${task.milestone === '已到样待入库' ? `<button class="h-8 px-3 text-sm border rounded-md hover:bg-gray-50" data-first-order-action="open-stock-in-dialog" data-task-id="${task.id}">核对入库</button>` : ''}
          ${task.sample ? `<button class="h-8 w-8 flex items-center justify-center border rounded-md hover:bg-gray-50"><i data-lucide="external-link" class="h-4 w-4"></i></button>` : ''}
        </div>
      </td>
    </tr>
  `
}

function renderPage(): string {
  const filteredTasks = getFilteredTasks()
  const kpiStats = getKpiStats()

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex items-center justify-between border-b bg-white px-6 py-4 -mx-6 -mt-6 mb-4">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">首单样衣打样</h1>
          <p class="text-sm text-gray-500 mt-1">管理首单样衣打样任务，跟踪物流与验收闭环</p>
        </div>
        <button class="h-9 px-4 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2" data-first-order-action="open-create-drawer">
          <i data-lucide="plus" class="h-4 w-4"></i>
          新建首单打样
        </button>
      </header>

      <!-- Filter Bar -->
      <section class="bg-white rounded-lg border p-4 space-y-4">
        <div class="grid grid-cols-5 gap-4">
          <div class="relative">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"></i>
            <input
              type="text"
              class="w-full h-9 pl-10 pr-3 border rounded-md text-sm"
              placeholder="搜索任务编号/项目/款号/工厂/运单号..."
              value="${escapeHtml(state.searchTerm)}"
              data-first-order-field="search"
            />
          </div>
          <select class="h-9 px-3 border rounded-md text-sm" data-first-order-field="status">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            <option value="IN_PROGRESS" ${state.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>进行中</option>
            <option value="ARRIVED" ${state.statusFilter === 'ARRIVED' ? 'selected' : ''}>已到样待入库</option>
            <option value="IN_QC" ${state.statusFilter === 'IN_QC' ? 'selected' : ''}>验收中</option>
            <option value="COMPLETED" ${state.statusFilter === 'COMPLETED' ? 'selected' : ''}>已完成</option>
            <option value="BLOCKED" ${state.statusFilter === 'BLOCKED' ? 'selected' : ''}>阻塞</option>
          </select>
          <select class="h-9 px-3 border rounded-md text-sm" data-first-order-field="site">
            <option value="all" ${state.siteFilter === 'all' ? 'selected' : ''}>全部站点</option>
            <option value="深圳" ${state.siteFilter === '深圳' ? 'selected' : ''}>深圳</option>
            <option value="雅加达" ${state.siteFilter === '雅加达' ? 'selected' : ''}>雅加达</option>
          </select>
          <select class="h-9 px-3 border rounded-md text-sm" data-first-order-field="owner">
            <option value="all" ${state.ownerFilter === 'all' ? 'selected' : ''}>全部</option>
            <option value="王版师" ${state.ownerFilter === '王版师' ? 'selected' : ''}>王版师</option>
            <option value="李版师" ${state.ownerFilter === '李版师' ? 'selected' : ''}>李版师</option>
            <option value="张花型师" ${state.ownerFilter === '张花型师' ? 'selected' : ''}>张花型师</option>
            <option value="赵版师" ${state.ownerFilter === '赵版师' ? 'selected' : ''}>赵版师</option>
          </select>
          <div class="flex gap-2">
            <button class="h-9 px-3 text-sm border rounded-md hover:bg-gray-50" data-first-order-action="reset-filters">重置</button>
            <button class="h-9 px-3 text-sm border rounded-md hover:bg-gray-50 flex items-center gap-1">
              <i data-lucide="filter" class="h-4 w-4"></i>
              高级
            </button>
          </div>
        </div>
      </section>

      <!-- KPI Quick Filters -->
      <section class="grid grid-cols-4 gap-4">
        <button
          class="bg-white rounded-lg border p-4 text-left hover:shadow-md transition-shadow ${state.activeKpiFilter === 'inTransit' ? 'ring-2 ring-blue-500' : ''}"
          data-first-order-action="set-kpi-filter"
          data-kpi="inTransit"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600">在途</span>
            <i data-lucide="clock" class="h-4 w-4 text-blue-600"></i>
          </div>
          <div class="text-2xl font-bold text-gray-900">${kpiStats.inTransit}</div>
        </button>
        <button
          class="bg-white rounded-lg border p-4 text-left hover:shadow-md transition-shadow ${state.activeKpiFilter === 'arrivedPending' ? 'ring-2 ring-blue-500' : ''}"
          data-first-order-action="set-kpi-filter"
          data-kpi="arrivedPending"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600">已到样待入库</span>
            <i data-lucide="package" class="h-4 w-4 text-orange-600"></i>
          </div>
          <div class="text-2xl font-bold text-gray-900">${kpiStats.arrivedPending}</div>
        </button>
        <button
          class="bg-white rounded-lg border p-4 text-left hover:shadow-md transition-shadow ${state.activeKpiFilter === 'inQc' ? 'ring-2 ring-blue-500' : ''}"
          data-first-order-action="set-kpi-filter"
          data-kpi="inQc"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600">验收中</span>
            <i data-lucide="check-circle" class="h-4 w-4 text-green-600"></i>
          </div>
          <div class="text-2xl font-bold text-gray-900">${kpiStats.inQc}</div>
        </button>
        <button
          class="bg-white rounded-lg border p-4 text-left hover:shadow-md transition-shadow ${state.activeKpiFilter === 'overdue' ? 'ring-2 ring-blue-500' : ''}"
          data-first-order-action="set-kpi-filter"
          data-kpi="overdue"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600">超期</span>
            <i data-lucide="alert-triangle" class="h-4 w-4 text-red-600"></i>
          </div>
          <div class="text-2xl font-bold text-gray-900">${kpiStats.overdue}</div>
        </button>
      </section>

      <!-- Table -->
      <section class="bg-white rounded-lg border overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1400px]">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">任务</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态/里程碑</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">项目</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">工厂/外协</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">目标站点</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">预计到样</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">运单</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">到样时间</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">入库时间</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">样衣</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">验收结论</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${filteredTasks.length > 0 ? filteredTasks.map(renderTaskRow).join('') : `
                <tr>
                  <td colspan="13" class="px-4 py-12 text-center text-gray-500">暂无数据</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
        <footer class="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <div class="text-sm text-gray-500">共 ${filteredTasks.length} 条</div>
          <div class="flex items-center gap-2">
            <button class="h-8 px-3 text-sm border rounded-md hover:bg-white" disabled>上一页</button>
            <button class="h-8 px-3 text-sm bg-blue-600 text-white rounded-md">1</button>
            <button class="h-8 px-3 text-sm border rounded-md hover:bg-white" disabled>下一页</button>
          </div>
        </footer>
      </section>
    </div>

    ${renderFirstOrderCreateDrawer()}
    ${renderFirstOrderReceiptDialog()}
    ${renderFirstOrderStockInDialog()}
  `
}

// ============ 事件处理 ============

export function handleFirstOrderSampleEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-first-order-action]')
  const action = actionNode?.dataset.firstOrderAction

  if (action === 'open-create-drawer') {
    state.createDrawerOpen = true
    return true
  }

  if (action === 'close-create-drawer') {
    state.createDrawerOpen = false
    return true
  }

  if (action === 'save-draft') {
    state.createDrawerOpen = false
    console.log('已保存草稿')
    return true
  }

  if (action === 'submit-create') {
    state.createDrawerOpen = false
    console.log('首单打样任务已创建')
    return true
  }

  if (action === 'open-receipt-dialog') {
    state.selectedTaskId = actionNode?.dataset.taskId || null
    state.receiptDialogOpen = true
    return true
  }

  if (action === 'close-receipt-dialog') {
    state.receiptDialogOpen = false
    return true
  }

  if (action === 'submit-receipt') {
    state.receiptDialogOpen = false
    console.log('到样签收成功')
    return true
  }

  if (action === 'open-stock-in-dialog') {
    state.selectedTaskId = actionNode?.dataset.taskId || null
    state.stockInDialogOpen = true
    return true
  }

  if (action === 'close-stock-in-dialog') {
    state.stockInDialogOpen = false
    return true
  }

  if (action === 'submit-stock-in') {
    state.stockInDialogOpen = false
    console.log('核对入库成功')
    return true
  }

  if (action === 'set-kpi-filter') {
    const kpi = actionNode?.dataset.kpi || null
    state.activeKpiFilter = state.activeKpiFilter === kpi ? null : kpi
    return true
  }

  if (action === 'reset-filters') {
    state.searchTerm = ''
    state.statusFilter = 'all'
    state.siteFilter = 'all'
    state.ownerFilter = 'all'
    state.activeKpiFilter = null
    return true
  }

  if (action === 'view-task') {
    const taskId = actionNode?.dataset.taskId
    console.log(`查看任务: ${taskId}`)
    return true
  }

  return false
}

export function handleFirstOrderSampleInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.firstOrderField
  if (!field) return false

  if (field === 'search') {
    state.searchTerm = (target as HTMLInputElement).value
    return true
  }

  if (field === 'status') {
    state.statusFilter = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'site') {
    state.siteFilter = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'owner') {
    state.ownerFilter = (target as HTMLSelectElement).value
    return true
  }

  return false
}

export function isFirstOrderSampleDialogOpen(): boolean {
  return state.createDrawerOpen || state.receiptDialogOpen || state.stockInDialogOpen
}

export function renderFirstOrderSamplePage(): string {
  return renderPage()
}
