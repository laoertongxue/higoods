// @page-pattern: pda
import { renderPdaFrame } from './pda-shell'
import { listDyeWorkOrders } from '../data/fcs/dyeing-task-domain.ts'
import { syncPdaStartRiskAndExceptions } from '../data/fcs/pda-start-link.ts'
import { syncMilestoneOverdueExceptions } from '../data/fcs/pda-exec-link.ts'
import { escapeHtml } from '../utils'
import { formatFactoryDisplayName } from '../data/fcs/factory-mock-data.ts'
import { getPostFinishingWorkOrderById, getPostFinishingWorkOrderBySourceTaskId, getPostFinishingFlowText, getPostFinishingSourceLabel, type PostFinishingWorkOrder } from '../data/fcs/post-finishing-current-read-model.ts'
import { getProcessActionOperationRecordsBySource, getProcessActionOperationRecordsByTask, type ProcessActionOperationRecord } from '../data/fcs/process-action-writeback-service.ts'
import { renderProductionObjectCodeButton } from '../data/fcs/production-order-identity.ts'
import { getProductionObjectLinkIndex, resolveProductionObjectRequest, type ProductionObjectSearchIndex } from '../data/fcs/production-object-overview.ts'

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
  // Preserve the dye tasks shown by the shared PDA header, without building
  // unrelated process catalogues merely to look up a known PF-POST record.
  listDyeWorkOrders()
  const order = getPostFinishingWorkOrderById(taskId) || getPostFinishingWorkOrderBySourceTaskId(taskId)
  return order ? renderPdaPostFinishingExecutionPage(taskId, order) : renderPdaFrame('<div class="p-4 text-sm text-muted-foreground">任务不存在</div>', 'exec', { disableTodoAutoOpen: true })
}

