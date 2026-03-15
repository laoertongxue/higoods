import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderDetailDrawer as uiDetailDrawer } from '../components/ui'

// ============ 类型定义 ============

interface Transit {
  from: string
  to: string
  carrier: string
  trackingNo: string
  eta: string
  transitSlaHours: number
  transitStartedAt: string
}

interface Anomaly {
  type: string
  level: string
  since: string
  note: string
}

interface RelatedWorkItem {
  name: string
  instanceId: string
}

interface Sample {
  sampleId: string
  sampleCode: string
  name: string
  category: string
  size: string
  color: string
  material: string
  templateType: string
  projectId: string | null
  projectName: string | null
  status: string
  currentLocation: string
  locationDetail: string
  occupancyType: '无' | '预占' | '占用'
  occupiedBy: string | null
  occupiedFor: string | null
  occupiedUntil: string | null
  inTransit: boolean
  transit: Transit | null
  anomalyFlag: boolean
  anomaly: Anomaly | null
  relatedWorkItem: RelatedWorkItem | null
  updatedAt: string
  updatedBy: string
}

interface LedgerEvent {
  eventId: string
  sampleCode: string
  time: string
  type: string
  summary: string
  by: string
}

// ============ Mock 数据生成 ============

function createMockSamples(): { samples: Sample[]; ledgerEvents: LedgerEvent[] } {
  const templates = ['基础款', '快时尚款', '改版款', '设计款']
  const locations = ['深圳仓', '摄影棚', '雅加达直播间', '在途']
  const projects = [
    { id: 'PRJ-20260110-001', name: '印尼风格碎花连衣裙', template: '基础款' },
    { id: 'PRJ-20260108-003', name: 'Y2K银色亮片短裙', template: '快时尚款' },
    { id: 'PRJ-20260112-005', name: '改版款短裙', template: '改版款' },
    { id: 'PRJ-20260105-008', name: '原创设计-立体花朵上衣', template: '设计款' },
  ]

  const samples: Sample[] = []
  const ledgerEvents: LedgerEvent[] = []

  for (let i = 1; i <= 65; i++) {
    const code = `SY-2026-${String(i).padStart(3, '0')}`
    const statusIndex = i % 8
    const locationIndex = i % 4
    const projectIndex = i % 5

    let status = '在库可用'
    let occupancyType: '无' | '预占' | '占用' = '无'
    let inTransit = false
    let anomalyFlag = false
    let transit: Transit | null = null
    let anomaly: Anomaly | null = null
    let occupiedBy: string | null = null
    let occupiedFor: string | null = null
    let occupiedUntil: string | null = null

    if (statusIndex === 0) {
      status = '在库可用'
    } else if (statusIndex === 1) {
      status = '预占锁定'
      occupancyType = '预占'
      occupiedBy = '李明'
      occupiedFor = '拍摄'
      occupiedUntil = '2026-01-20'
    } else if (statusIndex === 2) {
      status = '借出占用'
      occupancyType = '占用'
      occupiedBy = '王芳'
      occupiedFor = '直播'
      occupiedUntil = '2026-01-18'
    } else if (statusIndex === 3) {
      status = '在途待签收'
      inTransit = true
      const startDate = new Date()
      startDate.setHours(startDate.getHours() - (i % 3 === 0 ? 50 : 10))
      transit = {
        from: '深圳仓',
        to: '雅加达直播间',
        carrier: '顺丰国际',
        trackingNo: `SF${1000000000 + i}`,
        eta: '2026-01-19',
        transitSlaHours: 48,
        transitStartedAt: startDate.toISOString(),
      }
      if (i % 3 === 0) {
        anomalyFlag = true
        anomaly = {
          type: '在途超时',
          level: '高',
          since: startDate.toISOString(),
          note: '已超过SLA 48小时',
        }
      }
    } else if (statusIndex === 4) {
      status = '维修中'
      anomalyFlag = true
      anomaly = {
        type: '破损',
        level: '中',
        since: '2026-01-10T10:00:00Z',
        note: '拉链损坏，需要更换',
      }
    } else if (statusIndex === 5) {
      status = '待处置'
      anomalyFlag = true
      anomaly = {
        type: '质量问题',
        level: '高',
        since: '2026-01-08T15:00:00Z',
        note: '面料色差严重，待退货',
      }
    } else if (statusIndex === 6) {
      status = '借出占用'
      occupancyType = '占用'
      occupiedBy = '赵敏'
      occupiedFor = '试穿'
      occupiedUntil = '2026-01-15'
      anomalyFlag = true
      anomaly = {
        type: '归还超期',
        level: '中',
        since: '2026-01-15T00:00:00Z',
        note: '超期1天未归还',
      }
    } else {
      status = '已退货'
    }

    const project = projectIndex < 4 ? projects[projectIndex] : null

    samples.push({
      sampleId: `sample_${i}`,
      sampleCode: code,
      name: `${project?.name || '公共样衣'}${i > 50 ? '-副本' : ''}`,
      category: i % 2 === 0 ? '裙装' : '上衣',
      size: ['S', 'M', 'L', 'XL'][i % 4],
      color: ['红色', '蓝色', '白色', '黑色', '碎花'][i % 5],
      material: ['棉', '涤纶', '混纺', '丝绸'][i % 4],
      templateType: project?.template || templates[i % 4],
      projectId: project?.id || null,
      projectName: project?.name || null,
      status,
      currentLocation: inTransit ? '在途' : locations[locationIndex],
      locationDetail: inTransit ? '深圳→雅加达' : `${locations[locationIndex]}-A${(i % 10) + 1}区`,
      occupancyType,
      occupiedBy,
      occupiedFor,
      occupiedUntil,
      inTransit,
      transit,
      anomalyFlag,
      anomaly,
      relatedWorkItem: project
        ? { name: '到样样衣管理', instanceId: `wi_${i}` }
        : null,
      updatedAt: `2026-01-${String(15 + (i % 3)).padStart(2, '0')} ${String(10 + (i % 14)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
      updatedBy: ['张三', '李四', '王五', '赵六'][i % 4],
    })

    for (let j = 0; j < 3; j++) {
      ledgerEvents.push({
        eventId: `evt_${i}_${j}`,
        sampleCode: code,
        time: `2026-01-${String(10 + j).padStart(2, '0')} ${String(9 + j).padStart(2, '0')}:00`,
        type: ['入库', '出库', '在途', '签收', '借出', '归还'][j % 6],
        summary: `${['入库', '出库', '在途', '签收', '借出', '归还'][j % 6]}操作 - ${code}`,
        by: ['系统', '张三', '李四'][j % 3],
      })
    }
  }

  return { samples, ledgerEvents }
}

const mockData = createMockSamples()

// ============ 常量 ============

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: '在库可用', label: '在库可用' },
  { value: '预占锁定', label: '预占锁定' },
  { value: '借出占用', label: '借出占用' },
  { value: '在途待签收', label: '在途待签收' },
  { value: '维修中', label: '维修中' },
  { value: '待处置', label: '待处置' },
]

const LOCATION_OPTIONS = [
  { value: 'all', label: '全部位置' },
  { value: '深圳仓', label: '深圳仓' },
  { value: '摄影棚', label: '摄影棚' },
  { value: '雅加达直播间', label: '雅加达直播间' },
  { value: '在途', label: '在途' },
]

const TEMPLATE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: '基础款', label: '基础款' },
  { value: '快时尚款', label: '快时尚款' },
  { value: '改版款', label: '改版款' },
  { value: '设计款', label: '设计款' },
]

const STATUS_COLORS: Record<string, string> = {
  '在库可用': 'bg-emerald-100 text-emerald-800',
  '预占锁定': 'bg-purple-100 text-purple-800',
  '借出占用': 'bg-amber-100 text-amber-800',
  '在途待签收': 'bg-blue-100 text-blue-800',
  '维修中': 'bg-gray-100 text-gray-800',
  '待处置': 'bg-rose-100 text-rose-800',
  '已退货': 'bg-gray-100 text-gray-800',
}

// ============ 状态管理 ============

interface InventoryState {
  search: string
  statusFilter: string
  locationFilter: string
  templateFilter: string
  showAnomalyOnly: boolean
  showTransitOverdueOnly: boolean
  showTodayReturnOnly: boolean
  selectedSampleId: string | null
  drawerOpen: boolean
}

let state: InventoryState = {
  search: '',
  statusFilter: 'all',
  locationFilter: 'all',
  templateFilter: 'all',
  showAnomalyOnly: false,
  showTransitOverdueOnly: false,
  showTodayReturnOnly: false,
  selectedSampleId: null,
  drawerOpen: false,
}

// ============ 工具函数 ============

function getFilteredSamples(): Sample[] {
  return mockData.samples.filter((sample) => {
    if (state.search) {
      const term = state.search.toLowerCase()
      const matchesSearch =
        sample.sampleCode.toLowerCase().includes(term) ||
        sample.name.toLowerCase().includes(term) ||
        sample.projectName?.toLowerCase().includes(term) ||
        sample.transit?.trackingNo.toLowerCase().includes(term)
      if (!matchesSearch) return false
    }

    if (state.statusFilter !== 'all' && sample.status !== state.statusFilter) return false
    if (state.locationFilter !== 'all' && sample.currentLocation !== state.locationFilter) return false
    if (state.templateFilter !== 'all' && sample.templateType !== state.templateFilter) return false
    if (state.showAnomalyOnly && !sample.anomalyFlag) return false

    if (state.showTransitOverdueOnly) {
      if (!sample.inTransit || !sample.transit) return false
      const now = new Date()
      const started = new Date(sample.transit.transitStartedAt)
      const hoursElapsed = (now.getTime() - started.getTime()) / (1000 * 3600)
      if (hoursElapsed <= sample.transit.transitSlaHours) return false
    }

    if (state.showTodayReturnOnly) {
      if (sample.occupancyType !== '占用' || !sample.occupiedUntil) return false
      const today = new Date().toISOString().split('T')[0]
      if (sample.occupiedUntil !== today) return false
    }

    return true
  })
}

function getSummary() {
  const all = mockData.samples
  return {
    total: all.length,
    available: all.filter((s) => s.status === '在库可用').length,
    reserved: all.filter((s) => s.status === '预占锁定').length,
    occupied: all.filter((s) => s.status === '借出占用').length,
    inTransit: all.filter((s) => s.inTransit).length,
    anomaly: all.filter((s) => s.anomalyFlag).length,
  }
}

function getSelectedSample(): Sample | null {
  if (!state.selectedSampleId) return null
  return mockData.samples.find((s) => s.sampleId === state.selectedSampleId) || null
}

function getLedgerEvents(sampleCode: string): LedgerEvent[] {
  return mockData.ledgerEvents.filter((e) => e.sampleCode === sampleCode).slice(0, 8)
}

// ============ 渲染函数 ============

function renderKpiCard(
  label: string,
  value: number,
  icon: string,
  colorClass: string,
  action: string,
  actionValue?: string,
) {
  const isActive =
    (action === 'filter-status' && state.statusFilter === actionValue) ||
    (action === 'filter-anomaly' && state.showAnomalyOnly)
  return `
    <button class="rounded-lg border bg-card p-3 text-left transition hover:border-blue-300 ${isActive ? 'border-blue-300 bg-blue-50' : ''}" data-inventory-action="${action}" ${actionValue ? `data-filter-value="${actionValue}"` : ''}>
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center">
          <i data-lucide="${icon}" class="w-5 h-5"></i>
        </div>
        <div>
          <p class="text-xl font-semibold">${value}</p>
          <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
        </div>
      </div>
    </button>
  `
}

function renderSampleRow(sample: Sample) {
  const statusColor = STATUS_COLORS[sample.status] || 'bg-gray-100 text-gray-800'
  return `
    <tr class="border-b last:border-b-0 hover:bg-muted/40" data-inventory-action="view-detail" data-sample-id="${sample.sampleId}">
      <td class="px-3 py-3 align-top">
        <div class="font-medium text-blue-700">${escapeHtml(sample.sampleCode)}</div>
        <div class="text-xs text-muted-foreground flex items-center gap-2 mt-1">
          ${escapeHtml(sample.name)}
          <span class="inline-flex rounded-full px-2 py-0.5 text-xs border">${escapeHtml(sample.templateType)}</span>
        </div>
      </td>
      <td class="px-3 py-3 align-top text-xs">
        ${sample.projectName ? escapeHtml(sample.projectName) : '<span class="text-muted-foreground">公共样衣</span>'}
      </td>
      <td class="px-3 py-3 align-top">
        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusColor}">${escapeHtml(sample.status)}</span>
      </td>
      <td class="px-3 py-3 align-top">
        <div class="text-xs">${escapeHtml(sample.currentLocation)}</div>
        <div class="text-xs text-muted-foreground">${escapeHtml(sample.locationDetail)}</div>
      </td>
      <td class="px-3 py-3 align-top">
        ${sample.occupancyType !== '无'
    ? `<div class="text-xs"><div class="font-medium">${escapeHtml(sample.occupiedBy || '')}</div><div class="text-muted-foreground">${escapeHtml(sample.occupiedFor || '')} · 至 ${sample.occupiedUntil}</div></div>`
    : '<span class="text-muted-foreground text-xs">-</span>'}
      </td>
      <td class="px-3 py-3 align-top">
        ${sample.inTransit && sample.transit
    ? `<div class="text-xs"><div class="font-medium">${escapeHtml(sample.transit.trackingNo)}</div><div class="text-muted-foreground">ETA: ${sample.transit.eta}${sample.anomaly?.type === '在途超时' ? '<span class="ml-1 inline-flex rounded-full px-2 py-0.5 text-xs bg-rose-100 text-rose-800">超时</span>' : ''}</div></div>`
    : '<span class="text-muted-foreground text-xs">-</span>'}
      </td>
      <td class="px-3 py-3 align-top">
        ${sample.anomalyFlag && sample.anomaly
    ? `<div class="text-xs"><span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-rose-100 text-rose-800">${escapeHtml(sample.anomaly.type)}</span><div class="text-muted-foreground mt-1">${escapeHtml(sample.anomaly.level)}级</div></div>`
    : '<span class="text-muted-foreground text-xs">-</span>'}
      </td>
      <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(sample.updatedAt)}</td>
      <td class="px-3 py-3 align-top">
        <div class="flex gap-1">
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-inventory-action="view-detail" data-sample-id="${sample.sampleId}">查看</button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-inventory-action="open-ledger" data-sample-code="${sample.sampleCode}">台账</button>
        </div>
      </td>
    </tr>
  `
}

function renderInventoryDetailDrawer() {
  if (!state.drawerOpen) return ''
  const sample = getSelectedSample()
  if (!sample) return ''

  const statusColor = STATUS_COLORS[sample.status] || 'bg-gray-100 text-gray-800'
  const events = getLedgerEvents(sample.sampleCode)

  const content = `
    <div class="space-y-6">
      <!-- 基本信息 -->
      <div>
        <h4 class="font-semibold mb-3 flex items-center gap-2">
          <i data-lucide="file-text" class="h-4 w-4"></i>
          基本信息
        </h4>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-muted-foreground">样衣编号: </span><span class="font-medium">${escapeHtml(sample.sampleCode)}</span></div>
          <div><span class="text-muted-foreground">名称: </span><span>${escapeHtml(sample.name)}</span></div>
          <div><span class="text-muted-foreground">尺码: </span><span>${escapeHtml(sample.size)}</span></div>
          <div><span class="text-muted-foreground">颜色: </span><span>${escapeHtml(sample.color)}</span></div>
          <div><span class="text-muted-foreground">材质: </span><span>${escapeHtml(sample.material)}</span></div>
          <div><span class="text-muted-foreground">类型: </span><span>${escapeHtml(sample.templateType)}</span></div>
        </div>
      </div>

      <div class="border-t pt-4"></div>

      <!-- 快照卡片 -->
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-lg border p-3">
          <div class="text-xs text-muted-foreground mb-1">状态</div>
          <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusColor}">${escapeHtml(sample.status)}</span>
        </div>
        <div class="rounded-lg border p-3">
          <div class="text-xs text-muted-foreground mb-1">位置</div>
          <div class="font-medium text-sm">${escapeHtml(sample.currentLocation)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(sample.locationDetail)}</div>
        </div>
        ${sample.occupancyType !== '无' ? `
          <div class="rounded-lg border p-3">
            <div class="text-xs text-muted-foreground mb-1">占用信息</div>
            <div class="font-medium text-sm">${escapeHtml(sample.occupiedBy || '')}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(sample.occupiedFor || '')} · 至 ${sample.occupiedUntil}</div>
          </div>
        ` : ''}
        ${sample.inTransit && sample.transit ? `
          <div class="rounded-lg border p-3">
            <div class="text-xs text-muted-foreground mb-1">在途信息</div>
            <div class="font-medium text-sm">${escapeHtml(sample.transit.trackingNo)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(sample.transit.from)} → ${escapeHtml(sample.transit.to)}</div>
            <div class="text-xs text-muted-foreground">ETA: ${sample.transit.eta}</div>
          </div>
        ` : ''}
        ${sample.anomalyFlag && sample.anomaly ? `
          <div class="rounded-lg border border-rose-200 bg-rose-50 p-3 col-span-2">
            <div class="text-xs text-rose-600 mb-1">异常</div>
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-rose-100 text-rose-800">${escapeHtml(sample.anomaly.type)}</span>
            <div class="text-xs text-muted-foreground mt-1">${escapeHtml(sample.anomaly.note)}</div>
          </div>
        ` : ''}
      </div>

      <div class="border-t pt-4"></div>

      <!-- 快捷操作 -->
      <div>
        <h4 class="font-semibold mb-3 flex items-center gap-2">
          <i data-lucide="zap" class="h-4 w-4"></i>
          快捷操作
        </h4>
        <div class="grid grid-cols-2 gap-2">
          ${sample.inTransit ? `
            <button class="inline-flex h-9 items-center justify-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-inventory-action="sign-receive">
              <i data-lucide="check-circle" class="mr-2 h-4 w-4"></i>标记签收
            </button>
          ` : ''}
          ${sample.occupancyType === '预占' ? `
            <button class="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted" data-inventory-action="release-reserve">
              <i data-lucide="unlock" class="mr-2 h-4 w-4"></i>释放预占
            </button>
          ` : ''}
          ${sample.occupancyType === '占用' ? `
            <button class="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted" data-inventory-action="mark-return">
              <i data-lucide="rotate-ccw" class="mr-2 h-4 w-4"></i>标记归还
            </button>
          ` : ''}
          <button class="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted" data-inventory-action="init-maintenance">
            <i data-lucide="wrench" class="mr-2 h-4 w-4"></i>发起维修
          </button>
        </div>
      </div>

      <div class="border-t pt-4"></div>

      <!-- 最近台账事件 -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold flex items-center gap-2">
            <i data-lucide="scroll-text" class="h-4 w-4"></i>
            最近台账事件 (${events.length}条)
          </h4>
          <button class="inline-flex items-center text-xs text-blue-700 hover:underline" data-inventory-action="open-full-ledger" data-sample-code="${sample.sampleCode}">
            查看完整台账
            <i data-lucide="external-link" class="ml-1 h-3 w-3"></i>
          </button>
        </div>
        <div class="space-y-3">
          ${events.map((event) => `
            <div class="flex gap-3 text-sm">
              <div class="flex-shrink-0">
                <i data-lucide="calendar" class="w-4 h-4 text-muted-foreground"></i>
              </div>
              <div class="flex-1">
                <div class="font-medium">${escapeHtml(event.summary)}</div>
                <div class="text-xs text-muted-foreground">${escapeHtml(event.time)} · ${escapeHtml(event.by)}</div>
              </div>
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs border h-fit">${escapeHtml(event.type)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `

  return uiDetailDrawer(
    {
      title: '样衣详情(快照)',
      subtitle: sample.sampleCode,
      closeAction: { prefix: 'inventory', action: 'close-drawer' },
      width: 'md',
    },
    content
  )
}

function renderPage(): string {
  const filteredSamples = getFilteredSamples()
  const summary = getSummary()

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">样衣库存</h1>
          <p class="mt-1 text-sm text-muted-foreground">实时查看样衣资产状态，支持库存筛选、异常监控和快捷操作</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-inventory-action="refresh">
            <i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>刷新
          </button>
        </div>
      </header>

      <!-- Filter Bar -->
      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div class="xl:col-span-2">
            <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
            <div class="relative">
              <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
              <input
                class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
                placeholder="样衣编号 / 名称 / 项目 / 运单号"
                value="${escapeHtml(state.search)}"
                data-inventory-field="search"
              />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-inventory-field="statusFilter">
              ${STATUS_OPTIONS.map((o) => `<option value="${o.value}" ${state.statusFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">位置</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-inventory-field="locationFilter">
              ${LOCATION_OPTIONS.map((o) => `<option value="${o.value}" ${state.locationFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">模板类型</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-inventory-field="templateFilter">
              ${TEMPLATE_OPTIONS.map((o) => `<option value="${o.value}" ${state.templateFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-4">
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" class="h-4 w-4 rounded border" ${state.showAnomalyOnly ? 'checked' : ''} data-inventory-field="showAnomalyOnly" />
              <span>只看异常</span>
            </label>
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" class="h-4 w-4 rounded border" ${state.showTransitOverdueOnly ? 'checked' : ''} data-inventory-field="showTransitOverdueOnly" />
              <span>只看在途超时</span>
            </label>
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" class="h-4 w-4 rounded border" ${state.showTodayReturnOnly ? 'checked' : ''} data-inventory-field="showTodayReturnOnly" />
              <span>今日需归还</span>
            </label>
          </div>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-inventory-action="reset-filters">
            重置筛选
          </button>
        </div>
      </section>

      <!-- KPI Cards -->
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        ${renderKpiCard('总量', summary.total, 'package', 'bg-blue-500/10 text-blue-600', 'filter-status', 'all')}
        ${renderKpiCard('在库可用', summary.available, 'check-circle', 'bg-emerald-500/10 text-emerald-600', 'filter-status', '在库可用')}
        ${renderKpiCard('预占', summary.reserved, 'lock', 'bg-purple-500/10 text-purple-600', 'filter-status', '预占锁定')}
        ${renderKpiCard('占用', summary.occupied, 'users', 'bg-amber-500/10 text-amber-600', 'filter-status', '借出占用')}
        ${renderKpiCard('在途', summary.inTransit, 'truck', 'bg-blue-500/10 text-blue-600', 'filter-status', '在途待签收')}
        ${renderKpiCard('异常', summary.anomaly, 'alert-triangle', 'bg-rose-500/10 text-rose-600', 'filter-anomaly')}
      </section>

      <!-- Table -->
      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1400px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">样衣编号/名称</th>
                <th class="px-3 py-2 font-medium">所属项目</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">当前位置</th>
                <th class="px-3 py-2 font-medium">占用/预占</th>
                <th class="px-3 py-2 font-medium">在途信息</th>
                <th class="px-3 py-2 font-medium">异常</th>
                <th class="px-3 py-2 font-medium">最近更新</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSamples.length > 0
    ? filteredSamples.slice(0, 20).map(renderSampleRow).join('')
    : '<tr><td colspan="9" class="px-4 py-12 text-center text-muted-foreground"><i data-lucide="package-x" class="mx-auto h-10 w-10 text-muted-foreground/60"></i><p class="mt-2">暂无符合条件的样衣库存</p></td></tr>'}
            </tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
          <p class="text-xs text-muted-foreground">共 ${filteredSamples.length} 条${filteredSamples.length > 20 ? '，当前显示前20条' : ''}</p>
          <div class="flex flex-wrap items-center gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted cursor-not-allowed opacity-60" disabled>上一页</button>
            <span class="text-xs text-muted-foreground">1 / ${Math.ceil(filteredSamples.length / 20) || 1}</span>
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${filteredSamples.length <= 20 ? 'cursor-not-allowed opacity-60' : ''}" ${filteredSamples.length <= 20 ? 'disabled' : ''}>下一页</button>
          </div>
        </footer>
      </section>
    </div>

    ${renderInventoryDetailDrawer()}
  `
}

// ============ 事件处理 ============

export function handleSampleInventoryEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-inventory-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.inventoryField
    if (field === 'search' && fieldNode instanceof HTMLInputElement) {
      state.search = fieldNode.value
      return true
    }
    if (field === 'statusFilter' && fieldNode instanceof HTMLSelectElement) {
      state.statusFilter = fieldNode.value
      return true
    }
    if (field === 'locationFilter' && fieldNode instanceof HTMLSelectElement) {
      state.locationFilter = fieldNode.value
      return true
    }
    if (field === 'templateFilter' && fieldNode instanceof HTMLSelectElement) {
      state.templateFilter = fieldNode.value
      return true
    }
    if (field === 'showAnomalyOnly' && fieldNode instanceof HTMLInputElement) {
      state.showAnomalyOnly = fieldNode.checked
      return true
    }
    if (field === 'showTransitOverdueOnly' && fieldNode instanceof HTMLInputElement) {
      state.showTransitOverdueOnly = fieldNode.checked
      return true
    }
    if (field === 'showTodayReturnOnly' && fieldNode instanceof HTMLInputElement) {
      state.showTodayReturnOnly = fieldNode.checked
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-inventory-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.inventoryAction
  if (!action) return false

  if (action === 'refresh') {
    console.log('刷新库存数据')
    return true
  }

  if (action === 'reset-filters') {
    state.search = ''
    state.statusFilter = 'all'
    state.locationFilter = 'all'
    state.templateFilter = 'all'
    state.showAnomalyOnly = false
    state.showTransitOverdueOnly = false
    state.showTodayReturnOnly = false
    return true
  }

  if (action === 'filter-status') {
    const value = actionNode.dataset.filterValue
    if (value) {
      state.statusFilter = value
      state.showAnomalyOnly = false
    }
    return true
  }

  if (action === 'filter-anomaly') {
    state.showAnomalyOnly = !state.showAnomalyOnly
    return true
  }

  if (action === 'view-detail') {
    const sampleId = actionNode.dataset.sampleId
    if (sampleId) {
      state.selectedSampleId = sampleId
      state.drawerOpen = true
    }
    return true
  }

  if (action === 'close-drawer') {
    state.drawerOpen = false
    return true
  }

  if (action === 'open-ledger' || action === 'open-full-ledger') {
    const sampleCode = actionNode.dataset.sampleCode
    if (sampleCode) {
      appStore.navigate('/pcs/samples/ledger')
    }
    return true
  }

  if (action === 'sign-receive') {
    console.log('标记签收:', state.selectedSampleId)
    state.drawerOpen = false
    return true
  }

  if (action === 'release-reserve') {
    console.log('释放预占:', state.selectedSampleId)
    state.drawerOpen = false
    return true
  }

  if (action === 'mark-return') {
    console.log('标记归还:', state.selectedSampleId)
    state.drawerOpen = false
    return true
  }

  if (action === 'init-maintenance') {
    console.log('发起维修:', state.selectedSampleId)
    state.drawerOpen = false
    return true
  }

  return false
}

export function isSampleInventoryDialogOpen(): boolean {
  return state.drawerOpen
}

export function renderSampleInventoryPage(): string {
  return renderPage()
}
