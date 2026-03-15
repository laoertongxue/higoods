import { escapeHtml } from '../utils'
import { renderDetailDrawer as uiDetailDrawer } from '../components/ui'

// ============ 常量定义 ============

const STATUS_COLORS: Record<string, string> = {
  '在库': 'bg-green-100 text-green-700',
  '预占': 'bg-blue-100 text-blue-700',
  '借出': 'bg-orange-100 text-orange-700',
  '在途': 'bg-purple-100 text-purple-700',
  '冻结': 'bg-red-100 text-red-700',
  '待处置': 'bg-gray-100 text-gray-700',
  '已退货': 'bg-gray-100 text-gray-500',
  '已处置': 'bg-gray-100 text-gray-500',
}

const RISK_COLORS: Record<string, string> = {
  '超期未归还': 'bg-red-500 text-white',
  '在途超时': 'bg-orange-500 text-white',
  '冻结': 'bg-red-100 text-red-700',
  '待处置': 'bg-gray-500 text-white',
}

// ============ Mock 数据 ============

interface Sample {
  id: string
  code: string
  name: string
  responsibleSite: string
  inventoryStatus: string
  availability: string
  availabilityReason: string | null
  locationType: string
  locationDisplay: string
  custodianDisplay: string | null
  expectedReturnAt: string | null
  eta: string | null
  riskFlags: string[]
  projectRef: string | null
  workItemRef: string | null
  lastEventTime: string
  lastEventType: string
}

