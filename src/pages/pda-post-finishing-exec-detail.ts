// @page-pattern: pda
import { renderPdaFrame } from './pda-shell'
import { getPdaRuntimeContext } from './pda-runtime'
import { listDyeWorkOrders } from '../data/fcs/dyeing-task-domain.ts'
import { syncPdaStartRiskAndExceptions } from '../data/fcs/pda-start-link.ts'
import { syncMilestoneOverdueExceptions } from '../data/fcs/pda-exec-link.ts'
import { escapeHtml } from '../utils'
import { formatFactoryDisplayName } from '../data/fcs/factory-mock-data.ts'
import { FULL_CAPABILITY_FACTORY_ID, getPostFinishingWorkOrderById, getPostFinishingWorkOrderBySourceTaskId, getPostFinishingFlowText, getPostFinishingSourceLabel, type PostFinishingWorkOrder } from '../data/fcs/post-finishing-current-read-model.ts'
import { getProcessActionOperationRecordsBySource, getProcessActionOperationRecordsByTask, type ProcessActionOperationRecord } from '../data/fcs/process-action-writeback-service.ts'
import { renderProductionObjectCodeButton } from '../data/fcs/production-order-identity.ts'
import { getProductionObjectLinkIndex, resolveProductionObjectRequest, type ProductionObjectSearchIndex } from '../data/fcs/production-object-overview.ts'
import { getPostFinishingFullFlowPostTask, getPostFinishingProcessProgress, listPostFinishingFullFlowOutboundOrders } from '../data/fcs/post-finishing-full-flow.ts'
import { pdaBackButton, pdaDetails, pdaDetailRow, pdaEmpty, pdaNotice, pdaPill, pdaSectionTitle, pdaUi } from './pda-mobile-ui.ts'

// Only the production and process references present on this existing detail
// are resolved; reuse the same current link projection for this one render.
let linkIndexes = new Map<string, readonly ProductionObjectSearchIndex[]>()
function renderPdaObjectCode({ objectType, objectId, label, relatedProductionOrderNo }: { objectType: 'PRODUCTION_ORDER' | 'PROCESS_DOC'; objectId?: string | null; label?: string | null; relatedProductionOrderNo?: string | null }): string {
  const objectCode = (label || objectId || '').trim(), targetId = (objectId || '').trim()
  if (!targetId || !objectCode) return escapeHtml(objectCode || '-')
  if (!linkIndexes.has(objectType)) linkIndexes.set(objectType, getProductionObjectLinkIndex(objectType))
  const index = linkIndexes.get(objectType)!
  const preferred = resolveProductionObjectRequest({ objectType, objectId: targetId, relatedProductionOrderNo }, index)
  const resolved = preferred.status === 'READY' || !relatedProductionOrderNo ? preferred : resolveProductionObjectRequest({ objectType, objectId: targetId }, index)
  if (resolved.status !== 'READY') return escapeHtml(objectCode)
  return renderProductionObjectCodeButton({ objectType: resolved.indexItem.objectType, objectId: resolved.indexItem.primaryNo, label: objectCode, relatedProductionOrderNo: resolved.indexItem.relatedProductionOrderNo, defaultTab: resolved.clickedRef.defaultTab, highlightKey: resolved.clickedRef.highlightKey, className: 'text-left font-mono text-blue-600 hover:underline' })
}

export function renderPdaPostFinishingExecDetailPage(taskId: string): string {
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()
  // The dedicated post factory's header reads only its post-finishing todos.
  // Other factories still initialize the dye tasks their shared header uses.
  if (getPdaRuntimeContext()?.factoryId !== FULL_CAPABILITY_FACTORY_ID) listDyeWorkOrders()
  const order = getPostFinishingWorkOrderById(taskId) || getPostFinishingWorkOrderBySourceTaskId(taskId)
  return order ? renderPdaPostFinishingExecutionPage(taskId, order) : renderPdaFrame(`<div class="${pdaUi.page}"><div class="px-1">${pdaEmpty('任务不存在')}</div></div>`, 'exec', { disableTodoAutoOpen: true, hideBottomNav: true })
}

