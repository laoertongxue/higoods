import { escapeHtml } from '../../utils.ts'
import { renderBadge } from '../../components/ui/badge.ts'
import { PRODUCTION_DEMAND_PROCESS_MATCH_LABEL, type ProcessWorkOrderSourceSnapshot, type ProductionDemandProcessMatchStatus } from '../../data/fcs/process-work-order-domain.ts'
import { calculateEarlyProcessPlannedQty, createProductionDemandEarlyProcessWorkOrder, listEarlyProcessCreateCandidates, type EarlyProcessCode, type EarlyProcessCreatedResult } from '../../data/fcs/production-demand-early-process-work-orders.ts'
import { cancelProductionDemandDyeWorkOrder } from '../../data/fcs/dyeing-task-domain.ts'
import { cancelProductionDemandPrintWorkOrder } from '../../data/fcs/printing-task-domain.ts'

export interface EarlyProcessFactory { id: string; name: string }
export interface EarlyProcessManagementState {
  matchStatus: '' | ProductionDemandProcessMatchStatus
  createOpen: boolean
  createDemandId: string
  createProfessionalTaskId: string
  createError: string
}
export function createEarlyProcessManagementState(): EarlyProcessManagementState {
  return { matchStatus: '', createOpen: false, createDemandId: '', createProfessionalTaskId: '', createError: '' }
}
export function renderProcessManagementImage(url: string | undefined, alt: string): string {
  if (!url) return '<span class="inline-flex h-10 w-16 shrink-0 items-center rounded border px-1 text-center text-xs text-amber-700">图片待补充</span>'
  return `<button type="button" class="relative h-10 w-10 shrink-0 cursor-zoom-in overflow-hidden rounded border bg-white" data-pda-image-preview-url="${escapeHtml(url)}" data-pda-image-preview-title="${escapeHtml(alt)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(alt)}大图"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-muted-foreground">图片加载中</span></button>`
}
export function renderEarlyProcessMatchStatus(source?: ProcessWorkOrderSourceSnapshot): string {
  const status = source?.matchStatus
  if (!status) return '<span class="text-muted-foreground">不适用</span>'
  return renderBadge(PRODUCTION_DEMAND_PROCESS_MATCH_LABEL[status], status === 'MATCHED' ? 'success' : status === 'MATCH_FAILED' ? 'danger' : status === 'CANCELLED' ? 'neutral' : 'warning')
}
export function renderEarlyProcessMatchTabs(state: EarlyProcessManagementState, rows: Array<{ sourceSnapshot?: ProcessWorkOrderSourceSnapshot }>): string {
  const tabs: Array<['' | ProductionDemandProcessMatchStatus, string]> = [['', '全部'], ...Object.entries(PRODUCTION_DEMAND_PROCESS_MATCH_LABEL) as Array<[ProductionDemandProcessMatchStatus, string]>]
  return `<div role="tablist" aria-label="提前加工单匹配状态" class="mb-3 flex flex-wrap gap-2">${tabs.map(([value, label]) => `<button type="button" role="tab" aria-selected="${state.matchStatus === value}" class="h-9 rounded-md border px-3 text-sm ${state.matchStatus === value ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700' : 'bg-white text-slate-600'}" data-early-process-action="match-tab" data-match-status="${value}" data-skip-page-rerender="true">${escapeHtml(label)} <span class="ml-1 tabular-nums">${value ? rows.filter(row => row.sourceSnapshot?.matchStatus === value).length : rows.length}</span></button>`).join('')}</div>`
}
export function renderEarlyProcessSource(source?: ProcessWorkOrderSourceSnapshot): string {
  if (!source?.productionDemandId) return ''
  return `<div class="space-y-2 text-xs"><p class="font-medium">生产需求单提前创建</p><div class="flex items-start gap-2">${renderProcessManagementImage(source.targetSpuImageUrl, source.targetSpuName || source.targetSpuCode || '商品')}<div><p>${escapeHtml(source.targetSpuName || source.targetSpuCode || '')}</p><p>${escapeHtml(source.targetSpuCode || '')}</p></div></div><p>生产需求单：${escapeHtml(source.productionDemandNo || source.productionDemandId)}</p><p>生产单：${escapeHtml(source.matchedProductionOrderNo || '待匹配')}</p><p>专业任务：${escapeHtml(source.professionalTaskNo || source.professionalTaskId || '')}</p>${renderEarlyProcessMatchStatus(source)}${source.matchFailureReason ? `<p class="text-red-700">${escapeHtml(source.matchFailureReason)}</p>` : ''}</div>`
}
export function renderEarlyProcessDetail(source?: ProcessWorkOrderSourceSnapshot): string {
  if (!source?.productionDemandId) return ''
  return `<section class="mt-4 space-y-3 rounded-lg border p-4"><h3 class="font-medium">提前加工与生产单匹配</h3>${renderEarlyProcessSource(source)}<div class="flex items-center gap-3">${renderProcessManagementImage(source.materialImageUrl, source.materialName || '物料')}<div class="text-sm"><p>${escapeHtml(source.materialName || '')}</p><p>投入 SKU：${escapeHtml(source.inputMaterialSkuCode || '')}</p><p>产出 SKU：${escapeHtml(source.outputMaterialSkuCode || '')}</p></div></div><p class="text-sm">${source.matchStatus === 'MATCHED' ? `技术包：${escapeHtml(source.matchedTechPackVersionLabel || source.matchedTechPackVersionId || '待记录')}` : '待匹配生产单后确认下游'}</p><div class="grid gap-2 sm:grid-cols-2">${(source.professionalResultAttachments || []).map(file => `<div class="flex items-center gap-2 rounded border p-2">${file.mimeType.startsWith('image/') ? renderProcessManagementImage(file.dataUrl, file.fileName) : ''}<a href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.fileName)}" class="break-all text-xs text-blue-700">${escapeHtml(file.fileName)}</a></div>`).join('')}</div>${source.cancelReason ? `<p class="text-sm">取消原因：${escapeHtml(source.cancelReason)}</p>` : ''}<div class="space-y-2 border-t pt-2 text-xs">${(source.operationFacts || []).map(fact => `<p>${escapeHtml(fact.operatedAt)} · ${escapeHtml(fact.operatorName)} · ${escapeHtml(fact.detail)}</p>`).join('')}</div></section>`
}
export function renderEarlyProcessCancel(workOrderId: string | undefined, source?: ProcessWorkOrderSourceSnapshot): string {
  if (!source?.matchStatus || source.matchStatus === 'CANCELLED') return ''
  return `<button type="button" class="mt-2 block text-xs text-red-700 hover:underline" data-early-process-action="cancel" data-work-order-id="${escapeHtml(workOrderId || '')}">取消提前单</button>`
}
function renderEmptyDialog(): string {
  return '<div class="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-label="新增加工单" class="rounded-lg bg-white p-6"><p>暂无可选择的生产需求和专业任务，请先完成生产准备。</p><button class="mt-4 rounded border px-4 py-2" data-early-process-action="close-create">关闭</button></section></div>'
}
export function renderEarlyProcessCreateDialog(code: EarlyProcessCode, state: EarlyProcessManagementState, factories: EarlyProcessFactory[]): string {
  return code === 'DYE' ? renderDyeCreateDialog(state, factories) : renderPrintCreateDialog(state, factories)
}
function renderDyeCreateDialog(state: EarlyProcessManagementState, factories: EarlyProcessFactory[]): string {
  if (!state.createOpen) return ''
  const candidates = listEarlyProcessCreateCandidates('DYE')
  const defaultCandidate = candidates.find(item => item.eligible) || candidates[0]
  const demandId = candidates.some(item => item.demand.demandId === state.createDemandId) ? state.createDemandId : defaultCandidate?.demand.demandId
  const demandCandidates = candidates.filter(item => item.demand.demandId === demandId)
  const candidate = demandCandidates.find(item => item.professionalTaskId === state.createProfessionalTaskId) || demandCandidates.find(item => item.eligible) || demandCandidates[0]
  if (!candidate) return renderEmptyDialog()
  state.createDemandId = candidate.demand.demandId
  state.createProfessionalTaskId = candidate.professionalTaskId
  const planned = candidate.eligible ? calculateEarlyProcessPlannedQty(candidate.demand.requiredQtyTotal, candidate.defaultUnitConsumption, candidate.defaultLossRate) : 0
  const demandOptions = [...new Map(candidates.map(item => [item.demand.demandId, item])).values()].map(item => `<option value="${escapeHtml(item.demand.demandId)}" ${item.demand.demandId === candidate.demand.demandId ? 'selected' : ''}>${escapeHtml(item.demand.demandId)} · ${escapeHtml(item.demand.spuName)}</option>`).join('')
  const taskOptions = demandCandidates.map(item => `<option value="${escapeHtml(item.professionalTaskId)}" ${item.professionalTaskId === candidate.professionalTaskId ? 'selected' : ''} ${item.eligible ? '' : 'disabled'}>${escapeHtml(item.professionalTaskNo)} · ${escapeHtml(item.professionalResultVersion)}${item.eligible ? '' : `（${escapeHtml(item.ineligibleReason || '不可创建')}）`}</option>`).join('')
  const resultAttachments = candidate.professionalResultAttachments.map(file => `<article class="flex items-center gap-3 rounded border p-2">${file.mimeType.startsWith('image/') ? renderProcessManagementImage(file.dataUrl, file.fileName) : '<span class="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-xs">文件</span>'}<div class="min-w-0"><a class="block truncate text-sm font-medium text-blue-700" href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</a><p class="text-xs text-slate-500">${escapeHtml(file.mimeType)} · ${(file.sizeBytes / 1024).toFixed(0)} KB</p></div></article>`).join('')
  return `<div class="fixed inset-0 z-[120] flex items-center justify-center p-4" data-early-create-dialog><button type="button" class="absolute inset-0 bg-slate-950/55" data-early-process-action="close-create" data-skip-page-rerender="true" aria-label="关闭"></button><section role="dialog" aria-modal="true" aria-label="新增染色加工单" class="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header class="flex items-center justify-between border-b px-5 py-4"><div><h2 class="text-lg font-semibold">新增染色加工单</h2><p class="mt-1 text-xs text-slate-500">手动选择生产准备调色任务；加工厂创建时必选，下游由正式生产单匹配后确认。</p></div><button type="button" class="rounded border px-3 py-1.5 text-sm" data-early-process-action="close-create" data-skip-page-rerender="true">关闭</button></header><div class="space-y-4 p-5">${state.createError ? `<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.createError)}</p>` : ''}<div class="grid gap-3 md:grid-cols-2"><label class="text-sm">生产需求单<select class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-demand-id">${demandOptions}</select></label><label class="text-sm">调色任务<select class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-professional-task-id">${taskOptions}</select></label><div class="rounded border p-3 text-sm"><div class="flex gap-3">${renderProcessManagementImage(candidate.demand.imageUrl, candidate.demand.spuName)}<div><p class="font-semibold">${escapeHtml(candidate.demand.spuName)}</p><p>${escapeHtml(candidate.demand.spuCode)}</p><p>需求：${candidate.demand.requiredQtyTotal.toLocaleString('zh-CN')} 件</p></div></div></div><div class="rounded border p-3 text-sm"><p class="font-semibold">${escapeHtml(candidate.professionalTaskNo)}</p><p>染色要求：${escapeHtml(candidate.defaultTargetColor)}</p><p>调色结果：${escapeHtml(candidate.professionalResultId)} · ${escapeHtml(candidate.professionalResultVersion)}</p><p>审核：${candidate.eligible ? `${escapeHtml(candidate.professionalResultApprovedBy)} · ${escapeHtml(candidate.professionalResultApprovedAt)}` : escapeHtml(candidate.ineligibleReason || '待审核')}</p></div><div class="md:col-span-2"><p class="mb-2 text-sm font-medium">调色任务产出（${candidate.professionalResultAttachments.length}）</p><div class="grid gap-2 md:grid-cols-2">${resultAttachments}</div></div><div class="md:col-span-2 flex items-center gap-3 rounded border p-3">${renderProcessManagementImage(candidate.defaultMaterialImageUrl, candidate.defaultMaterialName)}<div class="text-sm"><p>${escapeHtml(candidate.defaultMaterialName)}</p><p class="text-xs text-slate-500">${escapeHtml(candidate.defaultInputSku)} → ${escapeHtml(candidate.defaultOutputSku)}</p></div></div><label class="text-sm">投入 SKU<input class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-input-sku" value="${escapeHtml(candidate.defaultInputSku)}" data-skip-page-rerender="true"></label><label class="text-sm">染色后产出 SKU<input class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-output-sku" value="${escapeHtml(candidate.defaultOutputSku)}" data-skip-page-rerender="true"></label><label class="text-sm">物料名称<input class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-material-name" value="${escapeHtml(candidate.defaultMaterialName)}" data-skip-page-rerender="true"></label><label class="text-sm">目标颜色<input class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-target-color" value="${escapeHtml(candidate.defaultTargetColor)}" data-skip-page-rerender="true"></label><label class="text-sm">预估单耗<input type="number" min="0.01" step="0.01" class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-unit-consumption" value="${candidate.defaultUnitConsumption}" data-skip-page-rerender="true"></label><label class="text-sm">损耗率（%）<input type="number" min="0" step="0.1" class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-loss-rate" value="${candidate.defaultLossRate * 100}" data-skip-page-rerender="true"></label><label class="text-sm">加工厂（必选）<select required class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-factory" data-skip-page-rerender="true"><option value="" selected disabled>请选择加工厂</option>${factories.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label class="text-sm">计划完成日期<input type="date" class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-finish" value="${escapeHtml(candidate.demand.requiredDeliveryDate || '')}" data-skip-page-rerender="true"></label><label class="md:col-span-2 flex items-center gap-2 rounded border px-3 py-2 text-sm"><input type="checkbox" data-preserve-native-click="true" data-early-process-field="create-water-soluble" data-skip-page-rerender="true">同一道工艺包含水溶处理（只创建这一张染色单）</label><p class="md:col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">下游接收方：待匹配正式生产单后确认</p></div><div class="rounded-lg bg-blue-50 px-4 py-3 text-sm"><span class="text-slate-600">计划加工数量：</span><strong data-early-planned-qty>${planned.toLocaleString('zh-CN',{maximumFractionDigits:2})} ${escapeHtml(candidate.defaultQtyUnit)}</strong><p class="mt-1 text-xs text-slate-500">需求数量 × 预估单耗 ×（1 + 损耗率）</p></div></div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button type="button" class="rounded border px-4 py-2 text-sm" data-early-process-action="close-create" data-skip-page-rerender="true">取消</button><button type="button" class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white" data-early-process-action="submit-create" data-skip-page-rerender="true">创建染色加工单</button></footer></section></div>`
}

