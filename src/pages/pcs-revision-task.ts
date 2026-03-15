import { escapeHtml } from '../utils'
import {
  renderFormDialog as uiFormDialog,
  renderConfirmDialog as uiConfirmDialog,
} from '../components/ui'

// ============ 常量定义 ============

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: '未开始', color: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  PENDING_REVIEW: { label: '待评审', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: '已确认', color: 'bg-green-100 text-green-700' },
  COMPLETED: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  BLOCKED: { label: '阻塞', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
}

const SOURCE_TYPE_MAP: Record<string, { label: string; color: string }> = {
  TEST_TRIGGER: { label: '测款触发', color: 'bg-purple-100 text-purple-700' },
  EXISTING_PRODUCT: { label: '既有商品改款', color: 'bg-orange-100 text-orange-700' },
  MANUAL: { label: '人工创建', color: 'bg-gray-100 text-gray-700' },
}

const REVISION_SCOPE_OPTIONS = [
  { value: 'PATTERN', label: '版型结构' }, { value: 'SIZE', label: '尺码规格' },
  { value: 'FABRIC', label: '面料' }, { value: 'ACCESSORIES', label: '辅料' },
  { value: 'CRAFT', label: '工艺' }, { value: 'PRINT', label: '花型' },
  { value: 'COLOR', label: '颜色' }, { value: 'PACKAGE', label: '包装标识' },
]

const DOWNSTREAM_TASK_TYPES = [
  { value: 'PATTERN', label: '打版任务' }, { value: 'PRINT', label: '花型任务' },
  { value: 'SAMPLE', label: '打样任务' }, { value: 'PRE_PRODUCTION', label: '产前版任务' },
]

// ============ Mock 数据 ============

interface RevisionTask {
  id: string; code: string; title: string
  projectId: string; projectName: string
  sourceType: string; upstreamInstance: string | null; upstreamTitle: string | null
  productRef: string | null; status: string; owner: string
  participants: string[]; priority: string; dueAt: string
  revisionScope: string[]; sampleCount: number; sampleSites: string[]
  revisionVersion: string | null; frozenAt: string | null; frozenBy: string | null
  downstreamCount: number; riskFlags: string[]
  blockedReason?: string; createdAt: string; updatedAt: string
}

