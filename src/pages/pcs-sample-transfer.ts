import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderPrimaryButton,
  renderSecondaryButton,
} from '../components/ui'

// ============ 类型定义 ============

interface Sample {
  id: string
  code: string
  name: string
}

interface Project {
  id: string
  name: string
}

interface WorkItem {
  id: string
  name: string
}

interface Entity {
  type: 'site' | 'person' | 'transit' | 'external'
  display: string
}

interface Tracking {
  carrier: string
  no: string
  eta: string | null
}

interface Operator {
  role: string
  name: string
}

interface TransferRecord {
  transfer_id: string
  event_type: string
  transfer_category: string
  event_time: string
  sample: Sample
  from_entity: Entity
  to_entity: Entity
  responsible_site_before: string
  responsible_site_after: string
  tracking: Tracking | null
  project: Project | null
  work_item: WorkItem | null
  operator: Operator
  risk_flags: string[]
  summary: string
  attachments_count: number
}

// ============ 常量 ============

const TRANSFER_CATEGORIES = [
  { value: 'all', label: '全部类型' },
  { value: 'inbound', label: '入库流' },
  { value: 'borrow', label: '借用流' },
  { value: 'logistics', label: '物流流' },
  { value: 'return', label: '退货流' },
  { value: 'inventory', label: '盘点纠正' },
  { value: 'disposal', label: '处置流' },
]

const EVENT_TYPES = [
  { value: 'ARRIVAL_SIGN', label: '到样签收', category: 'inbound' },
  { value: 'CHECK_IN', label: '核对入库', category: 'inbound' },
  { value: 'BORROW_OUT', label: '领用出库', category: 'borrow' },
  { value: 'RETURN_IN', label: '归还入库', category: 'borrow' },
  { value: 'SHIP_OUT', label: '寄出', category: 'logistics' },
  { value: 'RECEIVE_SIGN', label: '签收', category: 'logistics' },
  { value: 'INVENTORY_ADJUST', label: '盘点', category: 'inventory' },
  { value: 'RETURN_VENDOR', label: '退货', category: 'return' },
  { value: 'DISPOSAL', label: '处置', category: 'disposal' },
]

const SITES = [
  { value: 'all', label: '全部站点' },
  { value: 'shenzhen', label: '深圳' },
  { value: 'jakarta', label: '雅加达' },
]

const CATEGORY_COLORS: Record<string, string> = {
  inbound: 'bg-emerald-100 text-emerald-800',
  borrow: 'bg-blue-100 text-blue-800',
  logistics: 'bg-purple-100 text-purple-800',
  return: 'bg-amber-100 text-amber-800',
  inventory: 'bg-gray-100 text-gray-800',
  disposal: 'bg-rose-100 text-rose-800',
}

const CATEGORY_LABELS: Record<string, string> = {
  inbound: '入库流',
  borrow: '借用流',
  logistics: '物流流',
  return: '退货流',
  inventory: '盘点纠正',
  disposal: '处置流',
}

const EVENT_COLORS: Record<string, string> = {
  ARRIVAL_SIGN: 'bg-emerald-100 text-emerald-800',
  CHECK_IN: 'bg-green-100 text-green-800',
  BORROW_OUT: 'bg-blue-100 text-blue-800',
  RETURN_IN: 'bg-cyan-100 text-cyan-800',
  SHIP_OUT: 'bg-purple-100 text-purple-800',
  RECEIVE_SIGN: 'bg-violet-100 text-violet-800',
  INVENTORY_ADJUST: 'bg-gray-100 text-gray-800',
  RETURN_VENDOR: 'bg-amber-100 text-amber-800',
  DISPOSAL: 'bg-rose-100 text-rose-800',
}

const EVENT_LABELS: Record<string, string> = {
  ARRIVAL_SIGN: '到样签收',
  CHECK_IN: '核对入库',
  BORROW_OUT: '领用出库',
  RETURN_IN: '归还入库',
  SHIP_OUT: '寄出',
  RECEIVE_SIGN: '签收',
  INVENTORY_ADJUST: '盘点',
  RETURN_VENDOR: '退货',
  DISPOSAL: '处置',
}

const RISK_INFO: Record<string, { label: string; color: string }> = {
  IN_TRANSIT_TIMEOUT: { label: '在途超时', color: 'bg-rose-100 text-rose-800' },
  OVERDUE_RETURN: { label: '超期未归还', color: 'bg-amber-100 text-amber-800' },
  PENDING_CHECK: { label: '待核对', color: 'bg-yellow-100 text-yellow-800' },
}

// ============ Mock 数据 ============

