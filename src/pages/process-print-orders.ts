import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { listPrepProcessOrders, type PrepProcessOrderFact } from '../data/fcs/page-adapters/process-prep-pages-adapter'
import { createPrintWorkOrderFromStock } from '../data/fcs/printing-task-domain.ts'
import { listFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import { listProcessWorkOrderStockMaterials } from '../data/fcs/process-work-order-stock.ts'
import {
  PLATFORM_PROCESS_STATUS_CLASS,
  listPlatformStatusOptions,
  type PlatformProcessStatus,
} from '../data/fcs/process-platform-status-adapter.ts'

type PageSize = 10 | 20 | 50
type ModeFilter = '全部' | '生产单自动生成' | '按备货创建'

interface PrintCreateForm {
  stockMaterialId: string
  stockMaterialName: string
  materialSku: string
  plannedQty: string
  qtyUnit: string
  factoryId: string
  plannedFinishAt: string
  processName: string
}

const factories = listFactoryMasterRecords()
  .filter((factory) => factory.status === 'active' && factory.eligibility.allowDispatch)
  .filter((factory) => factory.processAbilities.some((ability) =>
    ability.processCode === 'PRINT'
    && (ability.status ?? 'ACTIVE') === 'ACTIVE'
    && ability.canReceiveTask !== false,
  ))

const defaultForm = (): PrintCreateForm => ({
  stockMaterialId: '',
  stockMaterialName: '',
  materialSku: '',
  plannedQty: '',
  qtyUnit: '米',
  factoryId: factories[0]?.id || '',
  plannedFinishAt: '2026-07-31T18:00',
  processName: '数码印花',
})

const state = {
  keyword: '',
  statusFilter: '全部' as '全部' | PlatformProcessStatus,
  modeFilter: '全部' as ModeFilter,
  page: 1,
  pageSize: 10 as PageSize,
  selectedWorkOrderId: null as string | null,
  createOpen: false,
  notice: null as string | null,
  formError: null as string | null,
  form: defaultForm(),
}

function getStockMaterials(factoryId = state.form.factoryId) {
  return listProcessWorkOrderStockMaterials({ factoryId, processCode: 'PRINT' })
}

function formatQty(qty: number, unit: string): string {
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(qty)} ${unit}`
}

function getOrders(): PrepProcessOrderFact[] {
  return listPrepProcessOrders('PRINT')
}

function getFilteredOrders(): PrepProcessOrderFact[] {
  const keyword = state.keyword.trim().toLowerCase()
  return getOrders().filter((order) => {
    if (state.statusFilter !== '全部' && order.platformStatusLabel !== state.statusFilter) return false
    if (state.modeFilter !== '全部' && order.createMode !== state.modeFilter) return false
    if (!keyword) return true
    return [
      order.orderNo,
      order.factoryName,
      order.sourceProductionOrderNo,
      order.sourceProductionOrderId,
      order.stockMaterial?.materialCode,
      order.stockMaterial?.materialName,
      order.sourceSummary,
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
  })
}

function renderStatus(order: PrepProcessOrderFact): string {
  const label = order.platformStatusLabel || order.status
  return `<span class="inline-flex rounded-full px-2 py-1 text-xs ${PLATFORM_PROCESS_STATUS_CLASS[label]}">${escapeHtml(label)}</span>`
}

function renderSource(order: PrepProcessOrderFact): string {
  if (order.sourceType === 'STOCK') {
    return `<div class="font-medium">按备货创建</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.stockMaterial?.materialName || '-')}</div>`
  }
  return `<div class="font-medium">生产单自动生成</div><div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(order.sourceProductionOrderNo || order.sourceProductionOrderId || '-')}</div>`
}

function renderPlatformSyncSection(order: PrepProcessOrderFact): string {
  const followUpActionLabel = order.followUpActionLabel || '查看详情'
  return `
    <section class="rounded-lg border bg-muted/20 p-4">
      <h3 class="font-medium">平台同步结果</h3>
      <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><span class="text-muted-foreground">平台状态：</span>${escapeHtml(order.platformStatusLabel || order.status)}</div>
        <div><span class="text-muted-foreground">工厂内部状态：</span>${escapeHtml(order.factoryInternalStatusLabel || '-')}</div>
        <div><span class="text-muted-foreground">风险提示：</span>${escapeHtml(order.platformRiskLabel || '暂无风险')}</div>
        <div><span class="text-muted-foreground">下一步动作：</span>${escapeHtml(followUpActionLabel)}</div>
        <div class="sm:col-span-2"><span class="text-muted-foreground">最近同步：</span>${escapeHtml(order.latestOperationAt || order.updatedAt)} · ${escapeHtml(order.latestOperationBy || '系统')}</div>
      </div>
    </section>
  `
}

function renderDetail(): string {
  if (!state.selectedWorkOrderId) return ''
  const order = getOrders().find((item) => item.workOrderId === state.selectedWorkOrderId)
  if (!order) return ''
  const plannedQtyLabel = order.plannedQtyLabel || '计划加工数量'
  return `
    <div class="fixed inset-0 z-40 bg-black/30" data-print-order-action="close-detail"></div>
    <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-background p-6 shadow-xl">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-xs text-muted-foreground">平台印花加工单</p><h2 class="mt-1 text-lg font-semibold">${escapeHtml(order.orderNo)}</h2></div>
        <button class="rounded-md border px-3 py-2 text-sm" data-print-order-action="close-detail">关闭</button>
      </div>
      <div class="mt-6 grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div><span class="text-muted-foreground">来源：</span>${escapeHtml(order.createMode)}</div>
        <div><span class="text-muted-foreground">来源对象：</span>${escapeHtml(order.sourceSummary)}</div>
        <div><span class="text-muted-foreground">工厂：</span>${escapeHtml(order.factoryName)}</div>
        <div><span class="text-muted-foreground">${escapeHtml(plannedQtyLabel)}：</span>${escapeHtml(formatQty(order.plannedFeedQty, order.unit))}</div>
        <div><span class="text-muted-foreground">计划完成：</span>${escapeHtml(order.plannedFinishAt)}</div>
        <div><span class="text-muted-foreground">平台加工单号：</span>${escapeHtml(order.workOrderNo || order.orderNo)}</div>
      </div>
      <div class="mt-4">${renderPlatformSyncSection(order)}</div>
      <button class="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" data-print-order-action="navigate-detail" data-work-order-id="${escapeHtml(order.workOrderId || order.orderNo)}">打开工厂端详情</button>
    </aside>
  `
}

function renderInput(field: keyof PrintCreateForm, label: string, value: string, type = 'text', max?: number): string {
  return `<label class="block"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm" type="${type}" value="${escapeHtml(value)}" ${typeof max === 'number' ? `max="${max}"` : ''} data-skip-page-rerender="true" data-print-create-field="${field}" /></label>`
}