function renderPostFinishingActionPanel(order: PostFinishingWorkOrder): string {
  const links: string[] = []
  if (!order.receiveAction.finishedAt) {
    links.push('<a class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/return-confirm">扫描送货单确认实收</a>')
  }
  if (order.qcStatus === '待质检' || order.qcStatus === '质检中') {
    links.push('<a class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium" href="/fcs/craft/post-finishing/qc-workbench">前往 Web 执行质检</a>')
  }
  if (order.postStatus === '待后道' || order.postStatus === '后道中') {
    links.push(`<a class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/execute?id=${encodeURIComponent(order.postOrderNo)}">扫描并执行后道加工单</a>`)
  }
  if (order.recheckStatus === '待复检' || order.recheckStatus === '复检中') {
    links.push(`<a class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/recheck?id=${encodeURIComponent(order.recheckOrderNo || '')}">扫描处理后交出复核单</a>`)
  }
  if (order.handoverStatus === '待交出') {
    links.push('<a class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium" href="/fcs/pda/handover?tab=handout">前往待交出</a>')
  }
  return links.length
    ? `<div class="grid gap-2">${links.join('')}</div>`
    : '<div class="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">当前没有可执行动作；后道实际操作只在专用页面完成。</div>'
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
    return '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">暂无操作记录</div>'
  }

  return `
    <div class="overflow-x-auto">
      <table class="min-w-[720px] text-left text-xs">
        <thead class="bg-muted text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">操作动作</th>
            <th class="px-3 py-2 font-medium">状态变化</th>
            <th class="px-3 py-2 font-medium">操作人</th>
            <th class="px-3 py-2 font-medium">成衣件数</th>
            <th class="px-3 py-2 font-medium">来源</th>
            <th class="px-3 py-2 font-medium">备注</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${rows.map((record) => `
            <tr data-testid="operation-record-row">
              <td class="px-3 py-2 font-medium">${escapeHtml(record.actionLabel)}</td>
              <td class="px-3 py-2">${escapeHtml(record.previousStatus)} -> ${escapeHtml(record.nextStatus)}</td>
              <td class="px-3 py-2">${escapeHtml(record.operatorName)}</td>
              <td class="px-3 py-2">${record.objectQty} ${escapeHtml(record.qtyUnit)}</td>
              <td class="px-3 py-2">${escapeHtml(record.sourceChannel)}</td>
              <td class="px-3 py-2">${escapeHtml(record.remark || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

export function renderPdaPostFinishingExecutionPage(execId: string, order: PostFinishingWorkOrder): string {
  linkIndexes = new Map()
  const actionRows = [order.receiveAction, order.qcAction, order.postAction, order.recheckAction]
    .filter(Boolean)
    .map((action) => `
      <tr>
        <td class="px-3 py-2">${escapeHtml(action!.actionType)}</td>
        <td class="px-3 py-2">${escapeHtml(action!.status)}</td>
        <td class="px-3 py-2">${action!.acceptedGarmentQty} ${escapeHtml(action!.qtyUnit)}</td>
        <td class="px-3 py-2">${escapeHtml(action!.operatorName || '—')}</td>
      </tr>
    `)
    .join('')

  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回
        </button>
        <h1 class="text-base font-semibold">实际工序执行</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: order.postOrderNo,
              relatedProductionOrderNo: order.sourceProductionOrderNo,
            })}</span>
            <span class="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(order.currentStatus)}</span>
          </div>
        </header>
        <div class="grid gap-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span class="text-muted-foreground">生产单</span>
            <span class="font-medium">${renderPdaObjectCode({
              objectType: 'PRODUCTION_ORDER',
              objectId: order.sourceProductionOrderNo,
            })}</span>
            <span class="text-muted-foreground">来源任务</span>
            <span class="font-medium">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: order.sourceTaskNo,
              relatedProductionOrderNo: order.sourceProductionOrderNo,
            })}</span>
            <span class="text-muted-foreground">来源车缝任务</span>
            <span class="font-medium">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: order.sourceSewingTaskNo,
              relatedProductionOrderNo: order.sourceProductionOrderNo,
            })}</span>
            <span class="text-muted-foreground">当前工厂</span>
            <span>${escapeHtml(formatFactoryDisplayName(order.currentFactoryName, order.currentFactoryId))}</span>
            <span class="text-muted-foreground">后道工厂</span>
            <span>${escapeHtml(formatFactoryDisplayName(order.managedPostFactoryName, order.managedPostFactoryId))}</span>
            <span class="text-muted-foreground">后道来源</span>
            <span>${escapeHtml(getPostFinishingSourceLabel(order))}</span>
            <span class="text-muted-foreground">当前流程</span>
            <span>${escapeHtml(getPostFinishingFlowText(order))}</span>
            <span class="text-muted-foreground">计划成衣件数</span>
            <span>${order.plannedGarmentQty} ${escapeHtml(order.plannedGarmentQtyUnit)}</span>
            <span class="text-muted-foreground">接收成衣件数</span>
            <span>${order.receiveAction.acceptedGarmentQty} ${escapeHtml(order.receiveAction.qtyUnit)}</span>
            <span class="text-muted-foreground">已完成实际工序成衣件数</span>
            <span>${order.postAction.acceptedGarmentQty} ${escapeHtml(order.postAction.qtyUnit)}</span>
            <span class="text-muted-foreground">当前状态</span>
            <span>${escapeHtml(order.currentStatus)}</span>
            <span class="text-muted-foreground">任务模式</span>
            <span>${escapeHtml(order.routeMode)}</span>
            <span class="text-muted-foreground">是否需要质检</span>
            <span>${order.linkedQcOrderId ? '需要' : '不需要'}</span>
            <span class="text-muted-foreground">是否需要后道</span>
            <span>${order.requiresPostFinishing ? '需要' : '后道已由车缝厂完成'}</span>
            <span class="text-muted-foreground">是否需要复检</span>
            <span>${order.linkedRecheckOrderId ? '需要' : '不需要'}</span>
          </div>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">当前可执行动作</h2>
        </header>
        <div class="space-y-3 p-4">
          ${renderPostFinishingActionPanel(order)}
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">收货、质检、后道、复检记录</h2>
        </header>
        <div class="overflow-x-auto p-4">
          <table class="min-w-[640px] text-left text-xs">
            <thead class="bg-muted text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">动作</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">确认成衣件数</th>
                <th class="px-3 py-2 font-medium">操作人</th>
              </tr>
            </thead>
            <tbody class="divide-y">${actionRows}</tbody>
          </table>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">操作记录</h2>
        </header>
        <div class="p-4">
          ${renderPostFinishingMobileOperationRecords(order)}
        </div>
      </article>
    </div>
  `
  void execId
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}
