import { ensurePostFinishingRecordState, getPostFinishingStorageFailure, runPostFinishingCommand } from '../../../data/fcs/post-finishing-records.ts'
// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderFormDialog } from '../../../components/ui/dialog.ts'
import { renderProductionObjectCodeButton } from '../../../data/fcs/production-order-identity.ts'
import { productionOrders } from '../../../data/fcs/production-orders.ts'
import { productionDemands } from '../../../data/fcs/production-demands.ts'
import { POST_FINISHING_PRODUCTION_SOURCE_FIXTURES } from '../../../data/fcs/post-finishing-production-source-fixtures.ts'
import {
  POST_FINISHING_SEWING_TASK_TYPE_LABEL,
  getCurrentPostFinishingActor,
  getPostFinishingQcInspectionSummary,
  getPostFinishingFactoryReturn,
  listPostFinishingFullFlowQcTasks,
  type PostFinishingFactoryReturnDelivery,
  type PostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingQcPrintActions, renderPostStatusBadge } from './shared.ts'
import {
  readQcShippingPriorityRules,
  saveQcShippingPriorityRules,
  readQcShippingDestination,
  listQcShippingWarehouses,
  saveQcShippingDestination,
} from '../../../data/fcs/post-finishing-qc-shipping-priority-runtime.ts'

interface QcOrderRow {
  task: PostFinishingQcTask
  delivery?: PostFinishingFactoryReturnDelivery
  qcLinked: boolean
  productionLinked: boolean
  mockSource: boolean
}

let message = ''
let messageTone: 'success' | 'error' = 'success'
let priorityRulesVersion = 0
let priorityRulesSaving = false
let priorityRulesReturnFocus: HTMLElement | null = null
let destinationSourceId = ''
let destinationVersion = 0

function priorityRulesPortal(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-qc-priority-rules-portal]')
}

function closePriorityRules(): void {
  if (priorityRulesSaving) return
  const portal = priorityRulesPortal()
  if (portal) portal.innerHTML = ''
  document.removeEventListener('keydown', handlePriorityRulesKeydown)
  priorityRulesReturnFocus?.focus()
}

function handlePriorityRulesKeydown(event: KeyboardEvent): void {
  const portal = priorityRulesPortal()
  if (!portal?.firstElementChild) {
    document.removeEventListener('keydown', handlePriorityRulesKeydown)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    closePriorityRules()
  }
  if (event.key !== 'Tab') return
  const fields = Array.from(portal.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled):not([hidden])'))
  const first = fields[0]
  const last = fields.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}

