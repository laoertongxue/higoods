import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { mockFactories } from '../../../data/fcs/factory-mock-data.ts'
import {
  buildSpecialCraftTaskDetailPath,
  getSpecialCraftOperationById,
} from '../../../data/fcs/special-craft-operations.ts'
import {
  createSpecialCraftDispatchHandoverFromFeiTickets,
  ensureSpecialCraftFeiTicketFlowSeeded,
  listCuttingSpecialCraftDispatchViews,
  listCuttingSpecialCraftFeiTicketBindings,
  type CuttingSpecialCraftDispatchView,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  getCanonicalCuttingMeta,
  getCanonicalCuttingPath,
  isCuttingAliasPath,
  renderCuttingPageHeader,
} from './meta'

type DispatchStatusFilter =
  | '全部'
  | '待绑定'
  | '待发料'
  | '已发料'
  | '已接收'
  | '待回仓'
  | '已回仓'
  | '差异'
  | '异议中'
  | '待确认顺序'

interface DispatchPageState {
  productionOrderNo: string
  cuttingOrderNo: string
  operationName: string
  targetFactoryName: string
  partName: string
  colorName: string
  sizeCode: string
  keyword: string
  status: DispatchStatusFilter
  selectedFeiTicketNos: string[]
  selectedGroupKey: string
  notice: string
}

const state: DispatchPageState = {
  productionOrderNo: '',
  cuttingOrderNo: '',
  operationName: '',
  targetFactoryName: '',
  partName: '',
  colorName: '',
  sizeCode: '',
  keyword: '',
  status: '全部',
  selectedFeiTicketNos: [],
  selectedGroupKey: '',
  notice: '',
}

const STATUS_FILTERS: DispatchStatusFilter[] = [
  '全部',
  '待绑定',
  '待发料',
  '已发料',
  '已接收',
  '待回仓',
  '已回仓',
  '差异',
  '异议中',
  '待确认顺序',
]

function resolveCuttingFactory() {
  return (
    mockFactories.find((factory) => factory.id === 'ID-F004')
    || mockFactories.find((factory) => factory.factoryType === 'CENTRAL_CUTTING')
    || mockFactories[0]
  )
}

function buildDispatchGroupKey(row: CuttingSpecialCraftDispatchView): string {
  return `${row.operationName}__${row.targetFactoryName}`
}

function getBindingForDispatchRow(row: CuttingSpecialCraftDispatchView) {
  return listCuttingSpecialCraftFeiTicketBindings().find(
    (binding) =>
      binding.feiTicketNo === row.feiTicketNo
      && binding.operationName === row.operationName
      && binding.partName === row.partName
      && binding.colorName === row.colorName
      && binding.sizeCode === row.sizeCode,
  )
}

function canDispatchRow(row: CuttingSpecialCraftDispatchView): boolean {
  return row.dispatchStatus === '待发料'
}

function getRows(): CuttingSpecialCraftDispatchView[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return listCuttingSpecialCraftDispatchViews().filter((row) => {
    const keyword = state.keyword.trim()
    const keywordMatched =
      keyword.length === 0
      || [
        row.productionOrderNo,
        row.cuttingOrderNo,
        row.operationName,
        row.targetFactoryName,
        row.feiTicketNo,
        row.partName,
        row.colorName,
        row.sizeCode,
        row.handoverRecordNo,
      ]
        .filter(Boolean)
        .some((value) => value.includes(keyword))

    if (!keywordMatched) return false
    if (state.status !== '全部' && row.dispatchStatus !== state.status && row.returnStatus !== state.status) return false
    if (state.productionOrderNo && row.productionOrderNo !== state.productionOrderNo) return false
    if (state.cuttingOrderNo && row.cuttingOrderNo !== state.cuttingOrderNo) return false
    if (state.operationName && row.operationName !== state.operationName) return false
    if (state.targetFactoryName && row.targetFactoryName !== state.targetFactoryName) return false
    if (state.partName && row.partName !== state.partName) return false
    if (state.colorName && row.colorName !== state.colorName) return false
    if (state.sizeCode && row.sizeCode !== state.sizeCode) return false
    return true
  })
}

function renderMetricCard(label: string, value: number, tone: 'blue' | 'green' | 'amber' | 'red' = 'blue'): string {
  const toneClass =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'red'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-sky-200 bg-sky-50 text-sky-700'

  return `
    <article class="rounded-2xl border bg-white p-4 shadow-sm">
      <div class="text-sm text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-semibold ${toneClass.split(' ').at(-1) || ''}">${value}</div>
    </article>
  `
}

