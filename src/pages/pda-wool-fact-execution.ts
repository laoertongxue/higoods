import { runWoolRecordCommand } from '../data/fcs/wool-domain/store.ts'
import {appStore} from '../state/store.ts'
import {pieceAvailableQty} from '../data/fcs/wool-domain/stage-rules.ts'
import {
  addWoolHandover,
  addWoolProcessReport,
  completeWoolWorkOrder,
  getWoolAllowedActions,
  listWoolMachineViews,
  readWoolStore,
  replaceWoolMachineAssociations,
  type WoolAllowedAction,
  type WoolWorkOrder,
} from '../data/fcs/wool-task-domain.ts'
import {
  buildWoolMobileTaskProjection,
  type WoolMobileCompletionFacts,
  type WoolMobileFactRecord,
  type WoolMobileTaskProjection,
} from '../data/fcs/wool-domain/mobile.ts'
import {
  validateWoolPdaTaskAccess,
  type WoolPdaTaskAccessResult,
} from '../data/fcs/wool-pda-task-access.ts'
import { getPdaSession } from '../data/fcs/store-domain-pda.ts'
import { escapeHtml } from '../utils.ts'
import {
  pdaBackButton,
  pdaDetails,
  pdaEmpty,
  pdaNotice,
  pdaPill,
  pdaSectionTitle,
  pdaStickyFooter,
  pdaUi,
} from './pda-mobile-ui.ts'

type WoolFactAction = Extract<
  WoolAllowedAction,
  'RECEIVE_YARN' | 'RECEIVE_PIECES' | 'REPORT_PROCESS' | 'HANDOVER' | 'ASSOCIATE_MACHINE' | 'COMPLETE'
>
export type WoolPdaFactSurface = 'EXECUTION' | 'HANDOVER_RECEIVE' | 'HANDOVER_HANDOUT'
type CompletionSection = keyof WoolMobileCompletionFacts

interface WoolActionDraft {
  selectedYarnSkus: string[]
  selectedMachineIds: string[]
  quantities: Record<string, string>
  differenceNotes: Record<string, string>
  outputSkuCode: string
  pieceKey?: string
  qty: string
  deliveryNo: string
  batchNo: string
  proofText: string
  remark: string
  completionLimits: Partial<Record<CompletionSection, number>>
}

const ACTION_LABELS: Record<WoolFactAction, string> = {
  RECEIVE_YARN: '接收纱线',
  RECEIVE_PIECES: '接收外加工片',
  REPORT_PROCESS: '加工填报',
  HANDOVER: '发起交出',
  ASSOCIATE_MACHINE: '关联横机设备',
  COMPLETE: '完成加工单',
}

const SURFACE_ACTIONS: Record<WoolPdaFactSurface, WoolFactAction[]> = {
  EXECUTION: ['COMPLETE', 'REPORT_PROCESS', 'ASSOCIATE_MACHINE'],
  HANDOVER_RECEIVE: ['RECEIVE_YARN', 'RECEIVE_PIECES'],
  HANDOVER_HANDOUT: ['HANDOVER'],
}

const FACT_LABELS: Record<WoolMobileFactRecord['recordType'], string> = {
  PIECE_RECEIPT: '末工艺回货片实收',
  INTERNAL_RECEIPT: '不外发片对应件数',
  YARN_RECEIPT: '纱线确认接收',
  PROCESS_REPORT: '加工填报',
  HANDOVER: '发起交出',
  QTY_CHANGE: '数量修改',
  WAREHOUSE_FLOW: '库存流水',
}

const state: {
  taskId: string
  userId: string
  surface: WoolPdaFactSurface
  overlay: null | { action: WoolFactAction; woolOrderId: string; commandId: string }
  draftsByAction: Partial<Record<WoolFactAction, WoolActionDraft>>
  factLimit: number
  error: string
  feedback: string
} = {
  taskId: '',
  userId: '',
  surface: 'EXECUTION',
  overlay: null,
  draftsByAction: {},
  factLimit: 5,
  error: '',
  feedback: '',
}

let commandSequence = 0

export function resetPdaWoolExecutionState(): void {
  state.taskId = ''
  state.userId = ''
  state.surface = 'EXECUTION'
  state.overlay = null
  state.draftsByAction = {}
  state.factLimit = 5
  state.error = ''
  state.feedback = ''
}

export function capturePdaWoolExecutionStateForDiagnostics(): {
  taskId: string
  userId: string
  surface: WoolPdaFactSurface
  overlayAction: WoolFactAction | null
  commandId: string
  draftActions: WoolFactAction[]
} {
  return {
    taskId: state.taskId,
    userId: state.userId,
    surface: state.surface,
    overlayAction: state.overlay?.action || null,
    commandId: state.overlay?.commandId || '',
    draftActions: Object.keys(state.draftsByAction) as WoolFactAction[],
  }
}

function syncTask(taskId: string, userId: string, surface: WoolPdaFactSurface): void {
  if (state.taskId === taskId && state.userId === userId && state.surface === surface) return
  state.taskId = taskId
  state.userId = userId
  state.surface = surface
  state.overlay = null
  state.draftsByAction = {}
  state.factLimit = 5
  state.error = ''
  state.feedback = ''
}

if (typeof window !== 'undefined') {
  window.addEventListener('higood:pda-wool-exec-leave', resetPdaWoolExecutionState)
}

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function nextCommandId(action: WoolFactAction, woolOrderId: string): string {
  commandSequence += 1
  return `PDA-${action}-${woolOrderId}-${Date.now()}-${commandSequence}`
}

function getCurrentAccess(taskId: string, woolOrderId?: string): WoolPdaTaskAccessResult {
  const session = getPdaSession()
  return validateWoolPdaTaskAccess({
    taskId,
    woolOrderId,
    currentFactoryId: session?.factoryId,
  })
}