const mockRevisionTasks: RevisionTask[] = [
  { id: 'RT-20260109-003', code: 'RT-20260109-003', title: '印尼风格碎花连衣裙改版（领口+腰节+面料克重）', projectId: 'PRJ-20260105-001', projectName: '印尼风格碎花连衣裙', sourceType: 'TEST_TRIGGER', upstreamInstance: 'WI-20260108-011', upstreamTitle: '测款结论判定', productRef: 'SPU-LY-2401', status: 'IN_PROGRESS', owner: '李版师', participants: ['王测款', '张仓管'], priority: '高', dueAt: '2026-01-15', revisionScope: ['PATTERN', 'SIZE', 'FABRIC'], sampleCount: 2, sampleSites: ['深圳', '雅加达'], revisionVersion: null, frozenAt: null, frozenBy: null, downstreamCount: 0, riskFlags: [], createdAt: '2026-01-09 09:30', updatedAt: '2026-01-09 14:30' },
  { id: 'RT-20260108-002', code: 'RT-20260108-002', title: '波西米亚风半身裙花型调整', projectId: 'PRJ-20260103-002', projectName: '波西米亚风半身裙', sourceType: 'EXISTING_PRODUCT', upstreamInstance: null, upstreamTitle: null, productRef: 'SPU-BX-2402', status: 'PENDING_REVIEW', owner: '王版师', participants: ['李设计'], priority: '中', dueAt: '2026-01-18', revisionScope: ['PRINT', 'COLOR'], sampleCount: 1, sampleSites: ['深圳'], revisionVersion: 'R1', frozenAt: null, frozenBy: null, downstreamCount: 0, riskFlags: [], createdAt: '2026-01-08 10:00', updatedAt: '2026-01-09 11:00' },
  { id: 'RT-20260105-001', code: 'RT-20260105-001', title: '休闲运动套装面料与工艺优化', projectId: 'PRJ-20260101-003', projectName: '休闲运动套装', sourceType: 'TEST_TRIGGER', upstreamInstance: 'WI-20260104-008', upstreamTitle: '测款结论判定', productRef: 'SPU-YD-2403', status: 'APPROVED', owner: '张版师', participants: ['陈采购', '刘仓管'], priority: '高', dueAt: '2026-01-12', revisionScope: ['FABRIC', 'ACCESSORIES', 'CRAFT'], sampleCount: 2, sampleSites: ['深圳'], revisionVersion: 'R2', frozenAt: '2026-01-08 16:00', frozenBy: '制版负责人', downstreamCount: 0, riskFlags: ['已冻结未建下游'], createdAt: '2026-01-05 14:00', updatedAt: '2026-01-08 16:00' },
  { id: 'RT-20260107-004', code: 'RT-20260107-004', title: '丝绸印花连衣裙尺码优化', projectId: 'PRJ-20260102-004', projectName: '丝绸印花连衣裙', sourceType: 'MANUAL', upstreamInstance: null, upstreamTitle: null, productRef: 'SPU-SC-2404', status: 'NOT_STARTED', owner: '赵版师', participants: [], priority: '低', dueAt: '2026-01-20', revisionScope: ['SIZE'], sampleCount: 1, sampleSites: ['深圳'], revisionVersion: null, frozenAt: null, frozenBy: null, downstreamCount: 0, riskFlags: [], createdAt: '2026-01-07 16:00', updatedAt: '2026-01-07 16:00' },
  { id: 'RT-20260106-005', code: 'RT-20260106-005', title: '格纹羊毛大衣面料与工艺调整', projectId: 'PRJ-20251228-005', projectName: '格纹羊毛大衣', sourceType: 'TEST_TRIGGER', upstreamInstance: 'WI-20260105-012', upstreamTitle: '测款结论判定', productRef: 'SPU-DY-2405', status: 'BLOCKED', owner: '钱版师', participants: ['孙采购'], priority: '高', dueAt: '2026-01-10', revisionScope: ['FABRIC', 'CRAFT'], sampleCount: 1, sampleSites: ['深圳'], revisionVersion: 'R1', frozenAt: null, frozenBy: null, downstreamCount: 0, riskFlags: ['阻塞', '超期'], blockedReason: '缺样衣：SMP-SZ-006 当前被占用', createdAt: '2026-01-06 09:00', updatedAt: '2026-01-09 08:00' },
  { id: 'RT-20260102-006', code: 'RT-20260102-006', title: '条纹休闲衬衫版型与工艺改版', projectId: 'PRJ-20251225-006', projectName: '条纹休闲衬衫', sourceType: 'EXISTING_PRODUCT', upstreamInstance: null, upstreamTitle: null, productRef: 'SPU-CS-2406', status: 'COMPLETED', owner: '周版师', participants: ['吴设计', '郑仓管'], priority: '中', dueAt: '2026-01-08', revisionScope: ['PATTERN', 'SIZE', 'CRAFT'], sampleCount: 2, sampleSites: ['深圳'], revisionVersion: 'R1', frozenAt: '2026-01-06 14:00', frozenBy: '制版负责人', downstreamCount: 2, riskFlags: [], createdAt: '2026-01-02 10:00', updatedAt: '2026-01-08 17:00' },
]