const SAMPLES: Sample[] = [
  { id: 'SPL-2026-001', code: 'SPL-2026-001', name: '印尼风格碎花连衣裙-红色-M' },
  { id: 'SPL-2026-002', code: 'SPL-2026-002', name: '波西米亚风长裙-蓝色-L' },
  { id: 'SPL-2026-003', code: 'SPL-2026-003', name: '简约T恤-白色-S' },
  { id: 'SPL-2026-004', code: 'SPL-2026-004', name: '牛仔短裤-深蓝-M' },
  { id: 'SPL-2026-005', code: 'SPL-2026-005', name: '针织开衫-米色-F' },
  { id: 'SPL-2026-006', code: 'SPL-2026-006', name: '休闲西装外套-黑色-L' },
  { id: 'SPL-2026-007', code: 'SPL-2026-007', name: '运动卫衣-灰色-XL' },
  { id: 'SPL-2026-008', code: 'SPL-2026-008', name: '雪纺衬衫-粉色-S' },
]

const PROJECTS: Project[] = [
  { id: 'PRJ-20260110-001', name: '印尼风格碎花连衣裙' },
  { id: 'PRJ-20260108-002', name: '波西米亚风长裙系列' },
  { id: 'PRJ-20260112-003', name: '基础款T恤系列' },
  { id: 'PRJ-20260105-004', name: '夏季牛仔系列' },
]

const WORK_ITEMS: WorkItem[] = [
  { id: 'WI-001', name: '商品项目立项' },
  { id: 'WI-002', name: '样衣获取' },
  { id: 'WI-003', name: '样衣拍摄试穿' },
  { id: 'WI-004', name: '直播测款' },
]