function renderAccessBlocked(access: WoolPdaTaskAccessResult, showBack = true): string {
  return `
    <div class="space-y-3 p-4" data-pda-wool-access-blocked>
      ${showBack ? '<button type="button" class="text-sm text-muted-foreground" data-pda-execd-action="back">← 返回</button>' : ''}
      <section class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <h2 class="font-semibold">当前任务不可操作</h2>
        <p class="mt-2">${escapeHtml(access.reasonLabel)}</p>
        <p class="mt-2 text-xs">页面已进入只读阻断状态，不会写入任何毛织加工单事实。</p>
      </section>
    </div>
  `
}

function outputLabel(order: WoolWorkOrder, outputSkuCode: string): string {
  const line = order.outputPlanLines.find((item) => item.outputSkuCode === outputSkuCode)
  return line
    ? [outputSkuCode, line.colorName, line.sizeCode, line.woolPartName].filter(Boolean).join(' / ')
    : outputSkuCode
}

function safeStyleImageUrl(value?: string): string {
  const url = value?.trim() || ''
  return /^(?:https?:\/\/|\/|data:image\/)/i.test(url) ? url : ''
}

function emptyDraft(outputSkuCode = ''): WoolActionDraft {
  return {
    selectedYarnSkus: [],
    selectedMachineIds: [],
    quantities: {},
    differenceNotes: {},
    outputSkuCode,
    qty: '',
    deliveryNo: '',
    batchNo: '',
    proofText: '',
    remark: '',
    completionLimits: {},
  }
}

function draftFor(action: WoolFactAction, projection: WoolMobileTaskProjection): WoolActionDraft {
  const existing = state.draftsByAction[action]
  if (existing) return existing
  const outputSkuCode = action === 'REPORT_PROCESS'
    ? projection.readyOutputSkuCodes[0] || ''
    : action === 'HANDOVER'
      ? projection.completionFacts.waitHandoverStocks.find((item) => item.availableHandoverQty > 0)?.outputSkuCode || ''
      : ''
  const draft = emptyDraft(outputSkuCode)
  if (action === 'ASSOCIATE_MACHINE') {
    draft.selectedMachineIds = projection.completionFacts.currentMachines.map((item) => item.machineId)
  }
  state.draftsByAction[action] = draft
  return draft
}

function parseProofFiles(value: string): string[] {
  return [...new Set(value.split(/[\n,，]+/).map((item) => item.trim()).filter(Boolean))]
}

function surfaceActions(actions: WoolAllowedAction[], surface: WoolPdaFactSurface): WoolFactAction[] {
  return SURFACE_ACTIONS[surface].filter((action) => actions.includes(action))
}

function primaryAction(actions: WoolAllowedAction[], surface: WoolPdaFactSurface): WoolFactAction | null {
  for (const action of SURFACE_ACTIONS[surface]) {
    if (actions.includes(action)) return action
  }
  return null
}