function openPriorityRules(trigger?: HTMLElement): void {
  const portal = priorityRulesPortal()
  if (!portal) return
  if (trigger) priorityRulesReturnFocus = trigger
  try {
    const rules = readQcShippingPriorityRules()
    priorityRulesVersion = rules.version
    const field = (name: string, label: string, value: string | number, type = 'text'): string => `<label class="grid gap-1 text-sm">${escapeHtml(label)}<input name="${name}" type="${type}" ${type === 'number' ? 'min="1" max="5" step="1"' : 'maxlength="60"'} value="${escapeHtml(String(value))}" required data-skip-page-rerender="true" class="h-9 w-full rounded-md border px-3"/></label>`
    portal.innerHTML = renderFormDialog({
      title: 'QC 发货紧急规则',
      description: `当前版本 V${rules.version}。后道负责人维护显示规则；保存后新查看和重打生效。`,
      width: 'lg',
      closeAction: { prefix: 'post-finishing-priority-rules', action: 'close' },
      submitAction: { prefix: 'post-finishing-priority-rules', action: 'save', label: '保存规则' },
    }, `<form data-qc-priority-rules-form class="grid max-h-[60vh] gap-3 overflow-y-auto pr-1" onsubmit="return false">
      <div class="rounded-md border bg-slate-50 p-3 text-xs">判定依据：揽收时效。时区：雅加达（Asia/Jakarta）。范围：今日、明日自然日；超期跟随今日星级。仓库、占用、供给去向及数量去重按已确认业务口径计算。</div>
      <div class="grid grid-cols-2 gap-3">${field('todayStars', '今日星数（1～5）', rules.todayStars, 'number')}${field('tomorrowStars', '明日星数（1～5）', rules.tomorrowStars, 'number')}</div>
      <p class="text-xs text-muted-foreground">今日星数必须高于明日；两日以外不显示紧急星级。</p>
      ${field('todayLabel', '今日提示文字', rules.todayLabel)}${field('tomorrowLabel', '明日提示文字', rules.tomorrowLabel)}${field('overdueLabel', '超期提示文字', rules.overdueLabel)}
      ${field('operator', '维护人', '')}
      <label class="grid gap-1 text-sm">修改原因<textarea name="reason" rows="2" maxlength="240" required data-skip-page-rerender="true" class="w-full rounded-md border px-3 py-2"></textarea></label>
      <p class="text-xs text-muted-foreground">维护记录用于责任追溯；取消或关闭不会保存。</p>
      <div role="status" aria-live="polite" data-qc-priority-rules-status class="text-sm"></div>
      <button type="button" hidden data-post-finishing-priority-rules-action="reload" data-skip-page-rerender="true" class="justify-self-start text-sm text-blue-700 underline">重新读取已保存规则（替换未保存输入）</button>
    </form>`)
    const panel = portal.querySelector<HTMLElement>('.relative')
    panel?.setAttribute('role', 'dialog')
    panel?.setAttribute('aria-modal', 'true')
    panel?.setAttribute('aria-label', 'QC 发货紧急规则')
    portal.querySelectorAll<HTMLElement>('[data-post-finishing-priority-rules-action]').forEach(button => button.setAttribute('data-skip-page-rerender', 'true'))
    panel?.querySelector('button')?.setAttribute('aria-label', '关闭规则维护')
    document.addEventListener('keydown', handlePriorityRulesKeydown)
    portal.querySelector<HTMLInputElement>('input')?.focus()
  } catch (error) {
    portal.innerHTML = `<div role="alert" class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">${escapeHtml(error instanceof Error ? error.message : '规则读取失败，未打开维护。')}</div>`
  }
}

function openShippingDestination(sourceId: string, trigger?: HTMLElement): void {
  const portal = priorityRulesPortal()
  const task = listPostFinishingFullFlowQcTasks().find(row => row.qcTaskId === sourceId)
  if (!portal || !task) return
  if (trigger) priorityRulesReturnFocus = trigger
  try {
    const destination = readQcShippingDestination(sourceId)
    destinationSourceId = sourceId
    destinationVersion = destination?.version || 0
    const warehouses = listQcShippingWarehouses()
    portal.innerHTML = renderFormDialog({
      title: '维护尚未出货部分去向',
      description: `${task.qcTaskNo} · ${task.productionOrderNo} · 第 ${task.returnIndex} 次回货`,
      width: 'lg',
      closeAction: { prefix: 'post-finishing-priority-rules', action: 'close' },
      submitAction: { prefix: 'post-finishing-priority-rules', action: 'save-destination', label: '保存去向' },
    }, `<form data-qc-shipping-destination-form class="grid max-h-[60vh] gap-3 overflow-y-auto pr-1" onsubmit="return false">
      <div class="rounded-md border bg-slate-50 p-3 text-xs">由 PPIC／计划负责人核对尚未形成出货单部分的最终供货仓。仅记录去向，不指定销售订单，也不分配需求数量。同 SKU 的其他仓库存和供给不自动互抵。</div>
      <label class="grid gap-1 text-sm">尚未出货部分目标成衣仓<select name="warehouseId" required data-skip-page-rerender="true" class="h-9 w-full rounded-md border px-3"><option value="">去向待核对</option>${warehouses.map(warehouse => `<option value="${escapeHtml(warehouse.id)}" ${warehouse.id === destination?.warehouseId ? 'selected' : ''}>${escapeHtml(warehouse.name)}</option>`).join('')}</select></label>
      <label class="grid gap-1 text-sm">维护人<input name="operator" required maxlength="60" data-skip-page-rerender="true" class="h-9 w-full rounded-md border px-3"/></label>
      <label class="grid gap-1 text-sm">修改原因<textarea name="reason" rows="2" required maxlength="240" data-skip-page-rerender="true" class="w-full rounded-md border px-3 py-2"></textarea></label>
      <p class="text-xs text-muted-foreground">已生成的出货子单保留各自冻结的目标仓，本次修改不影响子单和实收历史。旧子单去向缺失时须先核对；在成衣仓接收入口维护对应子单。取消或关闭不会保存。</p>
      <div role="status" aria-live="polite" data-qc-priority-rules-status class="text-sm"></div>
      <button type="button" hidden data-post-finishing-priority-rules-action="reload-destination" data-skip-page-rerender="true" class="justify-self-start text-sm text-blue-700 underline">重新读取已保存去向（替换未保存输入）</button>
    </form>`)
    const panel = portal.querySelector<HTMLElement>('.relative')
    panel?.setAttribute('role', 'dialog')
    panel?.setAttribute('aria-modal', 'true')
    panel?.setAttribute('aria-label', '维护尚未出货部分去向')
    portal.querySelectorAll<HTMLElement>('[data-post-finishing-priority-rules-action]').forEach(button => button.setAttribute('data-skip-page-rerender', 'true'))
    panel?.querySelector('button')?.setAttribute('aria-label', '关闭供货去向维护')
    document.addEventListener('keydown', handlePriorityRulesKeydown)
    portal.querySelector<HTMLSelectElement>('select')?.focus()
  } catch (error) {
    portal.innerHTML = `<div role="alert" class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">${escapeHtml(error instanceof Error ? error.message : '供货去向读取失败，未打开维护。')}</div>`
  }
}

