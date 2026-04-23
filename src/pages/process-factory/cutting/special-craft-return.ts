import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildSpecialCraftTaskDetailPath,
  getSpecialCraftOperationById,
} from '../../../data/fcs/special-craft-operations.ts'
import {
  ensureSpecialCraftFeiTicketFlowSeeded,
  getSpecialCraftFeiTicketScanSummary,
  getSpecialCraftReturnBindingsByHandoverRecordId,
  listCuttingSpecialCraftFeiTicketBindings,
  listCuttingSpecialCraftReturnViews,
  receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse,
  type CuttingSpecialCraftReturnView,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  getCanonicalCuttingMeta,
  isCuttingAliasPath,
  renderCuttingPageHeader,
} from './meta.ts'

type ReturnStatusFilter = '全部' | '待回仓' | '回仓途中' | '已回仓' | '差异' | '异议中'

interface ReturnPageState {
  productionOrderNo: string
  cuttingOrderNo: string
  operationName: string
  sourceFactoryName: string
  partName: string
  colorName: string
  sizeCode: string
  keyword: string
  status: ReturnStatusFilter
  selectedFeiTicketNos: string[]
  selectedRecordNo: string
  notice: string
}

const state: ReturnPageState = {
  productionOrderNo: '',
  cuttingOrderNo: '',
  operationName: '',
  sourceFactoryName: '',
  partName: '',
  colorName: '',
  sizeCode: '',
  keyword: '',
  status: '全部',
  selectedFeiTicketNos: [],
  selectedRecordNo: '',
  notice: '',
}

const STATUS_FILTERS: ReturnStatusFilter[] = ['全部', '待回仓', '回仓途中', '已回仓', '差异', '异议中']

function getBindingForReturnRow(row: CuttingSpecialCraftReturnView) {
  return listCuttingSpecialCraftFeiTicketBindings().find(
    (binding) =>
      binding.feiTicketNo === row.feiTicketNo
      && binding.operationName === row.operationName
      && binding.partName === row.partName
      && binding.colorName === row.colorName
      && binding.sizeCode === row.sizeCode,
  )
}

function canReceiveReturnRow(row: CuttingSpecialCraftReturnView): boolean {
  return row.returnStatus === '回仓途中'
}