const mockSamples: Sample[] = [
  { id: 'SA-2026-00001', code: 'SA-2026-00001', name: '印尼风格碎花连衣裙', responsibleSite: '深圳', inventoryStatus: '在库', availability: '可用', availabilityReason: null, locationType: 'warehouse', locationDisplay: '深圳仓-A区-01-03', custodianDisplay: null, expectedReturnAt: null, eta: null, riskFlags: [], projectRef: 'PRJ-20260116-001', workItemRef: 'WI-立项-001', lastEventTime: '2026-01-08 14:30:00', lastEventType: '入库' },
  { id: 'SA-2026-00002', code: 'SA-2026-00002', name: '波西米亚风蓝色半裙', responsibleSite: '深圳', inventoryStatus: '预占', availability: '不可用', availabilityReason: '已被直播测款预占', locationType: 'warehouse', locationDisplay: '深圳仓-A区-02-05', custodianDisplay: null, expectedReturnAt: '2026-01-15', eta: null, riskFlags: [], projectRef: 'PRJ-20260116-002', workItemRef: 'WI-测款-002', lastEventTime: '2026-01-07 10:20:00', lastEventType: '预占' },
  { id: 'SA-2026-00003', code: 'SA-2026-00003', name: '基础款白色T恤', responsibleSite: '深圳', inventoryStatus: '借出', availability: '不可用', availabilityReason: '已借出给主播A', locationType: 'external', locationDisplay: '外部保管-主播A', custodianDisplay: '主播A（张丽）', expectedReturnAt: '2026-01-10', eta: null, riskFlags: ['超期未归还'], projectRef: 'PRJ-20260116-003', workItemRef: 'WI-直播-003', lastEventTime: '2026-01-05 09:00:00', lastEventType: '借出' },
  { id: 'SA-2026-00004', code: 'SA-2026-00004', name: '牛仔短裤夏季款', responsibleSite: '雅加达', inventoryStatus: '在途', availability: '不可用', availabilityReason: '在途中', locationType: 'in_transit', locationDisplay: '深圳→雅加达', custodianDisplay: null, expectedReturnAt: null, eta: '2026-01-12', riskFlags: ['在途超时'], projectRef: 'PRJ-20260116-004', workItemRef: null, lastEventTime: '2026-01-06 16:45:00', lastEventType: '发出' },
  { id: 'SA-2026-00005', code: 'SA-2026-00005', name: '米色针织开衫', responsibleSite: '深圳', inventoryStatus: '冻结', availability: '不可用', availabilityReason: '质量问题冻结', locationType: 'warehouse', locationDisplay: '深圳仓-B区-03-01', custodianDisplay: null, expectedReturnAt: null, eta: null, riskFlags: ['冻结'], projectRef: 'PRJ-20260116-005', workItemRef: 'WI-质检-005', lastEventTime: '2026-01-04 11:30:00', lastEventType: '冻结' },
  { id: 'SA-2026-00006', code: 'SA-2026-00006', name: '黑色西装外套', responsibleSite: '深圳', inventoryStatus: '待处置', availability: '不可用', availabilityReason: '待报废处置', locationType: 'warehouse', locationDisplay: '深圳仓-C区-待处置区', custodianDisplay: null, expectedReturnAt: null, eta: null, riskFlags: ['待处置'], projectRef: null, workItemRef: null, lastEventTime: '2026-01-03 14:00:00', lastEventType: '标记待处置' },
  { id: 'SA-2026-00007', code: 'SA-2026-00007', name: '灰色连帽卫衣', responsibleSite: '深圳', inventoryStatus: '在库', availability: '可用', availabilityReason: null, locationType: 'warehouse', locationDisplay: '深圳仓-A区-04-02', custodianDisplay: null, expectedReturnAt: null, eta: null, riskFlags: [], projectRef: 'PRJ-20260116-007', workItemRef: 'WI-拍摄-007', lastEventTime: '2026-01-08 09:15:00', lastEventType: '归还入库' },
  { id: 'SA-2026-00008', code: 'SA-2026-00008', name: '粉色雪纺上衣', responsibleSite: '雅加达', inventoryStatus: '在库', availability: '可用', availabilityReason: null, locationType: 'warehouse', locationDisplay: '雅加达仓-A区-01-01', custodianDisplay: null, expectedReturnAt: null, eta: null, riskFlags: [], projectRef: 'PRJ-20260116-008', workItemRef: null, lastEventTime: '2026-01-07 15:30:00', lastEventType: '入库' },
  { id: 'SA-2026-00009', code: 'SA-2026-00009', name: '条纹休闲衬衫', responsibleSite: '深圳', inventoryStatus: '借出', availability: '不可用', availabilityReason: '已借出给短视频团队', locationType: 'external', locationDisplay: '外部保管-短视频团队', custodianDisplay: '短视频团队（李明）', expectedReturnAt: '2026-01-20', eta: null, riskFlags: [], projectRef: 'PRJ-20260116-009', workItemRef: 'WI-短视频-009', lastEventTime: '2026-01-06 10:00:00', lastEventType: '借出' },
  { id: 'SA-2026-00010', code: 'SA-2026-00010', name: '格子呢大衣', responsibleSite: '深圳', inventoryStatus: '在途', availability: '不可用', availabilityReason: '在途中', locationType: 'in_transit', locationDisplay: '工厂→深圳', custodianDisplay: null, expectedReturnAt: null, eta: '2026-01-11', riskFlags: [], projectRef: 'PRJ-20260116-010', workItemRef: 'WI-打样-010', lastEventTime: '2026-01-08 08:00:00', lastEventType: '发出' },
  { id: 'SA-2026-00011', code: 'SA-2026-00011', name: '丝绸印花裙', responsibleSite: '深圳', inventoryStatus: '已退货', availability: '不可用', availabilityReason: '已退货', locationType: 'warehouse', locationDisplay: '深圳仓-退货区', custodianDisplay: null, expectedReturnAt: null, eta: null, riskFlags: [], projectRef: null, workItemRef: null, lastEventTime: '2026-01-02 16:00:00', lastEventType: '退货入库' },
  { id: 'SA-2026-00012', code: 'SA-2026-00012', name: '运动休闲套装', responsibleSite: '雅加达', inventoryStatus: '预占', availability: '不可用', availabilityReason: '已被直播场次预占', locationType: 'warehouse', locationDisplay: '雅加达仓-B区-02-03', custodianDisplay: null, expectedReturnAt: '2026-01-18', eta: null, riskFlags: [], projectRef: 'PRJ-20260116-012', workItemRef: 'WI-直播-012', lastEventTime: '2026-01-08 11:00:00', lastEventType: '预占' },
]

// ============ 状态管理 ============

interface SampleViewState {
  viewMode: 'card' | 'kanban' | 'list'
  keyword: string
  responsibleSite: string
  inventoryStatus: string
  availability: string
  locationType: string
  riskFilter: string
  batchMode: boolean
  selectedSampleIds: string[]
  sortBy: string
  detailOpen: boolean
  selectedSampleId: string | null
}

let state: SampleViewState = {
  viewMode: 'card',
  keyword: '',
  responsibleSite: '深圳',
  inventoryStatus: 'all',
  availability: 'all',
  locationType: 'all',
  riskFilter: 'all',
  batchMode: false,
  selectedSampleIds: [],
  sortBy: 'lastEventTime',
  detailOpen: false,
  selectedSampleId: null,
}

// ============ 工具函数 ============

