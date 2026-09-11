import { dyePartnerFields } from '../../../data/fcs/dye-work-order-demo-details.ts'
import { getPreparationMaterialSourceDocumentNo } from '../../../data/fcs/preparation-material-receipt-sources.ts'
import { renderBadge } from '../../../components/ui/badge.ts'
import { renderFormDialog, renderSimpleConfirmDialog, renderDialog } from '../../../components/ui/dialog.ts'
import { renderInput, renderSelect, renderTextarea } from '../../../components/ui/form.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import {
  getDyeWorkOrderOnlineRecord,
  listDyeWorkOrderOnlineLogs,
  type DyeWorkOrderPfosEditInput,
} from '../../../data/fcs/dye-work-order-online-domain.ts'
import { listDyeWorkOrderOnlineRows } from '../../../data/fcs/dye-work-order-online-view.ts'
import { listBusinessFactoryMasterRecords } from '../../../data/fcs/factory-master-store.ts'
import { escapeHtml } from '../../../utils.ts'

const EVENT_PREFIX = 'dye-work-orders'

export type DyeWorkOrderOverlayState = null | {
  type: 'view' | 'edit' | 'logs' | 'remark' | 'remark-edit'
  dyeOrderId: string
  confirmHighRisk?: boolean
  targetStatus?: DyeWorkOrderPfosEditInput['status']
  logPage?: number
  error?: string
}

function field(label: string, value: string): string {
  return `<div class="space-y-1"><div class="text-xs text-muted-foreground">${escapeHtml(label)}</div><div class="text-sm font-medium">${escapeHtml(value || '—')}</div></div>`
}

function formField(label: string, html: string, className = ''): string {
  return `<label class="space-y-1.5 ${className}"><span class="text-sm font-medium">${escapeHtml(label)}</span>${html}</label>`
}

function renderObjectImage(url: string, label: string): string {
  return `<button type="button" class="relative h-24 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded border bg-white" data-pda-image-preview-url="${escapeHtml(url)}" data-pda-image-preview-title="${escapeHtml(label)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(label)}大图"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-muted-foreground">图片加载中</span></button>`
}

function axisTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (['RECEIVED', 'COMPLETED', 'FULL_HANDOVER'].includes(status)) return 'success'
  if (['RECEIPT_DIFFERENCE', 'CANCELLED'].includes(status)) return 'danger'
  if (['PARTIAL_RECEIVED', 'PARTIAL_HANDOVER', 'PROCESSING'].includes(status)) return 'info'
  if (['WAIT_SOURCE', 'WAIT_RECEIVE', 'WAIT_HANDOVER'].includes(status)) return 'warning'
  return 'neutral'
}