function renderStatusPill(label: string): string {
  const tone =
    label.includes('差异') || label.includes('异议') || label.includes('异常')
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : label.includes('待')
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}">${escapeHtml(label)}</span>`
}

function renderFilterOptions(values: string[], placeholder: string, field: string): string {
  return `
    <label class="space-y-1">
      <span class="text-xs text-muted-foreground">${escapeHtml(placeholder)}</span>
      <select
        class="h-10 w-full rounded-xl border bg-white px-3 text-sm"
        data-cutting-special-dispatch-field="${escapeHtml(field)}"
      >
        <option value="">全部</option>
        ${values
          .map(
            (value) => `
              <option value="${escapeHtml(value)}" ${state[field as keyof DispatchPageState] === value ? 'selected' : ''}>
                ${escapeHtml(value)}
              </option>
            `,
          )
          .join('')}
      </select>
    </label>
  `
}

function renderFilters(rows: CuttingSpecialCraftDispatchView[]): string {
  const productionOrders = Array.from(new Set(rows.map((row) => row.productionOrderNo))).sort()
  const cuttingOrders = Array.from(new Set(rows.map((row) => row.cuttingOrderNo))).sort()
  const operations = Array.from(new Set(rows.map((row) => row.operationName))).sort()
  const factories = Array.from(new Set(rows.map((row) => row.targetFactoryName))).sort()
  const parts = Array.from(new Set(rows.map((row) => row.partName))).sort()
  const colors = Array.from(new Set(rows.map((row) => row.colorName))).sort()
  const sizes = Array.from(new Set(rows.map((row) => row.sizeCode))).sort()

  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-1 xl:col-span-2">
          <span class="text-xs text-muted-foreground">关键字</span>
          <input
            type="text"
            class="h-10 w-full rounded-xl border bg-white px-3 text-sm"
            placeholder="支持生产单 / 菲票号 / 任务号 / 交出记录"
            value="${escapeHtml(state.keyword)}"
            data-cutting-special-dispatch-field="keyword"
          />
        </label>
        ${renderFilterOptions(productionOrders, '生产单', 'productionOrderNo')}
        ${renderFilterOptions(cuttingOrders, '裁片单', 'cuttingOrderNo')}
        ${renderFilterOptions(operations, '特殊工艺', 'operationName')}
        ${renderFilterOptions(factories, '目标工厂', 'targetFactoryName')}
        ${renderFilterOptions(parts, '裁片部位', 'partName')}
        ${renderFilterOptions(colors, '颜色', 'colorName')}
        ${renderFilterOptions(sizes, '尺码', 'sizeCode')}
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">状态</span>
          <select class="h-10 w-full rounded-xl border bg-white px-3 text-sm" data-cutting-special-dispatch-field="status">
            ${STATUS_FILTERS.map((value) => `<option value="${escapeHtml(value)}" ${state.status === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}
          </select>
        </label>
      </div>
    </section>
  `
}

function renderSelectionBar(rows: CuttingSpecialCraftDispatchView[]): string {
  const selectedRows = rows.filter((row) => state.selectedFeiTicketNos.includes(row.feiTicketNo))
  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-foreground">本次发料清单</div>
          <div class="mt-1 text-xs text-muted-foreground">
            已扫菲票 ${state.selectedFeiTicketNos.length} 张
            ${state.selectedGroupKey ? ` · 当前目标 ${escapeHtml(state.selectedGroupKey.replaceAll('__', ' / '))}` : ''}
          </div>
          ${
            state.notice
              ? `<div class="mt-2 text-xs text-amber-700">${escapeHtml(state.notice)}</div>`
              : ''
          }
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
            data-cutting-special-dispatch-action="clear-selection"
          >
            清空
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-xl border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${state.selectedFeiTicketNos.length === 0 ? 'opacity-50' : ''}"
            data-cutting-special-dispatch-action="create-handover"
          >
            创建交出记录
          </button>
        </div>
      </div>
      ${
        selectedRows.length > 0
          ? `
              <div class="mt-3 flex flex-wrap gap-2">
                ${selectedRows
                  .map(
                    (row) => `
                      <span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
                        ${escapeHtml(row.feiTicketNo)}
                      </span>
                    `,
                  )
                  .join('')}
              </div>
            `
          : ''
      }
    </section>
  `
}

function renderTable(rows: CuttingSpecialCraftDispatchView[]): string {
  if (rows.length === 0) {
    return `
      <section class="rounded-2xl border border-dashed bg-white px-6 py-10 text-center text-sm text-muted-foreground">
        暂无数据
      </section>
    `
  }

  return `
    <section class="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table class="min-w-[1760px] w-full table-auto border-collapse text-sm">
        <thead class="bg-slate-50 text-left text-slate-600">
          <tr>
            ${[
              '生产单',
              '裁片单',
              '特殊工艺',
              '目标工厂',
              '任务号',
              '菲票号',
              '裁片部位',
              '颜色',
              '尺码',
              '数量',
              '当前所在',
              '发料状态',
              '回仓状态',
              '交出记录',
              '操作',
            ]
              .map((header) => `<th class="px-3 py-3 font-medium">${escapeHtml(header)}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody class="divide-y">
          ${rows
            .map((row) => {
              const binding = getBindingForDispatchRow(row)
              const selected = state.selectedFeiTicketNos.includes(row.feiTicketNo)
              const taskHref =
                binding && getSpecialCraftOperationById(binding.operationId)
                  ? buildSpecialCraftTaskDetailPath(binding.operationId, binding.taskOrderId)
                  : '/fcs/craft/cutting/special-processes'
              const feiHref = `${getCanonicalCuttingPath('fei-tickets')}?keyword=${encodeURIComponent(row.feiTicketNo)}`
              const handoverHref = '/fcs/pda/handover'
              return `
                <tr class="align-top ${selected ? 'bg-blue-50/50' : ''}">
                  <td class="px-3 py-3">${escapeHtml(row.productionOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.cuttingOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.operationName)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.targetFactoryName)}</td>
                  <td class="px-3 py-3">${escapeHtml(binding?.taskOrderNo || '待绑定')}</td>
                  <td class="px-3 py-3 font-medium text-blue-700">${escapeHtml(row.feiTicketNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.partName)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.colorName)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sizeCode)}</td>
                  <td class="px-3 py-3">${row.qty}</td>
                  <td class="px-3 py-3">${escapeHtml(row.currentLocation)}</td>
                  <td class="px-3 py-3">${renderStatusPill(row.dispatchStatus)}</td>
                  <td class="px-3 py-3">${renderStatusPill(row.returnStatus)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.handoverRecordNo || '未创建')}</td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs ${canDispatchRow(row) ? 'border-blue-200 text-blue-700 hover:bg-blue-50' : 'opacity-50'}"
                        data-cutting-special-dispatch-action="toggle-fei-ticket"
                        data-fei-ticket-no="${escapeHtml(row.feiTicketNo)}"
                      >
                        扫菲票加入本次发料
                      </button>
                      <button type="button" class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeHtml(taskHref)}">查看任务</button>
                      <button type="button" class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeHtml(feiHref)}">查看菲票</button>
                      <button type="button" class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs" data-nav="${handoverHref}">查看交出记录</button>
                      <button type="button" class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs" data-nav="${handoverHref}">查看回仓状态</button>
                      ${
                        row.dispatchStatus === '差异' || row.returnStatus === '差异' || row.dispatchStatus === '异议中' || row.returnStatus === '异议中'
                          ? `<button type="button" class="inline-flex items-center rounded-full border border-rose-200 px-3 py-1.5 text-xs text-rose-700" data-nav="${handoverHref}">查看差异</button>`
                          : ''
                      }
                    </div>
                  </td>
                </tr>
              `
            })
            .join('')}
        </tbody>
      </table>
    </section>
  `
}