function readPostFinishingDetail(order: PostFinishingWorkOrder) {
  const task = getPostFinishingFullFlowPostTask(order.postOrderId) || getPostFinishingFullFlowPostTask(order.postOrderNo)
  const progress = task ? getPostFinishingProcessProgress(task) : undefined
  const ids = task ? new Set([task.postTaskId]) : undefined
  const outbounds = task ? listPostFinishingFullFlowOutboundOrders(undefined, ids) : []
  return { task, progress, outbounds }
}

function renderPostFinishingActionPanel(order: PostFinishingWorkOrder, detail: ReturnType<typeof readPostFinishingDetail>): string {
  const links: string[] = []
  const { task, progress, outbounds } = detail
  if (!order.receiveAction.finishedAt) {
    links.push('<a href="/fcs/pda/post-finishing/return-confirm">扫描送货单确认实收</a>')
  }
  if (order.qcStatus === '待质检' || order.qcStatus === '质检中') {
    links.push('<a href="/fcs/craft/post-finishing/qc-workbench">前往 Web 执行质检</a>')
  }
  if (task) {
    links.push(`<a href="/fcs/pda/post-finishing/execute?id=${encodeURIComponent(task.postTaskNo)}">${progress && progress.availableForOutboundQty > 0 ? `登记加工／准备出货（可交 ${progress.availableForOutboundQty} 件）` : task.status === '后道完成' ? '查看加工及后续记录' : '按项登记本次加工数量'}</a>`)
  }
  if (outbounds.some((record) => record.status === '待出货') || (!task && order.handoverStatus === '待交出')) {
    links.push('<a href="/fcs/pda/handover?tab=handout">前往待交出</a>')
  }
  return links.length
    ? `<div class="space-y-2">${links.map((link, index) => link.replace('<a ', `<a class="${index === 0 ? pdaUi.primaryButton : pdaUi.secondaryButton}" `)).join('')}</div>`
    : pdaEmpty('当前没有可执行动作；后道实际操作只在专用页面完成。')
}

function renderPostFinishingPartialRecords(detail: ReturnType<typeof readPostFinishingDetail>): string {
  const { task, outbounds } = detail
  if (!task) return ''
  const progress = detail.progress!
  return `<article class="${pdaUi.card} p-3">
    <header><h2 class="text-[16px] font-semibold leading-6 text-[#1a293c]">分项加工与多次交出</h2></header>
    <div class="mt-3 grid grid-cols-2 gap-2">${progress.processes.map((process) => `<div class="rounded-lg border border-[#e6ecf3] bg-[#f8fafc] p-3"><div class="text-[13px] leading-5 text-[#62748a]">${escapeHtml(process.processItem)}</div><div class="mt-1 text-[20px] font-semibold leading-6 text-[#1a293c]">${process.applicable ? `${process.completedQty} / ${process.expectedQty} <span class="text-[13px] font-normal text-[#62748a]">件</span>` : '不涉及'}</div></div>`).join('')}</div>
    ${pdaNotice(`全部后道完成 ${progress.totalCompletedQty} 件 · 已准备出货占用 ${progress.totalReservedQty} 件 · 可交 ${progress.availableForOutboundQty} 件`, 'info')}
    ${pdaDetails(`加工责任记录（${progress.records.length} 次）`, `<div class="space-y-2">${progress.records.length ? progress.records.map((record) => `<div class="rounded-lg border border-[#e6ecf3] bg-[#f8fafc] p-3 text-[13px] leading-5"><div class="font-semibold text-[#1a293c]">${escapeHtml(record.processItem)} · ${record.correctionOf ? '订正增减' : '本次完成'} ${record.quantities.reduce((sum, line) => sum + line.quantity, 0)} 件</div><div class="mt-1 text-[#62748a]">责任人 ${escapeHtml(record.responsible.actorName)} · 录入 ${escapeHtml(record.recordedBy.actorName)} · ${escapeHtml(record.recordedAt)}</div>${record.reason ? `<div class="mt-1 text-[#9a5908]">订正原因：${escapeHtml(record.reason)}</div>` : ''}</div>`).join('') : '<p class="text-sm text-[#62748a]">尚无分项登记。</p>'}</div>`)}
    <h3 class="mt-3 text-[15px] font-semibold leading-6 text-[#1a293c]">出货（${outbounds.length} 张）</h3>
    <div class="mt-2 space-y-2">${outbounds.length ? outbounds.map((record) => `<div class="rounded-lg border border-[#e6ecf3] bg-[#f8fafc] p-3"><div class="break-all font-mono text-[14px] font-semibold text-[#1a293c]">${escapeHtml(record.outboundOrderNo)}</div><div class="mt-1 flex items-center justify-between gap-2 text-[13px] text-[#62748a]"><span>${escapeHtml(record.status)}</span><b class="text-[15px] text-[#1a293c]">本次 ${record.lines.reduce((sum, line) => sum + line.outboundQty, 0)} 件</b></div></div>`).join('') : '<p class="text-sm text-[#62748a]">尚未生成出货单。</p>'}</div>
  </article>`
}

