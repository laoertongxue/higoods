import { escapeHtml } from '../../../utils.ts'
import {
  completeFeiTicketNumbering,
  filterFeiTicketNumberingRecords,
  getFeiTicketNumberingDemoCases,
  getFeiTicketNumberingRecord,
  getFeiTicketNumberingStatus,
  listFeiTicketNumberingRecords,
  listFeiTicketNumberingTickets,
  resolveFeiTicketNumberingScan,
  summarizeFeiTicketNumberingByOperator,
  type FeiTicketNumberingScanResult,
  type FeiTicketNumberingStatus,
} from '../../../data/fcs/cutting/fei-ticket-numbering.ts'
import {
  getCanonicalCuttingMeta,
  renderCuttingPageHeader,
} from './meta.ts'

interface PageState {
  keyword: string
  operatorName: string
  status: FeiTicketNumberingStatus | '全部'
  date: string
  scanInput: string
  currentOperator: string
  feedback: string
  scanResult: FeiTicketNumberingScanResult | null
  isScanDialogOpen: boolean
}

interface NumberingRow {
  rowId: string
  feiTicketNo: string
  productionOrderNo: string
  cutOrderNo: string
  spreadingOrderNo: string
  partName: string
  size: string
  pieceSequenceLabel: string
  numberCount: number
  status: FeiTicketNumberingStatus
  operatorName: string
  completedAt: string
  isBindingStrip: boolean
}

const state: PageState = {
  keyword: '',
  operatorName: '',
  status: '全部',
  date: '',
  scanInput: '',
  currentOperator: 'Siti Aminah',
  feedback: '',
  scanResult: null,
  isScanDialogOpen: false,
}

type PeriodMode = 'week' | 'month'

interface OperatorPeriodSummary {
  operatorId: string
  operatorName: string
  periodKey: string
  periodLabel: string
  ticketCount: number
  numberCount: number
  latestCompletedAt: string
}

function statusClass(status: FeiTicketNumberingStatus): string {
  if (status === '已完成') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === '免打编号') return 'border-sky-200 bg-sky-50 text-sky-700'
  if (status === '缺少编号区间') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function renderStatusBadge(status: FeiTicketNumberingStatus): string {
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(status)}">${escapeHtml(status)}</span>`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function buildRows(): NumberingRow[] {
  const ticketRows = listFeiTicketNumberingTickets()
    .filter((ticket) => ticket.printStatus !== 'VOIDED')
    .map((ticket) => {
      const status = getFeiTicketNumberingStatus(ticket)
      const record = getFeiTicketNumberingRecord(ticket.feiTicketId) || getFeiTicketNumberingRecord(ticket.feiTicketNo)
      return {
        rowId: ticket.feiTicketId,
        feiTicketNo: ticket.feiTicketNo,
        productionOrderNo: ticket.productionOrderNo,
        cutOrderNo: ticket.cutOrderNo,
        spreadingOrderNo: ticket.spreadingOrderNo || ticket.sourceSpreadingSessionNo,
        partName: ticket.partName,
        size: ticket.skuSize,
        pieceSequenceLabel: ticket.pieceSequenceRange?.rangeLabel || ticket.pieceSequenceLabel || '-',
        numberCount: record?.numberCount || (ticket.pieceSequenceRange ? ticket.pieceSequenceRange.endNo - ticket.pieceSequenceRange.startNo + 1 : 0),
        status,
        operatorName: record?.operatorName || '-',
        completedAt: record?.completedAt || '-',
        isBindingStrip: false,
      } satisfies NumberingRow
    })

  const demoCases = getFeiTicketNumberingDemoCases()
  const bindingRow: NumberingRow = {
    rowId: 'binding-strip-demo',
    feiTicketNo: demoCases.bindingStripFeiTicketNo,
    productionOrderNo: '捆条加工单',
    cutOrderNo: 'BT-260604-001',
    spreadingOrderNo: '-',
    partName: '捆条 2.5cm',
    size: '-',
    pieceSequenceLabel: '捆条免编号',
    numberCount: 0,
    status: '免打编号',
    operatorName: '-',
    completedAt: '-',
    isBindingStrip: true,
  }
  return [...ticketRows, bindingRow]
}

