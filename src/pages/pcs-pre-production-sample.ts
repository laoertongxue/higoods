import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderFormDialog as uiFormDialog,
  renderSecondaryButton,
  renderPrimaryButton,
} from '../components/ui'

// ============ 常量定义 ============

const STATUS = {
  NOT_STARTED: { label: '未开始', color: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  IN_TRANSIT: { label: '在途', color: 'bg-yellow-100 text-yellow-700' },
  ARRIVED: { label: '已到样', color: 'bg-orange-100 text-orange-700' },
  IN_QC: { label: '验收中', color: 'bg-purple-100 text-purple-700' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-700' },
  BLOCKED: { label: '阻塞', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
}

const PREPROD_RESULT = {
  PASS: { label: '通过', color: 'bg-green-100 text-green-700' },
  FAIL: { label: '不通过', color: 'bg-red-100 text-red-700' },
  NEED_RETRY: { label: '需补产前', color: 'bg-orange-100 text-orange-700' },
  NEED_REVISION: { label: '需改版', color: 'bg-yellow-100 text-yellow-700' },
}

const GATE_STATUS = {
  NOT_MET: { label: '未满足', color: 'bg-red-100 text-red-700' },
  MET: { label: '已满足', color: 'bg-green-100 text-green-700' },
}

// ============ Mock 数据 ============

const mockTasks = [
  {
    id: 'PP-20260115-001',
    title: '产前版-碎花连衣裙',
    status: 'COMPLETED',
    projectRef: 'PRJ-20260105-001',
    projectName: '印尼风格碎花连衣裙',
    sourceType: '首单',
    sourceRef: 'FS-20260109-005',
    factoryRef: 'JKT-Factory-03',
    factoryName: '雅加达工厂03',
    targetSite: '雅加达',
    patternRef: 'PT-20260112-004',
    patternVersion: 'P2',
    artworkRef: 'AT-20260109-001',
    artworkVersion: 'A1',
    expectedArrival: '2026-01-17',
    trackingNo: 'JNE-99230018',
    arrivedAt: '2026-01-18 14:10',
    stockedInAt: '2026-01-18 16:00',
    sampleRef: 'SY-JKT-00045',
    sampleName: '碎花连衣裙-产前版',
    preprodResult: 'PASS',
    gateStatus: 'MET',
    owner: '王版师',
    updatedAt: '2026-01-18 16:30',
  },
  {
    id: 'PP-20260116-002',
    title: '产前版-条纹T恤',
    status: 'IN_QC',
    projectRef: 'PRJ-20260108-003',
    projectName: '基础款条纹T恤',
    sourceType: '制版',
    sourceRef: 'PT-20260110-002',
    factoryRef: 'SZ-Factory-01',
    factoryName: '深圳工厂01',
    targetSite: '深圳',
    patternRef: 'PT-20260110-002',
    patternVersion: 'P3',
    artworkRef: null,
    artworkVersion: null,
    expectedArrival: '2026-01-15',
    trackingNo: 'SF-1234567890',
    arrivedAt: '2026-01-16 09:30',
    stockedInAt: '2026-01-16 11:00',
    sampleRef: 'SY-SZ-00123',
    sampleName: '条纹T恤-产前版',
    preprodResult: null,
    gateStatus: 'NOT_MET',
    owner: '李版师',
    updatedAt: '2026-01-16 11:00',
  },
  {
    id: 'PP-20260117-003',
    title: '产前版-牛仔短裤',
    status: 'ARRIVED',
    projectRef: 'PRJ-20260110-005',
    projectName: '夏季牛仔短裤',
    sourceType: '改版',
    sourceRef: 'RT-20260112-001',
    factoryRef: 'SZ-Factory-02',
    factoryName: '深圳工厂02',
    targetSite: '深圳',
    patternRef: 'PT-20260114-003',
    patternVersion: 'P2',
    artworkRef: null,
    artworkVersion: null,
    expectedArrival: '2026-01-16',
    trackingNo: 'YT-9876543210',
    arrivedAt: '2026-01-17 15:20',
    stockedInAt: null,
    sampleRef: null,
    sampleName: null,
    preprodResult: null,
    gateStatus: 'NOT_MET',
    owner: '张版师',
    updatedAt: '2026-01-17 15:20',
  },
  {
    id: 'PP-20260118-004',
    title: '产前版-印花衬衫',
    status: 'IN_TRANSIT',
    projectRef: 'PRJ-20260112-007',
    projectName: '热带印花衬衫',
    sourceType: '花型',
    sourceRef: 'AT-20260115-003',
    factoryRef: 'JKT-Factory-01',
    factoryName: '雅加达工厂01',
    targetSite: '雅加达',
    patternRef: 'PT-20260116-005',
    patternVersion: 'P1',
    artworkRef: 'AT-20260115-003',
    artworkVersion: 'A2',
    expectedArrival: '2026-01-20',
    trackingNo: 'JNE-88120045',
    arrivedAt: null,
    stockedInAt: null,
    sampleRef: null,
    sampleName: null,
    preprodResult: null,
    gateStatus: 'NOT_MET',
    owner: '陈版师',
    updatedAt: '2026-01-18 10:00',
  },
  {
    id: 'PP-20260119-005',
    title: '产前版-针织开衫',
    status: 'IN_PROGRESS',
    projectRef: 'PRJ-20260115-009',
    projectName: '秋季针织开衫',
    sourceType: '首单',
    sourceRef: 'FS-20260117-008',
    factoryRef: 'SZ-Factory-03',
    factoryName: '深圳工厂03',
    targetSite: '深圳',
    patternRef: 'PT-20260118-006',
    patternVersion: 'P2',
    artworkRef: null,
    artworkVersion: null,
    expectedArrival: '2026-01-22',
    trackingNo: null,
    arrivedAt: null,
    stockedInAt: null,
    sampleRef: null,
    sampleName: null,
    preprodResult: null,
    gateStatus: 'NOT_MET',
    owner: '王版师',
    updatedAt: '2026-01-19 09:00',
  },
  {
    id: 'PP-20260120-006',
    title: '产前版-波点连衣裙',
    status: 'COMPLETED',
    projectRef: 'PRJ-20260113-006',
    projectName: '复古波点连衣裙',
    sourceType: '改版',
    sourceRef: 'RT-20260115-004',
    factoryRef: 'JKT-Factory-02',
    factoryName: '雅加达工厂02',
    targetSite: '雅加达',
    patternRef: 'PT-20260117-007',
    patternVersion: 'P3',
    artworkRef: 'AT-20260116-005',
    artworkVersion: 'A1',
    expectedArrival: '2026-01-19',
    trackingNo: 'JNE-77890123',
    arrivedAt: '2026-01-19 11:30',
    stockedInAt: '2026-01-19 14:00',
    sampleRef: 'SY-JKT-00052',
    sampleName: '波点连衣裙-产前版',
    preprodResult: 'FAIL',
    gateStatus: 'NOT_MET',
    owner: '李版师',
    updatedAt: '2026-01-20 10:00',
  },
]

// ============ 类型定义 ============

interface PreProductionState {
  searchKeyword: string
  statusFilter: string
  siteFilter: string
  ownerFilter: string
  kpiFilter: string
  currentPage: number
  createDrawerOpen: boolean
  receiptDialogOpen: boolean
  stockInDialogOpen: boolean
  selectedTaskId: string | null
}

let state: PreProductionState = {
  searchKeyword: '',
  statusFilter: 'all',
  siteFilter: 'all',
  ownerFilter: 'all',
  kpiFilter: 'all',
  currentPage: 1,
  createDrawerOpen: false,
  receiptDialogOpen: false,
  stockInDialogOpen: false,
  selectedTaskId: null,
}

// ============ 工具函数 ============

function getKpiStats() {
  return {
    inTransit: mockTasks.filter((t) => t.status === 'IN_TRANSIT').length,
    arrived: mockTasks.filter((t) => t.status === 'ARRIVED').length,
    inQc: mockTasks.filter((t) => t.status === 'IN_QC').length,
    passed: mockTasks.filter((t) => t.preprodResult === 'PASS').length,
    failed: mockTasks.filter((t) => t.preprodResult === 'FAIL' || t.preprodResult === 'NEED_REVISION').length,
    overdue: mockTasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && new Date(t.expectedArrival) < new Date()).length,
  }
}

function getFilteredTasks() {
  return mockTasks.filter((task) => {
    if (state.searchKeyword && !task.id.toLowerCase().includes(state.searchKeyword.toLowerCase()) && !task.title.toLowerCase().includes(state.searchKeyword.toLowerCase()) && !task.projectName.toLowerCase().includes(state.searchKeyword.toLowerCase()) && !task.trackingNo?.toLowerCase().includes(state.searchKeyword.toLowerCase())) return false
    if (state.statusFilter !== 'all' && task.status !== state.statusFilter) return false
    if (state.siteFilter !== 'all' && task.targetSite !== state.siteFilter) return false
    if (state.ownerFilter !== 'all' && task.owner !== state.ownerFilter) return false
    if (state.kpiFilter === 'inTransit' && task.status !== 'IN_TRANSIT') return false
    if (state.kpiFilter === 'arrived' && task.status !== 'ARRIVED') return false
    if (state.kpiFilter === 'inQc' && task.status !== 'IN_QC') return false
    if (state.kpiFilter === 'passed' && task.preprodResult !== 'PASS') return false
    if (state.kpiFilter === 'failed' && task.preprodResult !== 'FAIL' && task.preprodResult !== 'NEED_REVISION') return false
    if (state.kpiFilter === 'overdue' && (task.status === 'COMPLETED' || task.status === 'CANCELLED' || new Date(task.expectedArrival) >= new Date())) return false
    return true
  })
}

function getSelectedTask() {
  return mockTasks.find((t) => t.id === state.selectedTaskId)
}

// ============ 渲染函数 ============

function renderPreprodCreateDrawer() {
  if (!state.createDrawerOpen) return ''

  const formContent = `
    <div class="space-y-6">
      <!-- 基本信息 -->
      <div class="space-y-4">
        <h3 class="font-medium text-sm text-muted-foreground">基本信息</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">标题 <span class="text-red-500">*</span></label>
          <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="产前版-{{款号/项目名}}" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">负责人 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择负责人</option>
              <option value="王版师">王版师</option>
              <option value="李版师">李版师</option>
              <option value="张版师">张版师</option>
              <option value="陈版师">陈版师</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">预计到样</label>
            <input type="date" class="w-full h-9 px-3 border rounded-md text-sm" />
          </div>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">参与人</label>
          <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="多人用逗号分隔" />
        </div>
      </div>

      <!-- 来源与绑定 -->
      <div class="space-y-4">
        <h3 class="font-medium text-sm text-muted-foreground">来源与绑定</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">项目 <span class="text-red-500">*</span></label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择项目</option>
            <option value="PRJ-20260105-001">PRJ-20260105-001 印尼风格碎花连衣裙</option>
            <option value="PRJ-20260108-003">PRJ-20260108-003 基础款条纹T恤</option>
            <option value="PRJ-20260110-005">PRJ-20260110-005 夏季牛仔短裤</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">来源类型 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择来源</option>
              <option value="首单">来自首单</option>
              <option value="制版">来自制版</option>
              <option value="花型">来自花型</option>
              <option value="改版">来自改版</option>
              <option value="人工">人工创建</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">上游实例引用</label>
            <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="上游任务编号" />
          </div>
        </div>
      </div>

      <!-- 版本输入 -->
      <div class="space-y-4">
        <h3 class="font-medium text-sm text-muted-foreground">版本输入（必须为冻结版本）</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">制版任务引用 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择制版任务</option>
              <option value="PT-20260112-004">PT-20260112-004（已冻结）</option>
              <option value="PT-20260110-002">PT-20260110-002（已冻结）</option>
              <option value="PT-20260114-003">PT-20260114-003（已冻结）</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">制版版本 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">P?</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">花型任务引用</label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择花型任务（若有）</option>
              <option value="AT-20260109-001">AT-20260109-001（已冻结）</option>
              <option value="AT-20260115-003">AT-20260115-003（已冻结）</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">花型版本</label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">A?</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
            </select>
          </div>
        </div>
        <div class="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
          <i data-lucide="alert-triangle" class="h-4 w-4 text-yellow-600 mt-0.5"></i>
          <p class="text-xs text-yellow-700">只能选择状态为"已冻结/已完成"的制版/花型任务版本</p>
        </div>
      </div>

      <!-- 打样对象与交期 -->
      <div class="space-y-4">
        <h3 class="font-medium text-sm text-muted-foreground">打样对象与交期</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">工厂/外协 <span class="text-red-500">*</span></label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择工厂</option>
            <option value="SZ-Factory-01">深圳工厂01</option>
            <option value="SZ-Factory-02">深圳工厂02</option>
            <option value="SZ-Factory-03">深圳工厂03</option>
            <option value="JKT-Factory-01">雅加达工厂01</option>
            <option value="JKT-Factory-02">雅加达工厂02</option>
            <option value="JKT-Factory-03">雅加达工厂03</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">打样要求</label>
          <textarea class="w-full px-3 py-2 border rounded-md text-sm min-h-[60px]" placeholder="面料/工艺/注意事项等"></textarea>
        </div>
      </div>

      <!-- 目标站点与收货信息 -->
      <div class="space-y-4">
        <h3 class="font-medium text-sm text-muted-foreground">目标站点与收货信息</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">目标站点 <span class="text-red-500">*</span></label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择站点</option>
            <option value="深圳">深圳</option>
            <option value="雅加达">雅加达</option>
          </select>
        </div>
        <div class="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
          收货地址将根据站点配置自动填充，收货联系人默认为站点仓管
        </div>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建产前版样衣',
      closeAction: { prefix: 'preprod', action: 'close-create-drawer' },
      width: 'sm',
    },
    formContent,
    {
      extra: renderSecondaryButton('保存草稿', { prefix: 'preprod', action: 'save-draft' }),
      confirm: { prefix: 'preprod', action: 'submit-create', label: '创建并开始', variant: 'primary' },
    }
  )
}

function renderPreprodReceiptDialog() {
  if (!state.receiptDialogOpen) return ''

  const formContent = `
    <div class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">签收时间 <span class="text-red-500">*</span></label>
        <input type="datetime-local" class="w-full h-9 px-3 border rounded-md text-sm" />
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">回执/包裹照片</label>
        <input type="file" class="w-full text-sm" accept="image/*" />
        <p class="text-xs text-muted-foreground">建议上传签收凭证</p>
      </div>
    </div>
  `

  return uiFormDialog(
    {
      title: '到样签收',
      closeAction: { prefix: 'preprod', action: 'close-receipt-dialog' },
      submitAction: { prefix: 'preprod', action: 'submit-receipt', label: '确认签收' },
      width: 'md',
    },
    formContent
  )
}

function renderPreprodStockInDialog() {
  if (!state.stockInDialogOpen) return ''
  const task = getSelectedTask()

  const formContent = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="block text-sm font-medium">仓库 <span class="text-red-500">*</span></label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择仓库</option>
            <option value="SZ-WH-01">深圳仓库01</option>
            <option value="JKT-WH-01">雅加达仓库01</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">库位 <span class="text-red-500">*</span></label>
          <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="A-01-02" />
        </div>
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">样衣编号 <span class="text-red-500">*</span></label>
        <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" value="SY-${task?.targetSite === '深圳' ? 'SZ' : 'JKT'}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}" />
        <p class="text-xs text-muted-foreground">系统自动生成，可修改确认</p>
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">初检结果 <span class="text-red-500">*</span></label>
        <select class="w-full h-9 px-3 border rounded-md text-sm">
          <option value="">选择初检结果</option>
          <option value="pass">合格</option>
          <option value="fail">不合格</option>
        </select>
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium">入库照片</label>
        <input type="file" class="w-full text-sm" accept="image/*" />
      </div>
    </div>
  `

  return uiFormDialog(
    {
      title: '核对入库',
      closeAction: { prefix: 'preprod', action: 'close-stock-in-dialog' },
      submitAction: { prefix: 'preprod', action: 'submit-stock-in', label: '确认入库' },
      width: 'md',
    },
    formContent
  )
}

function renderTaskRow(task: typeof mockTasks[0]) {
  const statusInfo = STATUS[task.status as keyof typeof STATUS] || { label: task.status, color: 'bg-gray-100 text-gray-700' }
  const resultInfo = task.preprodResult ? PREPROD_RESULT[task.preprodResult as keyof typeof PREPROD_RESULT] : null
  const gateInfo = GATE_STATUS[task.gateStatus as keyof typeof GATE_STATUS]
  const isOverdue = task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && new Date(task.expectedArrival) < new Date()

  return `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-3 py-3">
        <div>
          <button class="text-sm font-medium text-blue-600 hover:underline" data-preprod-action="view-task" data-task-id="${task.id}">${task.id}</button>
          <p class="text-xs text-gray-500">${escapeHtml(task.title)}</p>
        </div>
      </td>
      <td class="px-3 py-3">
        <span class="inline-flex px-2 py-0.5 text-xs rounded ${statusInfo.color}">${statusInfo.label}</span>
      </td>
      <td class="px-3 py-3">
        <button class="text-xs text-blue-600 hover:underline">${task.projectRef}</button>
        <p class="text-xs text-gray-500 truncate max-w-[120px]">${escapeHtml(task.projectName)}</p>
      </td>
      <td class="px-3 py-3">
        <div class="text-xs">
          <span class="text-gray-500">${task.sourceType}</span>
          <button class="block text-blue-600 hover:underline">${task.sourceRef}</button>
        </div>
      </td>
      <td class="px-3 py-3 text-xs">${escapeHtml(task.factoryName)}</td>
      <td class="px-3 py-3">
        <span class="inline-flex px-2 py-0.5 text-xs border rounded">${task.targetSite}</span>
      </td>
      <td class="px-3 py-3">
        <span class="inline-flex px-2 py-0.5 text-xs bg-gray-100 rounded font-mono">${task.patternVersion}</span>
      </td>
      <td class="px-3 py-3">
        ${task.artworkVersion ? `<span class="inline-flex px-2 py-0.5 text-xs bg-gray-100 rounded font-mono">${task.artworkVersion}</span>` : '<span class="text-xs text-gray-400">-</span>'}
      </td>
      <td class="px-3 py-3 ${isOverdue ? 'text-red-600 font-medium' : ''}">
        <div class="flex items-center gap-1 text-xs">
          ${isOverdue ? '<i data-lucide="alert-triangle" class="h-3 w-3"></i>' : ''}
          ${task.expectedArrival}
        </div>
      </td>
      <td class="px-3 py-3">
        ${task.trackingNo ? `<button class="text-xs text-blue-600 hover:underline flex items-center gap-1" data-preprod-action="copy-tracking" data-tracking="${task.trackingNo}">${task.trackingNo}<i data-lucide="copy" class="h-3 w-3"></i></button>` : '<span class="text-xs text-gray-400">-</span>'}
      </td>
      <td class="px-3 py-3 text-xs">${task.arrivedAt || '-'}</td>
      <td class="px-3 py-3 text-xs">${task.stockedInAt || '-'}</td>
      <td class="px-3 py-3">
        ${task.sampleRef ? `<button class="text-xs text-blue-600 hover:underline">${task.sampleRef}</button>` : '<span class="text-xs text-gray-400">-</span>'}
      </td>
      <td class="px-3 py-3">
        ${resultInfo ? `<span class="inline-flex px-2 py-0.5 text-xs rounded ${resultInfo.color}">${resultInfo.label}</span>` : '<span class="text-xs text-gray-400">-</span>'}
      </td>
      <td class="px-3 py-3">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${gateInfo.color}">
          <i data-lucide="${task.gateStatus === 'MET' ? 'unlock' : 'lock'}" class="h-3 w-3"></i>
          ${gateInfo.label}
        </span>
      </td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-1">
          <button class="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded" data-preprod-action="view-task" data-task-id="${task.id}">
            <i data-lucide="eye" class="h-3 w-3"></i>
          </button>
          ${(task.status === 'IN_TRANSIT' || task.status === 'IN_PROGRESS') ? `<button class="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded" data-preprod-action="open-receipt-dialog" data-task-id="${task.id}"><i data-lucide="package-check" class="h-3 w-3"></i></button>` : ''}
          ${task.status === 'ARRIVED' ? `<button class="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded" data-preprod-action="open-stock-in-dialog" data-task-id="${task.id}"><i data-lucide="warehouse" class="h-3 w-3"></i></button>` : ''}
          ${(task.status === 'IN_QC' || task.status === 'COMPLETED') && task.sampleRef ? `<button class="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded"><i data-lucide="package" class="h-3 w-3"></i></button>` : ''}
          ${task.status === 'IN_QC' ? `<button class="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded"><i data-lucide="file-check" class="h-3 w-3"></i></button>` : ''}
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
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">产前版样衣</h1>
          <p class="mt-1 text-sm text-gray-500">基于已冻结的制版/花型版本与首单验证结论，完成产前版样衣制作与回收，作为进入量产的关键门槛</p>
        </div>
        <button class="h-9 px-4 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2" data-preprod-action="open-create-drawer">
          <i data-lucide="plus" class="h-4 w-4"></i>
          新建产前版样衣
        </button>
      </header>

      <!-- Filter Bar -->
      <section class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-center gap-4">
          <div class="relative flex-1 min-w-[200px]">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"></i>
            <input
              type="text"
              class="w-full h-9 pl-10 pr-3 border rounded-md text-sm"
              placeholder="任务编号/项目/款号/运单号/样衣编号"
              value="${escapeHtml(state.searchKeyword)}"
              data-preprod-field="search"
            />
          </div>
          <select class="h-9 px-3 border rounded-md text-sm w-[140px]" data-preprod-field="status">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            <option value="NOT_STARTED" ${state.statusFilter === 'NOT_STARTED' ? 'selected' : ''}>未开始</option>
            <option value="IN_PROGRESS" ${state.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>进行中</option>
            <option value="IN_TRANSIT" ${state.statusFilter === 'IN_TRANSIT' ? 'selected' : ''}>在途</option>
            <option value="ARRIVED" ${state.statusFilter === 'ARRIVED' ? 'selected' : ''}>已到样待入库</option>
            <option value="IN_QC" ${state.statusFilter === 'IN_QC' ? 'selected' : ''}>验收中</option>
            <option value="COMPLETED" ${state.statusFilter === 'COMPLETED' ? 'selected' : ''}>已完成</option>
            <option value="BLOCKED" ${state.statusFilter === 'BLOCKED' ? 'selected' : ''}>阻塞</option>
          </select>
          <select class="h-9 px-3 border rounded-md text-sm w-[120px]" data-preprod-field="site">
            <option value="all" ${state.siteFilter === 'all' ? 'selected' : ''}>全部站点</option>
            <option value="深圳" ${state.siteFilter === '深圳' ? 'selected' : ''}>深圳</option>
            <option value="雅加达" ${state.siteFilter === '雅加达' ? 'selected' : ''}>雅加达</option>
          </select>
          <select class="h-9 px-3 border rounded-md text-sm w-[120px]" data-preprod-field="owner">
            <option value="all" ${state.ownerFilter === 'all' ? 'selected' : ''}>全部</option>
            <option value="王版师" ${state.ownerFilter === '王版师' ? 'selected' : ''}>王版师</option>
            <option value="李版师" ${state.ownerFilter === '李版师' ? 'selected' : ''}>李版师</option>
            <option value="张版师" ${state.ownerFilter === '张版师' ? 'selected' : ''}>张版师</option>
            <option value="陈版师" ${state.ownerFilter === '陈版师' ? 'selected' : ''}>陈版师</option>
          </select>
          <button class="h-9 px-3 text-sm border rounded-md hover:bg-gray-50 flex items-center gap-1" data-preprod-action="reset-filters">
            <i data-lucide="rotate-ccw" class="h-4 w-4"></i>
            重置
          </button>
        </div>
      </section>

      <!-- KPI Cards -->
      <section class="grid grid-cols-6 gap-4">
        <button
          class="rounded-lg border bg-white p-4 cursor-pointer transition-colors hover:bg-gray-50 ${state.kpiFilter === 'inTransit' ? 'ring-2 ring-blue-500' : ''}"
          data-preprod-action="set-kpi-filter"
          data-kpi="inTransit"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <i data-lucide="truck" class="h-5 w-5 text-yellow-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold">${kpiStats.inTransit}</p>
              <p class="text-xs text-gray-500">在途</p>
            </div>
          </div>
        </button>
        <button
          class="rounded-lg border bg-white p-4 cursor-pointer transition-colors hover:bg-gray-50 ${state.kpiFilter === 'arrived' ? 'ring-2 ring-blue-500' : ''}"
          data-preprod-action="set-kpi-filter"
          data-kpi="arrived"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <i data-lucide="package-check" class="h-5 w-5 text-orange-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold">${kpiStats.arrived}</p>
              <p class="text-xs text-gray-500">已到样待入库</p>
            </div>
          </div>
        </button>
        <button
          class="rounded-lg border bg-white p-4 cursor-pointer transition-colors hover:bg-gray-50 ${state.kpiFilter === 'inQc' ? 'ring-2 ring-blue-500' : ''}"
          data-preprod-action="set-kpi-filter"
          data-kpi="inQc"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <i data-lucide="clipboard-check" class="h-5 w-5 text-purple-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold">${kpiStats.inQc}</p>
              <p class="text-xs text-gray-500">验收中</p>
            </div>
          </div>
        </button>
        <button
          class="rounded-lg border bg-white p-4 cursor-pointer transition-colors hover:bg-gray-50 ${state.kpiFilter === 'passed' ? 'ring-2 ring-blue-500' : ''}"
          data-preprod-action="set-kpi-filter"
          data-kpi="passed"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <i data-lucide="check-circle" class="h-5 w-5 text-green-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold">${kpiStats.passed}</p>
              <p class="text-xs text-gray-500">已通过产前</p>
            </div>
          </div>
        </button>
        <button
          class="rounded-lg border bg-white p-4 cursor-pointer transition-colors hover:bg-gray-50 ${state.kpiFilter === 'failed' ? 'ring-2 ring-blue-500' : ''}"
          data-preprod-action="set-kpi-filter"
          data-kpi="failed"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <i data-lucide="alert-triangle" class="h-5 w-5 text-red-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold">${kpiStats.failed}</p>
              <p class="text-xs text-gray-500">未通过</p>
            </div>
          </div>
        </button>
        <button
          class="rounded-lg border bg-white p-4 cursor-pointer transition-colors hover:bg-gray-50 ${state.kpiFilter === 'overdue' ? 'ring-2 ring-blue-500' : ''}"
          data-preprod-action="set-kpi-filter"
          data-kpi="overdue"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <i data-lucide="clock" class="h-5 w-5 text-red-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold">${kpiStats.overdue}</p>
              <p class="text-xs text-gray-500">超期</p>
            </div>
          </div>
        </button>
      </section>

      <!-- Table -->
      <section class="rounded-lg border bg-white overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1800px] text-sm">
            <thead>
              <tr class="border-b bg-gray-50 text-left text-gray-600">
                <th class="px-3 py-3 font-medium w-[180px]">任务</th>
                <th class="px-3 py-3 font-medium w-[100px]">状态</th>
                <th class="px-3 py-3 font-medium">项目</th>
                <th class="px-3 py-3 font-medium">来源</th>
                <th class="px-3 py-3 font-medium">工厂</th>
                <th class="px-3 py-3 font-medium">站点</th>
                <th class="px-3 py-3 font-medium">制版版本</th>
                <th class="px-3 py-3 font-medium">花型版本</th>
                <th class="px-3 py-3 font-medium">预计到样</th>
                <th class="px-3 py-3 font-medium">运单</th>
                <th class="px-3 py-3 font-medium">到样时间</th>
                <th class="px-3 py-3 font-medium">入库时间</th>
                <th class="px-3 py-3 font-medium">样衣</th>
                <th class="px-3 py-3 font-medium">产前结论</th>
                <th class="px-3 py-3 font-medium">门禁</th>
                <th class="px-3 py-3 font-medium w-[120px]">操作</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTasks.length > 0 ? filteredTasks.map(renderTaskRow).join('') : `
                <tr>
                  <td colspan="16" class="px-4 py-12 text-center text-gray-500">暂无数据</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
        <footer class="flex items-center justify-between border-t px-4 py-3">
          <p class="text-sm text-gray-500">共 ${filteredTasks.length} 条</p>
          <div class="flex items-center gap-2">
            <button class="h-8 px-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50" disabled>
              <i data-lucide="chevron-left" class="h-4 w-4"></i>
            </button>
            <span class="text-sm">第 ${state.currentPage} 页</span>
            <button class="h-8 px-2 text-sm border rounded-md hover:bg-gray-50">
              <i data-lucide="chevron-right" class="h-4 w-4"></i>
            </button>
          </div>
        </footer>
      </section>
    </div>

    ${renderPreprodCreateDrawer()}
    ${renderPreprodReceiptDialog()}
    ${renderPreprodStockInDialog()}
  `
}

// ============ 事件处理 ============

export function handlePreProductionSampleEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-preprod-action]')
  const action = actionNode?.dataset.preprodAction

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
    console.log('产前版样衣已创建')
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
    const kpi = actionNode?.dataset.kpi || 'all'
    state.kpiFilter = state.kpiFilter === kpi ? 'all' : kpi
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.statusFilter = 'all'
    state.siteFilter = 'all'
    state.ownerFilter = 'all'
    state.kpiFilter = 'all'
    return true
  }

  if (action === 'view-task') {
    const taskId = actionNode?.dataset.taskId
    console.log(`查看任务: ${taskId}`)
    return true
  }

  if (action === 'copy-tracking') {
    const tracking = actionNode?.dataset.tracking
    if (tracking) {
      navigator.clipboard.writeText(tracking)
      console.log(`已复制运单号: ${tracking}`)
    }
    return true
  }

  return false
}

export function handlePreProductionSampleInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.preprodField
  if (!field) return false

  if (field === 'search') {
    state.searchKeyword = (target as HTMLInputElement).value
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

export function isPreProductionSampleDialogOpen(): boolean {
  return state.createDrawerOpen || state.receiptDialogOpen || state.stockInDialogOpen
}

export function renderPreProductionSamplePage(): string {
  return renderPage()
}