function listUnifiedPostFinishingMobileOperationRecords(order: PostFinishingWorkOrder): ProcessActionOperationRecord[] {
  const bySource = getProcessActionOperationRecordsBySource('POST_FINISHING', order.postOrderId)
  const byTask = order.sourceTaskId ? getProcessActionOperationRecordsByTask(order.sourceTaskId) : []
  return Array.from(new Map([...bySource, ...byTask].map((record) => [record.operationRecordId, record])).values())
    .sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))
}

function renderPostFinishingMobileOperationRecords(order: PostFinishingWorkOrder): string {
  const rows = listUnifiedPostFinishingMobileOperationRecords(order)
  if (rows.length === 0) {
    return '<div class="rounded-lg border border-dashed border-[#ccd8e7] bg-[#f8fafc] px-3 py-4 text-center text-sm text-[#62748a]">暂无操作记录</div>'
  }

  return `<div class="space-y-2">${rows.map((record) => `<article class="rounded-lg border border-[#e6ecf3] bg-[#f8fafc] p-3 text-[13px] leading-5" data-testid="operation-record-row"><div class="flex items-start justify-between gap-2"><strong class="min-w-0 break-words text-[14px] text-[#1a293c]">${escapeHtml(record.actionLabel)}</strong><span class="shrink-0 text-[12px] text-[#62748a]">${escapeHtml(record.sourceChannel)}</span></div><p class="mt-1 break-words">${escapeHtml(record.previousStatus)} → ${escapeHtml(record.nextStatus)}</p><p class="mt-1">${record.objectQty} ${escapeHtml(record.qtyUnit)} · 操作人 ${escapeHtml(record.operatorName)}</p>${record.remark ? `<p class="mt-1 break-words text-[12px] text-[#62748a]">${escapeHtml(record.remark)}</p>` : ''}</article>`).join('')}</div>`
}