async function saveShippingDestination(): Promise<void> {
  if (priorityRulesSaving) return
  const portal = priorityRulesPortal()
  const form = portal?.querySelector<HTMLFormElement>('[data-qc-shipping-destination-form]')
  if (!portal || !form || !form.reportValidity()) return
  const status = portal.querySelector<HTMLElement>('[data-qc-priority-rules-status]')
  const reload = portal.querySelector<HTMLButtonElement>('[data-post-finishing-priority-rules-action="reload-destination"]')
  const data = new FormData(form)
  const value = (name: string): string => String(data.get(name) || '').trim()
  priorityRulesSaving = true
  const buttons = Array.from(portal.querySelectorAll<HTMLButtonElement>('button'))
  buttons.forEach(button => { button.disabled = true })
  const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'))
  fields.forEach(field => { field.disabled = true })
  if (status) { status.className = 'text-sm'; status.textContent = '正在保存…' }
  try {
    await saveQcShippingDestination({ sourceId: destinationSourceId, warehouseId: value('warehouseId'), expectedVersion: destinationVersion, operator: value('operator'), reason: value('reason') })
    destinationVersion = readQcShippingDestination(destinationSourceId)?.version || 0
    if (status) { status.className = 'text-sm text-emerald-800'; status.textContent = '尚未出货部分去向已保存；已生成子单和实收历史保持原目标仓。' }
    form.querySelector<HTMLTextAreaElement>('[name="reason"]')!.value = ''
    if (reload) reload.hidden = true
  } catch (error) {
    if (status) { status.className = 'text-sm text-red-700'; status.textContent = `${error instanceof Error ? error.message : '供货去向保存失败。'} 输入已保留，尚未保存。` }
    if (reload) reload.hidden = false
  } finally {
    priorityRulesSaving = false
    buttons.forEach(button => { button.disabled = false })
    fields.forEach(field => { field.disabled = false })
  }
}