function renderView(dyeOrderId: string): string {
  const row = listDyeWorkOrderOnlineRows().find((item) => item.dyeOrderId === dyeOrderId)
  if (!row) return renderDialog({ title: '查看染色加工单', closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' } }, '<p class="text-sm text-red-600">染色加工单不存在。</p>')
  const links = (items: Array<{label: string; href?: string}>) => items.map(item => item.href ? `<a class="text-blue-700 hover:underline" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>` : escapeHtml(item.label)).join(' / ')
  const table = (headers: string[], rows: string[][]) => `<div class="overflow-x-auto"><table class="w-full min-w-[620px] border-collapse text-left text-xs"><thead><tr>${headers.map(text => `<th class="border bg-muted/30 p-2">${escapeHtml(text)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(text => `<td class="border p-2">${escapeHtml(text)}</td>`).join('')}</tr>`).join('') || `<tr><td class="border p-3 text-muted-foreground" colspan="${headers.length}">暂无记录</td></tr>`}</tbody></table></div>`
  const qty = (value: number | undefined, unit = row.qtyUnit) => value === undefined ? '待补录' : `${value} ${unit}`
  const body = `<div class="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
    <section class="space-y-3"><h3 class="font-medium">基本信息</h3><div class="flex gap-3">${renderObjectImage(row.productImageUrl, `${row.productCode} ${row.productName}`)}<div class="grid flex-1 grid-cols-2 gap-3">${field('商品', `${row.productCode} · ${row.productName}`)}${field('需求来源', `${row.sourceLabel} · ${row.productionOrderNo || row.purchaseOrderNo}`)}${field('任务', row.taskNo)}${field('当前加工厂', row.factoryName)}</div></div><div class="flex gap-4">${renderBadge(`接收：${row.receiptKnown ? row.receiptStatusLabel : '历史待补录'}`, axisTone(row.receiptStatus))}${renderBadge(`加工：${row.processingStatusLabel}`, axisTone(row.processingStatus))}${renderBadge(`交出：${row.handoverStatusLabel}`, axisTone(row.handoverStatus))}</div></section>
    <section class="space-y-3 border-t pt-3"><h3 class="font-medium">加工投入／上游</h3><div class="flex gap-3">${renderObjectImage(row.materialImageUrl, row.materialName)}<div class="grid flex-1 grid-cols-2 gap-3">${field('投入物料', row.rawMaterialSku !== row.materialName && !/[\u4e00-\u9fff]/.test(row.rawMaterialSku) ? `${row.materialName} · ${row.rawMaterialSku}` : row.materialName)}${row.upstreamDocuments.flatMap(doc=>dyePartnerFields(doc.partner)).map(([label,value])=>field(label,value)).join('')}${field('计划投入', qty(row.plannedQty))}${field('已接收', row.receiptKnown ? qty(row.receivedInputQty) : '历史接收待补录')}${field('实际使用', row.usageKnown ? qty(row.rawMaterialQty) : '待补录')}</div></div><div class="text-xs">关联上游：${links(row.upstreamLinks) || '暂无上游加工单'}<br>来源单据：${escapeHtml(row.inputSourceDocumentNos.join(' / ') || '待生成')}</div><details><summary class="cursor-pointer text-sm text-blue-700">供料记录 ${row.receiptRecords.length} 笔</summary>${table(['接收单','上游交接记录','实收数量','接收人','接收时间'], row.receiptRecords.map(record => [record.receiptId, getPreparationMaterialSourceDocumentNo(record.upstreamRecordId) || '历史来源单据待补录', qty(record.qty), record.receiverName, record.receivedAt]))}</details></section>
    <section class="space-y-3 border-t pt-3"><h3 class="font-medium">染色要求</h3><div class="grid grid-cols-2 gap-3">${field('工艺', row.processName)}${field('目标颜色／色号', row.colorNo)}${field('成分', row.composition)}${field('色样', row.sampleNote)}${field('深浅', row.shade || '待明确')}${field('温度', row.temperature ? `${row.temperature}℃` : '待明确')}</div></section>
    <section class="space-y-3 border-t pt-3"><h3 class="font-medium">加工记录</h3>${field('确认损耗', row.lossKnown ? qty(row.lossQty) : '待确认')}<details><summary class="cursor-pointer text-sm text-blue-700">查看分批加工记录（${row.executionRecords.length}）</summary>${table(['工序','投入','产出','确认损耗','操作人','开始／完成'], row.executionRecords.map(record => [record.nodeName, qty(record.inputQty, record.qtyUnit), qty(record.outputQty, record.qtyUnit), qty(record.lossQty, record.qtyUnit), record.operatorName, `${record.startedAt || '—'} / ${record.finishedAt || '未完成'}`]))}</details></section>
    <section class="space-y-3 border-t pt-3"><h3 class="font-medium">加工产出／下游</h3><div class="flex gap-3">${renderObjectImage(row.outputImageUrl, `${row.materialName} ${row.targetColorName}`)}<div class="text-sm">${escapeHtml(row.materialName)} · ${escapeHtml(row.targetColorName)}<br>${escapeHtml(row.colorSku)}</div></div><div class="text-xs">下游加工单：${links(row.downstreamLinks) || '加工完成后交接至下方接收单位'}</div><div class="grid grid-cols-2 gap-3">${row.downstreamPartner ? dyePartnerFields(row.downstreamPartner).map(([label,value])=>field(label,value)).join('') : field('接收单位', row.receiverName)}${field('交出单', row.handoverOrderNo)}${field('完成产出', qty(row.completedQty))}${field('已交出', qty(row.handedOverQty))}${field('下游已收', qty(row.downstreamReceivedQty))}${field('下游待接收', qty(row.pendingInboundQty))}</div><details><summary class="cursor-pointer text-sm text-blue-700">交接记录 ${row.handoverRecords.length} 笔</summary>${table(['交接记录','交出数量','接收数量','交出人／时间','接收人／时间','差异处理'], row.handoverRecords.map(record => [record.handoverRecordNo || record.recordId, qty(record.submittedQty), qty(record.taskReceipts?.length ? record.taskReceipts.reduce((sum, item) => sum + item.qty, 0) : record.receiverWrittenQty ?? record.warehouseWrittenQty), `${record.factorySubmittedBy || '待补录'} / ${record.factorySubmittedAt}`, record.taskReceipts?.length ? record.taskReceipts.map(item => `${item.receiverName} / ${item.receivedAt}`).join('；') : `${record.receiverWrittenBy || '待接收'} / ${record.receiverWrittenAt || record.warehouseWrittenAt || '—'}`, record.factoryDiffDecision === 'ACCEPT_DIFF' ? '差异已接受' : record.objectionStatus === 'RESOLVED' ? '异议已解决' : record.diffReason || '—']))}</details></section>
    <section class="space-y-3 border-t pt-3"><h3 class="font-medium">时间与备注</h3><div class="grid grid-cols-2 gap-3">${field('下单时间', row.orderedAt)}${field('预计完成', row.plannedFinishAt)}${field('实际完成', row.completedAt)}${field('实际交出', row.deliveredAt)}${field('备注', row.remark)}</div></section>
  </div>`
  return renderDialog({ title: `查看染色加工单 - ${row.workOrderNo}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' }, width: 'lg' }, body, renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
}

function renderEdit(dyeOrderId: string, error = ''): string {
  const row = listDyeWorkOrderOnlineRows().find((item) => item.dyeOrderId === dyeOrderId)
  if (!row) return renderView(dyeOrderId)
  const record = getDyeWorkOrderOnlineRecord(dyeOrderId)
  const factoryOptions = listBusinessFactoryMasterRecords({ includeTestFactories: true })
    .filter((factory) => factory.factoryType === 'CENTRAL_DYE'
      || factory.processAbilities.some((ability) => ability.processCode === 'DYE' && ability.status !== 'DISABLED'))
    .map((factory) => ({ value: factory.id, label: factory.name }))
  if (record.factoryId && !factoryOptions.some((factory) => factory.value === record.factoryId)) {
    factoryOptions.unshift({ value: record.factoryId, label: record.factoryName || record.factoryId })
  }
  const body = `<div class="max-h-[68vh] space-y-4 overflow-y-auto pr-1" data-skip-page-rerender="true">
    ${error ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(error)}</div>` : ''}
    <input type="hidden" value="${record.version}" data-dye-work-orders-edit="expectedVersion">
    <input type="hidden" value="${escapeHtml(record.factoryId)}" data-dye-work-orders-edit="factoryId">
    <input type="hidden" value="${escapeHtml(record.status)}" data-dye-work-orders-field="status">
    <input type="hidden" value="${escapeHtml(record.receiverName)}" data-dye-work-orders-field="receiverName">
    <div class="grid grid-cols-3 gap-3 rounded-lg border p-3"><div><div class="mb-1 text-xs text-muted-foreground">接收状态</div>${renderBadge(row.receiptStatusLabel, axisTone(row.receiptStatus))}</div><div><div class="mb-1 text-xs text-muted-foreground">加工状态</div>${renderBadge(row.processingStatusLabel, axisTone(row.processingStatus))}</div><div><div class="mb-1 text-xs text-muted-foreground">交出状态</div>${renderBadge(row.handoverStatusLabel, axisTone(row.handoverStatus))}</div></div>
    <div class="grid grid-cols-2 gap-4">
      ${formField('平台加工单号', renderInput({ value: row.workOrderNo, readonly: true }))}
      ${formField('计划数量', renderInput({ value: `${row.plannedQty} ${row.qtyUnit}`, readonly: true }))}
      ${formField('预计完成时间', renderInput({ value: record.plannedFinishAt, prefix: EVENT_PREFIX, field: 'plannedFinishAt' }))}
      ${formField('生产工厂', renderSelect({ value: record.factoryId, options: factoryOptions, prefix: EVENT_PREFIX, field: 'factory' }))}
      ${formField('下游接收方', renderInput({ value: `${row.receiverName} / ${row.receiverWarehouseName}`, readonly: true }))}
      ${formField('深浅', renderSelect({ value: record.shade, options: ['', '浅色', '深色'].map((value) => ({ value, label: value || '未选择' })), prefix: EVENT_PREFIX, field: 'shade' }))}
      ${formField('温度', renderSelect({ value: record.temperature ? String(record.temperature) : '', options: ['', '190', '200', '205'].map((value) => ({ value, label: value ? `${value}℃` : '未选择' })), prefix: EVENT_PREFIX, field: 'temperature' }))}
      ${formField('实际使用数量', renderInput({ type: 'number', value: String(record.rawMaterialQty), prefix: EVENT_PREFIX, field: 'rawMaterialQty' }))}
      ${formField('原料卷数', renderInput({ type: 'number', value: String(record.rawMaterialRollCount), prefix: EVENT_PREFIX, field: 'rawMaterialRollCount' }))}
      ${formField('完成数量', renderInput({ type: 'number', value: String(record.completedQty), prefix: EVENT_PREFIX, field: 'completedQty' }))}
      ${formField('确认损耗数量', renderInput({ type: 'number', value: String(record.lossQty), prefix: EVENT_PREFIX, field: 'lossQty' }))}
      ${formField('备注', renderTextarea({ value: record.remark, prefix: EVENT_PREFIX, field: 'remark', rows: 3 }), 'col-span-2')}
    </div>
  </div>`
  return renderFormDialog({ title: `编辑染色加工单 - ${row.workOrderNo}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' }, submitAction: { prefix: EVENT_PREFIX, action: 'save-edit', label: '保存' }, width: 'lg' }, body)
}

function renderLogs(dyeOrderId: string, requestedPage = 1): string {
  const record = getDyeWorkOrderOnlineRecord(dyeOrderId)
  const allLogs = listDyeWorkOrderOnlineLogs(dyeOrderId)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(allLogs.length / pageSize))
  const page = Math.min(totalPages, Math.max(1, requestedPage))
  const pageLogs = allLogs.slice((page - 1) * pageSize, page * pageSize)
  const rows = pageLogs.map((log) => `<tr class="border-b last:border-0"><td class="px-3 py-2 text-xs">${escapeHtml(log.operatedAt)}</td><td class="px-3 py-2 text-xs">${escapeHtml(log.operatorName)}<div class="text-muted-foreground">${escapeHtml(log.source)}</div></td><td class="px-3 py-2 text-xs">${escapeHtml(log.beforeStatus)} → ${escapeHtml(log.afterStatus)}</td><td class="px-3 py-2 text-xs"><div class="font-medium">${escapeHtml(log.action)}</div>${log.changes.map((change) => `<div>${escapeHtml(change.label)}：${escapeHtml(change.before)} → ${escapeHtml(change.after)}</div>`).join('')}</td></tr>`).join('')
  const body = `<div class="max-h-[65vh] overflow-auto"><table class="w-full min-w-[560px] text-left"><thead class="bg-muted/50"><tr><th class="px-3 py-2 text-xs">时间</th><th class="px-3 py-2 text-xs">操作人/操作端</th><th class="px-3 py-2 text-xs">状态</th><th class="px-3 py-2 text-xs">变更内容</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无操作日志</td></tr>'}</tbody></table></div><div class="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>共 ${allLogs.length} 条，第 ${page} / ${totalPages} 页</span><div class="flex gap-2"><button type="button" data-dye-work-orders-action="prev-log-page" ${page <= 1 ? 'disabled' : ''} class="rounded border px-2 py-1 disabled:opacity-50">上一页</button><button type="button" data-dye-work-orders-action="next-log-page" ${page >= totalPages ? 'disabled' : ''} class="rounded border px-2 py-1 disabled:opacity-50">下一页</button></div></div>`
  return renderDialog({ title: `操作日志 - ${record.workOrderNo}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' }, width: 'lg' }, body, renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
}

function renderRemark(dyeOrderId: string, editing: boolean): string {
  const record = getDyeWorkOrderOnlineRecord(dyeOrderId)
  const hasRemark = Boolean(record.remark.trim())
  const title = editing ? (hasRemark ? '编辑备注' : '新增备注') : '查看备注'
  const body = editing
    ? `<input type="hidden" value="${record.version}" data-dye-remark-version><label class="block space-y-2"><span class="text-sm font-medium">备注内容</span>${renderTextarea({value:record.remark,prefix:EVENT_PREFIX,field:'remark-content',rows:6,placeholder:'请输入备注内容，最多2000字'})}</label><p class="mt-2 text-sm text-red-600" role="alert" data-dye-remark-error></p>`
    : `<div class="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words text-sm" data-dye-remark-content>${escapeHtml(record.remark)}</div>`
  const footer = renderSecondaryButton(editing ? '取消' : '关闭', {prefix:EVENT_PREFIX,action:'close-overlay'}) + renderPrimaryButton(editing ? '保存备注' : '编辑备注', {prefix:EVENT_PREFIX,action:editing ? 'save-remark' : 'edit-remark'})
  return renderDialog({title:`${title} - ${record.workOrderNo}`,closeAction:{prefix:EVENT_PREFIX,action:'close-overlay'}},body,footer)
}

export function renderDyeWorkOrderOverlay(state: NonNullable<DyeWorkOrderOverlayState>): string {
  let content: string
  if (state.confirmHighRisk) {
    const record = getDyeWorkOrderOnlineRecord(state.dyeOrderId)
    const targetStatus = state.targetStatus || record.status
    content = renderSimpleConfirmDialog({ prefix: EVENT_PREFIX, closeAction: 'cancel-high-risk', confirmAction: 'confirm-high-risk', title: '确认高风险状态变更', description: `状态将从“${record.status} → ${targetStatus}”。该变更会影响 PDA 当前可执行动作，并永久保留操作记录。`, confirmLabel: '确认保存', danger: true })
  } else if (state.type === 'remark' || state.type === 'remark-edit') {
    content = renderRemark(state.dyeOrderId, state.type === 'remark-edit')
  } else if (state.type === 'edit') {
    content = renderEdit(state.dyeOrderId, state.error)
  } else if (state.type === 'logs') {
    content = renderLogs(state.dyeOrderId, state.logPage)
  } else {
    content = renderView(state.dyeOrderId)
  }
  return `<div data-skip-page-rerender="true">${content}</div>`
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
  const editRoot = root.querySelector<HTMLElement>('[data-dye-work-orders-overlay]') || root
  const factory = editRoot.querySelector<HTMLSelectElement>('[data-dye-work-orders-field="factory"]')
  const temperature = value(editRoot, 'temperature')
  return {
    expectedVersion: Number(editRoot.querySelector<HTMLInputElement>('[data-dye-work-orders-edit="expectedVersion"]')?.value || 0),
    operatorName: '染厂主管',
    operatedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-'),
    status: value(editRoot, 'status') as DyeWorkOrderPfosEditInput['status'],
    plannedFinishAt: value(editRoot, 'plannedFinishAt'),
    factoryId: factory?.value || editRoot.querySelector<HTMLInputElement>('[data-dye-work-orders-edit="factoryId"]')?.value || '',
    factoryName: factory?.selectedOptions[0]?.textContent?.trim() || '',
    receiverName: value(editRoot, 'receiverName'),
    shade: value(editRoot, 'shade') as DyeWorkOrderPfosEditInput['shade'],
    temperature: temperature ? Number(temperature) as 190 | 200 | 205 : null,
    rawMaterialQty: numericValue(editRoot, 'rawMaterialQty'),
    rawMaterialRollCount: numericValue(editRoot, 'rawMaterialRollCount'),
    completedQty: numericValue(editRoot, 'completedQty'),
    lossQty: numericValue(editRoot, 'lossQty'),
    remark: value(editRoot, 'remark'),
  }
}