function renderPrintCreateDialog(state: EarlyProcessManagementState, factories: EarlyProcessFactory[]): string {
  if (!state.createOpen) return ''
  const candidates = listEarlyProcessCreateCandidates('PRINT')
  const defaultCandidate = candidates.find(item => item.eligible) || candidates[0]
  const demandId = candidates.some(item => item.demand.demandId === state.createDemandId) ? state.createDemandId : defaultCandidate?.demand.demandId
  const demandCandidates = candidates.filter(item => item.demand.demandId === demandId)
  const candidate = demandCandidates.find(item => item.professionalTaskId === state.createProfessionalTaskId) || demandCandidates.find(item => item.eligible) || demandCandidates[0]
  if (!candidate) return renderEmptyDialog()
  state.createDemandId = candidate.demand.demandId
  state.createProfessionalTaskId = candidate.professionalTaskId
  const planned = candidate.eligible ? calculateEarlyProcessPlannedQty(candidate.demand.requiredQtyTotal, candidate.defaultUnitConsumption, candidate.defaultLossRate) : 0
  const demandOptions = [...new Map(candidates.map(item => [item.demand.demandId, item])).values()].map(item => `<option value="${escapeHtml(item.demand.demandId)}" ${item.demand.demandId === candidate.demand.demandId ? 'selected' : ''}>${escapeHtml(item.demand.demandId)} · ${escapeHtml(item.demand.spuName)}</option>`).join('')
  const taskOptions = demandCandidates.map(item => `<option value="${escapeHtml(item.professionalTaskId)}" ${item.professionalTaskId === candidate.professionalTaskId ? 'selected' : ''} ${item.eligible ? '' : 'disabled'}>${escapeHtml(item.professionalTaskNo)} · ${escapeHtml(item.professionalResultVersion)}${item.eligible ? '' : `（${escapeHtml(item.ineligibleReason || '不可创建')}）`}</option>`).join('')
  const attachments = candidate.professionalResultAttachments.map(file => `<article class="flex min-w-0 items-center gap-3 rounded border p-2">${file.mimeType.startsWith('image/') ? renderProcessManagementImage(file.dataUrl, file.fileName) : '<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-600">文件</span>'}<div class="min-w-0"><a class="block truncate text-sm font-medium text-blue-700" href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</a><p class="text-xs text-slate-500">${escapeHtml(file.mimeType)} · ${(file.sizeBytes / 1024).toFixed(0)} KB</p></div></article>`).join('')
  const imageCount = candidate.professionalResultAttachments.filter(file => file.mimeType.startsWith('image/')).length
  const fileCount = candidate.professionalResultAttachments.length - imageCount
  return `<div class="fixed inset-0 z-[120] flex items-center justify-center p-4" data-early-create-dialog><button type="button" class="absolute inset-0 bg-slate-950/55" data-early-process-action="close-create" data-skip-page-rerender="true" aria-label="关闭"></button><section role="dialog" aria-modal="true" aria-label="新增印花加工单" class="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header class="flex items-center justify-between border-b px-5 py-4"><div><h2 class="text-lg font-semibold">新增印花加工单</h2><p class="mt-1 text-xs text-slate-500">手动选择生产准备花型任务；加工厂创建时必选，下游由正式生产单匹配后确认。</p></div><button type="button" class="rounded border px-3 py-1.5 text-sm" data-early-process-action="close-create" data-skip-page-rerender="true">关闭</button></header><div class="space-y-4 p-5">${state.createError ? `<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.createError)}</p>` : ''}<div class="grid gap-3 md:grid-cols-2"><label class="text-sm">生产需求单<select class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-demand-id">${demandOptions}</select></label><label class="text-sm">花型任务<select class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-professional-task-id">${taskOptions}</select></label><div class="rounded border p-3 text-sm"><div class="flex gap-3">${renderProcessManagementImage(candidate.demand.imageUrl, candidate.demand.spuName)}<div><p class="font-semibold">${escapeHtml(candidate.demand.spuName)}</p><p>${escapeHtml(candidate.demand.spuCode)}</p><p>需求：${candidate.demand.requiredQtyTotal.toLocaleString('zh-CN')} 件</p></div></div></div><div class="rounded border p-3 text-sm"><p class="font-semibold">${escapeHtml(candidate.professionalTaskNo)}</p><p>花型任务产出：${imageCount} 张花型图 · ${fileCount} 个花型文件</p><p>成果：${escapeHtml(candidate.professionalResultId)} · ${escapeHtml(candidate.professionalResultVersion)}</p><p>审核：${candidate.eligible ? `${escapeHtml(candidate.professionalResultApprovedBy)} · ${escapeHtml(candidate.professionalResultApprovedAt)}` : escapeHtml(candidate.ineligibleReason || '待审核')}</p></div><div class="md:col-span-2"><p class="mb-2 text-sm font-medium">花型图、花型文件与任务产出（${candidate.professionalResultAttachments.length}）</p><div class="grid gap-2 md:grid-cols-2">${attachments}</div></div><div class="md:col-span-2 flex items-center gap-3 rounded border p-3">${renderProcessManagementImage(candidate.defaultMaterialImageUrl, candidate.defaultMaterialName)}<div class="text-sm"><p>${escapeHtml(candidate.defaultMaterialName)}</p><p class="text-xs text-slate-500">${escapeHtml(candidate.defaultInputSku)} → ${escapeHtml(candidate.defaultOutputSku)}</p></div></div><label class="text-sm">投入 SKU<input class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-input-sku" value="${escapeHtml(candidate.defaultInputSku)}" data-skip-page-rerender="true"></label><label class="text-sm">印花后产出 SKU<input class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-output-sku" value="${escapeHtml(candidate.defaultOutputSku)}" data-skip-page-rerender="true"></label><label class="text-sm">物料名称<input class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-material-name" value="${escapeHtml(candidate.defaultMaterialName)}" data-skip-page-rerender="true"></label><label class="text-sm">目标颜色<input class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-target-color" value="${escapeHtml(candidate.defaultTargetColor)}" data-skip-page-rerender="true"></label><label class="text-sm">预估单耗<input type="number" min="0.01" step="0.01" class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-unit-consumption" value="${candidate.defaultUnitConsumption}" data-skip-page-rerender="true"></label><label class="text-sm">损耗率（%）<input type="number" min="0" step="0.1" class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-loss-rate" value="${candidate.defaultLossRate * 100}" data-skip-page-rerender="true"></label><label class="text-sm">加工厂（必选）<select required class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-factory" data-skip-page-rerender="true"><option value="" selected disabled>请选择加工厂</option>${factories.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label class="text-sm">计划完成日期<input type="date" class="mt-1 h-10 w-full rounded border px-3" data-early-process-field="create-finish" value="${escapeHtml(candidate.demand.requiredDeliveryDate || '')}" data-skip-page-rerender="true"></label><p class="md:col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">下游接收方：待匹配正式生产单后确认</p></div><div class="rounded-lg bg-blue-50 px-4 py-3 text-sm"><span class="text-slate-600">计划加工数量：</span><strong data-early-planned-qty>${planned.toLocaleString('zh-CN',{maximumFractionDigits:2})} ${escapeHtml(candidate.defaultQtyUnit)}</strong><p class="mt-1 text-xs text-slate-500">需求数量 × 预估单耗 ×（1 + 损耗率）</p></div></div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button type="button" class="rounded border px-4 py-2 text-sm" data-early-process-action="close-create" data-skip-page-rerender="true">取消</button><button type="button" class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white" data-early-process-action="submit-create" data-skip-page-rerender="true">创建印花加工单</button></footer></section></div>`
}