function getRows(): CuttingSpecialCraftReturnView[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return listCuttingSpecialCraftReturnViews().filter((row) => {
    const keyword = state.keyword.trim()
    const keywordMatched =
      keyword.length === 0
      || [
        row.productionOrderNo,
        row.cuttingOrderNo,
        row.operationName,
        row.sourceFactoryName,
        row.feiTicketNo,
        row.partName,
        row.colorName,
        row.sizeCode,
        row.returnHandoverRecordNo,
      ]
        .filter(Boolean)
        .some((value) => value.includes(keyword))

    if (!keywordMatched) return false
    if (state.status !== '全部' && row.returnStatus !== state.status) return false
    if (state.productionOrderNo && row.productionOrderNo !== state.productionOrderNo) return false
    if (state.cuttingOrderNo && row.cuttingOrderNo !== state.cuttingOrderNo) return false
    if (state.operationName && row.operationName !== state.operationName) return false
    if (state.sourceFactoryName && row.sourceFactoryName !== state.sourceFactoryName) return false
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
    label.includes('差异') || label.includes('异议')
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : label.includes('待') || label.includes('途中')
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}">${escapeHtml(label)}</span>`
}

function renderFilterOptions(values: string[], placeholder: string, field: string): string {
  return `
    <label class="space-y-1">
      <span class="text-xs text-muted-foreground">${escapeHtml(placeholder)}</span>
      <select class="h-10 w-full rounded-xl border bg-white px-3 text-sm" data-cutting-special-return-field="${escapeHtml(field)}">
        <option value="">全部</option>
        ${values
          .map(
            (value) => `
              <option value="${escapeHtml(value)}" ${state[field as keyof ReturnPageState] === value ? 'selected' : ''}>${escapeHtml(value)}</option>
            `,
          )
          .join('')}
      </select>
    </label>
  `
}

function renderFilters(rows: CuttingSpecialCraftReturnView[]): string {
  const productionOrders = Array.from(new Set(rows.map((row) => row.productionOrderNo))).sort()
  const cuttingOrders = Array.from(new Set(rows.map((row) => row.cuttingOrderNo))).sort()
  const operations = Array.from(new Set(rows.map((row) => row.operationName))).sort()
  const factories = Array.from(new Set(rows.map((row) => row.sourceFactoryName))).sort()
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
            placeholder="支持生产单 / 菲票号 / 回仓记录"
            value="${escapeHtml(state.keyword)}"
            data-cutting-special-return-field="keyword"
          />
        </label>
        ${renderFilterOptions(productionOrders, '生产单', 'productionOrderNo')}
        ${renderFilterOptions(cuttingOrders, '裁片单', 'cuttingOrderNo')}
        ${renderFilterOptions(operations, '特殊工艺', 'operationName')}
        ${renderFilterOptions(factories, '来源工厂', 'sourceFactoryName')}
        ${renderFilterOptions(parts, '裁片部位', 'partName')}
        ${renderFilterOptions(colors, '颜色', 'colorName')}
        ${renderFilterOptions(sizes, '尺码', 'sizeCode')}
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">状态</span>
          <select class="h-10 w-full rounded-xl border bg-white px-3 text-sm" data-cutting-special-return-field="status">
            ${STATUS_FILTERS.map((value) => `<option value="${escapeHtml(value)}" ${state.status === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}
          </select>
        </label>
      </div>
    </section>
  `
}

function renderSelectionBar(rows: CuttingSpecialCraftReturnView[]): string {
  const selectedRows = rows.filter((row) => state.selectedFeiTicketNos.includes(row.feiTicketNo))
  const selectedSummaries = selectedRows.map((row) => getSpecialCraftFeiTicketScanSummary(row.feiTicketNo))
  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-foreground">本次回仓确认</div>
          <div class="mt-1 text-xs text-muted-foreground">
            已扫菲票 ${state.selectedFeiTicketNos.length} 张
            ${state.selectedRecordNo ? ` · 当前回仓记录 ${escapeHtml(state.selectedRecordNo)}` : ''}
          </div>
          ${state.notice ? `<div class="mt-2 text-xs text-amber-700">${escapeHtml(state.notice)}</div>` : ''}
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" data-cutting-special-return-action="clear-selection">清空</button>
          <button type="button" class="inline-flex items-center rounded-xl border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${state.selectedFeiTicketNos.length === 0 ? 'opacity-50' : ''}" data-cutting-special-return-action="confirm-return">扫菲票确认回仓</button>
        </div>
      </div>
      ${
        selectedRows.length > 0
          ? `<div class="mt-3 flex flex-wrap gap-2">
              ${selectedRows.map((row) => `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">${escapeHtml(row.feiTicketNo)}</span>`).join('')}
            </div>
            <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              ${selectedSummaries
                .map(
                  (summary) => `
                    <div class="rounded-xl border bg-slate-50/70 p-3 text-xs">
                      <div class="font-medium text-slate-800">${escapeHtml(summary.workOrderNo || summary.parentTaskOrderNo)}</div>
                      <div class="mt-1 text-muted-foreground">当前特殊工艺：${escapeHtml(summary.currentOperationName)}</div>
                      <div class="mt-1 text-muted-foreground">原数量 ${summary.originalQty} · 当前数量 ${summary.currentQty}</div>
                      <div class="mt-1 text-muted-foreground">累计报废 ${summary.cumulativeScrapQty} · 累计货损 ${summary.cumulativeDamageQty}</div>
                      <div class="mt-1 text-muted-foreground">当前所在：${escapeHtml(summary.currentLocation)}</div>
                      ${summary.hasOpenReturnDifference ? '<div class="mt-1 text-amber-700">已回仓 · 差异待处理</div>' : ''}
                    </div>
                  `,
                )
                .join('')}
            </div>`
          : ''
      }
    </section>
  `
}

function renderTable(rows: CuttingSpecialCraftReturnView[]): string {
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
              '来源工厂',
              '任务号',
              '菲票号',
              '裁片部位',
              '颜色',
              '尺码',
              '数量',
              '原数量',
              '当前数量',
              '报废',
              '货损',
              '回仓记录',
              '回写数量',
              '差异数量',
              '当前所在',
              '回仓状态',
              '操作',
            ]
              .map((header) => `<th class="px-3 py-3 font-medium">${escapeHtml(header)}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody class="divide-y">
          ${rows
            .map((row) => {
              const binding = getBindingForReturnRow(row)
              const scanSummary = row.feiTicketNo === '待绑定' ? null : getSpecialCraftFeiTicketScanSummary(row.feiTicketNo)
              const selected = state.selectedFeiTicketNos.includes(row.feiTicketNo)
              const taskHref =
                binding && getSpecialCraftOperationById(binding.operationId)
                  ? buildSpecialCraftTaskDetailPath(binding.operationId, binding.taskOrderId)
                  : '/fcs/craft/cutting/special-processes'
              const feiHref = `/fcs/craft/cutting/fei-tickets?keyword=${encodeURIComponent(row.feiTicketNo)}`
              const handoverHref = '/fcs/pda/handover'
              return `
                <tr class="align-top ${selected ? 'bg-blue-50/50' : ''}">
                  <td class="px-3 py-3">${escapeHtml(row.productionOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.cuttingOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.operationName)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sourceFactoryName)}</td>
                  <td class="px-3 py-3">${escapeHtml(binding?.taskOrderNo || '待绑定')}</td>
                  <td class="px-3 py-3 font-medium text-blue-700">${escapeHtml(row.feiTicketNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.partName)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.colorName)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sizeCode)}</td>
                  <td class="px-3 py-3">${row.qty}</td>
                  <td class="px-3 py-3">${scanSummary?.originalQty ?? '—'}</td>
                  <td class="px-3 py-3">${scanSummary?.currentQty ?? '—'}</td>
                  <td class="px-3 py-3">${scanSummary?.cumulativeScrapQty ?? '—'}</td>
                  <td class="px-3 py-3">${scanSummary?.cumulativeDamageQty ?? '—'}</td>
                  <td class="px-3 py-3">${escapeHtml(row.returnHandoverRecordNo || '未创建')}</td>
                  <td class="px-3 py-3">${row.receiverWrittenQty ?? '-'}</td>
                  <td class="px-3 py-3">${row.differenceQty ?? '-'}</td>
                  <td class="px-3 py-3">${escapeHtml(row.currentLocation)}</td>
                  <td class="px-3 py-3">
                    ${renderStatusPill(row.returnStatus)}
                    ${scanSummary?.hasOpenReturnDifference ? '<div class="mt-1 text-xs text-amber-700">已回仓 · 差异待处理</div>' : ''}
                  </td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs ${canReceiveReturnRow(row) ? 'border-blue-200 text-blue-700 hover:bg-blue-50' : 'opacity-50'}"
                        data-cutting-special-return-action="toggle-fei-ticket"
                        data-fei-ticket-no="${escapeHtml(row.feiTicketNo)}"
                      >
                        扫菲票确认回仓
                      </button>
                      <button type="button" class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeHtml(taskHref)}">查看任务</button>
                      <button type="button" class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeHtml(feiHref)}">查看菲票</button>
                      <button type="button" class="inline-flex items-center rounded-full border px-3 py-1.5 text-xs" data-nav="${handoverHref}">查看回仓记录</button>
                      ${
                        row.returnStatus === '差异'
                          ? `<button type="button" class="inline-flex items-center rounded-full border border-rose-200 px-3 py-1.5 text-xs text-rose-700" data-nav="${handoverHref}">查看差异</button>`
                          : ''
                      }
                      ${
                        row.returnStatus === '异议中'
                          ? `<button type="button" class="inline-flex items-center rounded-full border border-rose-200 px-3 py-1.5 text-xs text-rose-700" data-nav="${handoverHref}">查看异议</button>`
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

export function renderCraftCuttingSpecialCraftReturnPage(): string {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'special-craft-return')
  const allRows = listCuttingSpecialCraftReturnViews()
  const rows = getRows()
  const waitReturnCount = allRows.filter((row) => row.returnStatus === '待回仓').length
  const inTransitCount = allRows.filter((row) => row.returnStatus === '回仓途中').length
  const returnedCount = allRows.filter((row) => row.returnStatus === '已回仓').length
  const differenceCount = allRows.filter((row) => row.returnStatus === '差异').length
  const objectionCount = allRows.filter((row) => row.returnStatus === '异议中').length

  return `
    <div class="space-y-4 p-4">
      ${renderCuttingPageHeader(meta, {
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderMetricCard('待回仓菲票', waitReturnCount, 'amber')}
        ${renderMetricCard('回仓途中菲票', inTransitCount, 'blue')}
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

export function handleCraftCuttingSpecialCraftReturnEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cutting-special-return-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingSpecialReturnField as keyof ReturnPageState | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'productionOrderNo') state.productionOrderNo = input.value
    if (field === 'cuttingOrderNo') state.cuttingOrderNo = input.value
    if (field === 'operationName') state.operationName = input.value
    if (field === 'sourceFactoryName') state.sourceFactoryName = input.value
    if (field === 'partName') state.partName = input.value
    if (field === 'colorName') state.colorName = input.value
    if (field === 'sizeCode') state.sizeCode = input.value
    if (field === 'keyword') state.keyword = input.value
    if (field === 'status') state.status = input.value as ReturnStatusFilter
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-special-return-action]')
  const action = actionNode?.dataset.cuttingSpecialReturnAction
  if (!action) return false

  if (action === 'clear-selection') {
    state.selectedFeiTicketNos = []
    state.selectedRecordNo = ''
    state.notice = ''
    return true
  }

  if (action === 'toggle-fei-ticket') {
    const feiTicketNo = actionNode.dataset.feiTicketNo
    if (!feiTicketNo) return true
    const row = getRows().find((item) => item.feiTicketNo === feiTicketNo)
    if (!row) return true
    if (!canReceiveReturnRow(row)) {
      state.notice = '当前菲票不可确认回仓，只允许回仓途中状态扫码。'
      return true
    }
    if (state.selectedRecordNo && state.selectedRecordNo !== row.returnHandoverRecordNo) {
      state.notice = '同一次回仓确认只允许选择同一回仓记录下的菲票。'
      return true
    }
    state.selectedRecordNo = row.returnHandoverRecordNo
    state.notice = ''
    if (state.selectedFeiTicketNos.includes(feiTicketNo)) {
      state.selectedFeiTicketNos = state.selectedFeiTicketNos.filter((item) => item !== feiTicketNo)
      if (state.selectedFeiTicketNos.length === 0) {
        state.selectedRecordNo = ''
      }
      return true
    }
    state.selectedFeiTicketNos = [...state.selectedFeiTicketNos, feiTicketNo]
    return true
  }

  if (action === 'confirm-return') {
    if (state.selectedFeiTicketNos.length === 0) {
      state.notice = '请先扫菲票确认回仓。'
      return true
    }
    const selectedRows = getRows().filter((row) => state.selectedFeiTicketNos.includes(row.feiTicketNo))
    const firstBinding = selectedRows[0] ? getBindingForReturnRow(selectedRows[0]) : undefined
    const returnHandoverRecordId = firstBinding?.returnHandoverRecordId
    if (!returnHandoverRecordId) {
      state.notice = '当前菲票缺少回仓交出记录，不能直接确认回仓。'
      return true
    }
    const returnBindings = getSpecialCraftReturnBindingsByHandoverRecordId(returnHandoverRecordId)
    const receiverWrittenQty = returnBindings
      .filter((binding) => state.selectedFeiTicketNos.includes(binding.feiTicketNo))
      .reduce((total, binding) => total + binding.qty, 0)
    receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse({
      returnHandoverRecordId,
      receivedFeiTicketNos: [...state.selectedFeiTicketNos],
      receiverWrittenQty,
      receiverName: '裁床扫码员',
      receivedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    state.notice = `已确认回仓，共 ${state.selectedFeiTicketNos.length} 张菲票。`
    state.selectedFeiTicketNos = []
    state.selectedRecordNo = ''
    return true
  }

  return false
}

export function isCraftCuttingSpecialCraftReturnDialogOpen(): boolean {
  return false
}