function filterRows(rows: NumberingRow[]): NumberingRow[] {
  const keyword = state.keyword.trim().toUpperCase()
  const operator = state.operatorName.trim().toUpperCase()
  return rows.filter((row) => {
    if (state.status !== '全部' && row.status !== state.status) return false
    if (keyword) {
      const text = [
        row.feiTicketNo,
        row.productionOrderNo,
        row.cutOrderNo,
        row.spreadingOrderNo,
        row.partName,
        row.size,
        row.operatorName,
      ].join(' ').toUpperCase()
      if (!text.includes(keyword)) return false
    }
    if (operator && !row.operatorName.toUpperCase().includes(operator)) return false
    if (state.date && row.completedAt !== '-' && !row.completedAt.startsWith(state.date)) return false
    return true
  })
}

function renderKpiCards(rows: NumberingRow[]): string {
  const records = filterFeiTicketNumberingRecords({
    keyword: state.keyword,
    operatorName: state.operatorName,
    status: state.status,
    date: state.date,
  })
  const summaries = summarizeFeiTicketNumberingByOperator(records)
  const totalNumbers = records.reduce((sum, record) => sum + record.numberCount, 0)
  const pendingCount = rows.filter((row) => row.status === '未打编号').length
  const topOperator = summaries[0]
  const cards = [
    ['已完成菲票', `${records.length} 张`, '已有员工完成打编号记录'],
    ['已完成编号', `${formatNumber(totalNumbers)} 个`, '用于员工计件工资核对'],
    ['待打编号', `${pendingCount} 张`, '普通部位菲票入仓前必须完成'],
    ['最高计件员工', topOperator ? `${topOperator.operatorName}` : '-', topOperator ? `${topOperator.ticketCount} 张 / ${formatNumber(topOperator.numberCount)} 个编号` : '暂无记录'],
  ]
  return `
    <section class="grid gap-3 md:grid-cols-4">
      ${cards.map(([label, value, hint]) => `
        <article class="rounded-lg border bg-card p-4">
          <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
          <div class="mt-2 text-xl font-semibold text-foreground">${escapeHtml(value)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(hint)}</div>
        </article>
      `).join('')}
    </section>
  `
}

function renderScanDialog(): string {
  const result = state.scanResult
  const ticket = result?.ticket
  return `
    <div class="fixed inset-0 z-[130]" data-fei-ticket-numbering-dialog="scan">
      <button type="button" class="absolute inset-0 bg-black/45" data-fei-ticket-numbering-action="close-scan-dialog" aria-label="关闭弹窗"></button>
      <section class="absolute left-1/2 top-1/2 flex max-h-[88vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 class="text-base font-semibold text-foreground">扫码 / 输入菲票号</h2>
            <p class="mt-1 text-xs text-muted-foreground">扫描菲票获取编号区间，完成实体打编号后记录员工计件数量。</p>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-fei-ticket-numbering-action="close-scan-dialog">关闭</button>
        </header>
        <div class="space-y-4 overflow-y-auto px-5 py-4">
          <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto] lg:items-end">
            <label class="space-y-1">
              <span class="text-sm font-medium text-foreground">扫码 / 输入菲票号</span>
              <input
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value="${escapeHtml(state.scanInput)}"
                placeholder="扫描菲票二维码，或输入菲票号"
                data-skip-page-rerender="true"
                data-fei-ticket-numbering-field="scanInput"
              />
            </label>
            <label class="space-y-1">
              <span class="text-sm font-medium text-foreground">操作员工</span>
              <input
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value="${escapeHtml(state.currentOperator)}"
                placeholder="员工姓名"
                data-skip-page-rerender="true"
                data-fei-ticket-numbering-field="currentOperator"
              />
            </label>
            <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-fei-ticket-numbering-action="scan">查询编号区间</button>
            <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-fei-ticket-numbering-action="complete">完成打编号</button>
          </div>
          <div class="flex flex-wrap gap-2">
            ${renderDemoButtons()}
          </div>
          ${state.feedback ? `<div class="rounded-md border bg-muted/20 px-3 py-2 text-sm text-foreground">${escapeHtml(state.feedback)}</div>` : ''}
          ${result ? `
            <div class="rounded-lg border bg-muted/15 p-4">
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-sm font-semibold text-foreground">${escapeHtml(result.ticket?.feiTicketNo || state.scanInput || '-')}</div>
                ${renderStatusBadge(result.status)}
              </div>
              <div class="mt-3 grid gap-3 text-sm md:grid-cols-4">
                <div><span class="text-muted-foreground">部位：</span>${escapeHtml(ticket?.partName || '-')}</div>
                <div><span class="text-muted-foreground">尺码：</span>${escapeHtml(ticket?.skuSize || '-')}</div>
                <div><span class="text-muted-foreground">编号区间：</span>${escapeHtml(result.pieceSequenceLabel || '-')}</div>
                <div><span class="text-muted-foreground">计件数量：</span>${result.numberCount ? `${formatNumber(result.numberCount)} 个` : '-'}</div>
                <div class="md:col-span-4"><span class="text-muted-foreground">提示：</span>${escapeHtml(result.message)}</div>
              </div>
            </div>
          ` : '<div class="rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">请先扫描或输入菲票号。</div>'}
        </div>
        <footer class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-fei-ticket-numbering-action="close-scan-dialog">取消</button>
          <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-fei-ticket-numbering-action="complete">完成打编号</button>
        </footer>
      </section>
    </div>
  `
}