export function renderPdaPostFinishingExecutionPage(execId: string, order: PostFinishingWorkOrder): string {
  linkIndexes = new Map()
  const detail = readPostFinishingDetail(order)
  const actionRows = [order.receiveAction, order.qcAction, order.postAction]
    .filter(Boolean)
    .map((action) => `<article class="rounded-lg border border-[#e6ecf3] bg-[#f8fafc] p-3 text-sm"><div class="flex items-start justify-between gap-2"><strong class="min-w-0 break-words text-[16px] leading-6 text-[#1a293c]">${escapeHtml(action!.actionType)}</strong>${pdaPill(action!.status, action!.status.includes('完成') || action!.status.includes('已') ? 'ready' : 'warn')}</div><p class="mt-2">确认成衣件数 <b class="text-[18px] text-[#1a293c]">${action!.acceptedGarmentQty} ${escapeHtml(action!.qtyUnit)}</b></p><p class="mt-1 text-[13px] text-[#62748a]">操作人 ${escapeHtml(action!.operatorName || '—')}</p></article>`)
    .join('')
  const statusTone = order.currentStatus.includes('完成') || order.currentStatus.includes('已') ? 'ready' : order.currentStatus.startsWith('待') ? 'warn' : 'info'

  const content = `
    <div class="${pdaUi.page}">
      ${pdaBackButton()}
      <div class="flex items-start justify-between gap-3 px-1">
        <div class="min-w-0">
          <h1 class="break-words text-[26px] font-bold leading-8 text-[#1a293c]">${escapeHtml(order.postOrderNo)}</h1>
          <p class="mt-1 break-words text-[13px] leading-5 text-[#62748a]">生产单 ${escapeHtml(order.sourceProductionOrderNo)} · 来源任务 ${escapeHtml(order.sourceTaskNo)}</p>
        </div>
        ${pdaPill(order.currentStatus, statusTone)}
      </div>

      <section class="${pdaUi.card} p-3">
        <div class="rounded-lg border-l-4 border-[#2461ed] bg-[#f8fafc] p-3">
          <p class="text-[13px] leading-5 text-[#62748a]">后道来源</p>
          <p class="mt-1 break-words text-[15px] font-semibold leading-6 text-[#1a293c]">${escapeHtml(getPostFinishingSourceLabel(order))}</p>
          <p class="mt-1 break-words text-[13px] leading-5 text-[#62748a]">单据 ${escapeHtml(order.postOrderNo)} · 实物 ${escapeHtml(order.sourceProductionOrderNo)}</p>
        </div>
        <div class="mt-2">
          ${pdaDetailRow('当前工厂', escapeHtml(formatFactoryDisplayName(order.currentFactoryName, order.currentFactoryId)))}
          ${pdaDetailRow('后道工厂', escapeHtml(formatFactoryDisplayName(order.managedPostFactoryName, order.managedPostFactoryId)))}
          ${pdaDetailRow('当前流程', escapeHtml(getPostFinishingFlowText(order)))}
        </div>
        ${pdaDetails('更多单据信息', `<div class="space-y-2 text-[13px] leading-5 text-[#62748a]">
          <p>生产单：<span class="font-semibold text-[#1a293c]">${renderPdaObjectCode({ objectType: 'PRODUCTION_ORDER', objectId: order.sourceProductionOrderNo })}</span></p>
          <p>来源任务：<span class="font-semibold text-[#1a293c]">${renderPdaObjectCode({ objectType: 'PROCESS_DOC', objectId: order.sourceTaskNo, relatedProductionOrderNo: order.sourceProductionOrderNo })}</span></p>
          <p>来源车缝任务：<span class="font-semibold text-[#1a293c]">${renderPdaObjectCode({ objectType: 'PROCESS_DOC', objectId: order.sourceSewingTaskNo, relatedProductionOrderNo: order.sourceProductionOrderNo })}</span></p>
          <p>任务模式：<span class="font-semibold text-[#1a293c]">${escapeHtml(order.routeMode)}</span></p>
          <p>是否需要质检：<span class="font-semibold text-[#1a293c]">${order.linkedQcOrderId ? '需要' : '不需要'}</span></p>
          <p>是否需要后道：<span class="font-semibold text-[#1a293c]">${order.requiresPostFinishing ? '需要' : '不需要后道加工'}</span></p>
          <p>后续交出方式：<span class="font-semibold text-[#1a293c]">${order.requiresPostFinishing ? '按全部后道完成量准备出货' : 'QC后直接准备出货'}</span></p>
        </div>`)}
      </section>

      <section class="${pdaUi.card} p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[13px] leading-5 text-[#62748a]">计划成衣件数</p>
            <p class="mt-1 text-[28px] font-bold leading-none text-[#1a293c]">${order.plannedGarmentQty} <span class="text-[14px] font-normal text-[#62748a]">${escapeHtml(order.plannedGarmentQtyUnit)}</span></p>
          </div>
          ${pdaPill('计划', 'info')}
        </div>
        <div class="mt-3">
          ${pdaDetailRow('接收成衣件数', `${order.receiveAction.acceptedGarmentQty} ${escapeHtml(order.receiveAction.qtyUnit)}`)}
          ${pdaDetailRow('已完成实际工序', `${order.postAction.acceptedGarmentQty} ${escapeHtml(order.postAction.qtyUnit)}`)}
        </div>
      </section>

      ${renderPostFinishingPartialRecords(detail)}

      ${pdaSectionTitle('当前可执行动作')}
      <section class="${pdaUi.card} p-3">${renderPostFinishingActionPanel(order, detail)}</section>

      ${pdaDetails('收货、质检与后道摘要', `<div class="space-y-2">${actionRows || '<p class="text-sm text-[#62748a]">暂无摘要</p>'}</div>`)}
      ${pdaDetails('操作记录', renderPostFinishingMobileOperationRecords(order))}
      ${pdaNotice('质检已经收口为 Web 专属操作；此 PDA 页面不再创建、领取或完成质检单。', 'info')}
    </div>
  `
  void execId
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true, hideBottomNav: true })
}