function renderSelect(field: keyof PrintCreateForm, label: string, options: Array<{ value: string; label: string }>, value: string, placeholder?: string, skipPageRerender = true): string {
  return `<label class="block"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" ${skipPageRerender ? 'data-skip-page-rerender="true"' : ''} data-print-create-field="${field}">${placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}${options.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label>`
}

function renderCreate(): string {
  if (!state.createOpen) return ''
  const form = state.form
  const stockMaterials = getStockMaterials(form.factoryId)
  const selectedStock = stockMaterials.find((item) => item.stockMaterialId === form.stockMaterialId)
  return `
    <div class="fixed inset-0 z-40 bg-black/30" data-print-order-action="close-create"></div>
    <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-xl">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-xs text-muted-foreground">固定来源：按备货创建</p><h2 class="mt-1 text-lg font-semibold">新建印花加工单</h2></div>
        <button class="rounded-md border px-3 py-2 text-sm" data-print-order-action="close-create">关闭</button>
      </div>
      <p class="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">生产单来源由系统自动生成，只读且不能在此手工创建。</p>
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">${renderSelect('stockMaterialId', '仓库备货库存', stockMaterials.map((item) => ({ value: item.stockMaterialId, label: `${item.stockMaterialName} / ${item.materialSku} / 可用 ${item.availableQty} ${item.qtyUnit}` })), form.stockMaterialId, '请选择真实库存')}</div>
        <div class="sm:col-span-2 rounded-md border bg-muted/20 p-3 text-sm" data-print-stock-selection-summary>${selectedStock ? `<div class="font-medium">${escapeHtml(selectedStock.stockMaterialName)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(selectedStock.materialSku)} · ${escapeHtml(selectedStock.warehouseName)} · 可用 ${escapeHtml(String(selectedStock.availableQty))} ${escapeHtml(selectedStock.qtyUnit)}</div>` : '<span class="text-muted-foreground">选择库存后自动带出名称、编码、仓库与单位。</span>'}</div>
        ${renderInput('plannedQty', '计划数量', form.plannedQty, 'number', selectedStock?.availableQty)}
        <label class="block"><span class="mb-1 block text-xs text-muted-foreground">数量单位</span><input class="h-10 w-full rounded-md border bg-muted px-3 text-sm" value="${escapeHtml(form.qtyUnit)}" data-print-stock-unit readonly /></label>
        ${renderSelect('factoryId', '印花工厂', factories.map((factory) => ({ value: factory.id, label: factory.name })), form.factoryId, undefined, false)}
        ${renderInput('plannedFinishAt', '计划完成时间', form.plannedFinishAt, 'datetime-local')}
        <div class="sm:col-span-2">${renderInput('processName', '印花工艺', form.processName)}</div>
      </div>
      ${state.formError ? `<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-print-create-error>${escapeHtml(state.formError)}</p>` : ''}
      <button class="mt-3 w-full rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground" data-print-order-action="submit-create">创建印花加工单</button>
    </aside>
  `
}