async function savePriorityRules(): Promise<void> {
  if (priorityRulesSaving) return
  const portal = priorityRulesPortal()
  const form = portal?.querySelector<HTMLFormElement>('[data-qc-priority-rules-form]')
  if (!portal || !form) return
  const status = portal.querySelector<HTMLElement>('[data-qc-priority-rules-status]')
  const reload = portal.querySelector<HTMLButtonElement>('[data-post-finishing-priority-rules-action="reload"]')
  if (!form.reportValidity()) return
  const data = new FormData(form)
  const value = (name: string): string => String(data.get(name) || '').trim()
  priorityRulesSaving = true
  const buttons = Array.from(portal.querySelectorAll<HTMLButtonElement>('button'))
  buttons.forEach(button => { button.disabled = true })
  const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'))
  fields.forEach(field => { field.disabled = true })
  if (status) { status.className = 'text-sm'; status.textContent = '正在保存…' }
  try {
    await saveQcShippingPriorityRules({
      expectedVersion: priorityRulesVersion,
      todayStars: Number(value('todayStars')),
      tomorrowStars: Number(value('tomorrowStars')),
      todayLabel: value('todayLabel'), tomorrowLabel: value('tomorrowLabel'), overdueLabel: value('overdueLabel'),
      operator: value('operator'), reason: value('reason'),
    })
    priorityRulesVersion = readQcShippingPriorityRules().version
    if (status) { status.className = 'text-sm text-emerald-800'; status.textContent = `规则 V${priorityRulesVersion} 已保存，新查看和重打使用此版本。` }
    form.querySelector<HTMLTextAreaElement>('[name="reason"]')!.value = ''
    if (reload) reload.hidden = true
  } catch (error) {
    if (status) { status.className = 'text-sm text-red-700'; status.textContent = `${error instanceof Error ? error.message : '规则保存失败。'} 输入已保留，尚未保存。` }
    if (reload) reload.hidden = false
  } finally {
    priorityRulesSaving = false
    buttons.forEach(button => { button.disabled = false })
    fields.forEach(field => { field.disabled = false })
  }
}

