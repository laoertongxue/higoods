import { renderBadge } from '../../../components/ui/badge.ts'
import { renderFormDialog, renderSimpleConfirmDialog, renderDialog } from '../../../components/ui/dialog.ts'
import { renderInput, renderSelect, renderTextarea } from '../../../components/ui/form.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import {
  DYE_WORK_ORDER_ONLINE_STATUSES,
  getDyeWorkOrderOnlineRecord,
  listDyeWorkOrderOnlineLogs,
  type DyeWorkOrderPfosEditInput,
} from '../../../data/fcs/dye-work-order-online-domain.ts'
import { listDyeWorkOrderOnlineRows } from '../../../data/fcs/dye-work-order-online-view.ts'
import { escapeHtml } from '../../../utils.ts'

const EVENT_PREFIX = 'dye-work-orders'

export type DyeWorkOrderOverlayState = null | {
  type: 'view' | 'edit' | 'logs'
  dyeOrderId: string
  confirmHighRisk?: boolean
  error?: string
}

function field(label: string, value: string): string {
  return `<div class="space-y-1"><div class="text-xs text-muted-foreground">${escapeHtml(label)}</div><div class="text-sm font-medium">${escapeHtml(value || '—')}</div></div>`
}

function formField(label: string, html: string, className = ''): string {
  return `<label class="space-y-1.5 ${className}"><span class="text-sm font-medium">${escapeHtml(label)}</span>${html}</label>`
}