function renderStyleIdentity(order: WoolWorkOrder, projection: WoolMobileTaskProjection): string {
  const imageUrl = safeStyleImageUrl(order.styleImageUrl)
  const imageTitle = `${order.styleNo} · ${order.styleName}`
  const stageLabel = order.stage === 'KNITTING' ? '横机加工单' : '缝盘加工单'
  const statusTone = projection.processingStatus === 'COMPLETED' ? 'ready' : 'info'
  return `
    <div class="flex items-start justify-between gap-3 px-1">
      <div class="min-w-0">
        <h1 class="break-words text-[26px] font-bold leading-8 text-[#1a293c]">${escapeHtml(order.woolOrderNo)}</h1>
        <p class="mt-1 break-words text-[13px] leading-5 text-[#62748a]">${stageLabel} · 生产单 ${escapeHtml(order.productionOrderNo)}</p>
      </div>
      ${pdaPill(projection.processingStatusLabel, statusTone)}
    </div>
    <section class="${pdaUi.card} p-3">
      <div class="flex items-center gap-3">
        ${imageUrl
          ? `<button type="button" class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e2e6ec] bg-[#f1f3f6]" data-pda-image-preview-url="${escapeHtml(imageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${order.styleName}款式图片`)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
          : '<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-[#e2e6ec] bg-[#f1f3f6] px-1 text-center text-xs text-[#62748a]">暂无款式图片</div>'}
        <div class="min-w-0 flex-1">
          <h2 class="break-words text-[17px] font-semibold leading-6 text-[#1a293c]">${escapeHtml(order.styleName)}</h2>
          <p class="mt-1 break-words text-[13px] leading-5 text-[#62748a]">${escapeHtml(order.styleNo)} · ${escapeHtml(order.woolOrderNo)}</p>
          <p class="mt-1 break-words text-[13px] leading-5 text-[#62748a]">内部货号 ${escapeHtml(order.internalStyleCode || '—')}</p>
        </div>
      </div>
    </section>
  `
}

function renderOutputReadiness(order: WoolWorkOrder, projection: WoolMobileTaskProjection): string {
  const summaries = new Map(projection.completionFacts.processReports.map((item) => [item.outputSkuCode, item]))
  return order.outputPlanLines.map((line) => {
    const ready = projection.readyOutputSkuCodes.includes(line.outputSkuCode)
    const confirmed = line.requiredYarnSkus.filter((sku) => projection.confirmedYarnSkus.includes(sku))
    const missing = line.requiredYarnSkus.filter((sku) => !projection.confirmedYarnSkus.includes(sku))
    const summary = summaries.get(line.outputSkuCode)
    const statusText = projection.processingStatus === 'COMPLETED'
      ? '加工单已完成，仅可查看'
      : ready
        ? '可继续按实际产出填报'
        : order.stage === 'LINKING'
          ? (order.externalPieces.some(piece => piece.skuCode === line.outputSkuCode) ? '等待横机进度和末工艺回货片；已达可用量时不可继续填报' : '随横机自动填报，无需重复手工填报')
          : missing.length
            ? `缺少任一必需纱线时不可填报：${missing.join('、')}`
            : '已达到计划数量的 150%'
    const tone = projection.processingStatus === 'COMPLETED' ? 'ready' : ready ? 'info' : 'warn'
    return `
      <article class="${pdaUi.card} p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="break-words text-[17px] font-semibold leading-6 text-[#1a293c]">${escapeHtml(outputLabel(order, line.outputSkuCode))}</h3>
            <p class="mt-1 break-words text-[13px] leading-5 text-[#62748a]">${escapeHtml(statusText)}</p>
          </div>
          ${pdaPill(projection.processingStatus === 'COMPLETED' ? '已完成' : ready ? '可填报' : '待条件', tone)}
        </div>
        <div class="mt-3 flex items-end gap-1.5">
          <span class="text-[28px] font-bold leading-none text-[#1a293c]">${summary?.effectiveReportedQty || 0}</span>
          <span class="pb-0.5 text-[14px] text-[#62748a]">/ 上限 ${summary?.reportLimitQty || 0} ${escapeHtml(line.qtyUnit)}</span>
        </div>
        <details class="mt-3 border-t border-[#edf0f4] pt-2">
          <summary class="flex min-h-10 cursor-pointer list-none items-center justify-between text-[13px] font-medium text-[#62748a]"><span>数量依据与纱线</span><span aria-hidden="true">⌄</span></summary>
          <div class="space-y-1 pt-1 text-[13px] leading-5 text-[#62748a]">${order.stage === 'KNITTING' ? `<p>必需纱线：${escapeHtml(line.requiredYarnSkus.join('、') || '未配置')}</p><p>已接收：${escapeHtml(confirmed.join('、') || '无')}</p>` : `<p>本 SKU 可用上限：${summary?.reportLimitQty || 0} 件。</p><p>仅按对应进度与已维护外发片实收计算，不代表核验全部物理片齐套。</p>`}</div>
        </details>
      </article>
    `
  }).join('')
}

function renderQtyChanges(record: WoolMobileFactRecord): string {
  if (!record.qtyChanges.length) return ''
  return `<details class="mt-2"><summary class="cursor-pointer text-muted-foreground">数量修改历史（${record.qtyChanges.length}）</summary><div class="mt-1 space-y-1">${record.qtyChanges.map((change) => `
    <div>${change.beforeQty} → ${change.afterQty}${escapeHtml(change.qtyUnit)}；${escapeHtml(change.reason)}；${escapeHtml(change.changedBy)}；${escapeHtml(change.changedAt)}</div>
  `).join('')}</div></details>`
}

function renderFactList(projection: WoolMobileTaskProjection, expanded = false): string {
  const total = projection.factRecords.length
  const records = projection.factRecords.slice(0, state.factLimit)
  const recordRows = records.map((record) => `
    <article class="rounded-lg border border-[#e6ecf3] bg-[#f8fafc] p-3 text-[13px] leading-5">
      <div class="flex items-start justify-between gap-2">
        <b class="min-w-0 break-words text-[14px] text-[#1a293c]">${FACT_LABELS[record.recordType]}｜${escapeHtml(record.objectSkuCode)}</b>
        <span class="shrink-0 text-[12px] text-[#62748a]">${escapeHtml(record.occurredAt)}</span>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div><span class="block text-[12px] text-[#62748a]">原始数量</span><b>${record.originalQty ?? '—'}${escapeHtml(record.qtyUnit)}</b></div>
        <div><span class="block text-[12px] text-[#62748a]">有效数量</span><b>${record.effectiveQty ?? '—'}${escapeHtml(record.qtyUnit)}</b></div>
      </div>
      ${record.receiverName ? `<p class="mt-2">接收方：${escapeHtml(record.receiverName)} · 下游实收 ${record.downstreamActualReceivedQty ?? '待确认'} · 差异 ${record.downstreamDifferenceQty ?? '—'}</p>` : ''}
      ${record.differenceNote ? `<p class="mt-1 text-[#9a5908]">差异说明：${escapeHtml(record.differenceNote)}</p>` : ''}
      ${record.remark ? `<p class="mt-1">备注：${escapeHtml(record.remark)}</p>` : ''}
      <details class="mt-2 border-t border-[#e6ecf3] pt-2">
        <summary class="flex min-h-10 cursor-pointer list-none items-center justify-between text-[12px] font-medium text-[#62748a]"><span>记录、批次与凭证</span><span aria-hidden="true">⌄</span></summary>
        <div class="space-y-1 pt-1 text-[12px] text-[#62748a]">
          <p class="break-all">记录：${escapeHtml(record.recordId)}${record.recordLineId ? ` / ${escapeHtml(record.recordLineId)}` : ''}</p>
          ${record.batchNo || record.deliveryNo ? `<p>批次：${escapeHtml(record.batchNo || '—')}；送货单：${escapeHtml(record.deliveryNo || '—')}</p>` : ''}
          ${record.proofFiles.length ? `<p class="break-all">凭证：${record.proofFiles.map(escapeHtml).join('、')}</p>` : ''}
          ${record.warehouseFlowIds.length ? `<p class="break-all">库存流水：${record.warehouseFlowIds.map(escapeHtml).join('、')}</p>` : ''}
          <p>${escapeHtml(record.operatedBy)}｜${escapeHtml(record.occurredAt)}</p>
          ${renderQtyChanges(record)}
        </div>
      </details>
    </article>
  `).join('') || '<div class="py-2 text-sm text-[#62748a]">暂无记录</div>'
  return `
    <div data-pda-wool-fact-list-root>
      ${pdaDetails(`完整事实记录（${total}）`, `<div class="space-y-2">${recordRows}</div>${total > records.length ? `<button type="button" class="mt-3 ${pdaUi.secondaryButton}" data-pda-wool-action="fact-more" data-skip-page-rerender="true">加载更多 · 已显示 ${records.length}/${total}</button>` : ''}`, expanded)}
    </div>
  `
}

function draftAttrs(field: string, objectSkuCode?: string): string {
  return `data-pda-wool-draft="sync-draft" data-skip-page-rerender="true" data-draft-field="${field}"${objectSkuCode ? ` data-object-sku="${escapeHtml(objectSkuCode)}"` : ''}`
}


function renderQtyDialog(
  order: WoolWorkOrder,
  projection: WoolMobileTaskProjection,
  draft: WoolActionDraft,
  action: 'REPORT_PROCESS' | 'HANDOVER',
): string {
  if(action === 'HANDOVER' && order.stage === 'KNITTING') {
    const store=readWoolStore(), pieces=order.externalPieces.filter(p=>pieceAvailableQty(store,order,p.pieceKey)>0)
    if(!pieces.some(p=>p.pieceKey===draft.pieceKey))draft.pieceKey=pieces[0]?.pieceKey
    const selected=pieces.find(p=>p.pieceKey===draft.pieceKey)
    if(selected)draft.outputSkuCode=selected.skuCode
    const max=selected?pieceAvailableQty(store,order,selected.pieceKey):0
    return `<div class="space-y-4 p-4"><label class="${pdaUi.label}">选择外发片<select class="mt-1 h-[52px] w-full rounded-xl border border-[#bdcadb] bg-white px-3 text-[16px] text-[#1a293c] outline-none focus:border-[#2461ed]" ${draftAttrs('pieceKey')}>${pieces.map(p=>`<option value="${escapeHtml(p.pieceKey)}" ${p.pieceKey===draft.pieceKey?'selected':''}>${escapeHtml(p.pieceName)} · ${escapeHtml(p.skuCode)}</option>`).join('')}</select></label><p class="text-sm leading-6 text-[#62748a]">接收方：${escapeHtml(selected?.routeNodes[0]?.factoryName||'无可交出片')} · ${escapeHtml(selected?.routeNodes[0]?.craftName||'')}</p><label class="${pdaUi.label}">本次交出（片）<span class="relative mt-1 block"><input type="number" min="1" max="${max}" step="1" class="${pdaUi.input} pr-12" ${draftAttrs('qty')} value="${escapeHtml(draft.qty)}"><span class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#62748a]">片</span></span></label><p class="text-sm leading-6 text-[#62748a]">本次最多 ${max} 片。不外发片随横机填报记录对应件数。</p></div>`
  }
  const candidates = action === 'REPORT_PROCESS'
    ? order.outputPlanLines.filter((line) => projection.readyOutputSkuCodes.includes(line.outputSkuCode))
    : order.outputPlanLines.filter((line) =>
      (projection.completionFacts.waitHandoverStocks.find((item) =>
        item.outputSkuCode === line.outputSkuCode)?.availableHandoverQty || 0) > 0)
  if (!candidates.some((line) => line.outputSkuCode === draft.outputSkuCode)) {
    draft.outputSkuCode = candidates[0]?.outputSkuCode || ''
  }
  const summary = (sku: string): string => {
    if (action === 'REPORT_PROCESS') {
      const item = projection.completionFacts.processReports.find((entry) => entry.outputSkuCode === sku)
      return `累计 ${item?.effectiveReportedQty || 0} / 上限 ${item?.reportLimitQty || 0}`
    }
    const item = projection.completionFacts.waitHandoverStocks.find((entry) => entry.outputSkuCode === sku)
    return `可交余额 ${item?.availableHandoverQty || 0}${item?.qtyUnit || ''}（默认库位库存 ${item?.effectiveStockQty || 0}${item?.qtyUnit || ''}）`
  }
  const selectedAvailability = projection.completionFacts.waitHandoverStocks.find((item) =>
    item.outputSkuCode === draft.outputSkuCode)
  const selectedUnit = candidates.find((line) => line.outputSkuCode === draft.outputSkuCode)?.qtyUnit || ''
  return `<div class="space-y-4 p-4">
    <label class="${pdaUi.label}">${action === 'REPORT_PROCESS' ? '加工后 SKU' : '交出 SKU'}
      <select class="mt-1 min-h-[52px] w-full rounded-xl border border-[#bdcadb] bg-white px-3 py-2 text-[16px] text-[#1a293c] outline-none focus:border-[#2461ed]" ${draftAttrs('outputSkuCode')} ${candidates.length ? '' : 'disabled'}>${candidates.map((line) => `<option value="${escapeHtml(line.outputSkuCode)}" ${line.outputSkuCode === draft.outputSkuCode ? 'selected' : ''}>${escapeHtml(outputLabel(order, line.outputSkuCode))}｜${escapeHtml(summary(line.outputSkuCode))}</option>`).join('')}</select>
    </label>
    ${candidates.length ? '' : pdaNotice('当前没有可交出的 SKU。请返回核对有效加工填报、累计有效交出和默认库位库存。', 'warn')}
    <label class="${pdaUi.label}">本次数量<span class="relative mt-1 block"><input type="number" min="1" ${action === 'HANDOVER' ? `max="${selectedAvailability?.availableHandoverQty || 0}"` : ''} step="1" class="${pdaUi.input} pr-14" ${draftAttrs('qty')} value="${escapeHtml(draft.qty)}" ${candidates.length ? '' : 'disabled'}><span class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#62748a]">${escapeHtml(selectedUnit)}</span></span></label>
    ${action === 'HANDOVER' ? `<div class="rounded-xl border border-[#dfe6ee] bg-[#f8fafc] p-3 text-sm leading-6">接收方：${escapeHtml(order.downstreamTarget.receiverName || '交出去向未配置')}</div>` : ''}
    <label class="${pdaUi.label}">凭证（可选）<textarea class="mt-1 min-h-20 w-full rounded-xl border border-[#bdcadb] bg-white p-3 text-[15px] font-normal text-[#1a293c] outline-none focus:border-[#2461ed]" placeholder="凭证文件名或地址，逗号/换行分隔" ${draftAttrs('proofText')}>${escapeHtml(draft.proofText)}</textarea></label>
    <label class="${pdaUi.label}">备注（可选）<textarea class="mt-1 min-h-20 w-full rounded-xl border border-[#bdcadb] bg-white p-3 text-[15px] font-normal text-[#1a293c] outline-none focus:border-[#2461ed]" placeholder="填写本次说明" ${draftAttrs('remark')}>${escapeHtml(draft.remark)}</textarea></label>
  </div>`
}