function generateTransferRecords(): TransferRecord[] {
  const records: TransferRecord[] = []
  const now = new Date()
  let id = 1

  function subHours(date: Date, hours: number): Date {
    return new Date(date.getTime() - hours * 3600000)
  }

  function subDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 86400000)
  }

  function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000)
  }

  // 入库流 - 到样签收
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'ARRIVAL_SIGN',
    transfer_category: 'inbound',
    event_time: subHours(now, 2).toISOString(),
    sample: SAMPLES[0],
    from_entity: { type: 'external', display: '淘宝店铺-美衣坊' },
    to_entity: { type: 'site', display: '深圳仓-待入库区' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'shenzhen',
    tracking: { carrier: '顺丰', no: 'SF1234567890', eta: null },
    project: PROJECTS[0],
    work_item: WORK_ITEMS[1],
    operator: { role: '仓管', name: '李明' },
    risk_flags: [],
    summary: '淘宝外采样衣到货，已签收',
    attachments_count: 2,
  })

  // 入库流 - 核对入库
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'CHECK_IN',
    transfer_category: 'inbound',
    event_time: subHours(now, 1).toISOString(),
    sample: SAMPLES[0],
    from_entity: { type: 'site', display: '深圳仓-待入库区' },
    to_entity: { type: 'site', display: '深圳仓-A区-01-02' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'shenzhen',
    tracking: null,
    project: PROJECTS[0],
    work_item: WORK_ITEMS[1],
    operator: { role: '仓管', name: '李明' },
    risk_flags: [],
    summary: '核对无误，已入库',
    attachments_count: 1,
  })

  // 借用流 - 领用出库
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'BORROW_OUT',
    transfer_category: 'borrow',
    event_time: subDays(now, 1).toISOString(),
    sample: SAMPLES[1],
    from_entity: { type: 'site', display: '深圳仓-B区-02-05' },
    to_entity: { type: 'person', display: '主播-小美' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'shenzhen',
    tracking: null,
    project: PROJECTS[1],
    work_item: WORK_ITEMS[3],
    operator: { role: '买手', name: '张丽' },
    risk_flags: [],
    summary: '直播测款使用，预计3天归还',
    attachments_count: 1,
  })

  // 借用流 - 超期未归还
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'BORROW_OUT',
    transfer_category: 'borrow',
    event_time: subDays(now, 10).toISOString(),
    sample: SAMPLES[2],
    from_entity: { type: 'site', display: '深圳仓-A区-03-01' },
    to_entity: { type: 'person', display: '家播-阿杰' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'shenzhen',
    tracking: null,
    project: PROJECTS[2],
    work_item: WORK_ITEMS[3],
    operator: { role: '买手', name: '王芳' },
    risk_flags: ['OVERDUE_RETURN'],
    summary: '家播测款使用，已超期7天未归还',
    attachments_count: 0,
  })

  // 物流流 - 寄出（深圳→雅加达）
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'SHIP_OUT',
    transfer_category: 'logistics',
    event_time: subDays(now, 3).toISOString(),
    sample: SAMPLES[3],
    from_entity: { type: 'site', display: '深圳仓-C区-01-01' },
    to_entity: { type: 'transit', display: '在途（深圳→雅加达）' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'shenzhen',
    tracking: { carrier: 'DHL', no: 'DHL9876543210', eta: addDays(now, 2).toISOString() },
    project: PROJECTS[3],
    work_item: WORK_ITEMS[2],
    operator: { role: '仓管', name: '李明' },
    risk_flags: [],
    summary: '跨站点调拨，预计5天到达',
    attachments_count: 1,
  })

  // 物流流 - 在途超时
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'SHIP_OUT',
    transfer_category: 'logistics',
    event_time: subDays(now, 15).toISOString(),
    sample: SAMPLES[4],
    from_entity: { type: 'site', display: '深圳仓-B区-01-03' },
    to_entity: { type: 'transit', display: '在途（深圳→雅加达）' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'shenzhen',
    tracking: { carrier: 'EMS', no: 'EMS1122334455', eta: subDays(now, 5).toISOString() },
    project: PROJECTS[0],
    work_item: WORK_ITEMS[2],
    operator: { role: '仓管', name: '李明' },
    risk_flags: ['IN_TRANSIT_TIMEOUT'],
    summary: '跨站点调拨，已超时10天未签收',
    attachments_count: 1,
  })

  // 物流流 - 签收
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'RECEIVE_SIGN',
    transfer_category: 'logistics',
    event_time: subDays(now, 2).toISOString(),
    sample: SAMPLES[5],
    from_entity: { type: 'transit', display: '在途（深圳→雅加达）' },
    to_entity: { type: 'site', display: '雅加达仓-待入库区' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'jakarta',
    tracking: { carrier: 'DHL', no: 'DHL5566778899', eta: null },
    project: PROJECTS[1],
    work_item: WORK_ITEMS[2],
    operator: { role: '仓管', name: 'Andi' },
    risk_flags: ['PENDING_CHECK'],
    summary: '雅加达签收，待核对入库',
    attachments_count: 2,
  })

  // 借用流 - 归还入库
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'RETURN_IN',
    transfer_category: 'borrow',
    event_time: subHours(now, 5).toISOString(),
    sample: SAMPLES[6],
    from_entity: { type: 'person', display: '主播-小美' },
    to_entity: { type: 'site', display: '深圳仓-待核对区' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'shenzhen',
    tracking: null,
    project: PROJECTS[2],
    work_item: WORK_ITEMS[3],
    operator: { role: '买手', name: '张丽' },
    risk_flags: ['PENDING_CHECK'],
    summary: '直播结束归还，待核对',
    attachments_count: 1,
  })

  // 退货流
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'RETURN_VENDOR',
    transfer_category: 'return',
    event_time: subDays(now, 4).toISOString(),
    sample: SAMPLES[7],
    from_entity: { type: 'site', display: '深圳仓-A区-02-01' },
    to_entity: { type: 'external', display: '供应商-广州服饰厂' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'shenzhen',
    tracking: { carrier: '顺丰', no: 'SF9988776655', eta: null },
    project: PROJECTS[3],
    work_item: WORK_ITEMS[1],
    operator: { role: '仓管', name: '李明' },
    risk_flags: [],
    summary: '质量问题退货',
    attachments_count: 3,
  })

  // 盘点纠正
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
    event_type: 'INVENTORY_ADJUST',
    transfer_category: 'inventory',
    event_time: subDays(now, 1).toISOString(),
    sample: SAMPLES[0],
    from_entity: { type: 'site', display: '深圳仓-A区-01-02' },
    to_entity: { type: 'site', display: '深圳仓-A区-01-05' },
    responsible_site_before: 'shenzhen',
    responsible_site_after: 'shenzhen',
    tracking: null,
    project: PROJECTS[0],
    work_item: null,
    operator: { role: '仓管', name: '李明' },
    risk_flags: [],
    summary: '盘点发现位置错误，已纠正',
    attachments_count: 1,
  })

  // 添加更多记录
  for (let i = 0; i < 20; i++) {
    const eventTypeIndex = i % EVENT_TYPES.length
    const eventType = EVENT_TYPES[eventTypeIndex]
    const sample = SAMPLES[i % SAMPLES.length]
    const project = PROJECTS[i % PROJECTS.length]
    const workItem = WORK_ITEMS[i % WORK_ITEMS.length]
    const hasRisk = i % 5 === 0
    const riskTypes = ['IN_TRANSIT_TIMEOUT', 'OVERDUE_RETURN', 'PENDING_CHECK']

    records.push({
      transfer_id: `TRF-${String(id++).padStart(6, '0')}`,
      event_type: eventType.value,
      transfer_category: eventType.category,
      event_time: subDays(now, i + 5).toISOString(),
      sample,
      from_entity: {
        type: 'site',
        display: `深圳仓-${String.fromCharCode(65 + (i % 3))}区-0${(i % 5) + 1}-0${(i % 10) + 1}`,
      },
      to_entity: {
        type: i % 2 === 0 ? 'site' : 'person',
        display: i % 2 === 0 ? '雅加达仓-待入库区' : `主播-测试${i + 1}`,
      },
      responsible_site_before: 'shenzhen',
      responsible_site_after: i % 3 === 0 ? 'jakarta' : 'shenzhen',
      tracking:
        eventType.category === 'logistics'
          ? { carrier: 'DHL', no: `DHL${1000000000 + i}`, eta: addDays(now, 3).toISOString() }
          : null,
      project,
      work_item: workItem,
      operator: { role: '仓管', name: `操作员${i + 1}` },
      risk_flags: hasRisk ? [riskTypes[i % 3]] : [],
      summary: `流转记录 ${i + 1}`,
      attachments_count: i % 3,
    })
  }

  return records.sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())
}