function renderDemoButtons(): string {
  const cases = getFeiTicketNumberingDemoCases()
  const buttons = [
    ['未完成样例', cases.pendingTicket?.feiTicketNo || ''],
    ['已完成样例', cases.completedTicket?.feiTicketNo || ''],
    ['缺区间样例', cases.missingRangeTicket?.feiTicketNo || ''],
    ['捆条样例', cases.bindingStripFeiTicketNo],
  ].filter(([, value]) => Boolean(value))
  return buttons.map(([label, value]) => `
    <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-fei-ticket-numbering-action="demo-scan" data-ticket-no="${escapeHtml(value)}">${escapeHtml(label)}</button>
  `).join('')
}

function renderFilters(): string {
  const statuses: Array<FeiTicketNumberingStatus | '全部'> = ['全部', '未打编号', '已完成', '免打编号', '缺少编号区间']
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto_auto]">
        <label class="space-y-1">
          <span class="text-xs font-medium text-foreground">搜索</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.keyword)}" placeholder="菲票 / 生产单 / 裁片单 / 部位" data-skip-page-rerender="true" data-fei-ticket-numbering-field="keyword" />
        </label>
        <label class="space-y-1">
          <span class="text-xs font-medium text-foreground">员工</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.operatorName)}" placeholder="员工姓名" data-skip-page-rerender="true" data-fei-ticket-numbering-field="operatorName" />
        </label>
        <label class="space-y-1">
          <span class="text-xs font-medium text-foreground">状态</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-fei-ticket-numbering-field="status">
            ${statuses.map((item) => `<option value="${escapeHtml(item)}" ${state.status === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs font-medium text-foreground">日期</span>
          <input type="date" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.date)}" data-skip-page-rerender="true" data-fei-ticket-numbering-field="date" />
        </label>
        <button type="button" class="mt-5 h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-fei-ticket-numbering-action="query">查询</button>
        <button type="button" class="mt-5 h-10 rounded-md border px-4 text-sm hover:bg-muted" data-fei-ticket-numbering-action="reset">重置</button>
      </div>
    </section>
  `
}

function renderRowsTable(rows: NumberingRow[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold text-foreground">菲票打编号明细</h2>
        <div class="text-xs text-muted-foreground">共 ${rows.length} 条</div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              ${['菲票号', '状态', '来源', '部位 / 尺码', '编号区间', '计件数量', '操作员工', '完成时间', '操作'].map((head) => `<th class="whitespace-nowrap px-4 py-3 font-medium">${escapeHtml(head)}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y">
            ${rows.length ? rows.map((row) => `
              <tr class="align-top">
                <td class="whitespace-nowrap px-4 py-3 font-medium text-blue-700">${escapeHtml(row.feiTicketNo)}</td>
                <td class="whitespace-nowrap px-4 py-3">${renderStatusBadge(row.status)}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">
                  <div>${escapeHtml(row.productionOrderNo)}</div>
                  <div class="mt-1">${escapeHtml(row.cutOrderNo)} / ${escapeHtml(row.spreadingOrderNo)}</div>
                </td>
                <td class="px-4 py-3">${escapeHtml(row.partName)} <span class="text-muted-foreground">/ ${escapeHtml(row.size)}</span></td>
                <td class="whitespace-nowrap px-4 py-3">${escapeHtml(row.pieceSequenceLabel)}</td>
                <td class="whitespace-nowrap px-4 py-3">${row.numberCount ? `${formatNumber(row.numberCount)} 个` : '-'}</td>
                <td class="whitespace-nowrap px-4 py-3">${escapeHtml(row.operatorName)}</td>
                <td class="whitespace-nowrap px-4 py-3 text-muted-foreground">${escapeHtml(row.completedAt)}</td>
                <td class="whitespace-nowrap px-4 py-3">
                  <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-fei-ticket-numbering-action="open-scan-dialog" data-ticket-no="${escapeHtml(row.feiTicketNo)}">${row.status === '未打编号' ? '去打编号' : '查看'}</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="9" class="px-4 py-8 text-center text-muted-foreground">暂无符合条件的菲票。</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function parseCompletedDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map((item) => Number(item))
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDate(value: Date): string {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
}

function getIsoWeekInfo(value: Date): { key: string; label: string } {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() || 7
  const start = new Date(date)
  start.setDate(date.getDate() - day + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const thursday = new Date(start)
  thursday.setDate(start.getDate() + 3)
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  const firstThursdayDay = firstThursday.getDay() || 7
  firstThursday.setDate(firstThursday.getDate() + 4 - firstThursdayDay)
  const weekNo = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  const year = thursday.getFullYear()
  const weekText = `W${String(weekNo).padStart(2, '0')}`
  return {
    key: `${year}-${weekText}`,
    label: `${year} 年第 ${weekNo} 周（${formatDate(start).slice(5)} 至 ${formatDate(end).slice(5)}）`,
  }
}

function getPeriodInfo(completedAt: string, mode: PeriodMode): { key: string; label: string } {
  const date = parseCompletedDate(completedAt)
  if (mode === 'month') {
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
    return { key, label: `${date.getFullYear()} 年 ${pad2(date.getMonth() + 1)} 月` }
  }
  return getIsoWeekInfo(date)
}

function buildOperatorPeriodSummaries(mode: PeriodMode): OperatorPeriodSummary[] {
  const map = new Map<string, OperatorPeriodSummary>()
  filterFeiTicketNumberingRecords({ status: '已完成' }).forEach((record) => {
    const period = getPeriodInfo(record.completedAt, mode)
    const key = `${record.operatorName}|${period.key}`
    const current = map.get(key) || {
      operatorId: record.operatorId,
      operatorName: record.operatorName,
      periodKey: period.key,
      periodLabel: period.label,
      ticketCount: 0,
      numberCount: 0,
      latestCompletedAt: '',
    }
    current.ticketCount += 1
    current.numberCount += record.numberCount
    if (!current.latestCompletedAt || record.completedAt > current.latestCompletedAt) current.latestCompletedAt = record.completedAt
    map.set(key, current)
  })
  return Array.from(map.values()).sort((left, right) =>
    left.operatorName.localeCompare(right.operatorName, 'zh-CN') ||
    right.periodKey.localeCompare(left.periodKey, 'zh-CN') ||
    right.numberCount - left.numberCount,
  )
}

function renderOperatorPeriodSummaryTable(title: string, rows: OperatorPeriodSummary[]): string {
  const totalTickets = rows.reduce((sum, row) => sum + row.ticketCount, 0)
  const totalNumbers = rows.reduce((sum, row) => sum + row.numberCount, 0)
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
          <p class="mt-1 text-xs text-muted-foreground">按员工姓名升序，同一员工按最近周期优先排序。</p>
        </div>
        <div class="text-xs text-muted-foreground">${formatNumber(totalTickets)} 张菲票 / ${formatNumber(totalNumbers)} 个编号</div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              ${['员工', '统计周期', '菲票数量', '编号数量', '最近完成时间'].map((head) => `<th class="whitespace-nowrap px-4 py-3 font-medium">${escapeHtml(head)}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y">
            ${rows.length ? rows.map((row) => `
              <tr>
                <td class="whitespace-nowrap px-4 py-3 font-medium text-foreground">${escapeHtml(row.operatorName)}</td>
                <td class="whitespace-nowrap px-4 py-3">${escapeHtml(row.periodLabel)}</td>
                <td class="whitespace-nowrap px-4 py-3">${formatNumber(row.ticketCount)} 张</td>
                <td class="whitespace-nowrap px-4 py-3 font-semibold text-foreground">${formatNumber(row.numberCount)} 个</td>
                <td class="whitespace-nowrap px-4 py-3 text-muted-foreground">${escapeHtml(row.latestCompletedAt)}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" class="px-4 py-8 text-center text-muted-foreground">暂无员工计件记录。</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function syncStateFromControls(container: ParentNode = document): void {
  container.querySelectorAll<HTMLElement>('[data-fei-ticket-numbering-field]').forEach((node) => {
    const field = node.dataset.feiTicketNumberingField as keyof PageState | undefined
    if (!field) return
    if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement) {
      ;(state as unknown as Record<string, string>)[field] = node.value
    }
  })
}

export function renderCraftCuttingFeiTicketNumberingPage(): string {
  const rows = filterRows(buildRows())
  const meta = getCanonicalCuttingMeta('fei-ticket-numbering')
  return `
    <div class="space-y-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: `
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-fei-ticket-numbering-action="open-scan-dialog">扫码打编号</button>
          <a href="/fcs/craft/cutting/fei-ticket-numbering/summary" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-10 items-center rounded-md border px-3 py-2 text-sm hover:bg-muted">员工计件汇总</a>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/pda/cutting/fei-ticket-numbering">打开 PDA 打编号</button>
        `,
      })}
      ${renderKpiCards(rows)}
      ${renderFilters()}
      ${renderRowsTable(rows)}
      ${state.isScanDialogOpen ? renderScanDialog() : ''}
    </div>
  `
}

export function renderCraftCuttingFeiTicketNumberingSummaryPage(): string {
  const meta = getCanonicalCuttingMeta('fei-ticket-numbering')
  const records = filterFeiTicketNumberingRecords({ status: '已完成' })
  const summaries = summarizeFeiTicketNumberingByOperator(records)
  const totalNumbers = records.reduce((sum, record) => sum + record.numberCount, 0)
  const topOperator = summaries[0]
  return `
    <div class="space-y-4">
      ${renderCuttingPageHeader({
        ...meta,
        pageTitle: '员工计件汇总',
        pageSubtitle: '',
        shortDescription: '按员工 + 时间周期统计菲票打编号计件数量。',
      }, {
        actionsHtml: '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/fei-ticket-numbering">返回菲票打编号</button>',
      })}
      <section class="grid gap-3 md:grid-cols-3">
        <article class="rounded-lg border bg-card p-4">
          <div class="text-xs text-muted-foreground">完成菲票</div>
          <div class="mt-2 text-xl font-semibold text-foreground">${formatNumber(records.length)} 张</div>
          <div class="mt-1 text-xs text-muted-foreground">仅统计已完成打编号的普通部位菲票</div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <div class="text-xs text-muted-foreground">完成编号</div>
          <div class="mt-2 text-xl font-semibold text-foreground">${formatNumber(totalNumbers)} 个</div>
          <div class="mt-1 text-xs text-muted-foreground">用于员工计件工资核对</div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <div class="text-xs text-muted-foreground">最高计件员工</div>
          <div class="mt-2 text-xl font-semibold text-foreground">${escapeHtml(topOperator?.operatorName || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">${topOperator ? `${topOperator.ticketCount} 张 / ${formatNumber(topOperator.numberCount)} 个编号` : '暂无记录'}</div>
        </article>
      </section>
      ${renderOperatorPeriodSummaryTable('按周汇总', buildOperatorPeriodSummaries('week'))}
      ${renderOperatorPeriodSummaryTable('按月汇总', buildOperatorPeriodSummaries('month'))}
    </div>
  `
}

export function handleCraftCuttingFeiTicketNumberingEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-fei-ticket-numbering-field]')
  if (fieldNode) {
    syncStateFromControls(fieldNode.closest('[data-page]') || document)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-fei-ticket-numbering-action]')
  if (!actionNode) return false
  syncStateFromControls(actionNode.closest('[data-page]') || document)
  const action = actionNode.dataset.feiTicketNumberingAction

  if (action === 'open-scan-dialog') {
    state.isScanDialogOpen = true
    const ticketNo = actionNode.dataset.ticketNo || ''
    if (ticketNo) {
      state.scanInput = ticketNo
      state.scanResult = resolveFeiTicketNumberingScan(state.scanInput)
      state.feedback = state.scanResult.message
    } else {
      state.scanInput = ''
      state.scanResult = null
      state.feedback = ''
    }
    return true
  }

  if (action === 'close-scan-dialog') {
    state.isScanDialogOpen = false
    return true
  }

  if (action === 'demo-scan') {
    state.isScanDialogOpen = true
    state.scanInput = actionNode.dataset.ticketNo || ''
    state.scanResult = resolveFeiTicketNumberingScan(state.scanInput)
    state.feedback = state.scanResult.message
    return true
  }

  if (action === 'scan') {
    state.isScanDialogOpen = true
    state.scanResult = resolveFeiTicketNumberingScan(state.scanInput)
    state.feedback = state.scanResult.message
    return true
  }

  if (action === 'complete') {
    state.isScanDialogOpen = true
    const result = completeFeiTicketNumbering({
      feiTicketNoOrId: state.scanInput,
      operatorName: state.currentOperator,
      operatorRole: '打编号员工',
      source: 'WEB',
    })
    state.scanResult = result
    state.feedback = result.message
    return true
  }

  if (action === 'query') {
    state.feedback = '已按当前条件查询。'
    return true
  }

  if (action === 'reset') {
    state.keyword = ''
    state.operatorName = ''
    state.status = '全部'
    state.date = ''
    state.feedback = '筛选条件已重置。'
    return true
  }

  return false
}
