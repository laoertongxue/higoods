import {
  getProcessOrderTaskRelationView,
  type PendingProcessOrderTaskRef,
  type ProcessOrderTaskDocumentRef,
} from '../data/fcs/process-order-task-links.ts'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderDocument(document: ProcessOrderTaskDocumentRef): string {
  const label = `${document.documentTypeLabel} ${document.documentNo}`
  const content = `
    <div class="font-medium text-slate-800">${escapeHtml(label)}</div>
    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(document.processName)} · ${escapeHtml(document.objectLabel || '对象按加工单明细')} · ${escapeHtml(document.quantityLabel.replace(/\bPIECE\b/g, '件'))}</div>
  `
  const href = document.href || (document.documentKind === 'PRODUCTION_TASK'
    ? `/fcs/progress/board/tasks/${encodeURIComponent(document.documentId)}`
    : '')
  if (!href) return `<div class="rounded-md border bg-background px-3 py-2">${content}</div>`
  return `<a class="block rounded-md border bg-background px-3 py-2 hover:border-blue-300 hover:bg-blue-50/40" href="${href}" data-nav="${href}">${content}</a>`
}

function renderPendingDocument(document: PendingProcessOrderTaskRef): string {
  const objectFlow = [document.inputObjectType, document.outputObjectType].filter(Boolean).join(' → ')
  return `
    <div class="rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2" data-pending-occurrence="${escapeHtml(document.occurrenceEntryId)}">
      <div class="flex items-center justify-between gap-3">
        <div class="font-medium text-slate-800">${escapeHtml(document.processName)}</div>
        <span class="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-700">待生成</span>
      </div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(objectFlow || document.routeObjectKey || '对象按技术包路线节点')}</div>
    </div>
  `
}

function renderRelationCard(title: string, body: string, testId: string): string {
  return `
    <section class="rounded-lg border bg-card p-4" data-testid="${testId}">
      <h4 class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</h4>
      <div class="mt-3 space-y-2 text-sm">${body}</div>
    </section>
  `
}

export function renderProcessOrderTaskRelations(documentId: string): string {
  const view = getProcessOrderTaskRelationView(documentId)
  if (!view) return ''
  const predecessorItems = [
    ...view.predecessors.map(renderDocument),
    ...view.pendingPredecessors.map(renderPendingDocument),
  ]
  const successorItems = [
    ...view.successors.map(renderDocument),
    ...view.pendingSuccessors.map(renderPendingDocument),
  ]
  const predecessorBody = predecessorItems.length
    ? predecessorItems.join('')
    : '<p class="text-muted-foreground">当前加工单是该实物分支的路线起点，暂无前置任务项。</p>'
  const successorBody = successorItems.length
    ? successorItems.join('')
    : '<p class="text-muted-foreground">当前加工单是该实物分支的路线终点，暂无后置任务项。</p>'
  const detailBody = view.taskDetails.length
    ? view.taskDetails.map((detail) => `<div class="rounded-md border bg-background px-3 py-2">${escapeHtml(detail)}</div>`).join('')
    : '<p class="text-muted-foreground">暂无任务明细。</p>'

  return `
    <section class="space-y-3" data-process-order-task-relations="${escapeHtml(view.current.documentId)}">
      <div class="grid gap-3 md:grid-cols-2">
        ${renderRelationCard('需求来源', `<p class="font-medium text-slate-800">${escapeHtml(view.demandSource)}</p><p class="text-xs text-muted-foreground">${escapeHtml(view.current.productionOrderNo || '未绑定生产单')}</p>`, 'process-order-demand-source')}
        ${renderRelationCard('任务明细', detailBody, 'process-order-task-details')}
        ${renderRelationCard('前置任务项', predecessorBody, 'process-order-predecessors')}
        ${renderRelationCard('后置任务项', successorBody, 'process-order-successors')}
      </div>
    </section>
  `
}