const mockRecords = generateTransferRecords()

// ============ 状态管理 ============

interface TransferState {
  search: string
  categoryFilter: string
  eventTypeFilter: string
  siteFilter: string
  selectedRecordId: string | null
  drawerOpen: boolean
  advancedFilterOpen: boolean
  currentPage: number
}

let state: TransferState = {
  search: '',
  categoryFilter: 'all',
  eventTypeFilter: 'all',
  siteFilter: 'all',
  selectedRecordId: null,
  drawerOpen: false,
  advancedFilterOpen: false,
  currentPage: 1,
}

const PAGE_SIZE = 15

// ============ 工具函数 ============

function formatDate(isoString: string): string {
  const d = new Date(isoString)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
}

function formatFullDate(isoString: string): string {
  const d = new Date(isoString)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const sec = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${sec}`
}

function getFilteredRecords(): TransferRecord[] {
  return mockRecords.filter((r) => {
    if (state.search) {
      const keyword = state.search.toLowerCase()
      const matchSample = r.sample.code.toLowerCase().includes(keyword) || r.sample.name.toLowerCase().includes(keyword)
      const matchProject = r.project?.name.toLowerCase().includes(keyword)
      const matchWorkItem = r.work_item?.name.toLowerCase().includes(keyword)
      const matchTracking = r.tracking?.no.toLowerCase().includes(keyword)
      const matchOperator = r.operator.name.toLowerCase().includes(keyword)
      if (!matchSample && !matchProject && !matchWorkItem && !matchTracking && !matchOperator) {
        return false
      }
    }
    if (state.categoryFilter !== 'all' && r.transfer_category !== state.categoryFilter) return false
    if (state.eventTypeFilter !== 'all' && r.event_type !== state.eventTypeFilter) return false
    if (state.siteFilter !== 'all' && r.responsible_site_after !== state.siteFilter) return false
    return true
  })
}

function getStats() {
  return {
    total: mockRecords.length,
    inTransit: mockRecords.filter(
      (r) =>
        r.event_type === 'SHIP_OUT' &&
        !mockRecords.some(
          (r2) =>
            r2.event_type === 'RECEIVE_SIGN' &&
            r2.sample.id === r.sample.id &&
            new Date(r2.event_time) > new Date(r.event_time),
        ),
    ).length,
    inTransitTimeout: mockRecords.filter((r) => r.risk_flags.includes('IN_TRANSIT_TIMEOUT')).length,
    overdueReturn: mockRecords.filter((r) => r.risk_flags.includes('OVERDUE_RETURN')).length,
    pendingCheck: mockRecords.filter((r) => r.risk_flags.includes('PENDING_CHECK')).length,
  }
}

function getSelectedRecord(): TransferRecord | null {
  if (!state.selectedRecordId) return null
  return mockRecords.find((r) => r.transfer_id === state.selectedRecordId) || null
}

function getSiteLabel(site: string): string {
  return site === 'shenzhen' ? '深圳' : '雅加达'
}

// ============ 渲染函数 ============

function renderKpiCard(
  label: string,
  value: number,
  icon: string,
  colorClass: string,
  bgClass: string,
  action: string,
  actionValue?: string,
) {
  const isActive = action === 'filter-category' && state.categoryFilter === actionValue
  return `
    <button class="rounded-lg border p-3 text-left transition hover:border-blue-300 ${bgClass} ${isActive ? 'border-blue-300' : ''}" data-transfer-action="${action}" ${actionValue ? `data-filter-value="${actionValue}"` : ''}>
      <div class="text-xs ${colorClass} flex items-center gap-1">
        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        ${escapeHtml(label)}
      </div>
      <div class="text-xl font-semibold mt-1 ${colorClass}">${value}</div>
    </button>
  `
}

function renderRecordRow(record: TransferRecord): string {
  const catColor = CATEGORY_COLORS[record.transfer_category] || 'bg-gray-100 text-gray-800'
  const catLabel = CATEGORY_LABELS[record.transfer_category] || record.transfer_category
  const eventColor = EVENT_COLORS[record.event_type] || 'bg-gray-100 text-gray-800'
  const eventLabel = EVENT_LABELS[record.event_type] || record.event_type
  const siteChanged = record.responsible_site_before !== record.responsible_site_after

  return `
    <tr class="border-b last:border-b-0 hover:bg-muted/40 cursor-pointer" data-transfer-action="view-detail" data-record-id="${record.transfer_id}">
      <td class="px-3 py-2 align-top text-xs">${formatDate(record.event_time)}</td>
      <td class="px-3 py-2 align-top">
        <div class="text-xs font-medium text-blue-700">${escapeHtml(record.sample.code)}</div>
        <div class="text-xs text-muted-foreground truncate max-w-[140px]">${escapeHtml(record.sample.name)}</div>
      </td>
      <td class="px-3 py-2 align-top">
        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${catColor}">${escapeHtml(catLabel)}</span>
      </td>
      <td class="px-3 py-2 align-top">
        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${eventColor}">${escapeHtml(eventLabel)}</span>
      </td>
      <td class="px-3 py-2 align-top">
        <div class="flex items-center gap-1 text-xs">
          <span class="text-muted-foreground truncate max-w-[100px]">${escapeHtml(record.from_entity.display)}</span>
          <i data-lucide="arrow-right" class="w-3 h-3 text-blue-600 flex-shrink-0"></i>
          <span class="font-medium truncate max-w-[100px]">${escapeHtml(record.to_entity.display)}</span>
        </div>
      </td>
      <td class="px-3 py-2 align-top text-xs">
        ${
          siteChanged
            ? `<span>${getSiteLabel(record.responsible_site_before)}</span>
           <i data-lucide="arrow-right" class="inline w-3 h-3 text-amber-600"></i>
           <span class="text-amber-700 font-medium">${getSiteLabel(record.responsible_site_after)}</span>`
            : getSiteLabel(record.responsible_site_after)
        }
      </td>
      <td class="px-3 py-2 align-top text-xs">
        ${
          record.tracking
            ? `<span class="text-muted-foreground">${escapeHtml(record.tracking.carrier)}</span> ${record.tracking.no.slice(-6)}`
            : '<span class="text-muted-foreground">-</span>'
        }
      </td>
      <td class="px-3 py-2 align-top text-xs truncate max-w-[120px]">
        ${record.project ? escapeHtml(record.project.name) : '<span class="text-muted-foreground">-</span>'}
      </td>
      <td class="px-3 py-2 align-top text-xs">
        <span class="text-muted-foreground">${escapeHtml(record.operator.role)}</span> ${escapeHtml(record.operator.name)}
      </td>
      <td class="px-3 py-2 align-top">
        ${
          record.risk_flags.length > 0
            ? record.risk_flags
                .map((flag) => {
                  const risk = RISK_INFO[flag]
                  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${risk?.color || 'bg-gray-100'}">${escapeHtml(risk?.label || flag)}</span>`
                })
                .join(' ')
            : '<span class="text-muted-foreground text-xs">-</span>'
        }
      </td>
      <td class="px-3 py-2 align-top">
        <div class="flex gap-1">
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-transfer-action="view-detail" data-record-id="${record.transfer_id}">查看</button>
        </div>
      </td>
    </tr>
  `
}

function renderDetailDrawer(): string {
  if (!state.drawerOpen) return ''
  const record = getSelectedRecord()
  if (!record) return ''

  const catColor = CATEGORY_COLORS[record.transfer_category] || 'bg-gray-100 text-gray-800'
  const catLabel = CATEGORY_LABELS[record.transfer_category] || record.transfer_category
  const eventColor = EVENT_COLORS[record.event_type] || 'bg-gray-100 text-gray-800'
  const eventLabel = EVENT_LABELS[record.event_type] || record.event_type
  const siteChanged = record.responsible_site_before !== record.responsible_site_after

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-transfer-action="close-drawer" aria-label="关闭"></button>
      <section class="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 border-b bg-background px-4 py-3">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${catColor}">${escapeHtml(catLabel)}</span>
                <span class="text-muted-foreground">·</span>
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${eventColor}">${escapeHtml(eventLabel)}</span>
              </div>
              <div class="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>${formatFullDate(record.event_time)}</span>
                <span>·</span>
                <span class="flex items-center gap-1">
                  ${escapeHtml(record.transfer_id)}
                  <button class="hover:text-blue-600" data-transfer-action="copy-id" data-copy-value="${record.transfer_id}">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                  </button>
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              ${record.risk_flags
                .map((flag) => {
                  const risk = RISK_INFO[flag]
                  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${risk?.color || 'bg-gray-100'}">${escapeHtml(risk?.label || flag)}</span>`
                })
                .join('')}
              <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-transfer-action="close-drawer" aria-label="关闭">
                <i data-lucide="x" class="h-4 w-4"></i>
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-transfer-action="open-inventory">
              <i data-lucide="package" class="mr-1 h-3.5 w-3.5"></i>库存详情
            </button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-transfer-action="open-ledger">
              <i data-lucide="file-text" class="mr-1 h-3.5 w-3.5"></i>打开台账
            </button>
            ${
              record.project
                ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-transfer-action="open-project">
                <i data-lucide="external-link" class="mr-1 h-3.5 w-3.5"></i>打开项目
              </button>`
                : ''
            }
          </div>
        </header>

        <div class="p-4 space-y-6">
          <!-- A. 基本信息 -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2">
              <span class="text-muted-foreground">A.</span>基本信息
            </h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div><span class="text-muted-foreground">事件类型: </span>${escapeHtml(eventLabel)}</div>
              <div><span class="text-muted-foreground">发生时间: </span>${formatFullDate(record.event_time)}</div>
              <div><span class="text-muted-foreground">经办人: </span>${escapeHtml(record.operator.role)} - ${escapeHtml(record.operator.name)}</div>
              <div><span class="text-muted-foreground">说明：</span>${escapeHtml(record.summary)}</div>
            </div>
          </div>

          <div class="border-t pt-4"></div>

          <!-- B. From → To -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2">
              <span class="text-muted-foreground">B.</span>From → To 交接信息
            </h4>
            <div class="bg-muted/50 rounded-lg p-4">
              <div class="flex items-center gap-4">
                <div class="flex-1">
                  <div class="text-xs text-muted-foreground">From</div>
                  <div class="mt-1 font-medium text-sm">${escapeHtml(record.from_entity.display)}</div>
                  <div class="text-xs text-muted-foreground">${record.from_entity.type === 'site' ? '站点仓库' : record.from_entity.type === 'person' ? '外部主体' : '在途'}</div>
                </div>
                <i data-lucide="arrow-right" class="w-6 h-6 text-blue-600"></i>
                <div class="flex-1">
                  <div class="text-xs text-muted-foreground">To</div>
                  <div class="mt-1 font-medium text-sm">${escapeHtml(record.to_entity.display)}</div>
                  <div class="text-xs text-muted-foreground">${record.to_entity.type === 'site' ? '站点仓库' : record.to_entity.type === 'person' ? '外部主体' : '在途'}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="border-t pt-4"></div>

          <!-- C. 责任站点 -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2">
              <span class="text-muted-foreground">C.</span>责任站点信息
            </h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-muted-foreground">责任站点变化: </span>
                <span>${getSiteLabel(record.responsible_site_before)}</span>
                ${
                  siteChanged
                    ? `<i data-lucide="arrow-right" class="inline w-3 h-3 text-amber-600"></i>
                   <span class="text-amber-700 font-medium">${getSiteLabel(record.responsible_site_after)}</span>`
                    : ''
                }
              </div>
              <div>
                <span class="text-muted-foreground">责任切换依据: </span>
                ${siteChanged ? '签收事件（跨站点）' : '-'}
              </div>
            </div>
          </div>

          ${
            record.tracking
              ? `
            <div class="border-t pt-4"></div>
            <div>
              <h4 class="text-sm font-semibold mb-3 flex items-center gap-2">
                <span class="text-muted-foreground">D.</span>运单与签收证明
              </h4>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div><span class="text-muted-foreground">承运商: </span>${escapeHtml(record.tracking.carrier)}</div>
                <div>
                  <span class="text-muted-foreground">运单号: </span>
                  ${escapeHtml(record.tracking.no)}
                  <button class="ml-1 hover:text-blue-600" data-transfer-action="copy-id" data-copy-value="${record.tracking.no}">
                    <i data-lucide="copy" class="w-3 h-3 inline"></i>
                  </button>
                </div>
                ${record.tracking.eta ? `<div><span class="text-muted-foreground">预计到达: </span>${record.tracking.eta.split('T')[0]}</div>` : ''}
              </div>
            </div>
          `
              : ''
          }

          <div class="border-t pt-4"></div>

          <!-- E. 字段变更 Diff -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2">
              <span class="text-muted-foreground">E.</span>字段变更 Diff
            </h4>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-muted-foreground">
                  <th class="py-2 font-medium">字段名</th>
                  <th class="py-2 font-medium">变更前</th>
                  <th class="py-2 font-medium">变更后</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b">
                  <td class="py-2">当前位置</td>
                  <td class="py-2 text-muted-foreground">${escapeHtml(record.from_entity.display)}</td>
                  <td class="py-2 font-medium">${escapeHtml(record.to_entity.display)}</td>
                </tr>
                ${
                  siteChanged
                    ? `<tr class="border-b">
                    <td class="py-2">责任站点</td>
                    <td class="py-2 text-muted-foreground">${getSiteLabel(record.responsible_site_before)}</td>
                    <td class="py-2 font-medium">${getSiteLabel(record.responsible_site_after)}</td>
                  </tr>`
                    : ''
                }
                ${
                  record.to_entity.type === 'person'
                    ? `<tr class="border-b">
                    <td class="py-2">保管人</td>
                    <td class="py-2 text-muted-foreground">仓库</td>
                    <td class="py-2 font-medium">${escapeHtml(record.to_entity.display)}</td>
                  </tr>`
                    : ''
                }
              </tbody>
            </table>
          </div>

          <div class="border-t pt-4"></div>

          <!-- F. 关联对象与附件 -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2">
              <span class="text-muted-foreground">F.</span>关联对象与附件
            </h4>
            <div class="space-y-2 text-sm">
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground w-16">样衣:</span>
                <span>${escapeHtml(record.sample.code)}</span>
              </div>
              ${
                record.project
                  ? `<div class="flex items-center gap-2">
                  <span class="text-muted-foreground w-16">商品项目:</span>
                  <button class="text-blue-700 hover:underline" data-transfer-action="open-project">${escapeHtml(record.project.id)} - ${escapeHtml(record.project.name)}</button>
                </div>`
                  : ''
              }
              ${
                record.work_item
                  ? `<div class="flex items-center gap-2">
                  <span class="text-muted-foreground w-16">工作项:</span>
                  <button class="text-blue-700 hover:underline" data-transfer-action="open-work-item">${escapeHtml(record.work_item.id)} - ${escapeHtml(record.work_item.name)}</button>
                </div>`
                  : ''
              }
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground w-16">附件:</span>
                <span>${record.attachments_count} 个附件</span>
              </div>
            </div>
          </div>

          ${
            record.risk_flags.includes('PENDING_CHECK') ||
            record.risk_flags.includes('OVERDUE_RETURN') ||
            record.to_entity.type === 'transit'
              ? `
            <div class="border-t pt-4"></div>
            <div>
              <h4 class="text-sm font-semibold mb-3">快捷动作</h4>
              <div class="flex gap-2">
                ${record.to_entity.type === 'transit' ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-transfer-action="go-sign">去签收</button>` : ''}
                ${record.risk_flags.includes('PENDING_CHECK') ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-transfer-action="go-check">去核对入库</button>` : ''}
                ${record.risk_flags.includes('OVERDUE_RETURN') ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-transfer-action="go-urge">去催办</button>` : ''}
              </div>
            </div>
          `
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function renderTransferAdvancedFilterDrawer(): string {
  if (!state.advancedFilterOpen) return ''

  const formContent = `
    <div class="space-y-4">
      <div>
        <label class="block text-sm mb-1">From 站点</label>
        <select class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          ${SITES.map((s) => `<option value="${s.value}">${s.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm mb-1">To 站点</label>
        <select class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          ${SITES.map((s) => `<option value="${s.value}">${s.label}</option>`).join('')}
        </select>
      </div>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" class="h-4 w-4 rounded border" />
        <span>包含占用事件（预占/取消）</span>
      </label>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" class="h-4 w-4 rounded border" />
        <span>仅看在途</span>
      </label>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" class="h-4 w-4 rounded border" />
        <span>仅看超期未归还</span>
      </label>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" class="h-4 w-4 rounded border" />
        <span>仅看责任站点=我</span>
      </label>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" class="h-4 w-4 rounded border" />
        <span>仅看关联我发起的申请</span>
      </label>
    </div>
  `

  return uiDrawer(
    {
      title: '高级筛选',
      closeAction: { prefix: 'transfer', action: 'close-advanced-filter' },
      width: 'sm',
    },
    formContent,
    {
      extra: renderSecondaryButton('重置', { prefix: 'transfer', action: 'reset-filters' }),
      confirm: { prefix: 'transfer', action: 'apply-advanced-filter', label: '应用筛选', variant: 'primary' as const },
    }
  )
}

function renderPage(): string {
  const filtered = getFilteredRecords()
  const stats = getStats()
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const paginated = filtered.slice((state.currentPage - 1) * PAGE_SIZE, state.currentPage * PAGE_SIZE)

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">样衣流转记录</h1>
          <p class="mt-1 text-sm text-muted-foreground">查看样衣全链路流转明细，追踪位置变动与责任交接</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-transfer-action="open-advanced-filter">
            <i data-lucide="filter" class="mr-1 h-3.5 w-3.5"></i>高级筛选
          </button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-transfer-action="export">
            <i data-lucide="download" class="mr-1 h-3.5 w-3.5"></i>导出
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
                placeholder="样衣编号/项目/工作项/运单号/保管人"
                value="${escapeHtml(state.search)}"
                data-transfer-field="search"
              />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">流转类型</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-transfer-field="categoryFilter">
              ${TRANSFER_CATEGORIES.map((c) => `<option value="${c.value}" ${state.categoryFilter === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">事件类型</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-transfer-field="eventTypeFilter">
              <option value="all" ${state.eventTypeFilter === 'all' ? 'selected' : ''}>全部事件</option>
              ${EVENT_TYPES.map((e) => `<option value="${e.value}" ${state.eventTypeFilter === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">责任站点</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-transfer-field="siteFilter">
              ${SITES.map((s) => `<option value="${s.value}" ${state.siteFilter === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="mt-3 flex justify-end">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-transfer-action="reset-filters">
            重置筛选
          </button>
        </div>
      </section>

      <!-- KPI Cards -->
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        ${renderKpiCard('全部流转', stats.total, 'layers', 'text-gray-700', 'bg-card', 'filter-category', 'all')}
        ${renderKpiCard('当前在途', stats.inTransit, 'truck', 'text-purple-700', 'bg-card', 'filter-category', 'logistics')}
        ${renderKpiCard('在途超时', stats.inTransitTimeout, 'alert-triangle', 'text-rose-700', 'bg-rose-50 border-rose-200', 'filter-risk', 'IN_TRANSIT_TIMEOUT')}
        ${renderKpiCard('超期未归还', stats.overdueReturn, 'clock', 'text-amber-700', 'bg-amber-50 border-amber-200', 'filter-risk', 'OVERDUE_RETURN')}
        ${renderKpiCard('待核对', stats.pendingCheck, 'package', 'text-yellow-700', 'bg-yellow-50 border-yellow-200', 'filter-risk', 'PENDING_CHECK')}
      </section>

      <!-- Table -->
      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1400px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">时间</th>
                <th class="px-3 py-2 font-medium">样衣</th>
                <th class="px-3 py-2 font-medium">流转类型</th>
                <th class="px-3 py-2 font-medium">事件类型</th>
                <th class="px-3 py-2 font-medium">From → To</th>
                <th class="px-3 py-2 font-medium">责任站点</th>
                <th class="px-3 py-2 font-medium">运单</th>
                <th class="px-3 py-2 font-medium">关联项目</th>
                <th class="px-3 py-2 font-medium">经办人</th>
                <th class="px-3 py-2 font-medium">风险</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                paginated.length > 0
                  ? paginated.map(renderRecordRow).join('')
                  : '<tr><td colspan="11" class="px-4 py-12 text-center text-muted-foreground"><i data-lucide="file-x" class="mx-auto h-10 w-10 text-muted-foreground/60"></i><p class="mt-2">暂无符合条件的流转记录</p></td></tr>'
              }
            </tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
          <p class="text-xs text-muted-foreground">共 ${filtered.length} 条</p>
          <div class="flex flex-wrap items-center gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${state.currentPage === 1 ? 'cursor-not-allowed opacity-60' : ''}" ${state.currentPage === 1 ? 'disabled' : ''} data-transfer-action="prev-page">上一页</button>
            <span class="text-xs text-muted-foreground">${state.currentPage} / ${totalPages}</span>
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${state.currentPage >= totalPages ? 'cursor-not-allowed opacity-60' : ''}" ${state.currentPage >= totalPages ? 'disabled' : ''} data-transfer-action="next-page">下一页</button>
          </div>
        </footer>
      </section>
    </div>

    ${renderDetailDrawer()}
    ${renderTransferAdvancedFilterDrawer()}
  `
}

// ============ 事件处理 ============

export function handleSampleTransferEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-transfer-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.transferField
    if (field === 'search' && fieldNode instanceof HTMLInputElement) {
      state.search = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'categoryFilter' && fieldNode instanceof HTMLSelectElement) {
      state.categoryFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'eventTypeFilter' && fieldNode instanceof HTMLSelectElement) {
      state.eventTypeFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'siteFilter' && fieldNode instanceof HTMLSelectElement) {
      state.siteFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-transfer-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.transferAction
  if (!action) return false

  if (action === 'reset-filters') {
    state.search = ''
    state.categoryFilter = 'all'
    state.eventTypeFilter = 'all'
    state.siteFilter = 'all'
    state.currentPage = 1
    state.advancedFilterOpen = false
    return true
  }

  if (action === 'filter-category') {
    const value = actionNode.dataset.filterValue
    if (value) {
      state.categoryFilter = value
      state.currentPage = 1
    }
    return true
  }

  if (action === 'filter-risk') {
    // For now, just log - could add risk filter state
    console.log('Filter risk:', actionNode.dataset.filterValue)
    return true
  }

  if (action === 'view-detail') {
    const recordId = actionNode.dataset.recordId
    if (recordId) {
      state.selectedRecordId = recordId
      state.drawerOpen = true
    }
    return true
  }

  if (action === 'close-drawer') {
    state.drawerOpen = false
    return true
  }

  if (action === 'open-advanced-filter') {
    state.advancedFilterOpen = true
    return true
  }

  if (action === 'close-advanced-filter' || action === 'apply-advanced-filter') {
    state.advancedFilterOpen = false
    return true
  }

  if (action === 'prev-page') {
    if (state.currentPage > 1) state.currentPage--
    return true
  }

  if (action === 'next-page') {
    const totalPages = Math.ceil(getFilteredRecords().length / PAGE_SIZE) || 1
    if (state.currentPage < totalPages) state.currentPage++
    return true
  }

  if (action === 'export') {
    console.log('Export records')
    return true
  }

  if (action === 'copy-id') {
    const value = actionNode.dataset.copyValue
    if (value) {
      navigator.clipboard?.writeText(value)
      console.log('Copied:', value)
    }
    return true
  }

  if (action === 'open-inventory') {
    appStore.navigate('/pcs/samples/inventory')
    return true
  }

  if (action === 'open-ledger') {
    appStore.navigate('/pcs/samples/ledger')
    return true
  }

  if (action === 'open-project') {
    const record = getSelectedRecord()
    if (record?.project) {
      appStore.navigate(`/pcs/projects/${record.project.id}`)
    }
    return true
  }

  if (action === 'open-work-item') {
    console.log('Open work item')
    return true
  }

  if (action === 'go-sign' || action === 'go-check' || action === 'go-urge') {
    console.log('Quick action:', action)
    state.drawerOpen = false
    return true
  }

  return false
}

export function isSampleTransferDialogOpen(): boolean {
  return state.drawerOpen || state.advancedFilterOpen
}

export function renderSampleTransferPage(): string {
  return renderPage()
}