export function handleEarlyProcessManagementEvent(target: HTMLElement, options: {
  code: EarlyProcessCode
  state: EarlyProcessManagementState
  factories: EarlyProcessFactory[]
  refreshDialog: () => void
  refreshRows: (reloadFacts?: boolean) => void
  setNotice: (message: string) => void
  onCreated: (result: EarlyProcessCreatedResult) => void
}): boolean {
  const root = target.closest<HTMLElement>('[data-early-process-management]')
  if (!root) return false
  const { code, state, factories } = options
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-early-process-field]')
  const get = (name: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-early-process-field="${name}"]`)
  const value = (name: string) => get(name)?.value || ''
  const candidate = () => listEarlyProcessCreateCandidates(code).find(item => item.demand.demandId === state.createDemandId && item.professionalTaskId === state.createProfessionalTaskId)
  if (field) {
    if (field.dataset.earlyProcessField === 'create-demand-id' || field.dataset.earlyProcessField === 'create-professional-task-id') {
      if (field.dataset.earlyProcessField === 'create-demand-id') { state.createDemandId = field.value; state.createProfessionalTaskId = '' }
      else state.createProfessionalTaskId = field.value
      state.createError = ''; options.refreshDialog()
    }
    if (field.dataset.earlyProcessField === 'create-unit-consumption' || field.dataset.earlyProcessField === 'create-loss-rate') {
      const item = candidate(), output = root.querySelector<HTMLElement>('[data-early-planned-qty]')
      if (item && output) {
        try { output.textContent = `${calculateEarlyProcessPlannedQty(item.demand.requiredQtyTotal, Number(value('create-unit-consumption')), Number(value('create-loss-rate')) / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${item.defaultQtyUnit}` }
        catch { output.textContent = '请填写有效的单耗和损耗率' }
      }
    }
    return true
  }
  const node = target.closest<HTMLElement>('[data-early-process-action]')
  if (!node) return false
  const action = node.dataset.earlyProcessAction
  if (action === 'match-tab') { state.matchStatus = (node.dataset.matchStatus || '') as typeof state.matchStatus; options.refreshRows(); return true }
  if (action === 'open-create' || action === 'close-create') { state.createOpen = action === 'open-create'; state.createError = ''; options.refreshDialog(); return true }
  if (action === 'submit-create') {
    try {
      const item = candidate()
      if (!item) throw new Error('请选择生产需求单和已审核通过的专业任务')
      const factory = factories.find(item => item.id === value('create-factory'))
      const result = createProductionDemandEarlyProcessWorkOrder({ processCode: code, productionDemandId: state.createDemandId, professionalTaskId: state.createProfessionalTaskId, inputMaterialSkuCode: value('create-input-sku'), outputMaterialSkuCode: value('create-output-sku'), materialName: value('create-material-name'), materialImageUrl: item.defaultMaterialImageUrl, targetColor: value('create-target-color'), estimatedUnitConsumption: Number(value('create-unit-consumption')), estimatedLossRate: Number(value('create-loss-rate')) / 100, qtyUnit: item.defaultQtyUnit, requiresWaterSoluble: code === 'DYE' && Boolean((get('create-water-soluble') as HTMLInputElement | null)?.checked), plannedFinishAt: value('create-finish') || undefined, factoryId: factory?.id || '', factoryName: factory?.name || '', operatorName: '管理员', operatorRole: '管理员' })
      state.createOpen = false; state.createError = ''; options.onCreated(result)
      options.setNotice(`已创建 ${result.workOrderNo}，计划加工 ${result.plannedQty.toLocaleString('zh-CN')} ${result.qtyUnit}。`)
      options.refreshDialog(); options.refreshRows(true)
    } catch (error) {
      state.createError = error instanceof Error ? error.message : '创建失败，请检查填写内容'
      // Keep entered fields when validation fails.
      let message = root.querySelector<HTMLElement>('[data-early-create-error]')
      if (!message) { message = document.createElement('p'); message.dataset.earlyCreateError = ''; message.className = 'mx-5 my-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700'; root.querySelector('[data-early-create-dialog] section footer')?.before(message) }
      message.textContent = state.createError
    }
    return true
  }
  if (action === 'cancel') {
    const reason = window.prompt('请输入取消原因（历史记录会保留）：') || ''
    if (!reason.trim() || !window.confirm(`确认取消这张未完成的提前${code === 'DYE' ? '染色' : '印花'}加工单？`)) return true
    try {
      const cancel = code === 'DYE' ? cancelProductionDemandDyeWorkOrder : cancelProductionDemandPrintWorkOrder
      cancel(node.dataset.workOrderId || '', { operatorName: '管理员', operatorRole: '管理员', reason })
      options.setNotice('提前加工单已取消，历史和匹配记录已保留。'); options.refreshRows(true)
    } catch (error) { options.setNotice(error instanceof Error ? error.message : '取消失败') }
    return true
  }
  return false
}