function getFilteredSamples(): Sample[] {
  return mockSamples.filter((s) => {
    if (state.keyword) {
      const kw = state.keyword.toLowerCase()
      const match = s.code.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw) ||
        s.projectRef?.toLowerCase().includes(kw) || s.workItemRef?.toLowerCase().includes(kw) ||
        s.custodianDisplay?.toLowerCase().includes(kw)
      if (!match) return false
    }
    if (state.responsibleSite !== 'all' && s.responsibleSite !== state.responsibleSite) return false
    if (state.inventoryStatus !== 'all' && s.inventoryStatus !== state.inventoryStatus) return false
    if (state.availability !== 'all') {
      if (state.availability === '可用' && s.availability !== '可用') return false
      if (state.availability === '不可用' && s.availability !== '不可用') return false
    }
    if (state.locationType !== 'all' && s.locationType !== state.locationType) return false
    if (state.riskFilter !== 'all' && !s.riskFlags.includes(state.riskFilter)) return false
    return true
  })
}

function getSortedSamples(): Sample[] {
  const filtered = getFilteredSamples()
  return [...filtered].sort((a, b) => {
    if (state.sortBy === 'lastEventTime') {
      return new Date(b.lastEventTime).getTime() - new Date(a.lastEventTime).getTime()
    }
    if (state.sortBy === 'expectedReturnAt') {
      const aDate = a.expectedReturnAt || a.eta || '9999-12-31'
      const bDate = b.expectedReturnAt || b.eta || '9999-12-31'
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    }
    if (state.sortBy === 'riskFirst') {
      return b.riskFlags.length - a.riskFlags.length
    }
    return 0
  })
}

function getKpiStats() {
  const all = mockSamples.filter((s) => state.responsibleSite === 'all' || s.responsibleSite === state.responsibleSite)
  return {
    total: all.length,
    available: all.filter((s) => s.availability === '可用').length,
    inStock: all.filter((s) => s.inventoryStatus === '在库').length,
    reserved: all.filter((s) => s.inventoryStatus === '预占').length,
    borrowed: all.filter((s) => s.inventoryStatus === '借出').length,
    inTransit: all.filter((s) => s.inventoryStatus === '在途').length,
    frozen: all.filter((s) => s.inventoryStatus === '冻结' || s.inventoryStatus === '待处置').length,
    overdue: all.filter((s) => s.riskFlags.includes('超期未归还')).length,
  }
}

function getKanbanGroups() {
  const sorted = getSortedSamples()
  const groups: Record<string, Sample[]> = { '在库（可用）': [], '预占': [], '借出': [], '在途': [], '冻结/待处置': [] }
  sorted.forEach((s) => {
    if (s.inventoryStatus === '在库' && s.availability === '可用') groups['在库（可用）'].push(s)
    else if (s.inventoryStatus === '预占') groups['预占'].push(s)
    else if (s.inventoryStatus === '借出') groups['借出'].push(s)
    else if (s.inventoryStatus === '在途') groups['在途'].push(s)
    else if (s.inventoryStatus === '冻结' || s.inventoryStatus === '待处置') groups['冻结/待处置'].push(s)
  })
  return groups
}

function getSelectedSample(): Sample | undefined {
  if (!state.selectedSampleId) return undefined
  return mockSamples.find((s) => s.id === state.selectedSampleId)
}

// ============ 渲染函数 ============

function renderKpiCard(label: string, value: number, filterAction: string, highlight = false) {
  return `
    <button class="rounded-lg border bg-card p-3 text-center transition hover:shadow-md ${highlight && value > 0 ? 'border-red-300 bg-red-50' : ''}"
      data-view-action="${filterAction}">
      <div class="text-2xl font-bold ${highlight && value > 0 ? 'text-red-600' : ''}">${value}</div>
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
    </button>
  `
}