function renderView(dyeOrderId: string): string {
  const row = listDyeWorkOrderOnlineRows().find((item) => item.dyeOrderId === dyeOrderId)
  if (!row) return renderDialog({ title: '查看染色加工单', closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' } }, '<p class="text-sm text-red-600">染色加工单不存在。</p>')
  const body = `<div class="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
    <div class="flex items-start gap-4 rounded-lg border bg-muted/20 p-4">
      <img src="${escapeHtml(row.productImageUrl)}" alt="商品图" class="h-24 w-20 rounded border object-cover">
      <div class="grid flex-1 grid-cols-2 gap-3">${field('平台加工单号', row.workOrderNo)}${field('当前状态', row.status)}${field('生产单号', row.productionOrderNo)}${field('任务单号', row.taskNo)}</div>
    </div>
    <div class="grid grid-cols-2 gap-4">${field('预计完成时间', row.plannedFinishAt)}${field('生产工厂', row.factoryName || '待分配工厂')}${field('面料接收人', row.receiverName)}${field('染色工艺', row.processName)}${field('深浅', row.shade)}${field('温度', row.temperature ? `${row.temperature}℃` : '')}</div>
    <div class="rounded-lg border p-4"><h3 class="mb-3 font-medium">原料与数量</h3><div class="grid grid-cols-2 gap-4">${field('原料/面料', `${row.materialName} · ${row.rawMaterialSku}`)}${field('染色色号', row.colorNo)}${field('计划数量', `${row.plannedQty} ${row.qtyUnit}`)}${field('原料数量', `${row.rawMaterialQty} ${row.qtyUnit}`)}${field('原料卷数', `${row.rawMaterialRollCount} 卷`)}${field('完成数量', `${row.completedQty} ${row.qtyUnit}`)}${field('损耗数量', `${row.lossQty} ${row.qtyUnit}`)}${field('备注', row.remark)}</div></div>
  </div>`
  return renderDialog({ title: `查看染色加工单 - ${row.workOrderNo}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' }, width: 'lg' }, body, renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
}

function renderEdit(dyeOrderId: string, error = ''): string {
  const row = listDyeWorkOrderOnlineRows().find((item) => item.dyeOrderId === dyeOrderId)
  if (!row) return renderView(dyeOrderId)
  const record = getDyeWorkOrderOnlineRecord(dyeOrderId)
  const factories = [...new Map(listDyeWorkOrderOnlineRows().map((item) => [item.factoryId, item.factoryName])).entries()].filter(([, name]) => name)
  const receivers = [...new Set(listDyeWorkOrderOnlineRows().map((item) => item.receiverName).filter(Boolean))]
  const body = `<div class="max-h-[68vh] space-y-4 overflow-y-auto pr-1" data-skip-page-rerender="true">
    ${error ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(error)}</div>` : ''}
    <input type="hidden" value="${record.version}" data-dye-work-orders-edit="expectedVersion">
    <input type="hidden" value="${escapeHtml(record.factoryId)}" data-dye-work-orders-edit="factoryId">
    <div class="grid grid-cols-2 gap-4">
      ${formField('平台加工单号', renderInput({ value: row.workOrderNo, readonly: true }))}
      ${formField('计划数量', renderInput({ value: `${row.plannedQty} ${row.qtyUnit}`, readonly: true }))}
      ${formField('预计完成时间', renderInput({ value: record.plannedFinishAt, prefix: EVENT_PREFIX, field: 'plannedFinishAt' }))}
      ${formField('状态', renderSelect({ value: record.status, options: DYE_WORK_ORDER_ONLINE_STATUSES.map((value) => ({ value, label: value })), prefix: EVENT_PREFIX, field: 'status' }))}
      ${formField('生产工厂', renderSelect({ value: record.factoryId, options: factories.map(([value, label]) => ({ value, label })), prefix: EVENT_PREFIX, field: 'factory' }))}
      ${formField('面料接收人', renderSelect({ value: record.receiverName, options: receivers.map((value) => ({ value, label: value })), prefix: EVENT_PREFIX, field: 'receiverName' }))}
      ${formField('深浅', renderSelect({ value: record.shade, options: ['', '浅色', '深色'].map((value) => ({ value, label: value || '未选择' })), prefix: EVENT_PREFIX, field: 'shade' }))}
      ${formField('温度', renderSelect({ value: record.temperature ? String(record.temperature) : '', options: ['', '190', '200', '205'].map((value) => ({ value, label: value ? `${value}℃` : '未选择' })), prefix: EVENT_PREFIX, field: 'temperature' }))}
      ${formField('原料数量', renderInput({ type: 'number', value: String(record.rawMaterialQty), prefix: EVENT_PREFIX, field: 'rawMaterialQty' }))}
      ${formField('原料卷数', renderInput({ type: 'number', value: String(record.rawMaterialRollCount), prefix: EVENT_PREFIX, field: 'rawMaterialRollCount' }))}
      ${formField('完成数量', renderInput({ type: 'number', value: String(record.completedQty), prefix: EVENT_PREFIX, field: 'completedQty' }))}
      ${formField('损耗数量', renderInput({ type: 'number', value: String(record.lossQty), prefix: EVENT_PREFIX, field: 'lossQty' }))}
      ${formField('备注', renderTextarea({ value: record.remark, prefix: EVENT_PREFIX, field: 'remark', rows: 3 }), 'col-span-2')}
    </div>
  </div>`
  return renderFormDialog({ title: `编辑染色加工单 - ${row.workOrderNo}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' }, submitAction: { prefix: EVENT_PREFIX, action: 'save-edit', label: '保存' }, width: 'lg' }, body)
}

function renderLogs(dyeOrderId: string): string {
  const record = getDyeWorkOrderOnlineRecord(dyeOrderId)
  const logs = listDyeWorkOrderOnlineLogs(dyeOrderId).slice(0, 10)
  const rows = logs.map((log) => `<tr class="border-b last:border-0"><td class="px-3 py-2 text-xs">${escapeHtml(log.operatedAt)}</td><td class="px-3 py-2 text-xs">${escapeHtml(log.operatorName)}<div class="text-muted-foreground">${escapeHtml(log.source)}</div></td><td class="px-3 py-2 text-xs">${escapeHtml(log.beforeStatus)} → ${escapeHtml(log.afterStatus)}</td><td class="px-3 py-2 text-xs">${log.changes.length ? log.changes.map((change) => `${escapeHtml(change.label)}：${escapeHtml(change.before)} → ${escapeHtml(change.after)}`).join('<br>') : escapeHtml(log.action)}</td></tr>`).join('')
  const body = `<div class="max-h-[65vh] overflow-auto"><table class="w-full min-w-[560px] text-left"><thead class="bg-muted/50"><tr><th class="px-3 py-2 text-xs">时间</th><th class="px-3 py-2 text-xs">操作人/操作端</th><th class="px-3 py-2 text-xs">状态</th><th class="px-3 py-2 text-xs">变更内容</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无操作日志</td></tr>'}</tbody></table></div><div class="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>共 ${logs.length} 条，第 1 / 1 页</span><div class="flex gap-2"><button type="button" disabled class="rounded border px-2 py-1 opacity-50">上一页</button><button type="button" disabled class="rounded border px-2 py-1 opacity-50">下一页</button></div></div>`
  return renderDialog({ title: `操作日志 - ${record.workOrderNo}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' }, width: 'lg' }, body, renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
}

export function renderDyeWorkOrderOverlay(state: NonNullable<DyeWorkOrderOverlayState>): string {
  if (state.confirmHighRisk) {
    const record = getDyeWorkOrderOnlineRecord(state.dyeOrderId)
    return renderSimpleConfirmDialog({ prefix: EVENT_PREFIX, closeAction: 'cancel-high-risk', confirmAction: 'confirm-high-risk', title: '确认高风险状态变更', description: `当前状态为“${record.status}”。取消或回退状态会永久保留操作记录。`, confirmLabel: '确认保存', danger: true })
  }
  if (state.type === 'edit') return renderEdit(state.dyeOrderId, state.error)
  if (state.type === 'logs') return renderLogs(state.dyeOrderId)
  return renderView(state.dyeOrderId)
}

function value(root: ParentNode, field: string): string {
  return root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-dye-work-orders-field="${field}"]`)?.value.trim() || ''
}

function numericValue(root: ParentNode, field: string): number {
  const parsed = Number(value(root, field))
  if (!Number.isFinite(parsed)) throw new Error(`${field}必须是有效数字`)
  return parsed
}

export function readDyeWorkOrderEditInput(root: ParentNode): DyeWorkOrderPfosEditInput {
  const factory = root.querySelector<HTMLSelectElement>('[data-dye-work-orders-field="factory"]')
  const temperature = value(root, 'temperature')
  return {
    expectedVersion: Number(root.querySelector<HTMLInputElement>('[data-dye-work-orders-edit="expectedVersion"]')?.value || 0),
    operatorName: '染厂主管',
    operatedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-'),
    status: value(root, 'status') as DyeWorkOrderPfosEditInput['status'],
    plannedFinishAt: value(root, 'plannedFinishAt'),
    factoryId: factory?.value || root.querySelector<HTMLInputElement>('[data-dye-work-orders-edit="factoryId"]')?.value || '',
    factoryName: factory?.selectedOptions[0]?.textContent?.trim() || '',
    receiverName: value(root, 'receiverName'),
    shade: value(root, 'shade') as DyeWorkOrderPfosEditInput['shade'],
    temperature: temperature ? Number(temperature) as 190 | 200 | 205 : null,
    rawMaterialQty: numericValue(root, 'rawMaterialQty'),
    rawMaterialRollCount: numericValue(root, 'rawMaterialRollCount'),
    completedQty: numericValue(root, 'completedQty'),
    lossQty: numericValue(root, 'lossQty'),
    remark: value(root, 'remark'),
  }
}