export function renderCraftCuttingSpecialCraftDispatchPage(): string {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'special-craft-dispatch')
  const allRows = listCuttingSpecialCraftDispatchViews()
  const rows = getRows()
  const waitDispatchCount = allRows.filter((row) => row.dispatchStatus === '待发料').length
  const dispatchedCount = allRows.filter((row) => row.dispatchStatus === '已发料').length
  const receivedCount = allRows.filter((row) => row.dispatchStatus === '已接收').length
  const waitReturnCount = allRows.filter((row) => row.returnStatus === '待回仓' || row.returnStatus === '回仓途中').length
  const returnedCount = allRows.filter((row) => row.returnStatus === '已回仓').length
  const differenceCount = allRows.filter((row) => row.dispatchStatus === '差异' || row.returnStatus === '差异').length
  const objectionCount = allRows.filter((row) => row.dispatchStatus === '异议中' || row.returnStatus === '异议中').length

  return `
    <div class="space-y-4 p-4">
      ${renderCuttingPageHeader(meta, {
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderMetricCard('待发料菲票', waitDispatchCount, 'amber')}
        ${renderMetricCard('已发料菲票', dispatchedCount, 'blue')}
        ${renderMetricCard('已接收菲票', receivedCount, 'green')}
        ${renderMetricCard('待回仓菲票', waitReturnCount, 'amber')}
        ${renderMetricCard('已回仓菲票', returnedCount, 'green')}
        ${renderMetricCard('差异菲票', differenceCount, 'red')}
        ${renderMetricCard('异议中菲票', objectionCount, 'red')}
      </section>
      ${renderFilters(allRows)}
      ${renderSelectionBar(rows)}
      ${renderTable(rows)}
    </div>
  `
}

export function handleCraftCuttingSpecialCraftDispatchEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cutting-special-dispatch-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingSpecialDispatchField as keyof DispatchPageState | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'productionOrderNo') state.productionOrderNo = input.value
    if (field === 'cuttingOrderNo') state.cuttingOrderNo = input.value
    if (field === 'operationName') state.operationName = input.value
    if (field === 'targetFactoryName') state.targetFactoryName = input.value
    if (field === 'partName') state.partName = input.value
    if (field === 'colorName') state.colorName = input.value
    if (field === 'sizeCode') state.sizeCode = input.value
    if (field === 'keyword') state.keyword = input.value
    if (field === 'status') state.status = input.value as DispatchStatusFilter
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-special-dispatch-action]')
  const action = actionNode?.dataset.cuttingSpecialDispatchAction
  if (!action) return false

  if (action === 'clear-selection') {
    state.selectedFeiTicketNos = []
    state.selectedGroupKey = ''
    state.notice = ''
    return true
  }

  if (action === 'toggle-fei-ticket') {
    const feiTicketNo = actionNode.dataset.feiTicketNo
    if (!feiTicketNo) return true
    const row = getRows().find((item) => item.feiTicketNo === feiTicketNo)
    if (!row) return true
    if (!canDispatchRow(row)) {
      state.notice = '当前菲票不可发料，只允许待发料状态加入本次发料。'
      return true
    }
    const groupKey = buildDispatchGroupKey(row)
    if (state.selectedGroupKey && state.selectedGroupKey !== groupKey) {
      state.notice = '同一次发料只允许选择同一特殊工艺、同一目标工厂的菲票。'
      return true
    }
    state.selectedGroupKey = groupKey
    state.notice = ''
    if (state.selectedFeiTicketNos.includes(feiTicketNo)) {
      state.selectedFeiTicketNos = state.selectedFeiTicketNos.filter((item) => item !== feiTicketNo)
      if (state.selectedFeiTicketNos.length === 0) {
        state.selectedGroupKey = ''
      }
      return true
    }
    state.selectedFeiTicketNos = [...state.selectedFeiTicketNos, feiTicketNo]
    return true
  }

  if (action === 'create-handover') {
    if (state.selectedFeiTicketNos.length === 0) {
      state.notice = '请先扫菲票加入本次发料。'
      return true
    }
    const selectedRows = getRows().filter((row) => state.selectedFeiTicketNos.includes(row.feiTicketNo))
    const firstBinding = selectedRows[0] ? getBindingForDispatchRow(selectedRows[0]) : undefined
    if (!firstBinding) {
      state.notice = '当前选中菲票未绑定特殊工艺任务，不能创建交出记录。'
      return true
    }
    const cuttingFactory = resolveCuttingFactory()
    createSpecialCraftDispatchHandoverFromFeiTickets({
      cuttingFactoryId: cuttingFactory.id,
      cuttingFactoryName: cuttingFactory.name,
      targetFactoryId: firstBinding.targetFactoryId,
      targetFactoryName: firstBinding.targetFactoryName,
      operationId: firstBinding.operationId,
      operationName: firstBinding.operationName,
      selectedFeiTicketNos: [...state.selectedFeiTicketNos],
      operatorName: '裁床扫码员',
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    state.notice = `已创建交出记录，共 ${state.selectedFeiTicketNos.length} 张菲票。`
    state.selectedFeiTicketNos = []
    state.selectedGroupKey = ''
    return true
  }

  return false
}

export function isCraftCuttingSpecialCraftDispatchDialogOpen(): boolean {
  return false
}