function renderSampleCard(sample: Sample) {
  const statusColor = STATUS_COLORS[sample.inventoryStatus] || 'bg-gray-100 text-gray-700'
  const hasRisk = sample.riskFlags.length > 0
  const riskColor = hasRisk ? RISK_COLORS[sample.riskFlags[0]] || '' : ''

  return `
    <div class="rounded-lg border bg-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer relative"
      data-view-action="open-detail" data-sample-id="${sample.id}">
      ${state.batchMode ? `
        <div class="absolute top-2 left-2 z-10" data-view-action="toggle-select" data-sample-id="${sample.id}">
          <input type="checkbox" class="h-4 w-4 rounded border" ${state.selectedSampleIds.includes(sample.id) ? 'checked' : ''} />
        </div>
      ` : ''}
      <div class="absolute top-2 right-2 z-10">
        <button class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/80 hover:bg-white" data-view-action="open-menu" data-sample-id="${sample.id}">
          <i data-lucide="more-horizontal" class="h-4 w-4"></i>
        </button>
      </div>
      <!-- 主图 -->
      <div class="aspect-square bg-muted relative flex items-center justify-center">
        <i data-lucide="image" class="h-16 w-16 text-muted-foreground/40"></i>
        ${hasRisk ? `
          <div class="absolute bottom-2 right-2">
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs ${riskColor}">
              <i data-lucide="alert-triangle" class="h-3 w-3 mr-1"></i>${sample.riskFlags[0]}
            </span>
          </div>
        ` : ''}
      </div>
      <div class="p-3">
        <div class="flex items-center gap-1 mb-1">
          <span class="text-xs font-mono text-muted-foreground">${sample.code}</span>
          <button class="p-0.5 hover:bg-muted rounded" data-view-action="copy-code" data-code="${sample.code}">
            <i data-lucide="copy" class="h-3 w-3 text-muted-foreground"></i>
          </button>
        </div>
        <div class="font-medium text-sm truncate mb-2">${escapeHtml(sample.name)}</div>
        <div class="flex flex-wrap gap-1 mb-2">
          <span class="inline-flex rounded-full px-2 py-0.5 text-xs border ${statusColor}">${sample.inventoryStatus}</span>
          <span class="inline-flex rounded-full px-2 py-0.5 text-xs border ${sample.availability === '可用' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}">${sample.availability}</span>
          <span class="inline-flex rounded-full px-2 py-0.5 text-xs border">${sample.responsibleSite}</span>
        </div>
        <div class="text-xs text-muted-foreground space-y-1">
          <div class="flex items-center gap-1">
            <i data-lucide="map-pin" class="h-3 w-3"></i>
            <span class="truncate">${escapeHtml(sample.locationDisplay)}</span>
          </div>
          ${(sample.expectedReturnAt || sample.eta) ? `
            <div class="flex items-center gap-1">
              <i data-lucide="clock" class="h-3 w-3"></i>
              <span class="${sample.riskFlags.includes('超期未归还') ? 'text-red-500' : ''}">${sample.expectedReturnAt ? `预计归还: ${sample.expectedReturnAt}` : `ETA: ${sample.eta}`}</span>
            </div>
          ` : ''}
        </div>
        ${(sample.projectRef || sample.workItemRef) ? `
          <div class="flex flex-wrap gap-1 mt-2 pt-2 border-t">
            ${sample.projectRef ? `<span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-muted">${sample.projectRef}</span>` : ''}
            ${sample.workItemRef ? `<span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-muted">${sample.workItemRef}</span>` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `
}

function renderKanbanView() {
  const groups = getKanbanGroups()
  return `
    <div class="flex gap-4 overflow-x-auto pb-4">
      ${Object.entries(groups).map(([status, samples]) => `
        <div class="flex-shrink-0 w-[280px]">
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="flex items-center justify-between mb-3">
              <span class="font-medium text-sm">${status}</span>
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-muted">${samples.length}</span>
            </div>
            <div class="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
              ${samples.length > 0 ? samples.map((s) => `
                <div class="rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md transition-shadow" data-view-action="open-detail" data-sample-id="${s.id}">
                  <div class="flex gap-3">
                    <div class="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                      <i data-lucide="image" class="h-6 w-6 text-muted-foreground/40"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-mono text-muted-foreground">${s.code}</div>
                      <div class="text-sm font-medium truncate">${escapeHtml(s.name)}</div>
                      <div class="text-xs text-muted-foreground truncate mt-1">${escapeHtml(s.locationDisplay)}</div>
                      ${s.riskFlags.length > 0 ? `<span class="inline-flex rounded-full px-2 py-0.5 text-xs mt-1 ${RISK_COLORS[s.riskFlags[0]] || ''}">${s.riskFlags[0]}</span>` : ''}
                    </div>
                  </div>
                </div>
              `).join('') : '<div class="text-center text-sm text-muted-foreground py-8">暂无数据</div>'}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

function renderListView() {
  const sorted = getSortedSamples()
  return `
    <div class="rounded-lg border bg-card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1100px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              ${state.batchMode ? '<th class="px-3 py-2 w-10"></th>' : ''}
              <th class="px-3 py-2 font-medium">样衣</th>
              <th class="px-3 py-2 font-medium">库存状态</th>
              <th class="px-3 py-2 font-medium">可用性</th>
              <th class="px-3 py-2 font-medium">责任站点</th>
              <th class="px-3 py-2 font-medium">当前位置</th>
              <th class="px-3 py-2 font-medium">预计归还/ETA</th>
              <th class="px-3 py-2 font-medium">风险</th>
              <th class="px-3 py-2 font-medium">关联项目</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.length > 0 ? sorted.map((s) => `
              <tr class="border-b last:border-b-0 hover:bg-muted/40 cursor-pointer" data-view-action="open-detail" data-sample-id="${s.id}">
                ${state.batchMode ? `
                  <td class="px-3 py-3" data-view-action="toggle-select" data-sample-id="${s.id}">
                    <input type="checkbox" class="h-4 w-4 rounded border" ${state.selectedSampleIds.includes(s.id) ? 'checked' : ''} />
                  </td>
                ` : ''}
                <td class="px-3 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                      <i data-lucide="image" class="h-5 w-5 text-muted-foreground/40"></i>
                    </div>
                    <div>
                      <div class="text-xs font-mono text-muted-foreground">${s.code}</div>
                      <div class="text-sm font-medium truncate max-w-[120px]">${escapeHtml(s.name)}</div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs border ${STATUS_COLORS[s.inventoryStatus] || ''}">${s.inventoryStatus}</span></td>
                <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs border ${s.availability === '可用' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}">${s.availability}</span></td>
                <td class="px-3 py-3">${s.responsibleSite}</td>
                <td class="px-3 py-3 max-w-[150px] truncate">${escapeHtml(s.locationDisplay)}</td>
                <td class="px-3 py-3 ${s.riskFlags.includes('超期未归还') ? 'text-red-500' : ''}">${s.expectedReturnAt || s.eta || '-'}</td>
                <td class="px-3 py-3">${s.riskFlags.length > 0 ? `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${RISK_COLORS[s.riskFlags[0]] || ''}">${s.riskFlags[0]}</span>` : '-'}</td>
                <td class="px-3 py-3">
                  <div class="text-xs">
                    ${s.projectRef ? `<div>${s.projectRef}</div>` : ''}
                    ${s.workItemRef ? `<div class="text-muted-foreground">${s.workItemRef}</div>` : ''}
                    ${!s.projectRef && !s.workItemRef ? '-' : ''}
                  </div>
                </td>
                <td class="px-3 py-3">
                  <div class="flex items-center gap-1">
                    <button class="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-muted" data-view-action="open-detail" data-sample-id="${s.id}"><i data-lucide="eye" class="h-3.5 w-3.5"></i></button>
                    ${s.availability === '可用' ? `<button class="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-muted" data-view-action="apply-sample" data-sample-id="${s.id}"><i data-lucide="send" class="h-3.5 w-3.5"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="10" class="px-4 py-12 text-center text-muted-foreground">无匹配数据</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderSampleDetailDrawer() {
  if (!state.detailOpen) return ''
  const sample = getSelectedSample()
  if (!sample) return ''

  const statusColor = STATUS_COLORS[sample.inventoryStatus] || 'bg-gray-100 text-gray-700'
  const hasOverdue = sample.riskFlags.includes('超期未归还')
  const hasTransitDelay = sample.riskFlags.includes('在途超时')

  const content = `
    <div class="space-y-6">
      <!-- 主图 -->
      <div class="aspect-[4/5] bg-muted rounded-lg flex items-center justify-center">
        <i data-lucide="image" class="h-24 w-24 text-muted-foreground/30"></i>
      </div>

      <!-- 基本信息 -->
      <div>
        <div class="flex items-center gap-2 mb-2">
          <span class="font-mono text-sm">${sample.code}</span>
          <button class="p-1 hover:bg-muted rounded" data-view-action="copy-code" data-code="${sample.code}">
            <i data-lucide="copy" class="h-3 w-3"></i>
          </button>
        </div>
        <h3 class="text-lg font-semibold">${escapeHtml(sample.name)}</h3>
        <div class="flex flex-wrap gap-2 mt-2">
          <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusColor}">${sample.inventoryStatus}</span>
          <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${sample.availability === '可用' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${sample.availability}</span>
          <span class="inline-flex rounded-full px-2 py-0.5 text-xs border">${sample.responsibleSite}</span>
        </div>
      </div>

      <!-- 状态卡片 -->
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-lg border p-3">
          <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <i data-lucide="map-pin" class="h-4 w-4"></i>当前位置
          </div>
          <div class="font-medium">${escapeHtml(sample.locationDisplay)}</div>
        </div>
        ${sample.custodianDisplay ? `
          <div class="rounded-lg border p-3">
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <i data-lucide="user" class="h-4 w-4"></i>保管人
            </div>
            <div class="font-medium">${escapeHtml(sample.custodianDisplay)}</div>
          </div>
        ` : ''}
        ${sample.expectedReturnAt ? `
          <div class="rounded-lg border p-3 ${hasOverdue ? 'border-red-300 bg-red-50' : ''}">
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <i data-lucide="calendar" class="h-4 w-4"></i>预计归还
            </div>
            <div class="font-medium ${hasOverdue ? 'text-red-600' : ''}">${sample.expectedReturnAt}</div>
          </div>
        ` : ''}
        ${sample.eta ? `
          <div class="rounded-lg border p-3 ${hasTransitDelay ? 'border-orange-300 bg-orange-50' : ''}">
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <i data-lucide="truck" class="h-4 w-4"></i>预计到达
            </div>
            <div class="font-medium ${hasTransitDelay ? 'text-orange-600' : ''}">${sample.eta}</div>
          </div>
        ` : ''}
      </div>

      <!-- 风险提示 -->
      ${sample.riskFlags.length > 0 ? `
        <div class="rounded-lg border border-red-300 bg-red-50 p-3">
          <div class="flex items-center gap-2 text-red-600">
            <i data-lucide="alert-triangle" class="h-4 w-4"></i>
            <span class="font-medium">风险提示</span>
          </div>
          <div class="mt-2 flex flex-wrap gap-1">
            ${sample.riskFlags.map((r) => `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${RISK_COLORS[r] || ''}">${r}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 关联信息 -->
      ${(sample.projectRef || sample.workItemRef) ? `
        <div>
          <h4 class="font-medium mb-2">关联信息</h4>
          <div class="space-y-2 text-sm">
            ${sample.projectRef ? `<div class="flex items-center justify-between"><span class="text-muted-foreground">关联项目</span><button class="text-primary hover:underline" data-view-action="open-project">${sample.projectRef}</button></div>` : ''}
            ${sample.workItemRef ? `<div class="flex items-center justify-between"><span class="text-muted-foreground">关联工作项</span><span>${sample.workItemRef}</span></div>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- 最近事件 -->
      <div>
        <h4 class="font-medium mb-2">最近事件</h4>
        <div class="text-sm">
          <span class="text-muted-foreground">${sample.lastEventTime}</span>
          <span class="mx-2">·</span>
          <span>${sample.lastEventType}</span>
        </div>
      </div>
    </div>
  `

  const extraButtons = `
    ${sample.availability === '可用' ? `
      <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm text-white hover:bg-blue-700" data-view-action="apply-sample" data-sample-id="${sample.id}">
        <i data-lucide="send" class="mr-2 h-4 w-4"></i>发起使用申请
      </button>
    ` : ''}
    <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-view-action="view-ledger">
      <i data-lucide="file-text" class="mr-2 h-4 w-4"></i>查看台账
    </button>
    <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-view-action="view-inventory">
      <i data-lucide="package" class="mr-2 h-4 w-4"></i>打开库存
    </button>
  `

  return uiDetailDrawer(
    {
      title: '样衣详情',
      closeAction: { prefix: 'view', action: 'close-detail' },
      width: 'sm',
    },
    content,
    extraButtons
  )
}

function renderPage(): string {
  const sorted = getSortedSamples()
  const kpi = getKpiStats()

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">样衣视图</h1>
        <div class="inline-flex rounded-lg border bg-muted p-1">
          <button class="inline-flex h-8 items-center rounded-md px-3 text-sm ${state.viewMode === 'card' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}" data-view-action="set-view-mode" data-mode="card">
            <i data-lucide="layout-grid" class="mr-1.5 h-4 w-4"></i>卡片
          </button>
          <button class="inline-flex h-8 items-center rounded-md px-3 text-sm ${state.viewMode === 'kanban' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}" data-view-action="set-view-mode" data-mode="kanban">
            <i data-lucide="columns-3" class="mr-1.5 h-4 w-4"></i>看板
          </button>
          <button class="inline-flex h-8 items-center rounded-md px-3 text-sm ${state.viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}" data-view-action="set-view-mode" data-mode="list">
            <i data-lucide="list" class="mr-1.5 h-4 w-4"></i>列表
          </button>
        </div>
      </header>

      <!-- Filter Bar -->
      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="relative flex-1 min-w-[200px] max-w-[300px]">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="样衣编号/款号/项目/保管人" value="${escapeHtml(state.keyword)}" data-view-field="keyword" />
          </div>
          <select class="h-9 rounded-md border bg-background px-3 text-sm w-[120px]" data-view-field="responsibleSite">
            <option value="all" ${state.responsibleSite === 'all' ? 'selected' : ''}>全部站点</option>
            <option value="深圳" ${state.responsibleSite === '深圳' ? 'selected' : ''}>深圳</option>
            <option value="雅加达" ${state.responsibleSite === '雅加达' ? 'selected' : ''}>雅加达</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm w-[120px]" data-view-field="inventoryStatus">
            <option value="all" ${state.inventoryStatus === 'all' ? 'selected' : ''}>全部状态</option>
            <option value="在库" ${state.inventoryStatus === '在库' ? 'selected' : ''}>在库</option>
            <option value="预占" ${state.inventoryStatus === '预占' ? 'selected' : ''}>预占</option>
            <option value="借出" ${state.inventoryStatus === '借出' ? 'selected' : ''}>借出</option>
            <option value="在途" ${state.inventoryStatus === '在途' ? 'selected' : ''}>在途</option>
            <option value="冻结" ${state.inventoryStatus === '冻结' ? 'selected' : ''}>冻结</option>
            <option value="待处置" ${state.inventoryStatus === '待处置' ? 'selected' : ''}>待处置</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm w-[100px]" data-view-field="availability">
            <option value="all" ${state.availability === 'all' ? 'selected' : ''}>全部</option>
            <option value="可用" ${state.availability === '可用' ? 'selected' : ''}>可用</option>
            <option value="不可用" ${state.availability === '不可用' ? 'selected' : ''}>不可用</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm w-[130px]" data-view-field="riskFilter">
            <option value="all" ${state.riskFilter === 'all' ? 'selected' : ''}>全部</option>
            <option value="超期未归还" ${state.riskFilter === '超期未归还' ? 'selected' : ''}>超期未归还</option>
            <option value="在途超时" ${state.riskFilter === '在途超时' ? 'selected' : ''}>在途超时</option>
            <option value="冻结" ${state.riskFilter === '冻结' ? 'selected' : ''}>冻结</option>
            <option value="待处置" ${state.riskFilter === '待处置' ? 'selected' : ''}>待处置</option>
          </select>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-view-action="reset-filters">重置</button>
          <button class="inline-flex h-9 items-center justify-center rounded-md border w-9 hover:bg-muted" data-view-action="refresh">
            <i data-lucide="refresh-cw" class="h-4 w-4"></i>
          </button>
        </div>
      </section>

      <!-- KPI概览 -->
      <section class="grid grid-cols-8 gap-3">
        ${renderKpiCard('总样衣数', kpi.total, 'kpi-total')}
        ${renderKpiCard('可用', kpi.available, 'kpi-available')}
        ${renderKpiCard('在库', kpi.inStock, 'kpi-inStock')}
        ${renderKpiCard('预占', kpi.reserved, 'kpi-reserved')}
        ${renderKpiCard('借出', kpi.borrowed, 'kpi-borrowed')}
        ${renderKpiCard('在途', kpi.inTransit, 'kpi-inTransit')}
        ${renderKpiCard('冻结/待处置', kpi.frozen, 'kpi-frozen')}
        ${renderKpiCard('超期未归还', kpi.overdue, 'kpi-overdue', true)}
      </section>

      <!-- View Toolbar -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button class="inline-flex h-8 items-center rounded-md ${state.batchMode ? 'bg-primary text-primary-foreground' : 'border'} px-3 text-sm hover:bg-primary/90" data-view-action="toggle-batch">
            ${state.batchMode ? '取消批量' : '批量选择'}
          </button>
          ${state.batchMode && state.selectedSampleIds.length > 0 ? `
            <span class="text-sm text-muted-foreground">已选 ${state.selectedSampleIds.length} 件</span>
            <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm text-white hover:bg-blue-700" data-view-action="batch-apply">
              <i data-lucide="send" class="mr-1 h-4 w-4"></i>发起使用申请
            </button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-view-action="batch-export">
              <i data-lucide="download" class="mr-1 h-4 w-4"></i>导出
            </button>
          ` : ''}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">排序：</span>
          <select class="h-8 rounded-md border bg-background px-2 text-sm w-[140px]" data-view-field="sortBy">
            <option value="lastEventTime" ${state.sortBy === 'lastEventTime' ? 'selected' : ''}>最近变更</option>
            <option value="expectedReturnAt" ${state.sortBy === 'expectedReturnAt' ? 'selected' : ''}>预计归还时间</option>
            <option value="riskFirst" ${state.sortBy === 'riskFirst' ? 'selected' : ''}>风险优先</option>
          </select>
        </div>
      </div>

      <!-- Main View -->
      ${state.viewMode === 'card' ? `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${sorted.map(renderSampleCard).join('')}
        </div>
      ` : ''}
      ${state.viewMode === 'kanban' ? renderKanbanView() : ''}
      ${state.viewMode === 'list' ? renderListView() : ''}

      ${sorted.length === 0 ? `
        <div class="rounded-lg border bg-card p-12 text-center">
          <div class="text-muted-foreground">无匹配数据，请调整筛选条件</div>
          <button class="text-primary hover:underline mt-2" data-view-action="reset-filters">重置筛选</button>
        </div>
      ` : ''}
    </div>

    ${renderSampleDetailDrawer()}
  `
}

// ============ 事件处理 ============

export function handleSampleViewEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-view-action]')
  const action = actionNode?.dataset.viewAction

  if (action === 'set-view-mode') {
    const mode = actionNode?.dataset.mode as 'card' | 'kanban' | 'list'
    if (mode) {
      state.viewMode = mode
      return true
    }
  }

  if (action === 'open-detail') {
    const sampleId = actionNode?.dataset.sampleId
    if (sampleId) {
      state.selectedSampleId = sampleId
      state.detailOpen = true
      return true
    }
  }

  if (action === 'close-detail') {
    state.detailOpen = false
    return true
  }

  if (action === 'toggle-batch') {
    state.batchMode = !state.batchMode
    state.selectedSampleIds = []
    return true
  }

  if (action === 'toggle-select') {
    const sampleId = actionNode?.dataset.sampleId
    if (sampleId) {
      if (state.selectedSampleIds.includes(sampleId)) {
        state.selectedSampleIds = state.selectedSampleIds.filter((id) => id !== sampleId)
      } else {
        state.selectedSampleIds = [...state.selectedSampleIds, sampleId]
      }
      return true
    }
  }

  if (action === 'batch-apply') {
    console.log('批量申请:', state.selectedSampleIds)
    state.selectedSampleIds = []
    state.batchMode = false
    return true
  }

  if (action === 'copy-code') {
    const code = actionNode?.dataset.code
    if (code) {
      navigator.clipboard.writeText(code)
      console.log('已复制:', code)
    }
    return true
  }

  if (action === 'reset-filters') {
    state.keyword = ''
    state.responsibleSite = '深圳'
    state.inventoryStatus = 'all'
    state.availability = 'all'
    state.locationType = 'all'
    state.riskFilter = 'all'
    return true
  }

  if (action === 'refresh') {
    console.log('刷新')
    return true
  }

  // KPI 快捷筛选
  if (action === 'kpi-available') { state.availability = '可用'; return true }
  if (action === 'kpi-inStock') { state.inventoryStatus = '在库'; return true }
  if (action === 'kpi-reserved') { state.inventoryStatus = '预占'; return true }
  if (action === 'kpi-borrowed') { state.inventoryStatus = '借出'; return true }
  if (action === 'kpi-inTransit') { state.inventoryStatus = '在途'; return true }
  if (action === 'kpi-frozen') { state.inventoryStatus = '冻结'; return true }
  if (action === 'kpi-overdue') { state.riskFilter = '超期未归还'; return true }

  if (action === 'apply-sample' || action === 'view-ledger' || action === 'view-inventory' || action === 'batch-export') {
    console.log(action)
    return true
  }

  return false
}

export function handleSampleViewInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.viewField
  if (!field) return false

  if (field === 'keyword') { state.keyword = (target as HTMLInputElement).value; return true }
  if (field === 'responsibleSite') { state.responsibleSite = (target as HTMLSelectElement).value; return true }
  if (field === 'inventoryStatus') { state.inventoryStatus = (target as HTMLSelectElement).value; return true }
  if (field === 'availability') { state.availability = (target as HTMLSelectElement).value; return true }
  if (field === 'riskFilter') { state.riskFilter = (target as HTMLSelectElement).value; return true }
  if (field === 'sortBy') { state.sortBy = (target as HTMLSelectElement).value; return true }

  return false
}

export function isSampleViewDialogOpen(): boolean {
  return state.detailOpen
}

export function renderSampleViewPage(): string {
  return renderPage()
}