const mockTaskDetail = {
  id: 'RT-20260109-003', code: 'RT-20260109-003', title: '印尼风格碎花连衣裙改版（领口+腰节+面料克重）',
  projectId: 'PRJ-20260105-001', projectName: '印尼风格碎花连衣裙',
  sourceType: 'TEST_TRIGGER', upstreamInstance: 'WI-20260108-011', upstreamTitle: '测款结论判定',
  productRef: 'SPU-LY-2401', status: 'IN_PROGRESS', owner: '李版师',
  participants: ['王测款', '张仓管'], priority: '高', dueAt: '2026-01-15',
  revisionVersion: null, frozenAt: null, frozenBy: null, createdAt: '2026-01-09 09:30', updatedAt: '2026-01-09 14:30',
  revisionGoal: '降低退货率，从12%降至6%以下；提升直播转化',
  revisionScope: ['PATTERN', 'SIZE', 'FABRIC'],
  constraints: { maxCost: 85, maxDeliveryDays: 15, unchangeable: ['面料花色', '整体风格'] },
  changeList: [
    { id: 1, category: '版型结构', changePoint: '领口开深-1.5cm', before: '领口开深18cm', after: '领口开深16.5cm', reason: '测款反馈领口过深', risk: '中', verification: '打样验证', recommendedDownstream: ['PATTERN', 'SAMPLE'], owner: '李版师' },
    { id: 2, category: '尺码规格', changePoint: '腰围放量+2cm', before: 'M码腰围68cm', after: 'M码腰围70cm', reason: '退货数据显示腰围偏紧', risk: '低', verification: '测量', recommendedDownstream: ['PATTERN'], owner: '李版师' },
    { id: 3, category: '面料', changePoint: '克重从120→140', before: '面料克重120g/m²', after: '面料克重140g/m²', reason: '提升垂感和品质感', risk: '中', verification: '打样验证', recommendedDownstream: ['SAMPLE'], owner: '李版师' },
  ],
  acceptanceCriteria: [
    { id: 1, content: '领口开深实测值在16-17cm范围内', required: true, checked: false },
    { id: 2, content: 'M码腰围实测值在69-71cm范围内', required: true, checked: false },
    { id: 3, content: '面料克重在135-145g/m²范围内', required: true, checked: false },
  ],
  issues: [
    { id: 1, source: '测款反馈', category: '版型', description: '直播间反馈领口过深，不够保守，不适合印尼市场审美', severity: '严重' },
    { id: 2, source: '售后数据', category: '尺码', description: 'M码腰围偏紧投诉占总退货的28%', severity: '严重' },
    { id: 3, source: '版房评审', category: '面料', description: '当前面料克重偏轻，垂感不足，影响整体品质感', severity: '一般' },
  ],
  relatedSamples: [
    { code: 'SY-LED-002', name: '印尼碎花连衣裙-红色M', site: '深圳', status: '可用', location: 'A区-3排-12号', keeper: '张仓管', available: true, expectedReturn: null },
    { code: 'SY-LED-003', name: '印尼碎花连衣裙-红色L', site: '雅加达', status: '借出', location: '使用中', keeper: '印尼仓管', available: false, expectedReturn: '2026-01-12' },
  ],
  logs: [
    { time: '2026-01-09 14:30', action: '更新改版清单', user: '李版师', detail: '新增变更点：面料克重调整' },
    { time: '2026-01-09 14:00', action: '上传附件', user: '李版师', detail: '上传改版清单-草稿.xlsx' },
    { time: '2026-01-09 10:00', action: '领取任务', user: '李版师', detail: '状态变更：未开始 → 进行中' },
    { time: '2026-01-09 09:30', action: '创建任务', user: '系统', detail: '由测款结论判定(WI-20260108-011)自动触发创建' },
  ],
}

// ============ 状态管理 ============

interface RevisionState {
  search: string; statusFilter: string; ownerFilter: string
  sourceFilter: string; siteFilter: string; quickFilter: string | null
  selectedTaskId: string | null; detailOpen: boolean; activeTab: string
  createOpen: boolean; createDownstreamOpen: boolean
  approveDialogOpen: boolean; rejectDialogOpen: boolean; blockDialogOpen: boolean
  rejectReason: string; blockReason: string
  downstreamSelections: string[]
}

let state: RevisionState = {
  search: '', statusFilter: 'all', ownerFilter: 'all',
  sourceFilter: 'all', siteFilter: 'all', quickFilter: null,
  selectedTaskId: null, detailOpen: false, activeTab: 'plan',
  createOpen: false, createDownstreamOpen: false,
  approveDialogOpen: false, rejectDialogOpen: false, blockDialogOpen: false,
  rejectReason: '', blockReason: '',
  downstreamSelections: [],
}

// ============ 工具函数 ============

function getFilteredTasks(): RevisionTask[] {
  return mockRevisionTasks.filter((task) => {
    if (state.search) {
      const kw = state.search.toLowerCase()
      const match = task.code.toLowerCase().includes(kw) || task.title.toLowerCase().includes(kw) ||
        task.projectName.toLowerCase().includes(kw) || (task.productRef && task.productRef.toLowerCase().includes(kw))
      if (!match) return false
    }
    if (state.statusFilter !== 'all' && task.status !== state.statusFilter) return false
    if (state.ownerFilter === 'mine' && task.owner !== '李版师') return false
    if (state.sourceFilter !== 'all' && task.sourceType !== state.sourceFilter) return false
    if (state.siteFilter !== 'all' && !task.sampleSites.includes(state.siteFilter)) return false
    if (state.quickFilter === 'mine' && task.owner !== '李版师') return false
    if (state.quickFilter === 'pendingReview' && task.status !== 'PENDING_REVIEW') return false
    if (state.quickFilter === 'frozenNoDownstream' && !(task.status === 'APPROVED' && task.downstreamCount === 0)) return false
    if (state.quickFilter === 'blocked' && task.status !== 'BLOCKED') return false
    if (state.quickFilter === 'overdue' && !task.riskFlags.includes('超期')) return false
    return true
  })
}

function getStats() {
  return {
    total: mockRevisionTasks.length,
    mine: mockRevisionTasks.filter((t) => t.owner === '李版师').length,
    pendingReview: mockRevisionTasks.filter((t) => t.status === 'PENDING_REVIEW').length,
    frozenNoDownstream: mockRevisionTasks.filter((t) => t.status === 'APPROVED' && t.downstreamCount === 0).length,
    blocked: mockRevisionTasks.filter((t) => t.status === 'BLOCKED').length,
    overdue: mockRevisionTasks.filter((t) => t.riskFlags.includes('超期')).length,
  }
}