function params(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string>): void {
  const current = params()
  Object.entries(overrides).forEach(([key, value]) => current.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/qc-orders?${current.toString()}`)
}

function refresh(): void {
  navigate({ refresh: String(Date.now()) })
}

function renderMessage(): string {
  if (!message) return ''
  return `<div role="status" class="rounded-lg border px-4 py-3 text-sm ${messageTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}">${escapeHtml(message)}</div>`
}

function totalExpected(task: PostFinishingQcTask): number {
  return task.lines.reduce((sum, line) => sum + line.expectedQty, 0)
}

function totalPassed(task: PostFinishingQcTask): number { return getPostFinishingQcInspectionSummary(task)?.passedQty || 0 }

function totalDefect(task: PostFinishingQcTask): number { const result=getPostFinishingQcInspectionSummary(task);return result?result.defectQty+result.returnQty:0 }

function selectOptions(values: string[], selected: string): string {
  return `<option value="">全部</option>${values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}`
}

function renderSkuLines(row: QcOrderRow): string {
  return row.task.lines.map(line => `<div class="py-1 text-xs"><strong>${escapeHtml(line.sku.skuCode)}</strong><div class="text-muted-foreground">${escapeHtml(line.sku.colorName)} · ${escapeHtml(line.sku.sizeName)} · ${line.expectedQty} 件</div></div>`).join('')
}

const columns: StandardListColumn<QcOrderRow>[] = [
  { key: 'qcOrder', title: '质检单号', width: 160, required: true, freezeable: true, render: (row) => {
    const linked = row.qcLinked
    return `<div class="break-all font-mono font-semibold">${linked ? renderProductionObjectCodeButton({ objectType: 'QC_ORDER', objectId: row.task.qcTaskNo, relatedProductionOrderNo: row.task.productionOrderNo }) : escapeHtml(row.task.qcTaskNo)}</div><div class="mt-1 text-xs text-muted-foreground">第 ${row.task.returnIndex} 次回货${linked ? '' : ' · 生产主线关联待补'}</div>`
  } },
  { key: 'documents', title: '单号', width: 190, required: true, render: (row) => {
    if(row.task.sourceKind==='WAREHOUSE_STOCK')return `<div>来源：成衣仓库存</div><div>原仓：${escapeHtml(row.task.sourceWarehouseName||'待核对')}</div><div class="font-mono text-xs">申请 ${escapeHtml(row.task.inventoryApplicationId||'待核对')}</div>`
    return `<div>后道：<span class="font-mono">${escapeHtml(row.delivery?.sewingTaskNo || '—')}</span></div><div class="mt-1">生产：${row.productionLinked ? renderProductionObjectCodeButton({ objectType: 'PRODUCTION_ORDER', objectId: row.task.productionOrderNo }) : escapeHtml(row.task.productionOrderNo)}</div>${row.mockSource ? '<div class="mt-1 text-xs text-muted-foreground">后道验收 Mock 来源；生产主线已关联</div>' : ''}<div class="mt-1 break-all text-xs text-muted-foreground">回货：${escapeHtml(row.task.deliveryOrderNo)}</div>`
  } },
  { key: 'factory', title: '来源工厂', width: 110, required: true, render: (row) => escapeHtml(row.task.sourceKind==='WAREHOUSE_STOCK'?row.task.sourceWarehouseName||'库存送检':row.delivery?.sewingFactoryName || '—') },
  { key: 'responsibility', title: '后道责任 / 完成去向', width: 190, required: true, render: (row) => {
    const destination = row.task.status === '质检完成'
      ? (row.task.postTaskNo
          ? `生成加工单 ${row.task.postTaskNo}`
          : row.task.outboundOrderNo
            ? `待出货 ${row.task.outboundOrderNo}`
            : '本次无正常放行量，不生成出货单')
      : '按实际项目加工；无项目则准备出货'
    return `<div class="text-xs font-medium ${row.task.responsibility.responsibilityMode === 'POST_FACTORY' ? 'text-blue-700' : 'text-slate-700'}">${escapeHtml(`${row.task.responsibility.taskTypeLabel} · ${row.task.responsibility.responsibilityLabel}`)}</div><div class="mt-1 text-[11px] text-muted-foreground">${row.task.status === '质检完成' ? row.task.frozenProcessItems?.length ? escapeHtml(row.task.frozenProcessItems.join(' → ')) : '不涉及后道加工' : '由质检员按实物确认加工项目'}</div><div class="mt-1 text-[11px] text-blue-700">${escapeHtml(destination)}</div>`
  } },
  { key: 'station', title: '质检员', width: 100, required: true, render: (row) => escapeHtml(row.task.claimedBy?.actorName || '待领取') },
  { key: 'sku', title: 'SKU 明细', width: 220, required: true, render: renderSkuLines },
  { key: 'expected', title: '本批实收', width: 80, required: true, align: 'center', render: (row) => `${totalExpected(row.task)} 件` },
  {key:'inspected',title:'实际检查',width:100,required:true,align:'center',render:row=>{const summary=getPostFinishingQcInspectionSummary(row.task);return summary?`${summary.inspectedQty} 件`:row.task.status==='待送检'||row.task.status==='待质检'?'0 件':'检查记录缺失'}},
  { key: 'passed', title: '实检合格', width: 80, required: true, align: 'center', render: (row) => getPostFinishingQcInspectionSummary(row.task)?`${totalPassed(row.task)} 件`:row.task.status==='待送检'||row.task.status==='待质检'?'0 件':'检查记录缺失' },
  { key: 'defect', title: '不合格数量', width: 90, required: true, align: 'center', render: (row) => `${totalDefect(row.task)} 件` },
  {key:'uninspected',title:'未抽随批放行',width:100,required:true,align:'center',render:row=>{const summary=getPostFinishingQcInspectionSummary(row.task);return row.task.status!=='质检完成'?'尚未放行':summary?`${summary.uninspectedQty} 件`:'检查记录缺失'}},
  {key:'released',title:'正常放行',width:90,required:true,align:'center',render:row=>row.task.status==='质检完成'?`${row.task.results?.reduce((n,line)=>n+(line.releasedQty??line.passedQty),0)||0} 件`:'尚未放行'},
  { key: 'result', title: '质检结果', width: 95, required: true, render: (row) => row.task.status === '待送检' ? '待送检出库' : row.task.status !== '质检完成' ? '未出结果' : !getPostFinishingQcInspectionSummary(row.task)?'检查记录缺失':totalDefect(row.task) > 0 ? '检查发现问题' : getPostFinishingQcInspectionSummary(row.task)!.fullInspection?'全检无问题':'抽检无问题' },
  { key: 'status', title: '状态', width: 90, required: true, render: (row) => renderPostStatusBadge(row.task.status) },
  { key: 'actions', title: '操作', width: 200, required: true, actionColumn: true, render: (row) => {
    const actor = getCurrentPostFinishingActor()
    const canOperate = row.task.claimedBy?.actorId === actor.actorId
    const destinationAction = row.task.sourceKind==='WAREHOUSE_STOCK'?'':`<button type="button" class="whitespace-nowrap text-xs text-blue-600 hover:underline" data-post-finishing-priority-rules-action="destination" data-source-id="${escapeHtml(row.task.qcTaskId)}" data-skip-page-rerender="true">供货去向</button>`
    if (row.task.status === '待送检') {
      return `<div class="grid gap-2">${destinationAction}<a href="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(row.task.deliveryId)}" data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(row.task.deliveryId)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">去待加工仓送检</a></div>`
    }
    return `<div class="grid grid-cols-2 gap-x-3 gap-y-2">${destinationAction}${row.task.status === '质检中' && canOperate ? `<a href="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(row.task.qcTaskNo)}" data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">完成质检</a>` : ''}<a href="/fcs/craft/post-finishing/qc-workbench?view=detail&taskNo=${encodeURIComponent(row.task.qcTaskNo)}" data-nav="/fcs/craft/post-finishing/qc-workbench?view=detail&taskNo=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">查看质检单</a><a href="/fcs/craft/post-finishing/print?type=QC_ORDER&id=${encodeURIComponent(row.task.qcTaskNo)}" data-nav="/fcs/craft/post-finishing/print?type=QC_ORDER&id=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">打印质检单</a><a href="/fcs/craft/post-finishing/print?type=QC_DETAIL&id=${encodeURIComponent(row.task.qcTaskNo)}" data-nav="/fcs/craft/post-finishing/print?type=QC_DETAIL&id=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">打印质检详情单</a></div>`
  } },
]