function renderMachineDialog(
  order: WoolWorkOrder,
  projection: WoolMobileTaskProjection,
  draft: WoolActionDraft,
): string {
  const store = readWoolStore()
  const currentMachineIds = new Set(projection.completionFacts.currentMachines.map((item) => item.machineId))
  const associations = new Map(store.machineAssociations.map((item) => [item.machineId, item]))
  const machines = listWoolMachineViews()
  return `<div class="space-y-4 p-4">
    ${pdaNotice('勾选本加工单当前使用的横机。保存的是整组最终关联；取消勾选会解除关联，选择其他加工单正在使用的横机会转移关联。', 'info')}
    <div class="space-y-2">${machines.map((machine) => {
      const association = associations.get(machine.machineId)
      const belongsToCurrent = currentMachineIds.has(machine.machineId)
      const otherOrder = association && !belongsToCurrent
        ? store.workOrders[association.woolOrderId]
        : undefined
      const unavailable = machine.status === 'REPAIR' || machine.status === 'DISABLED'
      const statusLabel = machine.status === 'IDLE'
        ? '空闲'
        : machine.status === 'PRODUCING'
          ? belongsToCurrent ? '本单使用中' : '其他加工单使用中'
          : machine.status === 'REPAIR'
            ? '维修中'
            : '已停用'
      return `<label class="flex min-h-[64px] items-start gap-3 rounded-xl border border-[#dfe6ee] bg-white p-3 text-sm ${unavailable ? 'bg-[#f1f5f9] text-[#62748a]' : ''}">
        <input type="checkbox" class="mt-1 h-5 w-5" ${draftAttrs('selectedMachineIds', machine.machineId)} ${draft.selectedMachineIds.includes(machine.machineId) ? 'checked' : ''} ${unavailable ? 'disabled' : ''}>
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-semibold leading-6 text-[#1a293c]">${escapeHtml(machine.machineNo)} / ${escapeHtml(machine.machineName)}</span>
          <span class="mt-1 block text-[13px] leading-5">${escapeHtml(machine.machineModel)} · ${escapeHtml(machine.needleType)} · ${escapeHtml(statusLabel)}</span>
          ${otherOrder ? `<span class="mt-1 block text-[13px] leading-5 text-[#9a5908]">当前关联 ${escapeHtml(otherOrder.woolOrderNo)}；保存后将转移到本单</span>` : ''}
        </span>
      </label>`
    }).join('') || '<div class="rounded border p-3 text-sm text-muted-foreground">暂无横机设备</div>'}</div>
  </div>`
}

function pagedSection(
  key: CompletionSection,
  title: string,
  rows: string[],
  draft: WoolActionDraft,
): string {
  const limit = draft.completionLimits[key] || 2
  const visible = rows.slice(0, limit)
  return `<section class="rounded-xl border border-[#dfe6ee] bg-white p-3" data-completion-section="${key}">
    <div class="text-[15px] font-semibold leading-6 text-[#1a293c]">${title}</div>
    <div class="mt-2 space-y-2 text-[13px] leading-5 text-[#1a293c]">${visible.join('') || '<div class="text-[#62748a]">暂无有效记录</div>'}</div>
    ${rows.length > visible.length ? `<button type="button" class="mt-3 ${pdaUi.secondaryButton}" data-pda-wool-action="completion-more" data-skip-page-rerender="true" data-section="${key}">加载更多 · 已显示 ${visible.length}/${rows.length}</button>` : ''}
  </section>`
}

const COMPLETION_SECTION_KEYS: CompletionSection[] = [
  'yarnReceipts',
  'processReports',
  'handovers',
  'waitHandoverStocks',
  'currentMachines',
]

function renderCompletionFactSection(
  facts: WoolMobileTaskProjection['completionFacts'],
  key: CompletionSection,
  draft: WoolActionDraft,
): string {
  if (key === 'yarnReceipts') {
    return pagedSection(key, '1. 确认接收的纱线', facts.yarnReceipts.map((item) => `<div>${escapeHtml(item.yarnSkuCode)}：有效 ${item.effectiveReceivedQty}${item.qtyUnit}；批次 ${escapeHtml(item.batchNos.join('、') || '无')}；最近接收 ${escapeHtml(item.latestReceivedAt || '无')}</div>`), draft)
  }
  if (key === 'processReports') {
    return pagedSection(key, '2. 加工填报', facts.processReports.map((item) => `<div>${escapeHtml(item.outputSkuCode)}：计划 ${item.plannedQty}；可用上限 ${item.reportLimitQty}；有效填报 ${item.effectiveReportedQty}；与计划差异 ${item.differenceFromPlanQty}${item.qtyUnit}</div>`), draft)
  }
  if (key === 'handovers') {
    return pagedSection(key, '3. 发起交出', facts.handovers.map((item) => `<div>${escapeHtml(item.handoverId)} / ${escapeHtml(item.outputSkuCode)}：有效 ${item.effectiveQty}${item.qtyUnit}；接收方 ${escapeHtml(item.receiverName)}；下游实收 ${item.downstreamActualReceivedQty ?? '待确认'}；差异 ${item.downstreamDifferenceQty ?? '—'}；时间 ${escapeHtml(item.downstreamReceivedAt || '待确认')}</div>`), draft)
  }
  if (key === 'waitHandoverStocks') {
    return pagedSection(key, '4. 待交出仓库存', facts.waitHandoverStocks.map((item) => `<div>${escapeHtml(item.outputSkuCode)}：${item.outputObjectType === 'GARMENT' ? '成衣' : '裁片'}；固定库位 ${escapeHtml(item.defaultLocationId)}；有效余额 ${item.effectiveStockQty}${item.qtyUnit}</div>`), draft)
  }
  return pagedSection(key, '5. 当前横机关联', facts.currentMachines.map((item) => `<div>${escapeHtml(item.machineNo)} / ${escapeHtml(item.machineName)}；关联时间 ${escapeHtml(item.associatedAt)}</div>`), draft)
}

function renderCompleteDialog(projection: WoolMobileTaskProjection, draft: WoolActionDraft): string {
  const order = readWoolStore().workOrders[projection.woolOrderId]
  const facts = projection.completionFacts
  return `<div class="space-y-3 p-4 text-sm">
    ${pdaNotice('请核对当前事实。系统会校验填报、交出和下游实际接收，未满足条件无法完单。', 'warn')}
    ${COMPLETION_SECTION_KEYS.map((key) => renderCompletionFactSection(facts, key, draft)).join('')}
    ${pdaNotice(order.stage === 'KNITTING' ? '确认完成后，系统解除当前关联横机。' : '确认完成前，系统核对最终交出与下游接收。', 'info')}
    <label class="${pdaUi.label}">完成备注（可选）<textarea class="mt-1 min-h-20 w-full rounded-xl border border-[#bdcadb] bg-white p-3 text-[15px] font-normal text-[#1a293c] outline-none focus:border-[#2461ed]" placeholder="填写本次完单说明" ${draftAttrs('remark')}>${escapeHtml(draft.remark)}</textarea></label>
  </div>`
}

function renderOverlay(order: WoolWorkOrder, projection: WoolMobileTaskProjection): string {
  if (!state.overlay || state.overlay.woolOrderId !== order.woolOrderId) return ''
  if(state.overlay.action==='RECEIVE_YARN')return `<section class="rounded border p-4"><a class="text-blue-700" href="/fcs/pda/factory-receipts">扫码接收来纱，填写 pcs、毛重和净重</a></section>`
  const action = state.overlay.action
  const draft = draftFor(action, projection)
  const canSubmit = action !== 'HANDOVER' || (order.stage === 'KNITTING'
    ? order.externalPieces.some(piece => pieceAvailableQty(readWoolStore(), order, piece.pieceKey) > 0)
    : projection.completionFacts.waitHandoverStocks.some(item => item.availableHandoverQty > 0))
  const body = action === 'REPORT_PROCESS' || action === 'HANDOVER'
      ? renderQtyDialog(order, projection, draft, action)
      : action === 'ASSOCIATE_MACHINE'
        ? renderMachineDialog(order, projection, draft)
        : renderCompleteDialog(projection, draft)
  return `<div class="fixed inset-0 z-[140] flex items-end bg-[#13283b66] sm:items-center sm:p-4">
    <section class="max-h-[92vh] w-full overflow-y-auto overflow-x-hidden rounded-t-2xl bg-[#f2f5f9] sm:mx-auto sm:max-w-lg sm:rounded-2xl">
      <header class="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-2 border-b border-[#dfe6ee] bg-white px-4"><h2 class="min-w-0 break-words text-[18px] font-semibold leading-6 text-[#1a293c]">${ACTION_LABELS[action]}${action === 'COMPLETE' ? '二次确认' : ''}</h2><button type="button" class="min-h-12 shrink-0 px-2 text-[14px] text-[#62748a]" data-pda-wool-action="close-overlay" data-skip-page-rerender="true">关闭</button></header>
      ${state.error ? `<div class="px-4 pt-3" data-pda-wool-error>${pdaNotice(state.error, 'danger')}</div>` : ''}
      ${body}
      <footer class="sticky bottom-0 z-10 flex gap-2 border-t border-[#dfe6ee] bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><button type="button" class="min-h-[52px] flex-1 rounded-xl border border-[#ccd8e7] bg-white px-3 text-[15px] font-semibold text-[#62748a]" data-pda-wool-action="close-overlay" data-skip-page-rerender="true">取消</button><button type="button" class="min-h-[52px] flex-1 rounded-xl bg-[#2461ed] px-3 text-[16px] font-semibold text-white disabled:bg-[#aebfd8]" data-pda-wool-action="save-fact" data-skip-page-rerender="true" ${canSubmit ? '' : 'disabled'}>${action === 'COMPLETE' ? '确认完成加工单' : `保存${ACTION_LABELS[action]}`}</button></footer>
    </section>
  </div>`
}

function getSurfaceTitle(surface: WoolPdaFactSurface): string {
  if (surface === 'HANDOVER_RECEIVE') return '交接 · 确认接收'
  if (surface === 'HANDOVER_HANDOUT') return '交接 · 发起交出'
  return '执行加工单'
}

function getSurfaceEmptyText(surface: WoolPdaFactSurface, projection: WoolMobileTaskProjection): string {
  if (projection.processingStatus === 'COMPLETED') return '加工单已完成，只能查看事实记录。'
  if (surface === 'HANDOVER_HANDOUT') return '当前没有可交出的加工成品，请先到“执行”完成加工填报。'
  if (surface === 'HANDOVER_RECEIVE') return '当前不能确认接收，请刷新后核对加工单状态。'
  return '当前没有可执行动作，请核对本阶段的投入接收与可用数量。'
}

export function renderPdaWoolFactContent(
  taskId: string,
  surface: WoolPdaFactSurface,
  initialAccess?: WoolPdaTaskAccessResult,
  showBack = false,
): string {
  const session = getPdaSession()
  syncTask(taskId, session?.userId || '', surface)
  const access = initialAccess ?? getCurrentAccess(taskId)
  if (!access.canAccess || !access.order) return renderAccessBlocked(access, showBack)
  const order = access.order
  const projection = buildWoolMobileTaskProjection(order.woolOrderId)
  const availableSurfaceActions = surfaceActions(projection.allowedActions, surface)
  const primary = primaryAction(projection.allowedActions, surface)
  const secondary = availableSurfaceActions.filter((action) => action !== primary)
  return `<div class="${pdaUi.page}" data-pda-wool-root data-task-id="${escapeHtml(taskId)}" data-wool-order-id="${escapeHtml(order.woolOrderId)}" data-wool-surface="${surface}" data-wool-show-back="${showBack ? 'true' : 'false'}">
    ${showBack ? pdaBackButton('back', true) : ''}
    ${state.error && !state.overlay ? `<div data-pda-wool-error>${pdaNotice(state.error, 'danger')}</div>` : ''}
    ${state.feedback ? pdaNotice(state.feedback, 'ready') : ''}
    ${renderStyleIdentity(order, projection)}
    ${pdaSectionTitle(getSurfaceTitle(surface), order.stage === 'KNITTING' ? '横机产出' : '缝盘产出')}
    <div class="space-y-2">${renderOutputReadiness(order, projection)}</div>
    ${renderFactList(projection)}
    ${secondary.length ? pdaDetails('其他可操作', `<div class="space-y-2">${secondary.map((action) => `<button type="button" class="${pdaUi.actionRow}" data-pda-wool-action="open-fact" data-skip-page-rerender="true" data-wool-fact-action="${action}" data-wool-order-id="${escapeHtml(order.woolOrderId)}"><span class="min-w-0 text-[16px] font-semibold leading-6 text-[#1a293c]">${ACTION_LABELS[action]}</span><span class="shrink-0 text-[#8090a4]" aria-hidden="true">›</span></button>`).join('')}</div>`) : ''}
    <div data-pda-wool-overlay-root>${renderOverlay(order, projection)}</div>
    ${primary
      ? pdaStickyFooter(`<button type="button" class="${pdaUi.primaryButton}" data-pda-wool-action="open-fact" data-skip-page-rerender="true" data-wool-fact-action="${primary}" data-wool-order-id="${escapeHtml(order.woolOrderId)}">${ACTION_LABELS[primary]}</button>`)
      : pdaEmpty(getSurfaceEmptyText(surface, projection))}
  </div>`
}

export function renderPdaWoolExecutionContent(
  taskId: string,
  initialAccess?: WoolPdaTaskAccessResult,
): string {
  return renderPdaWoolFactContent(taskId, 'EXECUTION', initialAccess, true)
}

export function renderPdaWoolHandoverContent(
  taskId: string,
  mode: 'RECEIVE' | 'HANDOVER',
): string {
  return renderPdaWoolFactContent(
    taskId,
    mode === 'RECEIVE' ? 'HANDOVER_RECEIVE' : 'HANDOVER_HANDOUT',
  )
}

function refreshRoot(root: HTMLElement, taskId: string): void {
  const surface = (root.dataset.woolSurface || 'EXECUTION') as WoolPdaFactSurface
  root.outerHTML = renderPdaWoolFactContent(
    taskId,
    surface,
    undefined,
    root.dataset.woolShowBack === 'true',
  )
}

function refreshOverlay(root: HTMLElement, order: WoolWorkOrder): void {
  const target = root.querySelector<HTMLElement>('[data-pda-wool-overlay-root]')
  if (target) target.innerHTML = renderOverlay(order, buildWoolMobileTaskProjection(order.woolOrderId))
}

function refreshCompletionSection(
  root: HTMLElement,
  order: WoolWorkOrder,
  section: CompletionSection,
): void {
  const target = root.querySelector<HTMLElement>(`[data-completion-section="${section}"]`)
  if (!target) return
  const projection = buildWoolMobileTaskProjection(order.woolOrderId)
  const draft = draftFor('COMPLETE', projection)
  target.outerHTML = renderCompletionFactSection(projection.completionFacts, section, draft)
}

function refreshFactList(root: HTMLElement, order: WoolWorkOrder): void {
  const target = root.querySelector<HTMLElement>('[data-pda-wool-fact-list-root]')
  if (target) {
    target.outerHTML = renderFactList(buildWoolMobileTaskProjection(order.woolOrderId), true)
  }
}

function syncDraft(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  if (!state.overlay) return
  const draft = state.draftsByAction[state.overlay.action]
  const field = target.dataset.draftField
  if (!draft || !field) return
  const sku = target.dataset.objectSku || ''
  if (field === 'selectedYarnSkus' && target instanceof HTMLInputElement) {
    draft.selectedYarnSkus = target.checked
      ? [...new Set([...draft.selectedYarnSkus, sku])]
      : draft.selectedYarnSkus.filter((item) => item !== sku)
  } else if (field === 'selectedMachineIds' && target instanceof HTMLInputElement) {
    draft.selectedMachineIds = target.checked
      ? [...new Set([...draft.selectedMachineIds, sku])]
      : draft.selectedMachineIds.filter((item) => item !== sku)
  } else if (field === 'quantities' || field === 'differenceNotes') {
    draft[field][sku] = target.value
  } else if (
    field === 'pieceKey'
    || field === 'outputSkuCode'
    || field === 'qty'
    || field === 'deliveryNo'
    || field === 'batchNo'
    || field === 'proofText'
    || field === 'remark'
  ) {
    draft[field] = target.value
  }
}

export function handlePdaWoolExecutionEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-pda-wool-root]')
  if (!root) return false
  const draftNode = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-pda-wool-draft="sync-draft"]')
  if (draftNode) {
    syncDraft(draftNode)
    if (state.overlay?.action === 'HANDOVER' && ['outputSkuCode','pieceKey'].includes(draftNode.dataset.draftField || '')) {
      const access = getCurrentAccess(
        root.dataset.taskId || '',
        root.dataset.woolOrderId || '',
      )
      if (access.canAccess && access.order) refreshOverlay(root, access.order)
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-pda-wool-action]')
  const action = actionNode?.dataset.pdaWoolAction
  if (!actionNode || !action) return false
  const taskId = root.dataset.taskId || ''
  const woolOrderId = root.dataset.woolOrderId || ''
  const surface = (root.dataset.woolSurface || 'EXECUTION') as WoolPdaFactSurface
  const access = getCurrentAccess(taskId, woolOrderId)
  if (!access.canAccess || !access.order) {
    root.outerHTML = renderAccessBlocked(access, root.dataset.woolShowBack === 'true')
    return true
  }
  const order = access.order
  const projection = buildWoolMobileTaskProjection(order.woolOrderId)

  if (action === 'open-fact') {
    const factAction = actionNode.dataset.woolFactAction as WoolFactAction
    if (
      !SURFACE_ACTIONS[surface].includes(factAction)
      ||
      !projection.allowedActions.includes(factAction)
      || !getWoolAllowedActions(order.woolOrderId).includes(factAction)
    ) {
      state.error = '当前业务事实已变化，请按最新页面操作。'
      refreshRoot(root, taskId)
      return true
    }
    if (factAction === 'RECEIVE_YARN' || factAction === 'RECEIVE_PIECES') { appStore.navigate(`/fcs/pda/wool/pending-receipts?workOrderId=${encodeURIComponent(order.woolOrderId)}&pda=1`); return true }
    if (state.overlay?.action !== factAction) state.draftsByAction = {}
    state.overlay = {
      action: factAction,
      woolOrderId: order.woolOrderId,
      commandId: nextCommandId(factAction, order.woolOrderId),
    }
    draftFor(factAction, projection)
    state.error = ''
    refreshOverlay(root, order)
    return true
  }
  if (action === 'close-overlay') {
    if (state.overlay) delete state.draftsByAction[state.overlay.action]
    state.overlay = null
    state.error = ''
    refreshOverlay(root, order)
    return true
  }
  if (action === 'fact-more') {
    state.factLimit += 5
    refreshFactList(root, order)
    return true
  }
  if (action === 'completion-more' && state.overlay?.action === 'COMPLETE') {
    const section = actionNode.dataset.section as CompletionSection
    if (!COMPLETION_SECTION_KEYS.includes(section)) return true
    const draft = draftFor('COMPLETE', projection)
    draft.completionLimits[section] = (draft.completionLimits[section] || 2) + 2
    refreshCompletionSection(root, order, section)
    return true
  }
  if (action !== 'save-fact' || !state.overlay) return true

  const saveAccess = getCurrentAccess(taskId, state.overlay.woolOrderId)
  if (!saveAccess.canAccess || !saveAccess.order) {
    state.error = `${saveAccess.reasonLabel} 本次保存未产生任何业务记录。`
    refreshOverlay(root, order)
    return true
  }
  const savingOverlay = state.overlay
  void (async () => {
  const operatedAt = nowText()
  const operatedBy = getPdaSession()?.userName || 'PDA 毛织操作员'
  const currentAction = savingOverlay.action
  const draft = draftFor(currentAction, projection)
  try {
    await runWoolRecordCommand(() => {
    if (currentAction === 'RECEIVE_YARN' || currentAction === 'RECEIVE_PIECES') {
      throw new Error('请从统一待接收入口按来源批次确认')
    } else if (currentAction === 'REPORT_PROCESS') {
      addWoolProcessReport(order.woolOrderId, {
        commandId: savingOverlay.commandId,
        outputSkuCode: draft.outputSkuCode,
        reportedQty: Number(draft.qty),
        reportedAt: operatedAt,
        reportedBy: operatedBy,
        proofFiles: parseProofFiles(draft.proofText),
        remark: draft.remark,
      })
    } else if (currentAction === 'HANDOVER') {
      addWoolHandover(order.woolOrderId, {
        commandId: savingOverlay.commandId,
        outputSkuCode: draft.outputSkuCode,
        pieceKey: draft.pieceKey,
        handoverQty: Number(draft.qty),
        handedOverAt: operatedAt,
        handedOverBy: operatedBy,
        proofFiles: parseProofFiles(draft.proofText),
        remark: draft.remark,
      })
    } else if (currentAction === 'ASSOCIATE_MACHINE') {
      replaceWoolMachineAssociations(order.woolOrderId, draft.selectedMachineIds, {
        operatedAt,
        operatedBy,
      })
    } else {
      completeWoolWorkOrder(order.woolOrderId, {
        commandId: savingOverlay.commandId,
        completedAt: operatedAt,
        completedBy: operatedBy,
        remark: draft.remark,
      })
    }
    })
    state.feedback = `${ACTION_LABELS[currentAction]}已保存，Web 端同步更新。`
    delete state.draftsByAction[currentAction]
    state.overlay = null
    state.error = ''
    refreshRoot(root, taskId)
  } catch (error) {
    state.error = error instanceof Error ? error.message : '保存失败，请检查后重试。'
    refreshOverlay(root, order)
  }
  })()
  return true
}