function getScopeLabel(val: string) {
  return REVISION_SCOPE_OPTIONS.find((o) => o.value === val)?.label || val
}

// ============ 渲染函数 ============

function renderTaskRow(task: RevisionTask) {
  const statusCfg = STATUS_MAP[task.status] || { label: task.status, color: 'bg-gray-100' }
  const sourceCfg = SOURCE_TYPE_MAP[task.sourceType] || { label: task.sourceType, color: 'bg-gray-100' }

  return `
    <tr class="border-b last:border-b-0 hover:bg-muted/40 cursor-pointer" data-revision-action="view-detail" data-task-id="${task.id}">
      <td class="px-3 py-3">
        <div><div class="font-medium text-primary">${task.code}</div>
        <div class="text-sm text-muted-foreground truncate max-w-[260px]">${escapeHtml(task.title)}</div></div>
      </td>
      <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusCfg.color}">${statusCfg.label}</span></td>
      <td class="px-3 py-3">
        <div class="text-sm"><div class="font-medium">${task.projectId}</div>
        <div class="text-muted-foreground truncate max-w-[120px]">${escapeHtml(task.projectName)}</div></div>
      </td>
      <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${sourceCfg.color}">${sourceCfg.label}</span></td>
      <td class="px-3 py-3 text-sm">${task.productRef || '-'}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-1">
          ${task.revisionScope.slice(0, 3).map((s) => `<span class="inline-flex rounded-full px-2 py-0.5 text-xs border">${getScopeLabel(s)}</span>`).join('')}
          ${task.revisionScope.length > 3 ? `<span class="inline-flex rounded-full px-2 py-0.5 text-xs border">+${task.revisionScope.length - 3}</span>` : ''}
        </div>
      </td>
      <td class="px-3 py-3 text-sm"><div>${task.sampleCount} 件</div><div class="text-xs text-muted-foreground">${task.sampleSites.join('/')}</div></td>
      <td class="px-3 py-3 text-sm">${task.owner}</td>
      <td class="px-3 py-3 text-sm ${task.riskFlags.includes('超期') ? 'text-red-600 font-medium' : ''}">${task.dueAt}</td>
      <td class="px-3 py-3">${task.revisionVersion ? `<span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-blue-50 text-blue-700">${task.revisionVersion}</span>` : '<span class="text-muted-foreground">-</span>'}</td>
      <td class="px-3 py-3">${task.downstreamCount > 0 ? `<span class="text-sm">${task.downstreamCount} 个</span>` : (task.status === 'APPROVED' ? '<span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-700">未创建</span>' : '<span class="text-muted-foreground">-</span>')}</td>
      <td class="px-3 py-3">
        ${task.riskFlags.length > 0 ? task.riskFlags.map((f) => `<span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-700 mr-1">${f}</span>`).join('') : '<span class="text-muted-foreground">-</span>'}
      </td>
      <td class="px-3 py-3 text-sm text-muted-foreground">${task.updatedAt}</td>
      <td class="px-3 py-3">
        <div class="flex items-center justify-end gap-1">
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-revision-action="view-detail" data-task-id="${task.id}">查看</button>
          <button class="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-muted" data-revision-action="open-menu" data-task-id="${task.id}">
            <i data-lucide="more-horizontal" class="h-4 w-4"></i>
          </button>
        </div>
      </td>
    </tr>
  `
}

function renderDetailDrawer() {
  if (!state.detailOpen) return ''
  const task = mockTaskDetail
  const statusCfg = STATUS_MAP[task.status] || { label: task.status, color: 'bg-gray-100' }

  return `
    <div class="fixed inset-0 z-50 flex justify-end">
      <div class="absolute inset-0 bg-black/45" data-revision-action="close-detail"></div>
      <div class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[480px] overflow-y-auto animate-in slide-in-from-right duration-200">
        <div class="sticky top-0 bg-background border-b px-6 py-4 z-10">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-lg font-semibold">${task.code}</span>
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusCfg.color}">${statusCfg.label}</span>
              </div>
              <div class="text-sm text-muted-foreground mt-1 truncate max-w-[500px]">${escapeHtml(task.title)}</div>
            </div>
            <button class="p-1 hover:bg-accent rounded" data-revision-action="close-detail">
              <i data-lucide="x" class="h-5 w-5"></i>
            </button>
          </div>
          <!-- Tabs -->
          <div class="flex gap-1 mt-4 border-b -mb-px">
            <button class="px-4 py-2 text-sm ${state.activeTab === 'plan' ? 'border-b-2 border-primary text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}" data-revision-action="set-tab" data-tab="plan">改版方案</button>
            <button class="px-4 py-2 text-sm ${state.activeTab === 'samples' ? 'border-b-2 border-primary text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}" data-revision-action="set-tab" data-tab="samples">样衣(${task.relatedSamples.length})</button>
            <button class="px-4 py-2 text-sm ${state.activeTab === 'output' ? 'border-b-2 border-primary text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}" data-revision-action="set-tab" data-tab="output">产出物</button>
            <button class="px-4 py-2 text-sm ${state.activeTab === 'log' ? 'border-b-2 border-primary text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}" data-revision-action="set-tab" data-tab="log">日志</button>
          </div>
        </div>

        <div class="px-6 py-4 space-y-6">
          ${state.activeTab === 'plan' ? `
            <!-- 改版目标 -->
            <div>
              <h3 class="font-semibold mb-2 flex items-center gap-2"><i data-lucide="target" class="h-4 w-4"></i>改版目标</h3>
              <div class="bg-muted/50 p-3 rounded text-sm">${escapeHtml(task.revisionGoal)}</div>
            </div>
            <!-- 改版范围 -->
            <div>
              <h3 class="font-semibold mb-2">改版范围</h3>
              <div class="flex flex-wrap gap-2">
                ${task.revisionScope.map((s) => `<span class="inline-flex rounded-full px-3 py-1 text-sm border">${getScopeLabel(s)}</span>`).join('')}
              </div>
            </div>
            <!-- 约束 -->
            <div>
              <h3 class="font-semibold mb-2">约束条件</h3>
              <div class="grid grid-cols-3 gap-3 text-sm">
                <div class="rounded-lg border p-3"><div class="text-muted-foreground">成本上限</div><div class="font-medium">¥${task.constraints.maxCost}</div></div>
                <div class="rounded-lg border p-3"><div class="text-muted-foreground">交期上限</div><div class="font-medium">${task.constraints.maxDeliveryDays}天</div></div>
                <div class="rounded-lg border p-3"><div class="text-muted-foreground">不可变更</div><div class="font-medium">${task.constraints.unchangeable.join('、')}</div></div>
              </div>
            </div>
            <!-- 问题点 -->
            <div>
              <h3 class="font-semibold mb-2">问题点列表</h3>
              <div class="space-y-2">
                ${task.issues.map((issue) => `
                  <div class="rounded-lg border p-3">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-muted">${issue.source}</span>
                      <span class="inline-flex rounded-full px-2 py-0.5 text-xs border">${issue.category}</span>
                      <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${issue.severity === '严重' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">${issue.severity}</span>
                    </div>
                    <div class="text-sm">${escapeHtml(issue.description)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
            <!-- 改版清单 -->
            <div>
              <h3 class="font-semibold mb-2">改版清单</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-sm border">
                  <thead><tr class="bg-muted/50"><th class="px-3 py-2 text-left">分类</th><th class="px-3 py-2 text-left">变更点</th><th class="px-3 py-2 text-left">改前</th><th class="px-3 py-2 text-left">改后</th><th class="px-3 py-2 text-left">原因</th><th class="px-3 py-2 text-left">风险</th></tr></thead>
                  <tbody>
                    ${task.changeList.map((c) => `<tr class="border-t"><td class="px-3 py-2">${c.category}</td><td class="px-3 py-2 font-medium">${escapeHtml(c.changePoint)}</td><td class="px-3 py-2 text-muted-foreground">${escapeHtml(c.before)}</td><td class="px-3 py-2">${escapeHtml(c.after)}</td><td class="px-3 py-2 text-muted-foreground">${escapeHtml(c.reason)}</td><td class="px-3 py-2"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${c.risk === '中' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}">${c.risk}</span></td></tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <!-- 验收标准 -->
            <div>
              <h3 class="font-semibold mb-2">验收标准</h3>
              <div class="space-y-2">
                ${task.acceptanceCriteria.map((ac) => `
                  <div class="flex items-center gap-2 text-sm">
                    <input type="checkbox" class="h-4 w-4 rounded border" ${ac.checked ? 'checked' : ''} />
                    <span>${escapeHtml(ac.content)}</span>
                    ${ac.required ? '<span class="text-red-500">*</span>' : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${state.activeTab === 'samples' ? `
            <div>
              <h3 class="font-semibold mb-3">关联样衣</h3>
              <div class="space-y-2">
                ${task.relatedSamples.map((s) => `
                  <div class="rounded-lg border p-3 flex items-center gap-4">
                    <div class="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                      <i data-lucide="shirt" class="h-6 w-6 text-muted-foreground"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium">${s.code}</div>
                      <div class="text-sm text-muted-foreground">${escapeHtml(s.name)}</div>
                    </div>
                    <div class="text-sm text-right">
                      <div>${s.site} · ${s.location}</div>
                      <div class="text-muted-foreground">保管：${s.keeper}</div>
                    </div>
                    <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${s.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${s.status}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${state.activeTab === 'output' ? `
            <div>
              <h3 class="font-semibold mb-3">产出物</h3>
              <div class="text-sm text-muted-foreground mb-4">
                ${task.revisionVersion ? `<span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-blue-100 text-blue-700 mr-2">${task.revisionVersion}</span>已冻结` : '暂未冻结版本'}
              </div>
              <div class="rounded-lg border p-3 flex items-center gap-3">
                <i data-lucide="file-text" class="h-5 w-5 text-muted-foreground"></i>
                <div class="flex-1">
                  <div class="text-sm font-medium">改版清单-草稿.xlsx</div>
                  <div class="text-xs text-muted-foreground">2026-01-09 14:00 · 李版师</div>
                </div>
                <button class="inline-flex h-8 items-center rounded-md border px-2 text-sm hover:bg-muted">下载</button>
              </div>
            </div>
          ` : ''}

          ${state.activeTab === 'log' ? `
            <div>
              <h3 class="font-semibold mb-3">操作日志</h3>
              <div class="space-y-3">
                ${task.logs.map((log) => `
                  <div class="flex gap-3 text-sm">
                    <div class="w-[130px] text-muted-foreground shrink-0">${log.time}</div>
                    <div class="flex-1">
                      <span class="font-medium">${log.action}</span>
                      <span class="text-muted-foreground ml-2">by ${escapeHtml(log.user)}</span>
                      ${log.detail ? `<div class="text-muted-foreground mt-0.5">${escapeHtml(log.detail)}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Footer Actions -->
        <div class="sticky bottom-0 bg-background border-t px-6 py-4 flex items-center gap-2">
          ${task.status === 'IN_PROGRESS' ? `<button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-revision-action="submit-review">提交评审</button>` : ''}
          ${task.status === 'PENDING_REVIEW' ? `
            <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-revision-action="open-approve-dialog">通过冻结</button>
            <button class="inline-flex h-9 items-center rounded-md bg-rose-600 px-4 text-sm text-white hover:bg-rose-700" data-revision-action="open-reject-dialog">驳回</button>
          ` : ''}
          ${task.status === 'APPROVED' ? `
            <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-revision-action="open-downstream-dialog">创建下游任务</button>
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-revision-action="complete">完成任务</button>
          ` : ''}
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-revision-action="close-detail">关闭</button>
        </div>
      </div>
    </div>
  `
}

function renderRevisionCreateDownstreamDialog() {
  if (!state.createDownstreamOpen) return ''

  const formContent = `
    <div class="space-y-2">
      ${DOWNSTREAM_TASK_TYPES.map((t) => `
        <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${state.downstreamSelections.includes(t.value) ? 'border-primary bg-primary/5' : ''}">
          <input type="checkbox" class="h-4 w-4 rounded border" ${state.downstreamSelections.includes(t.value) ? 'checked' : ''} data-revision-action="toggle-downstream" data-type="${t.value}" />
          <span class="font-medium">${t.label}</span>
        </label>
      `).join('')}
    </div>
  `

  return uiFormDialog(
    {
      title: '创建下游任务',
      description: '根据改版清单推荐，请选择需要创建的下游任务类型：',
      closeAction: { prefix: 'revision', action: 'close-downstream-dialog' },
      width: 'sm',
      submitAction: { prefix: 'revision', action: 'confirm-downstream', label: '确认创建' },
      cancelLabel: '取消',
    },
    formContent
  )
}

function renderRevisionApproveDialog() {
  if (!state.approveDialogOpen) return ''

  return uiConfirmDialog(
    {
      title: '确认冻结版本',
      description: '冻结后改版方案将锁定为正式版本，可基于此创建下游打版/打样任务。',
      closeAction: { prefix: 'revision', action: 'close-approve-dialog' },
      confirmAction: { prefix: 'revision', action: 'confirm-approve', label: '确认冻结' },
      cancelLabel: '取消',
    }
  )
}

function renderRevisionRejectDialog() {
  if (!state.rejectDialogOpen) return ''

  const formContent = `
    <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px]" placeholder="请输入驳回原因..." data-revision-field="reject-reason">${escapeHtml(state.rejectReason)}</textarea>
  `

  return uiFormDialog(
    {
      title: '驳回改版方案',
      description: '请填写驳回原因',
      closeAction: { prefix: 'revision', action: 'close-reject-dialog' },
      width: 'sm',
      submitAction: { prefix: 'revision', action: 'confirm-reject', label: '确认驳回' },
      cancelLabel: '取消',
    },
    formContent
  )
}

function renderPage(): string {
  const filtered = getFilteredTasks()
  const stats = getStats()

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">改版任务</h1>
          <p class="mt-1 text-sm text-muted-foreground">基于测款反馈/样衣评审/既有商品问题点，输出改版方案与改版包</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-revision-action="open-create">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>新建改版任务
        </button>
      </header>

      <!-- Filter -->
      <section class="rounded-lg border bg-card p-4">
        <div class="flex items-center gap-4 flex-wrap">
          <div class="relative flex-1 min-w-[200px] max-w-sm">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="任务编号/标题/项目/款号" value="${escapeHtml(state.search)}" data-revision-field="search" />
          </div>
          <select class="h-9 rounded-md border bg-background px-3 text-sm w-28" data-revision-field="statusFilter">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            ${Object.entries(STATUS_MAP).map(([k, v]) => `<option value="${k}" ${state.statusFilter === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm w-28" data-revision-field="ownerFilter">
            <option value="all" ${state.ownerFilter === 'all' ? 'selected' : ''}>全部</option>
            <option value="mine" ${state.ownerFilter === 'mine' ? 'selected' : ''}>我负责的</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm w-36" data-revision-field="sourceFilter">
            <option value="all" ${state.sourceFilter === 'all' ? 'selected' : ''}>全部来源</option>
            ${Object.entries(SOURCE_TYPE_MAP).map(([k, v]) => `<option value="${k}" ${state.sourceFilter === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-revision-action="reset-filters">重置</button>
          <button class="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted" data-revision-action="refresh">
            <i data-lucide="refresh-cw" class="h-4 w-4"></i>
          </button>
        </div>
      </section>

      <!-- KPI Buttons -->
      <section class="flex items-center gap-2 flex-wrap">
        <button class="inline-flex h-8 items-center rounded-md ${state.quickFilter === null && state.statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'border'} px-3 text-sm" data-revision-action="quick-filter" data-filter="">全部 (${stats.total})</button>
        <button class="inline-flex h-8 items-center rounded-md ${state.quickFilter === 'mine' ? 'bg-primary text-primary-foreground' : 'border'} px-3 text-sm" data-revision-action="quick-filter" data-filter="mine">我的 (${stats.mine})</button>
        <button class="inline-flex h-8 items-center rounded-md ${state.quickFilter === 'pendingReview' ? 'bg-primary text-primary-foreground' : 'border text-yellow-600 border-yellow-300'} px-3 text-sm" data-revision-action="quick-filter" data-filter="pendingReview">待评审 (${stats.pendingReview})</button>
        <button class="inline-flex h-8 items-center rounded-md ${state.quickFilter === 'frozenNoDownstream' ? 'bg-primary text-primary-foreground' : 'border text-orange-600 border-orange-300'} px-3 text-sm" data-revision-action="quick-filter" data-filter="frozenNoDownstream">已冻结未建下游 (${stats.frozenNoDownstream})</button>
        <button class="inline-flex h-8 items-center rounded-md ${state.quickFilter === 'blocked' ? 'bg-primary text-primary-foreground' : 'border text-red-600 border-red-300'} px-3 text-sm" data-revision-action="quick-filter" data-filter="blocked">阻塞 (${stats.blocked})</button>
        <button class="inline-flex h-8 items-center rounded-md ${state.quickFilter === 'overdue' ? 'bg-primary text-primary-foreground' : 'border text-red-600 border-red-300'} px-3 text-sm" data-revision-action="quick-filter" data-filter="overdue">超期 (${stats.overdue})</button>
      </section>

      <!-- Table -->
      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1400px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium min-w-[280px]">任务</th>
                <th class="px-3 py-2 font-medium w-24">状态</th>
                <th class="px-3 py-2 font-medium w-[140px]">项目</th>
                <th class="px-3 py-2 font-medium w-28">来源</th>
                <th class="px-3 py-2 font-medium w-[100px]">商品</th>
                <th class="px-3 py-2 font-medium w-[160px]">改版范围</th>
                <th class="px-3 py-2 font-medium w-[100px]">样衣</th>
                <th class="px-3 py-2 font-medium w-20">负责人</th>
                <th class="px-3 py-2 font-medium w-24">截止时间</th>
                <th class="px-3 py-2 font-medium w-20">冻结版本</th>
                <th class="px-3 py-2 font-medium w-24">下游任务</th>
                <th class="px-3 py-2 font-medium w-[100px]">风险</th>
                <th class="px-3 py-2 font-medium w-[140px]">最近更新</th>
                <th class="px-3 py-2 font-medium w-[100px] text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length > 0 ? filtered.map(renderTaskRow).join('') : '<tr><td colspan="14" class="px-4 py-12 text-center text-muted-foreground"><i data-lucide="file-text" class="mx-auto h-10 w-10 text-muted-foreground/60"></i><p class="mt-2">无符合条件的任务</p></td></tr>'}
            </tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
          <p class="text-xs text-muted-foreground">共 ${filtered.length} 条</p>
        </footer>
      </section>
    </div>

    ${renderDetailDrawer()}
    ${renderRevisionCreateDownstreamDialog()}
    ${renderRevisionApproveDialog()}
    ${renderRevisionRejectDialog()}
  `
}

// ============ 事件处理 ============

export function handleRevisionTaskEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-revision-action]')
  const action = actionNode?.dataset.revisionAction

  if (action === 'view-detail') {
    const taskId = actionNode?.dataset.taskId
    if (taskId) { state.selectedTaskId = taskId; state.detailOpen = true; state.activeTab = 'plan'; return true }
  }

  if (action === 'close-detail') { state.detailOpen = false; return true }

  if (action === 'set-tab') {
    const tab = actionNode?.dataset.tab
    if (tab) { state.activeTab = tab; return true }
  }

  if (action === 'quick-filter') {
    const filter = actionNode?.dataset.filter
    state.quickFilter = filter || null
    state.statusFilter = 'all'
    state.ownerFilter = 'all'
    return true
  }

  if (action === 'reset-filters') {
    state.search = ''; state.statusFilter = 'all'; state.ownerFilter = 'all'
    state.sourceFilter = 'all'; state.siteFilter = 'all'; state.quickFilter = null
    return true
  }

  if (action === 'open-create') { state.createOpen = true; return true }
  if (action === 'close-create') { state.createOpen = false; return true }

  if (action === 'open-downstream-dialog') {
    const recommended = new Set<string>()
    mockTaskDetail.changeList.forEach((item) => item.recommendedDownstream.forEach((d) => recommended.add(d)))
    state.downstreamSelections = Array.from(recommended)
    state.createDownstreamOpen = true
    return true
  }
  if (action === 'close-downstream-dialog') { state.createDownstreamOpen = false; return true }
  if (action === 'toggle-downstream') {
    const type = actionNode?.dataset.type
    if (type) {
      if (state.downstreamSelections.includes(type)) {
        state.downstreamSelections = state.downstreamSelections.filter((t) => t !== type)
      } else {
        state.downstreamSelections = [...state.downstreamSelections, type]
      }
      return true
    }
  }
  if (action === 'confirm-downstream') {
    console.log('创建下游任务:', state.downstreamSelections)
    state.createDownstreamOpen = false
    return true
  }

  if (action === 'open-approve-dialog') { state.approveDialogOpen = true; return true }
  if (action === 'close-approve-dialog') { state.approveDialogOpen = false; return true }
  if (action === 'confirm-approve') { console.log('冻结通过'); state.approveDialogOpen = false; return true }

  if (action === 'open-reject-dialog') { state.rejectDialogOpen = true; return true }
  if (action === 'close-reject-dialog') { state.rejectDialogOpen = false; state.rejectReason = ''; return true }
  if (action === 'confirm-reject') { console.log('驳回:', state.rejectReason); state.rejectDialogOpen = false; state.rejectReason = ''; return true }

  if (action === 'submit-review') { console.log('提交评审'); return true }
  if (action === 'complete') { console.log('完成任务'); state.detailOpen = false; return true }
  if (action === 'refresh') { console.log('刷新'); return true }

  return false
}

export function handleRevisionTaskInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.revisionField
  if (!field) return false

  if (field === 'search') { state.search = (target as HTMLInputElement).value; return true }
  if (field === 'statusFilter') { state.statusFilter = (target as HTMLSelectElement).value; state.quickFilter = null; return true }
  if (field === 'ownerFilter') { state.ownerFilter = (target as HTMLSelectElement).value; state.quickFilter = null; return true }
  if (field === 'sourceFilter') { state.sourceFilter = (target as HTMLSelectElement).value; return true }
  if (field === 'reject-reason') { state.rejectReason = (target as HTMLTextAreaElement).value; return true }

  return false
}

export function isRevisionTaskDialogOpen(): boolean {
  return state.detailOpen || state.createOpen || state.createDownstreamOpen || state.approveDialogOpen || state.rejectDialogOpen
}

export function renderRevisionTaskPage(): string {
  return renderPage()
}