export function renderPostFinishingQcOrdersPage(): string {
  const current = params()
  const actor = getCurrentPostFinishingActor()
  const isSupervisor = actor.roleName === 'QC主管'
  const keyword = current.get('keyword')?.trim().toLowerCase() || ''
  const status = current.get('status') || ''
  const source = current.get('source') || ''
  const factory = current.get('factory') || ''
  const owner = current.get('owner')?.trim().toLowerCase() || ''
  const allRecords = listPostFinishingFullFlowQcTasks()
  const countSource = isSupervisor ? allRecords : allRecords.filter((task) => task.claimedBy?.actorId === actor.actorId)
  // 清单只需确认实际生产来源是否存在。打开编号后由原概览入口读取
  // 物料、收货和结算详情，避免为每个单号先生成整份生产概览。
  const orders = [...productionOrders]
  const byNo = new Map(orders.map(order => [order.productionOrderNo, order]))
  const byId = new Map(orders.map(order => [order.productionOrderId, order]))
  const records = countSource.map((task): QcOrderRow => {
    const source = byNo.get(task.productionOrderNo) || byId.get(task.productionOrderNo)
    return { task, delivery: getPostFinishingFactoryReturn(task.deliveryId),
      qcLinked: Boolean(byId.get(task.productionOrderId) || source), productionLinked: Boolean(source),
      mockSource: Boolean(source && POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.some(item => item.productionOrderId === source.productionOrderId)
        && productionDemands.some(item => item.demandId === source.demandId)) }
  }).filter((row) => {
    const sourceLabel = row.task.sourceKind==='WAREHOUSE_STOCK'?'成衣仓库存':row.delivery ? POST_FINISHING_SEWING_TASK_TYPE_LABEL[row.delivery.sewingTaskType] : ''
    const searchable = [row.task.qcTaskNo, row.task.deliveryOrderNo, row.task.productionOrderNo, row.task.claimedBy?.actorName, ...row.task.lines.map((line) => line.sku.skuCode)].filter(Boolean).join(' ').toLowerCase()
    return (!keyword || searchable.includes(keyword))
      && (!status || row.task.status === status)
      && (!source || sourceLabel === source)
      && (!factory || (row.task.sourceKind==='WAREHOUSE_STOCK'?row.task.sourceWarehouseName:row.delivery?.sewingFactoryName) === factory)
      && (!owner || row.task.claimedBy?.actorName.toLowerCase().includes(owner))
  })
  const counts = records.reduce<Record<string, number>>((result, { task }) => {
    result[task.status] = (result[task.status] || 0) + 1
    return result
  }, {})
  const pageSize = Math.max(10, Math.min(50, Number(current.get('pageSize') || 20)))
  const slice = paginateStandardListRows(records, Number(current.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['qcOrder'], pageSize }
  const sources = [...new Set(allRecords.map(task=>task.sourceKind==='WAREHOUSE_STOCK'?'成衣仓库存':getPostFinishingFactoryReturn(task.deliveryId)?.sewingTaskType).filter(Boolean).map(source=>source==='成衣仓库存'?source:POST_FINISHING_SEWING_TASK_TYPE_LABEL[source!]))]
  const factories = [...new Set(allRecords.map((task) => task.sourceKind==='WAREHOUSE_STOCK'?task.sourceWarehouseName:getPostFinishingFactoryReturn(task.deliveryId)?.sewingFactoryName).filter((value): value is string => Boolean(value)))]
  return renderStandardListPage({
    title: '质检清单',
    primaryActionsHtml: `<div class="flex flex-wrap items-center justify-end gap-2"><button type="button" data-post-finishing-priority-rules-action="open" data-skip-page-rerender="true" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">发货紧急规则</button>${renderPostFinishingQcPrintActions()}<a href="/fcs/craft/post-finishing/qc-workbench" data-nav="/fcs/craft/post-finishing/qc-workbench" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white">执行质检</a></div>`,
    feedbackHtml: renderMessage(),
    filtersHtml: `<form action="/fcs/craft/post-finishing/qc-orders" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-6"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="质检单/后道加工单/生产单/质检员/SKU"/></label><label class="text-xs text-muted-foreground">当前状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['待送检','待质检','质检中','质检完成'], status)}</select></label><label class="text-xs text-muted-foreground">后道来源<select name="source" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(sources, source)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories, factory)}</select></label>${isSupervisor ? `<label class="text-xs text-muted-foreground">质检员<input name="owner" value="${escapeHtml(current.get('owner') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"/></label>` : ''}<div class="flex items-end justify-end gap-2 md:col-span-3 xl:col-span-6"><a href="/fcs/craft/post-finishing/qc-orders" data-nav="/fcs/craft/post-finishing/qc-orders" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    statsHtml: renderStandardListStats([
      { label: '待送检', value: counts['待送检'] || 0 },
      { label: '待质检', value: counts['待质检'] || 0 },
      { label: '质检中', value: counts['质检中'] || 0 },
      { label: '质检完成', value: counts['质检完成'] || 0 },
    ]),
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-qc-orders', emptyText: '暂无符合条件的质检单；待质检单请使用完整单号领取。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing-qc-orders', fieldPrefix: 'post-finishing-qc-orders' }),
  }) + '<div data-qc-priority-rules-portal></div>'
}

export async function handlePostFinishingQcOrdersEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const ruleAction = target.closest<HTMLElement>('[data-post-finishing-priority-rules-action]')
  if (ruleAction && (!event || event.type === 'click')) {
    event?.preventDefault()
    const action = ruleAction.dataset.postFinishingPriorityRulesAction
    if (['open', 'reload', 'destination', 'reload-destination'].includes(action || '')) {
      try {
        ruleAction.setAttribute('disabled', '')
        await ensurePostFinishingRecordState()
        const failure = getPostFinishingStorageFailure()
        if (failure) throw new Error(failure)
        if (action === 'open' || action === 'reload') openPriorityRules(action === 'open' ? ruleAction : undefined)
        else openShippingDestination(action === 'destination' ? ruleAction.dataset.sourceId || '' : destinationSourceId, action === 'destination' ? ruleAction : undefined)
      } catch (error) {
        const status = priorityRulesPortal()?.querySelector<HTMLElement>('[data-qc-priority-rules-status]')
        const message = `重新读取失败，输入已保留：${error instanceof Error ? error.message : String(error)}`
        if (status) status.textContent = message
        else if (priorityRulesPortal()) priorityRulesPortal()!.innerHTML = `<p role="alert" class="p-3 text-red-700">${escapeHtml(message)}</p>`
      } finally { ruleAction.removeAttribute('disabled') }
    }
    if (action === 'close') closePriorityRules()
    if (action === 'save') await savePriorityRules()
    if (action === 'save-destination') await saveShippingDestination()
    return true
  }
  const pageAction = target.closest<HTMLElement>('[data-post-finishing-qc-orders-action]')?.dataset.postFinishingQcOrdersAction
  if (pageAction === 'prev-page' || pageAction === 'next-page') {
    navigate({ page: String(Math.max(1, Number(params().get('page') || 1) + (pageAction === 'prev-page' ? -1 : 1))) })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-qc-orders-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value })
    return true
  }
  return false
}
