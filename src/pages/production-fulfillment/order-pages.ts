// @page-pattern: list
// PAGE-001—008: all DDS entry points read the same static production-order facts as the accepted diagram.
import type { StandardListColumn } from '../../components/ui/list-table'
import { listTimingCases, getTimingBranch, getTimingFacts, getTimingIssues, timingCaseHref, timingReceiptTotal, TIMING_AS_OF, TIMING_SCENES, TIMING_IMAGE } from '../../data/production-timing/source'
import { calculateSewingReturnDeadlineDate, SEWING_RETURN_COUNTING_DAYS } from '../../data/fcs/sewing-return-calendar'
import { e, fmt, badge, button, anchor, imageCell, renderDataTable, renderColumns, tableContexts, activeTableId, saveTablePreferences, resetTablePages } from './common'
import { ui } from './ui-state'
import './order-pages.css'

// Each list delegates to common.ts renderDataTable, which actually calls
// renderStandardListPage, renderStandardListTable and renderTablePagination.
// Keep their shared pagination/column preferences rather than duplicating them here.

type TimingCase = ReturnType<typeof listTimingCases>[number]
type TimingFacts = ReturnType<typeof getTimingFacts>
type ModuleSection = 'overview' | 'orders' | 'follow-up' | 'work-items' | 'teams' | 'inbound-analysis' | 'configuration' | 'pending-purchases'
type Filters = { query: string; follower: string; health: string; scenario: string; scope: string; dateFrom: string; dateTo: string; factory: string }
interface Clock { kind: string; start: string | null; end: string | null; sla?: number; days?: number }
interface SourceDocument { id: string; no: string; type: string; status: string; object: string; quantity: number | null; unit: string; executor: string; receiver: string; times: Record<string, string | null>; clock?: Clock; handoverClock?: Clock; sampleTiming?: { due: string | null; late: boolean; done: boolean }; quantities?: Record<string, number | null>; timingApplicable?: boolean }
interface WorkRow { id: string; production: TimingCase; documentId?: string; documentNo?: string; title: string; object: string; kind: string; state: string; executionState: string; quantity: string; startedAt: string | null; endedAt: string | null; deadline: number | null; deadlineLabel?: string; elapsed: number | null; elapsedLabel?: string; gap: number | null; executor: string; receiver: string; unit: string }
interface ContractTask { id: string; factory: string; type: string; assigned: string | null; held: number | null; receipts: { qty: number; at: string }[]; executor: string; receiver: string }
interface OrderRow { id: string; production: TimingCase; facts: TimingFacts; health: string; current: string; currentCount: number; historyCount: number; factualCount: number; status: string; warehouse: number | null; deadline: number; firstAt: string; follower: string; scenario: string }
const BASE = '/dds/supply-chain/production-fulfillment'
const DAY = 86400000
const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const sectionLabels: Record<ModuleSection, string> = { overview: '时效总览', orders: '生产单监控', 'follow-up': '我的跟单', 'work-items': '工作项监控', teams: '团队与工厂', 'inbound-analysis': '入库时效分析', configuration: '时效口径（只读）', 'pending-purchases': '采购待关联' }
const emptyFilters = (): Filters => ({ query: '', follower: '全部', health: '全部', scenario: '全部', scope: '全部', dateFrom: '', dateTo: '', factory: '全部' })
let draft = emptyFilters(), filters = emptyFilters(), more = false, currentSection: ModuleSection = 'overview', columnOverlay = false, notice = ''
const contractRules: Record<string, { name: string; days: readonly number[] }> = {
  sewing: { name: '独立车缝', days: SEWING_RETURN_COUNTING_DAYS.INDEPENDENT_SEWING },
  combined: { name: '车缝＋烫包', days: SEWING_RETURN_COUNTING_DAYS.SEWING_TO_IRON_PACK },
  full: { name: '裁剪＋车缝＋烫包', days: SEWING_RETURN_COUNTING_DAYS.CUTTING_TO_IRON_PACK },
  INDEPENDENT_SEWING: { name: '独立车缝', days: SEWING_RETURN_COUNTING_DAYS.INDEPENDENT_SEWING },
  SEWING_TO_IRON_PACK: { name: '车缝＋烫包', days: SEWING_RETURN_COUNTING_DAYS.SEWING_TO_IRON_PACK },
  CUTTING_TO_IRON_PACK: { name: '裁剪＋车缝＋烫包', days: SEWING_RETURN_COUNTING_DAYS.CUTTING_TO_IRON_PACK },
}
function timestamp(value: string | null | undefined): number { return value ? Date.parse(value.includes('T') ? value : value.replace(' ', 'T') + (value.length <= 10 ? 'T00:00:00+08:00' : '+08:00')) : NaN }
function time(value: string | number | null | undefined): string {
  if (value == null || value === '') return '待核实'
  const ms = typeof value === 'number' ? value : timestamp(value)
  if (!Number.isFinite(ms)) return '待核实'
  return dateFormatter.format(ms)
}
function display(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') { const object = value as Record<string, unknown>; return String(object.name ?? object.displayName ?? object.no ?? '') }
  return ''
}
function follower(c: TimingCase): string { return display(c.merch) || '待核实' }
function styleCode(c: TimingCase): string { return c.style.split('·').at(-1)?.trim() || '' }
function scene(c: TimingCase): string { return display((TIMING_SCENES as Record<string, unknown>)[c.key]).replace(/^假设演示\s*·\s*/, '') || c.key }
function tasks(c: TimingCase): ContractTask[] { return c.tasks as ContractTask[] }
function duration(ms: number | null): string { if (ms == null || !Number.isFinite(ms)) return '待核实'; const hours = Math.max(0, ms / 3600000); return hours >= 24 ? `${fmt(hours / 24)}天` : `${fmt(hours)}小时` }
function clockOutcome(clock: Clock): { complete: string; pending: string } {
  return /交接|调拨/.test(clock.kind) ? { complete: '已全部接收', pending: '尚未全部接收' } : /采购到仓/.test(clock.kind) ? { complete: '已入面辅料仓', pending: '尚未全部入面辅料仓' } : { complete: '已完成', pending: '未完成' }
}
function workRows(cases: TimingCase[]): WorkRow[] {
  const rows: WorkRow[] = []
  for (const c of cases) {
    const branch = getTimingBranch(c)
    if (branch) for (const d of Object.values(branch.docs) as SourceDocument[]) {
      if (d.timingApplicable === false) continue
      const clocks: Clock[] = [...(d.clock ? [d.clock] : []), ...(d.handoverClock ? [d.handoverClock] : [])]
      for (const [index, clock] of clocks.entries()) {
        const start = timestamp(clock.start), end = timestamp(clock.end || TIMING_AS_OF), sla = clock.sla ?? clock.days
        const deadline = sla != null && Number.isFinite(start) ? start + sla * DAY : null
        const gap = deadline == null || !Number.isFinite(end) ? null : Math.max(0, end - deadline), outcome = clockOutcome(clock), completionUnverified = !clock.end && /执行结果待取得|资料待取得|待核实/.test(d.status)
        const state = completionUnverified && deadline != null ? `完成事实待取得 · ${gap ? '截止已过，是否超时待核实' : '截止未到'}` : !Number.isFinite(start) ? `${clock.kind}开始时间缺失 · 无法判定时效` : deadline == null ? `${clock.kind}时效要求未确认 · 无法判定是否超时` : gap ? clock.end ? `${outcome.complete} · 晚${duration(gap)}` : `${outcome.pending} · 已超时${duration(gap)}` : clock.end ? `${outcome.complete} · 按期` : `${outcome.pending} · 截止未到`
        rows.push({ id: `${c.order}:${d.id}:${index}`, production: c, documentId: d.id, documentNo: d.no, title: d.type, object: d.object, kind: clock.kind, state, executionState: d.type === '生产准备单' && d.status === '已关闭' ? '准备已完成（单据已关闭）' : d.status, quantity: Object.entries(d.quantities || { 数量: d.quantity }).map(([name, qty]) => `${name}${qty == null ? '待核实' : fmt(qty) + d.unit}`).join(' · '), startedAt: clock.start, endedAt: clock.end, deadline, elapsed: Number.isFinite(start) && Number.isFinite(end) ? end - start : null, elapsedLabel: completionUnverified ? '从开始至查看时点，实际完成耗时待核实' : undefined, gap: completionUnverified ? null : gap, executor: d.executor, receiver: d.receiver, unit: d.unit })
      }
      if (d.sampleTiming) rows.push({ id: `${c.order}:${d.id}:sample`, production: c, documentId: d.id, documentNo: d.no, title: d.type, object: d.object, kind: '产前样衣交出', state: !d.sampleTiming.due ? '工厂实领日期缺失 · 交样时效无法判定' : d.sampleTiming.late ? d.sampleTiming.done ? '已交出 · 晚于要求日期' : '未交出 · 已过要求日期' : d.sampleTiming.done ? '已交出 · 按要求日期' : '未交出 · 要求日期未过', executionState: d.status, quantity: d.quantity == null ? '样衣数量待核实' : `${d.quantity}${d.unit}`, startedAt: d.times.工厂实领, endedAt: d.times.样衣交出, deadline: d.sampleTiming.due ? timestamp(d.sampleTiming.due) : null, deadlineLabel: d.sampleTiming.due ? d.sampleTiming.due + '（要求交样日期，日内截止未定）' : '工厂实领日期缺失', elapsed: null, gap: null, executor: d.executor, receiver: d.receiver, unit: d.unit })
    }
    for (const task of tasks(c)) {
      const rule = contractRules[task.type]
      if (!rule) continue
      const assigned = task.assigned || '', validStart = Number.isFinite(timestamp(assigned)), validHeld = task.held != null && Number.isFinite(task.held) && task.held > 0
      const receipts = task.receipts.filter(receipt => timestamp(receipt.at) <= timestamp(TIMING_AS_OF)), cumulative = timingReceiptTotal(task)
      for (const [index, percent] of [30, 70, 100].entries()) {
        const target = validHeld ? Math.ceil(task.held! * percent / 100) : null
        const deadline = validStart ? timestamp(calculateSewingReturnDeadlineDate(assigned, rule.days[index]) + ' 23:59:59') + 999 : null
        let received = 0, reached: string | null = null
        if (target != null) for (const receipt of [...receipts].sort((a, b) => timestamp(a.at) - timestamp(b.at))) { received += receipt.qty; if (received >= target) { reached = receipt.at; break } }
        const elapsed = validStart ? timestamp(reached || TIMING_AS_OF) - timestamp(assigned.slice(0, 10)) : null, gap = deadline == null ? null : Math.max(0, timestamp(reached || TIMING_AS_OF) - deadline)
        const contractDocument = branch ? Object.values(branch.docs).find(d => d.type === '车缝任务分配合同' && d.object.includes(task.id)) : undefined
        const missing = [!validStart ? '业务分配日期缺失' : '', !validHeld ? task.held === 0 ? '工厂实领为0，节点目标尚不能计算' : '工厂实领量缺失' : ''].filter(Boolean)
        const state = missing.length ? `${missing.join('；')} · 合同节点无法判定` : reached ? gap ? `已达标 · 晚${duration(gap)}` : '已达标 · 按期' : gap ? `未达标 · 已超时${duration(gap)}` : '未达标 · 截止未到'
        const quantity = target == null ? `节点目标量无法计算 · 后道累计实收${fmt(cumulative)}件` : `节点应累计实收${fmt(target)}件 · 当前累计实收${fmt(cumulative)}件 · ${reached ? '本节点已达标' : `${gap ? '超时仍差' : '距本节点目标还差'}${fmt(Math.max(0, target - cumulative))}件`}`
        rows.push({ id: `${c.order}:${task.id}:${percent}`, production: c, documentId: contractDocument?.id, documentNo: contractDocument?.no, title: `${task.factory} ${task.id} · ${percent}%回货`, object: `${rule.name} · 工厂实领${task.held == null ? '待核实' : fmt(task.held) + '件'}`, kind: '合同累计回货', state, executionState: reached ? '本节点累计实收已达标' : `当前后道累计实收${fmt(cumulative)}件`, quantity, startedAt: validStart ? assigned.slice(0, 10) + ' 00:00' : null, endedAt: reached, deadline, deadlineLabel: !validStart ? '业务分配日期缺失' : undefined, elapsed, gap: validHeld ? gap : null, executor: task.executor, receiver: task.receiver, unit: '件' })
      }
    }
  }
  return rows
}
function orderRows(cases: TimingCase[]): OrderRow[] {
  return cases.filter(c => Boolean(c.order)).map(c => {
    const facts = getTimingFacts(c), issues = getTimingIssues(c), works = workRows([c]), current = issues.filter(i => i.category === 'work' && i.tone === 'bad'), historical = works.filter(w => Boolean(w.endedAt) && (Boolean(w.gap) || /晚于要求日期/.test(w.state))), factual = issues.filter(i => i.category === 'facts')
    const health = facts.complete ? !c.warehouseAt ? '全部已入成衣仓 · 是否按期待核实' : timestamp(c.warehouseAt) > facts.deadline ? '全部已入成衣仓 · 晚入库' : '全部已入成衣仓 · 按期' : current.length ? '有未完成超时工作' : facts.remaining === null ? '入库数量未知 · 完成结果无法判定' : timestamp(TIMING_AS_OF) > facts.deadline ? '未全部入成衣仓 · 已过整单截止' : factual.length ? '未全部入成衣仓 · 部分时效待核实' : '未全部入成衣仓 · 暂无未完成超时工作'
    const currentLabel = current[0]?.title || issues.find(i=>i.category==='work'&&i.tone==='warn')?.title || factual[0]?.title || (facts.complete ? facts.result : historical.length ? `暂无需继续催办的超时工作；${historical.length}项已结束但晚完成` : '已知工作暂无未完成超时；整单尚未全部入成衣仓')
    return { id: c.order!, production: c, facts, health, current: currentLabel, currentCount: current.length, historyCount: historical.length, factualCount: factual.length, status: facts.complete ? '已全部入成衣仓' : facts.remaining === null ? '入库完成情况待核实' : '尚未全部入成衣仓', warehouse: c.warehouse, deadline: facts.deadline, firstAt: facts.first.at, follower: follower(c), scenario: scene(c) }
  })
}
function matchingCases(): TimingCase[] {
  return listTimingCases().filter(c => {
    const facts = getTimingFacts(c), q = filters.query.trim().toLowerCase(), rows = orderRows([c]), health = rows[0]?.health || '待关联生产单'
    if (q && ![c.order, display(c.style), display(c.merch), ...c.purchases.map(p => p.id), ...tasks(c).map(t => t.id), ...(currentSection === 'work-items' ? Object.values(getTimingBranch(c)?.docs || {}).flatMap(d => [d.no, d.object, d.type]) : []), scene(c)].join(' ').toLowerCase().includes(q)) return false
    if (filters.follower !== '全部' && !follower(c).includes(filters.follower)) return false
    if (filters.scenario !== '全部' && c.key !== filters.scenario) return false
    if (filters.factory !== '全部' && !tasks(c).some(t => t.factory === filters.factory)) return false
    if (filters.health !== '全部' && health !== filters.health) return false
    if (filters.scope === '尚未确认全量入仓' && facts.complete || filters.scope === '已全部入成衣仓' && !facts.complete) return false
    const at = timestamp(facts.first.at)
    if (filters.dateFrom && at < timestamp(filters.dateFrom) || filters.dateTo && at >= timestamp(filters.dateTo) + DAY) return false
    return true
  })
}
function input(label: string, key: keyof Filters, value: string, type = 'text'): string { return `<label class="pf-order-filter"><span>${e(label)}</span><input type="${type}" data-pf-field="order-${key}" data-skip-page-rerender="true" value="${e(value)}" ${key === 'query' ? 'placeholder="生产单 / 采购单 / 款式 / 工厂任务"' : ''}></label>` }
function select(label: string, key: keyof Filters, value: string, options: { value: string; label: string }[]): string { return `<label class="pf-order-filter"><span>${e(label)}</span><select data-pf-field="order-${key}" data-skip-page-rerender="true">${options.map(option => `<option value="${e(option.value)}" ${value === option.value ? 'selected' : ''}>${e(option.label)}</option>`).join('')}</select></label>` }
function options(values: string[]): { value: string; label: string }[] { return values.map(value => ({ value, label: value })) }
function filtersHtml(): string {
  const allCases = listTimingCases(), healths = [...new Set(orderRows(allCases).map(row => row.health))], factories = [...new Set(allCases.flatMap(c => tasks(c).map(task => task.factory)))].sort()
  return `<section class="pf-order-query" aria-label="生产单查询"><div class="pf-order-filter-grid">${input('生产单 / 采购单 / 款式 / 任务', 'query', draft.query)}${select('跟单', 'follower', draft.follower, options(['全部', '陈静', '王明']))}${select('完成范围', 'scope', draft.scope, options(['全部', '尚未确认全量入仓', '已全部入成衣仓']))}${more ? `${select('入仓结果 / 未完成超时', 'health', draft.health, options(['全部', ...healths]))}${select('演示场景', 'scenario', draft.scenario, [{ value: '全部', label: '全部场景' }, ...allCases.map(c => ({ value: c.key, label: scene(c) }))])}${select('责任工厂', 'factory', draft.factory, options(['全部', ...factories]))}${input('最早采购下单 · 从', 'dateFrom', draft.dateFrom, 'date')}${input('最早采购下单 · 至', 'dateTo', draft.dateTo, 'date')}` : ''}</div><div class="pf-order-query-actions">${button('查询', 'order-query')}${button('重置', 'order-reset')}${button('导出当前查询全部结果', 'order-export')}${button(more ? '收起筛选' : '更多筛选', 'order-more', `aria-expanded="${more}"`)}<small>统计、图表、列表共用当前查询范围；按生产单去重</small></div></section>`
}
function kpis(rows: OrderRow[]): string {
  const data = [['范围内生产单', rows.length, '全部'], ['尚未确认全量入仓', rows.filter(r => !r.facts.complete).length, '尚未确认全量入仓'], ['有未完成超时工作的生产单', rows.filter(r => r.currentCount > 0).length, '有未完成超时工作'], ['已全部入成衣仓', rows.filter(r => r.facts.complete).length, '已全部入成衣仓'], ['有资料待核实的生产单', rows.filter(r => r.factualCount > 0).length, '']]
  return `<div class="pf-order-kpis">${data.map(([label, value, filter]) => `<${filter ? 'button type="button" data-pf-action="order-stat" data-value="' + e(filter) + '" data-skip-page-rerender="true"' : 'div'} class="pf-order-kpi"><span>${label}</span><strong>${value}</strong></${filter ? 'button' : 'div'}>`).join('')}</div>`
}
function orderColumns(): StandardListColumn<OrderRow>[] { return [
  { key: 'id', title: '生产单 / 采购来源', width: 220, required: true, freezeable: true, sortable: true, render: row => `${anchor(row.id, timingCaseHref(row.production))}<small>${row.production.purchases.map(p => e(p.id)).join(' / ')}<br>${e(row.scenario)}</small>` },
  { key: 'style', title: '款式', width: 250, render: row => imageCell(display(row.production.style), styleCode(row.production), row.production.imageUrl) },
  { key: 'health', title: '整单入仓结果 / 工作超时', width: 205, sortable: true, render: row => `${badge(row.health)}<small>${e(row.facts.result)}<br>未完成超时工作 ${row.currentCount}项 · 已结束但晚的计时项 ${row.historyCount}项</small>` },
  { key: 'follower', title: '跟单 / 协调', width: 145, sortable: true, render: row => `${e(row.follower)}<small>协调 ${e(row.production.coordinator || '待核实')}</small>` },
  { key: 'firstAt', title: '最早商品采购下单', width: 175, sortable: true, sortValue: row => timestamp(row.firstAt), render: row => `${time(row.firstAt)}<small>${row.facts.complete && row.production.warehouseAt ? '下单至全量入仓' : row.facts.complete ? '实际全程耗时待核实；下单至查看时点' : '下单至查看时点'} ${fmt((timestamp(row.facts.complete && row.production.warehouseAt ? row.production.warehouseAt : TIMING_AS_OF) - timestamp(row.firstAt)) / DAY)} 自然日</small>` },
  { key: 'deadline', title: '全部入成衣仓截止', width: 175, sortable: true, render: row => `${time(row.deadline)}<small>最早采购下单＋28自然日</small>` },
  { key: 'warehouse', title: '成衣仓已入库 / 应完成', width: 195, sortable: true, sortValue: row => row.warehouse, render: row => `<b>${row.warehouse == null ? '待核实' : fmt(row.warehouse)} / ${fmt(row.facts.required)}件</b><small>${row.facts.remaining == null ? '未入仓量待核实' : `尚未入仓${fmt(row.facts.remaining)}件`}${row.production.warehouseAt ? '<br>最后入库 ' + time(row.production.warehouseAt) : row.warehouse === 0 ? '<br>尚无已记录入仓数量' : '<br>最后入库时间缺失 · 按期结果待核实'}</small>` },
  { key: 'position', title: '未入仓量的已知进度 / 待核实位置', width: 255, render: row => { const balance = row.facts.balance; return balance ? `<small>${balance.waiting ? `尚未下发车缝${fmt(balance.waiting)}件 · ` : ''}工厂实领、后道尚未实收${fmt(balance.factory)}件<br>后道加工${!row.facts.complete && row.production.key !== 'late' && !row.production.processing && !balance.waiting ? '待取得' : fmt(balance.processing) + '件'} · 后道已交出、成衣仓待收${fmt(balance.handover)}件${balance.unknown ? `<br>任务归属待核实${fmt(balance.unknown)}件` : ''}${balance.position ? `<br>后道位置待核实${fmt(balance.position)}件` : ''}</small>` : '当前位置待核实' } },
  { key: 'current', title: '当前优先处理 / 核实', width: 280, render: row => `${e(row.current)}${row.factualCount ? `<small>资料核实${row.factualCount}项，进入图示查看</small>` : ''}` },
  { key: 'operations', title: '操作', width: 100, required: true, actionColumn: true, render: row => anchor('全程图示', timingCaseHref(row.production)) },
] }
function pendingHtml(cases: TimingCase[]): string {
  const pending = cases.filter(c => !c.order)
  if (!pending.length) return ''
  const columns: StandardListColumn<TimingCase>[] = [
    { key: 'purchase', title: '商品采购单', width: 190, required: true, freezeable: true, render: c => anchor(c.purchases.map(p => p.id).join(' / '), timingCaseHref(c)) },
    { key: 'style', title: '款式', width: 250, render: c => imageCell(display(c.style), styleCode(c), c.imageUrl) },
    { key: 'start', title: '最早采购下单 / 成衣仓入库截止', width: 180, render: c => { const facts = getTimingFacts(c); return `下单 ${time(facts.first.at)}<small>入库截止 ${time(facts.deadline)}</small>` } },
    { key: 'quantity', title: '原采购应完成 / 成衣仓已入库', width: 160, render: c => `${fmt(getTimingFacts(c).required)}件 / ${c.warehouse == null ? '待核实' : fmt(c.warehouse) + '件'}` },
    { key: 'status', title: '待核实内容', width: 280, render: () => `${badge('生产单关联尚未取得')}<small>尚未取得生产单关联，准备、加工及入仓事实无法核对；不表示尚未生产或未建单</small>` },
    { key: 'operations', title: '操作', width: 100, required: true, actionColumn: true, render: c => anchor('查看资料缺口', timingCaseHref(c)) },
  ]
  return `<section class="pf-order-pending"><h2>采购待关联 · ${pending.length}条</h2><p>以下采购的有效生产单关联尚未取得；是否已建单、生产及入仓仍需核实，独立展示，不计入生产单数量或完成率。</p>${renderDataTable('timing-pending', '采购待关联', columns, pending, ui)}</section>`
}
function overviewHtml(rows: OrderRow[]): string {
  const states = [...new Set(rows.map(row => row.health))], maximum = Math.max(1, rows.length)
  return `<section class="pf-order-overview"><div><h2>整单入仓结果与未完成超时工作</h2><div class="pf-order-status-chart">${states.map(status => { const count = rows.filter(r => r.health === status).length; return `<button type="button" data-pf-action="order-health" data-value="${e(status)}" data-skip-page-rerender="true"><span>${status}</span><i><b style="width:${count / maximum * 100}%"></b></i><strong>${count}单</strong></button>` }).join('')}</div></div><div class="pf-order-priority"><h2>当前需要跟进</h2>${rows.filter(r => r.currentCount || r.factualCount || getTimingIssues(r.production).some(i=>i.category==='work'&&i.tone==='warn')).slice(0, 5).map(row => `<a href="${e(timingCaseHref(row.production))}" data-pf-action="navigate" data-path="${e(timingCaseHref(row.production))}" data-skip-page-rerender="true"><b>${e(row.id)}</b><span>${e(row.current)}</span><small>${e(row.follower)} · 未完成超时工作${row.currentCount}项 / 资料核实${row.factualCount}项</small></a>`).join('') || '<p>当前查询范围暂无需催办的未完成超时或资料核实事项；已结束但晚完成的工作仍在列表保留。</p>'}</div></section>`
}
function documentButton(row: WorkRow): string { return row.documentId ? `<button type="button" class="pf-link" data-pf-action="source-document" data-document="${e(row.documentId)}" data-order-id="${e(row.production.id)}" data-skip-page-rerender="true">${e(row.title)}</button>` : anchor(row.title, timingCaseHref(row.production)) }
function workColumns(): StandardListColumn<WorkRow>[] { return [
  { key: 'title', title: '具体工作 / 对应单据', width: 275, required: true, freezeable: true, render: row => `${documentButton(row)}<small>${e(row.kind)} · ${e(row.documentNo || '对应单据待核实')}</small>` },
  { key: 'production', title: '生产单 / 对象范围', width: 250, render: row => `${anchor(row.production.order || '待关联生产单', timingCaseHref(row.production))}<small>${e(row.object)}</small>` },
  { key: 'state', title: '本工作时效 / 单据状态', width: 150, sortable: true, render: row => `${badge(row.state)}<small>${e(row.executionState)}</small>` },
  { key: 'executor', title: '执行负责人', width: 130, sortable: true, render: row => e(row.executor || '待核实') },
  { key: 'receiver', title: '接收确认责任', width: 145, sortable: true, render: row => e(row.receiver || '待核实') },
  { key: 'startedAt', title: '计时起点 / 业务分配', width: 175, sortable: true, sortValue: row => timestamp(row.startedAt), render: row => time(row.startedAt) },
  { key: 'deadline', title: '应完成截止', width: 175, sortable: true, render: row => row.deadlineLabel || (row.deadline == null ? row.startedAt ? '时效要求未确认 · 截止无法计算' : '开始时间缺失 · 截止无法计算' : time(row.deadline)) },
  { key: 'endedAt', title: '实际完成 / 接收 / 达标', width: 175, sortable: true, sortValue: row => timestamp(row.endedAt), render: row => row.endedAt ? time(row.endedAt) : row.state.includes('缺失') ? '完成时间待核实' : '尚无实际完成 / 接收 / 达标时间' },
  { key: 'elapsed', title: '本项计时已用', width: 135, sortable: true, render: row => row.kind === '产前样衣交出' ? '按交样日期判断，日内截止未定' : row.elapsedLabel ? `${row.elapsedLabel}：${duration(row.elapsed)}` : duration(row.elapsed) },
  { key: 'gap', title: '未结束超时 / 已结束延误', width: 150, sortable: true, render: row => row.gap == null ? row.kind === '产前样衣交出' ? row.state : '判断依据不足 · 时效无法判定' : row.gap ? `${row.endedAt ? '已结束 · 晚' : '仍未结束 · 已超时'}${duration(row.gap)}` : row.endedAt ? '已结束 · 按期' : '尚未结束 · 截止未到' },
  { key: 'quantity', title: '独立数量与现场单位', width: 250, render: row => e(row.quantity) },
  { key: 'operations', title: '操作', width: 100, required: true, actionColumn: true, render: row => anchor('全程图示', timingCaseHref(row.production)) },
] }
function filteredWorkRows(cases: TimingCase[]): WorkRow[] {
  const query = filters.query.trim().toLowerCase()
  return workRows(cases.filter(c => c.order)).filter(row => !query || [row.production.order, row.production.style, ...row.production.purchases.map(p => p.id), row.title, row.object, row.documentNo].join(' ').toLowerCase().includes(query))
}
function teamTaskRows(cases: TimingCase[]) {
  return cases.filter(c => c.order).flatMap(c => tasks(c).filter(task => filters.factory === '全部' || task.factory === filters.factory).map(task => ({ production: c, ...task, received: timingReceiptTotal(task), nodes: workRows([c]).filter(row => row.kind === '合同累计回货' && row.title.includes(task.id)) })))
}
function teamsHtml(cases: TimingCase[]): string {
  const allTasks = teamTaskRows(cases)
  const factories = [...new Set(allTasks.map(task => task.factory))]
  return `<div class="pf-order-factory-summary">${factories.map(factory => { const subset = allTasks.filter(task => task.factory === factory), held = subset.reduce((total, task) => total + (task.held ?? 0), 0), received = subset.reduce((total, task) => total + task.received, 0), late = subset.filter(task => !getTimingFacts(task.production).complete && task.nodes.some(node => node.state.startsWith('未达标 · 已超时'))); return `<section><h2>${e(factory)}</h2><b>后道累计实收 ${fmt(received)} / 已知工厂实领 ${fmt(held)}件</b><p>${subset.length}项任务 · ${late.length}项合同未达标且超时${subset.some(task => task.held == null) ? ' · 部分实领量待核实' : ''}</p><small>汇总只看数量；${late.length ? late.map(task => e(task.id)).join('、') + '仍需逐项跟进' : '逐任务查看合同节点'}。同厂任务不跨任务冲抵。</small></section>` }).join('')}</div>${renderDataTable('timing-factories', '逐厂逐任务回货', [
    { key: 'id', title: '工厂 / 具体任务', width: 205, required: true, freezeable: true, render: task => `${e(task.factory)}<small>${documentButton({ title: task.id, documentId: task.nodes[0]?.documentId, production: task.production } as WorkRow)}</small>` },
    { key: 'production', title: '生产单', width: 190, render: task => anchor(task.production.order || '待关联生产单', timingCaseHref(task.production)) },
    { key: 'contract', title: '合同类型 / 业务分配日期', width: 180, render: task => `${e(contractRules[task.type]?.name || task.type)}<small>${e(task.assigned || '业务分配日期缺失')}</small>` },
    { key: 'held', title: '工厂实领量', width: 110, sortable: true, render: task => task.held == null ? '工厂实领量待核实' : `${fmt(task.held)}件` },
    { key: 'received', title: '后道实收量', width: 110, sortable: true, render: task => `${fmt(task.received)}件` },
    { key: 'nodes', title: '30% / 70% / 100%节点', width: 365, render: task => task.nodes.map(node => `${badge(node.state)} ${e(node.title.slice(node.title.lastIndexOf('·') + 1))} · 应达标截止 ${node.deadline == null ? '分配日期缺失' : time(node.deadline)}<small>${e(node.quantity)}</small>`).join('<br>') },
    { key: 'executor', title: '执行 → 接收确认', width: 210, render: task => `${e(task.executor)} → ${e(task.receiver)}` },
    { key: 'operations', title: '操作', width: 100, required: true, actionColumn: true, render: task => anchor('全程图示', timingCaseHref(task.production)) },
  ], allTasks, ui)}`
}
function inboundHtml(rows: OrderRow[]): string {
  const completed = rows.filter(row => row.facts.complete), withTime = completed.filter(row => row.production.warehouseAt), timely = withTime.filter(row => timestamp(row.production.warehouseAt) <= row.deadline), totalRequired = rows.reduce((sum, row) => sum + row.facts.required, 0), totalKnown = rows.filter(row => row.warehouse !== null).reduce((sum, row) => sum + (row.warehouse ?? 0), 0)
  return `<section class="pf-order-inbound-summary"><div><span>已完成生产单按期入仓率（可判定）</span><strong>${withTime.length ? fmt(timely.length / withTime.length * 100) + '%' : '待核实'}</strong><small>按期${timely.length}单 / 全量入仓且有最后入库时间${withTime.length}单；未完成单不计入此分母</small></div><div><span>已全量入仓 · 最后入库时间缺失</span><strong>${completed.length - withTime.length}单</strong><small>数量已完成，但是否按期无法判定；排除按期率分母</small></div><div><span>已知成衣仓入库量 / 全部采购应完成量</span><strong>${fmt(totalKnown)} / ${fmt(totalRequired)}件</strong><small>${rows.filter(row => row.warehouse === null).length}单入库量未知，未知不填0；此合计不代表全范围实际入仓率</small></div></section><p class="pf-order-definition">按采购原下单数量判断全量完成；最后一批实际入成衣仓时间与最早关联商品采购下单＋28自然日比较。当前局部工作超时不推定整单必然晚完成。</p>${renderDataTable('timing-inbound', '整单入库结果', orderColumns(), rows, ui)}`
}
function configurationHtml(): string {
  const rules = [
    ['整单目标', '最早关联商品采购下单 → 全部应完成数量入成衣仓', '下单时刻＋28自然日；商品采购不能拆到多个生产单'],
    ['准备阶段', '从最早商品采购下单开始', '无定位印整体4天；有定位印整体5天；并行支线不相加'],
    ['面辅料采购', '各自物料采购下单 → 面料仓 / 辅料仓实收', '各单8自然日；库存来源仍须调拨交出与下游接收单据'],
    ['辅助工艺', '每道实际加工开始 → 实际加工完成', '每道3自然日；大货染色、印花、水洗不套用此标准'],
    ['工厂合同 · 独立车缝', '业务分配日为第1天；累计30% / 70% / 100%', `第${SEWING_RETURN_COUNTING_DAYS.INDEPENDENT_SEWING.join(' / ')}自然日当日23:59截止；分母工厂实领，分子该任务后道实收`],
    ['工厂合同 · 车缝＋烫包', '业务分配日为第1天；累计30% / 70% / 100%', `第${SEWING_RETURN_COUNTING_DAYS.SEWING_TO_IRON_PACK.join(' / ')}自然日当日23:59截止；星期日照常计入`],
    ['工厂合同 · 裁剪＋车缝＋烫包', '业务分配日为第1天；累计30% / 70% / 100%', `第${SEWING_RETURN_COUNTING_DAYS.CUTTING_TO_IRON_PACK.join(' / ')}自然日当日23:59截止；同厂任务分别判断`],
    ['工厂产前版样衣', '实际领料后第3天交出', '按日期展示，日内截止时刻待确认；是否通过不影响合同回货'],
    ['交接', '上游实际交出 / 调拨出 → 下游实际接收', '与加工分别计时；未配置标准仅记录耗时，正常或超时均无法判定'],
    ['人工放行', '读取裁片放行管理的人工记录', '业务人员决定是否放行；系统不按齐套或样衣结果自动放行'],
    ['资料缺口', '数量、时间、归属未知', '未知与0、未完成、无需办理分别表达；数据冲突进入核实'],
  ]
  return `<section class="pf-order-rules"><h2>已确认时效口径（只读）</h2><p>当前原型按已确认口径展示。本页不提供规则编辑；这里记录时效要求及资料来源。办理生产、交接、放行仍在相应原模块。</p><table><thead><tr><th>监控对象</th><th>起止依据</th><th>时效与完成要求</th></tr></thead><tbody>${rules.map(row => `<tr>${row.map(cell => `<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table><p>演示查看时点 ${TIMING_AS_OF}（北京时间）；静态演示不会因打开、查询或刷新而写入业务记录。</p></section>`
}
function pageBody(section: ModuleSection): string {
  if (section === 'configuration') return configurationHtml()
  const cases = matchingCases(), rows = orderRows(cases), productionCases = cases.filter(c => c.order)
  if (section === 'pending-purchases') return pendingHtml(cases) || '<div class="pf-order-empty">当前查询范围无待关联采购，可重置筛选。</div>'
  if (section === 'work-items') return `<p class="pf-order-definition">加工和交接按具体单据分别计时；不同单位不汇总。准备阶段整体要求与支线工作分别展示，不重复加总为全程时长。</p>${renderDataTable('timing-work-items', '具体工作与交接', workColumns(), filteredWorkRows(productionCases), ui)}`
  if (section === 'teams') return teamsHtml(productionCases)
  if (section === 'inbound-analysis') return inboundHtml(rows)
  return `${kpis(rows)}${section === 'overview' ? overviewHtml(rows) : ''}${section === 'follow-up' ? '<p class="pf-order-definition">默认显示陈静负责的生产单；可切换跟单。当前执行人与接收确认责任在图中逐项查看。</p>' : ''}${renderDataTable('timing-' + section, section === 'follow-up' ? '我的生产单' : '生产单', orderColumns(), rows, ui)}${pendingHtml(cases)}`
}
export function renderOrderModulePage(section: string): string {
  const selected = (Object.hasOwn(sectionLabels, section) ? section : 'overview') as ModuleSection
  if (selected !== currentSection) { currentSection = selected; resetTablePages(); if (selected === 'follow-up' && filters.follower === '全部') { draft.follower = '陈静'; filters.follower = '陈静' } }
  return `<section id="timing-module-root" class="pf-order-module" data-timing-section="${selected}"><header class="pf-order-heading"><div><p>数据决策系统 DDS / 供应链域 / 生产与履约时效</p><h1>${sectionLabels[selected]}</h1><small>演示查看时点 ${TIMING_AS_OF} · 自然日</small></div>${anchor('生产单监控', BASE + '/orders')}</header>${selected === 'configuration' ? '' : filtersHtml()}${notice ? `<p class="pf-order-notice" role="status">${e(notice)}</p>` : ''}<div id="timing-module-content">${pageBody(selected)}</div><div id="timing-module-overlays"></div></section>`
}
function refreshContent(): void { const root = document.querySelector('#timing-module-content'); if (root) root.innerHTML = pageBody(currentSection) }
function refreshFilters(): void { const query = document.querySelector('.pf-order-query'); if (query) query.outerHTML = filtersHtml() }
function refreshOverlay(): void { const root = document.querySelector('#timing-module-overlays'); if (root) root.innerHTML = columnOverlay ? renderColumns(activeTableId) : '' }
function exportCsv(): void {
  const cases = matchingCases(), rows = orderRows(cases), works = filteredWorkRows(cases), teamTasks = currentSection === 'teams' ? teamTaskRows(cases) : []
  const values: unknown[][] = currentSection === 'work-items' ? [['生产单', '具体工作', '本工作时效结果', '单据状态', '执行负责人', '接收确认责任', '计时起点 / 业务分配', '应完成 / 达标截止', '实际完成 / 接收 / 达标', '本项数量（含现场单位）'], ...works.map(row => [row.production.order, row.title, row.state, row.executionState, row.executor, row.receiver, time(row.startedAt), row.deadlineLabel || time(row.deadline), time(row.endedAt), row.quantity])]
    : currentSection === 'teams' ? [['生产单', '工厂', '具体任务', '合同', '业务分配日期', '工厂实领（件）', '后道累计实收（件）', '30%节点', '70%节点', '100%节点', '执行负责人', '接收确认人'], ...teamTasks.map(task => [task.production.order, task.factory, task.id, contractRules[task.type]?.name || task.type, task.assigned, task.held, task.received, ...task.nodes.map(node => `${node.state} · ${time(node.deadline)} · ${node.quantity}`), task.executor, task.receiver])]
    : currentSection === 'pending-purchases' ? [['商品采购单', '款式', '场景', '下单时间', '入库截止', '原采购应完成量（件）', '成衣仓已入库量（件）', '生产单关联'], ...cases.filter(c => !c.order).map(c => [c.purchases.map(p => p.id).join(' / '), c.style, scene(c), time(getTimingFacts(c).first.at), time(getTimingFacts(c).deadline), getTimingFacts(c).required, c.warehouse == null ? '待核实' : c.warehouse, '未取得有效生产单关联'])]
    : [['生产单', '商品采购单', '场景', '跟单', '最早采购下单', '入库截止', '整单入仓状态', '整单入仓结果 / 未完成超时工作', '成衣仓入库量（件）', '原采购应完成量（件）', '未完成超时工作数（项）', '已结束但晚的计时项数（含合同节点）', '资料核实事项数（项）'], ...rows.map(row => [row.id, row.production.purchases.map(p => p.id).join(' / '), row.scenario, row.follower, time(row.firstAt), time(row.deadline), row.status, row.health, row.warehouse == null ? '待核实' : row.warehouse, row.facts.required, row.currentCount, row.historyCount, row.factualCount]), ...(['overview', 'orders', 'follow-up'].includes(currentSection) ? cases.filter(c => !c.order).map(c => ['待关联生产单', c.purchases.map(p => p.id).join(' / '), scene(c), follower(c), time(getTimingFacts(c).first.at), time(getTimingFacts(c).deadline), '待核实', '不计入生产单统计', c.warehouse == null ? '待核实' : c.warehouse, getTimingFacts(c).required, '', '', '']) : [])]
  const safe = (value: unknown) => { const text = String(value ?? ''); return '"' + (/^[=+\-@]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"' }
  const csv = '\uFEFF' + [['来源：本地原型静态演示记录', `查看时点${TIMING_AS_OF}`, `当前查询全部匹配结果${JSON.stringify(filters)}`], ...values].map(row => row.map(safe).join(',')).join('\r\n'), url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `生产单时效-${currentSection}-20261007.csv`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0)
  notice = `已发起当前查询结果下载：${values.length - 1}条。`
  const root = document.querySelector('#timing-module-root'); const previous = root?.querySelector('.pf-order-notice'); if (previous) previous.textContent = notice; else if (root) { const message = document.createElement('p'); message.className = 'pf-order-notice'; message.role = 'status'; message.textContent = notice; root.querySelector('#timing-module-content')?.before(message) }
}
export function handleOrderModuleClick(target: Element): boolean {
  if (!target.closest('#timing-module-root')) return false
  const element = target.closest<HTMLElement>('[data-pf-action]'); if (!element) return false
  const action = element.dataset.pfAction, table = element.closest<HTMLElement>('[data-pf-table]')?.dataset.pfTable || element.dataset.table || '', context = tableContexts.get(table)
  if (action === 'navigate') return false
  if (action === 'order-query' || action === 'order-reset') { if (action === 'order-reset') draft = emptyFilters(); filters = { ...draft }; notice = ''; document.querySelector('.pf-order-notice')?.remove(); resetTablePages(); refreshContent(); refreshFilters(); return true }
  if (action === 'order-more') { more = !more; refreshFilters(); return true }
  if (action === 'order-export') { exportCsv(); return true }
  if (action === 'order-stat') { const value = element.dataset.value || '全部'; if (['尚未确认全量入仓', '已全部入成衣仓', '全部'].includes(value)) { draft.scope = filters.scope = value; draft.health = filters.health = '全部' } else if (value) { draft.health = filters.health = value; draft.scope = filters.scope = '尚未确认全量入仓' } resetTablePages(); refreshContent(); refreshFilters(); return true }
  if (action === 'order-health') { draft.health = filters.health = element.dataset.value || '全部'; more = true; resetTablePages(); refreshContent(); refreshFilters(); return true }
  if (action === 'sort-column') { if (context) { const key = element.dataset.columnKey || ''; context.sort = { key, direction: context.sort?.key === key && context.sort.direction === 'asc' ? 'desc' : 'asc' }; context.page = 1; refreshContent() } return true }
  if (action === 'prev-page' || action === 'next-page') { if (context) { context.page += action === 'next-page' ? 1 : -1; refreshContent() } return true }
  if (action === 'columns') { columnOverlay = true; const root = document.querySelector('#timing-module-overlays'); if (root) root.innerHTML = renderColumns(table); return true }
  if (action === 'close-column-settings') { columnOverlay = false; refreshOverlay(); return true }
  if (['toggle-column-visibility', 'toggle-column-freeze', 'column-up', 'restore-column-settings'].includes(action || '')) {
    const current = tableContexts.get(activeTableId); if (!current) return true
    const key = element.dataset.pfColumnKey || element.dataset.columnKey || element.dataset.key || '', column = current.columns.find(col => col.key === key)
    if (action === 'toggle-column-visibility' && column && !column.required && !column.actionColumn) current.preferences.visibleKeys = current.preferences.visibleKeys.includes(key) ? current.preferences.visibleKeys.filter(item => item !== key) : [...current.preferences.visibleKeys, key]
    if (action === 'toggle-column-freeze' && column?.freezeable) current.preferences.frozenKeys = current.preferences.frozenKeys.includes(key) ? current.preferences.frozenKeys.filter(item => item !== key) : [...current.preferences.frozenKeys, key]
    if (action === 'column-up') { const index = current.preferences.order.indexOf(key); if (index > 0) [current.preferences.order[index - 1], current.preferences.order[index]] = [current.preferences.order[index], current.preferences.order[index - 1]] }
    if (action === 'restore-column-settings') current.preferences = { order: current.columns.map(col => col.key), visibleKeys: current.columns.map(col => col.key), frozenKeys: current.columns.filter(col => col.required && col.freezeable).slice(0, 1).map(col => col.key), pageSize: 20 }
    saveTablePreferences(current); refreshContent(); refreshOverlay(); return true
  }
  if (action === 'image') { const root = document.querySelector('#timing-module-overlays'); if (root) root.innerHTML = `<div class="pf-order-image-backdrop" data-pf-action="order-close-image" data-skip-page-rerender="true"><section role="dialog" aria-modal="true" aria-label="款式大图"><header><strong>${e(element.dataset.label || '款式实图')}</strong>${button('关闭', 'order-close-image')}</header><img src="${e(element.dataset.image || TIMING_IMAGE)}" alt="${e(element.dataset.label || '款式实图')}"></section></div>`; return true }
  if (action === 'order-close-image') { if (target.closest('section[role="dialog"]') && !target.closest('button')) return true; const root = document.querySelector('#timing-module-overlays'); if (root) root.innerHTML = ''; return true }
  return false
}
export function handleOrderModuleField(target: Element): boolean {
  if (!target.closest('#timing-module-root')) return false
  const element = target as HTMLInputElement | HTMLSelectElement, key = element.dataset.pfField
  if (key?.startsWith('order-')) { const property = key.slice(6) as keyof Filters; if (Object.hasOwn(draft, property)) draft[property] = element.value; return true }
  if (key === 'pageSize') { const table = element.closest<HTMLElement>('[data-pf-table]')?.dataset.pfTable || '', context = tableContexts.get(table); if (context) { context.preferences.pageSize = Number(element.value); context.page = 1; saveTablePreferences(context); refreshContent() } return true }
  return false
}
export function handleOrderModuleKey(event: KeyboardEvent): boolean {
  if (!document.querySelector('#timing-module-root')) return false
  if (event.key === 'Escape') { const root = document.querySelector('#timing-module-overlays'); if (root?.innerHTML) { columnOverlay = false; root.innerHTML = ''; return true } }
  if (event.key === 'Enter' && (event.target as Element | null)?.matches('input[data-pf-field^="order-"]')) { filters = { ...draft }; resetTablePages(); refreshContent(); return true }
  return false
}
export function handleOrderModuleColumnDrag(target: Element, event: Event): boolean {
  if (!target.closest('#timing-module-overlays') || event.type !== 'drop') return false
  const drag = event as DragEvent & { higoodStandardListColumnKey?: string }, sourceKey = drag.higoodStandardListColumnKey || drag.dataTransfer?.getData('application/x-higood-list-column-key'), targetKey = target.closest<HTMLElement>('[data-standard-list-column-key]')?.dataset.standardListColumnKey, context = tableContexts.get(activeTableId)
  if (!sourceKey || !targetKey || !context || sourceKey === targetKey) return false
  const sourceColumn = context.columns.find(column => column.key === sourceKey), targetColumn = context.columns.find(column => column.key === targetKey)
  if (!sourceColumn || !targetColumn || sourceColumn.actionColumn || targetColumn.actionColumn) return false
  const order = context.preferences.order.filter(key => key !== sourceKey), index = order.indexOf(targetKey)
  if (index < 0) return false
  order.splice(index, 0, sourceKey); context.preferences.order = order; saveTablePreferences(context); refreshContent(); refreshOverlay(); return true
}