function renderPagination(total: number, totalPages: number): string {
  return `<div class="flex items-center justify-between border-t px-4 py-3 text-sm"><span>共 ${total} 条，第 ${state.page} / ${totalPages} 页</span><div class="flex gap-2"><button class="rounded border px-3 py-1.5" data-print-order-action="page-prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button><button class="rounded border px-3 py-1.5" data-print-order-action="page-next" ${state.page >= totalPages ? 'disabled' : ''}>下一页</button></div></div>`
}

export function renderProcessPrintOrdersPage(): string {
  const filtered = getFilteredOrders()
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize))
  state.page = Math.min(state.page, totalPages)
  const rows = filtered.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)
  const statusOptions = listPlatformStatusOptions()
  return `
    <main class="space-y-5 p-6">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div><h1 class="text-2xl font-semibold">印花加工单</h1><p class="mt-1 text-sm text-muted-foreground">生产单自动生成，或由业务人员按备货创建。</p></div>
        <button class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" data-print-order-action="create-new">按备货创建</button>
      </header>
      ${state.notice ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">${escapeHtml(state.notice)}</div>` : ''}
      <section class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <input class="h-10 rounded-md border bg-background px-3 text-sm md:col-span-2" placeholder="加工单号 / 生产单号 / 备货物料 / 工厂" value="${escapeHtml(state.keyword)}" data-print-order-field="keyword" />
        <select class="h-10 rounded-md border bg-background px-3 text-sm" data-print-order-field="statusFilter"><option>全部</option>${statusOptions.map((status) => `<option ${state.statusFilter === status ? 'selected' : ''}>${status}</option>`).join('')}</select>
        <select class="h-10 rounded-md border bg-background px-3 text-sm" data-print-order-field="modeFilter">${(['全部', '生产单自动生成', '按备货创建'] as ModeFilter[]).map((mode) => `<option ${state.modeFilter === mode ? 'selected' : ''}>${mode}</option>`).join('')}</select>
      </section>
      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto"><table class="w-full min-w-[1080px] text-sm"><thead class="bg-muted/50 text-left"><tr><th class="px-4 py-3">平台加工单号</th><th class="px-4 py-3">来源</th><th class="px-4 py-3">工厂</th><th class="px-4 py-3">计划数量</th><th class="px-4 py-3">计划完成</th><th class="px-4 py-3">平台状态</th><th class="px-4 py-3">风险提示</th><th class="px-4 py-3">下一步动作</th><th class="px-4 py-3">操作</th></tr></thead><tbody>
          ${rows.map((order) => `<tr class="border-t"><td class="px-4 py-3 font-mono text-xs">${escapeHtml(order.workOrderNo || order.orderNo)}</td><td class="px-4 py-3">${renderSource(order)}</td><td class="px-4 py-3">${escapeHtml(order.factoryName)}</td><td class="px-4 py-3">${escapeHtml(formatQty(order.plannedFeedQty, order.unit))}</td><td class="px-4 py-3">${escapeHtml(order.plannedFinishAt)}</td><td class="px-4 py-3">${renderStatus(order)}</td><td class="px-4 py-3">${escapeHtml(order.platformRiskLabel || '-')}</td><td class="px-4 py-3">${escapeHtml(order.followUpActionLabel || '查看详情')}</td><td class="px-4 py-3"><button class="text-primary hover:underline" data-print-order-action="open-detail" data-work-order-id="${escapeHtml(order.workOrderId || order.orderNo)}">查看</button></td></tr>`).join('') || '<tr><td colspan="9" class="px-4 py-10 text-center text-muted-foreground">暂无加工单</td></tr>'}
        </tbody></table></div>
        ${renderPagination(filtered.length, totalPages)}
      </section>
    </main>
    ${renderDetail()}
    ${renderCreate()}
  `
}

function submitCreate(): void {
  const form = state.form
  const result = createPrintWorkOrderFromStock({
    stockMaterialId: form.stockMaterialId,
    stockMaterialName: form.stockMaterialName,
    materialSku: form.materialSku,
    factoryId: form.factoryId,
    plannedQty: Number(form.plannedQty),
    qtyUnit: form.qtyUnit,
    plannedFinishAt: form.plannedFinishAt.replace('T', ' '),
    processName: form.processName,
  })
  if (!result.ok || !result.order) {
    state.formError = result.message
    return
  }
  state.notice = `已创建印花加工单 ${result.order.printOrderNo}`
  state.createOpen = false
  state.form = defaultForm()
  state.formError = null
  state.page = Math.max(1, Math.ceil(getOrders().length / state.pageSize))
}

export function handleProcessPrintOrdersEvent(target: HTMLElement): boolean {
  const createField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-print-create-field]')
  if (createField) {
    const field = createField.dataset.printCreateField as keyof PrintCreateForm
    state.form[field] = createField.value
    if (field === 'factoryId' && !getStockMaterials(createField.value).some((item) => item.stockMaterialId === state.form.stockMaterialId)) {
      state.form.stockMaterialId = ''
      state.form.stockMaterialName = ''
      state.form.materialSku = ''
      state.form.qtyUnit = ''
    }
    if (field === 'stockMaterialId') {
      const selected = getStockMaterials().find((item) => item.stockMaterialId === createField.value)
      state.form.stockMaterialName = selected?.stockMaterialName || ''
      state.form.materialSku = selected?.materialSku || ''
      state.form.qtyUnit = selected?.qtyUnit || ''
      const drawer = createField.closest<HTMLElement>('aside')
      const unitInput = drawer?.querySelector<HTMLInputElement>('[data-print-stock-unit]')
      if (unitInput) unitInput.value = selected?.qtyUnit || ''
      const qtyInput = drawer?.querySelector<HTMLInputElement>('[data-print-create-field="plannedQty"]')
      if (qtyInput) {
        if (selected) qtyInput.max = String(selected.availableQty)
        else qtyInput.removeAttribute('max')
      }
      const summary = drawer?.querySelector<HTMLElement>('[data-print-stock-selection-summary]')
      if (summary) summary.textContent = selected
        ? `${selected.stockMaterialName} / ${selected.materialSku} / ${selected.warehouseName} / 可用 ${selected.availableQty} ${selected.qtyUnit}`
        : '选择库存后自动带出名称、编码、仓库与单位。'
    }
    state.formError = null
    createField.closest<HTMLElement>('aside')?.querySelector('[data-print-create-error]')?.remove()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-print-order-field]')
  if (field) {
    if (field.dataset.printOrderField === 'keyword') state.keyword = field.value
    if (field.dataset.printOrderField === 'statusFilter') state.statusFilter = field.value as typeof state.statusFilter
    if (field.dataset.printOrderField === 'modeFilter') state.modeFilter = field.value as ModeFilter
    state.page = 1
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-print-order-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.printOrderAction
  if (action === 'navigate-detail') {
    const workOrderId = actionNode.dataset.workOrderId
    if (workOrderId) appStore.navigate(`/fcs/craft/printing/work-orders/${encodeURIComponent(workOrderId)}`)
    return true
  }
  if (action === 'open-detail') state.selectedWorkOrderId = actionNode.dataset.workOrderId || null
  if (action === 'close-detail') state.selectedWorkOrderId = null
  if (action === 'create-new') { state.createOpen = true; state.notice = null; state.formError = null }
  if (action === 'close-create') { state.createOpen = false; state.form = defaultForm(); state.formError = null }
  if (action === 'submit-create') submitCreate()
  if (action === 'page-prev') state.page = Math.max(1, state.page - 1)
  if (action === 'page-next') state.page += 1
  if (action === 'close-all') { state.selectedWorkOrderId = null; state.createOpen = false; state.formError = null }
  return true
}

export function isProcessPrintOrdersDialogOpen(): boolean {
  return Boolean(state.selectedWorkOrderId || state.createOpen)
}
