import {
  listLegacyLikeDeductionBasisForTailPages,
  listLegacyLikeDyePrintOrdersForTailPages,
  listLegacyLikeProcessTasksForTailPages,
  listLegacyLikeQualityInspectionsForTailPages,
  listLegacyLikeSettlementBatchesForTailPages,
  listLegacyLikeStatementDraftsForTailPages,
} from '../data/fcs/page-adapters/long-tail-pages-adapter'
import { escapeHtml, formatDateTime, toClassName } from '../utils'

const processTasks = listLegacyLikeProcessTasksForTailPages()
const legacyLikeQualityInspections = listLegacyLikeQualityInspectionsForTailPages()
const legacyLikeDeductionBasisItems = listLegacyLikeDeductionBasisForTailPages()
const legacyLikeDyePrintOrders = listLegacyLikeDyePrintOrdersForTailPages()
const initialStatementDrafts = listLegacyLikeStatementDraftsForTailPages()
const initialSettlementBatches = listLegacyLikeSettlementBatchesForTailPages()

const QC_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '待处理',
  CLOSED: '已结案',
}

const LIABILITY_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
}

const STATEMENT_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  CLOSED: '已关闭',
}

const BATCH_STATUS_ZH: Record<string, string> = {
  PENDING: '待提交',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
}

type TodoKind =
  | 'PENDING_LIABILITY'
  | 'PENDING_CLOSE'
  | 'PENDING_ARBITRATION'
  | 'PENDING_STATEMENT'
  | 'PENDING_GATE'

interface TodoItem {
  id: string
  kind: TodoKind
  kindZh: string
  title: string
  relatedObj: string
  note: string
  updatedAt: string
  href: string
  actionLabel: string
}

const TODO_BADGE: Record<TodoKind, string> = {
  PENDING_LIABILITY: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_CLOSE: 'bg-blue-50 text-blue-700 border-blue-200',
  PENDING_ARBITRATION: 'bg-orange-50 text-orange-700 border-orange-200',
  PENDING_STATEMENT: 'bg-green-50 text-green-700 border-green-200',
  PENDING_GATE: 'bg-red-50 text-red-700 border-red-200',
}

function statCard(label: string, value: number, colorClass = 'text-foreground'): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="p-5">
        <p class="mb-1 text-sm text-muted-foreground">${escapeHtml(label)}</p>
        <p class="text-2xl font-semibold tabular-nums ${colorClass}">${value}</p>
      </div>
    </article>
  `
}

function renderSectionTable(title: string, header: string[], rowsHtml: string, emptyText: string, colspan: number): string {
  return `
    <section class="space-y-3">
      <h2 class="text-sm font-medium text-muted-foreground">${escapeHtml(title)}</h2>
      <div class="rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b bg-muted/30">
              <tr>
                ${header.map((item) => `<th class="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">${escapeHtml(item)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="${colspan}" class="px-4 py-8 text-center text-muted-foreground">${escapeHtml(emptyText)}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `
}

function buildTodos(): TodoItem[] {
  const todos: TodoItem[] = []

  legacyLikeQualityInspections
    .filter((qc) => qc.status === 'SUBMITTED' && (!qc.liabilityStatus || qc.liabilityStatus === 'DRAFT'))
    .forEach((qc) => {
      todos.push({
        id: qc.qcId,
        kind: 'PENDING_LIABILITY',
        kindZh: '待判责',
        title: `QC ${qc.qcId} 待判责`,
        relatedObj: qc.productionOrderId ?? qc.qcId,
        note: `质检结果：${qc.result === 'PASS' ? '合格' : qc.result === 'FAIL' ? '不合格' : '-'}`,
        updatedAt: qc.updatedAt ?? qc.createdAt,
        href: `/fcs/quality/qc-records/${qc.qcId}`,
        actionLabel: '查看质检',
      })
    })

  legacyLikeQualityInspections
    .filter((qc) => qc.status === 'SUBMITTED' && qc.liabilityStatus === 'CONFIRMED')
    .forEach((qc) => {
      todos.push({
        id: `close-${qc.qcId}`,
        kind: 'PENDING_CLOSE',
        kindZh: '待结案',
        title: `QC ${qc.qcId} 待结案`,
        relatedObj: qc.productionOrderId ?? qc.qcId,
        note: '责任已确认，可进行结案',
        updatedAt: qc.updatedAt ?? qc.createdAt,
        href: `/fcs/quality/qc-records/${qc.qcId}`,
        actionLabel: '查看质检',
      })
    })

  legacyLikeQualityInspections
    .filter((qc) => qc.liabilityStatus === 'DISPUTED')
    .forEach((qc) => {
      todos.push({
        id: `arb-${qc.qcId}`,
        kind: 'PENDING_ARBITRATION',
        kindZh: '待仲裁',
        title: `QC ${qc.qcId} 待处理争议`,
        relatedObj: qc.productionOrderId ?? qc.qcId,
        note: '质检结果存在争议，后续在质检记录链路内处理',
        updatedAt: qc.updatedAt ?? qc.createdAt,
        href: `/fcs/quality/qc-records/${qc.qcId}`,
        actionLabel: '查看质检',
      })
    })

  const occupiedIds = new Set(
    initialStatementDrafts
      .filter((statement) => statement.status !== 'CLOSED')
      .flatMap((statement) => statement.itemBasisIds),
  )

  legacyLikeDeductionBasisItems
    .filter((basis) => basis.settlementReady === true && !occupiedIds.has(basis.basisId))
    .forEach((basis) => {
      todos.push({
        id: `stmt-${basis.basisId}`,
        kind: 'PENDING_STATEMENT',
        kindZh: '待生成对账单',
        title: '扣款依据待生成对账单',
        relatedObj: basis.basisId,
        note: `结算对象：${basis.settlementPartyId ?? '-'}`,
        updatedAt: basis.updatedAt ?? basis.createdAt,
        href: '/fcs/settlement/statements',
        actionLabel: '查看对账单生成',
      })
    })

  processTasks
    .filter((task) => task.status === 'BLOCKED' && task.blockReason === 'ALLOCATION_GATE')
    .forEach((task) => {
      todos.push({
        id: `gate-${task.taskId}`,
        kind: 'PENDING_GATE',
        kindZh: '待处理当前生产暂停',
        title: `任务 ${task.taskId} 当前生产暂停`,
        relatedObj: task.productionOrderId ?? task.taskId,
        note: task.blockNoteZh ?? '配货开始条件未满足，任务生产暂停',
        updatedAt: task.updatedAt ?? task.createdAt,
        href: '/fcs/process/task-breakdown',
        actionLabel: '查看拆解任务',
      })
    })

  return todos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20)
}

export function renderOverviewPage(): string {
  const blockedTasks = processTasks.filter((task) => task.status === 'BLOCKED' && task.blockReason === 'ALLOCATION_GATE')
  const openQc = legacyLikeQualityInspections.filter((item) => item.status !== 'CLOSED')
  const disputedQc = legacyLikeQualityInspections.filter((item) => item.liabilityStatus === 'DISPUTED')
  const disputedBasis = legacyLikeDeductionBasisItems.filter((item) => item.status === 'DISPUTED')
  const readyBasis = legacyLikeDeductionBasisItems.filter((item) => item.settlementReady === true)
  const frozenBasis = legacyLikeDeductionBasisItems.filter((item) => !item.settlementReady && item.status !== 'VOID')
  const draftStatements = initialStatementDrafts.filter((item) => item.status === 'DRAFT')
  const processingBatches = initialSettlementBatches.filter((item) => item.status === 'PROCESSING')
  const dpTotal = legacyLikeDyePrintOrders.length
  const dpAvailable = legacyLikeDyePrintOrders.filter((item) => item.availableQty > 0).length
  const dpFail = legacyLikeDyePrintOrders.filter((item) => item.returnedFailQty > 0).length

  const disputedCount = new Set([
    ...disputedQc.map((item) => item.qcId),
    ...disputedBasis.map((item) => item.basisId),
  ]).size

  const recentQc = [...legacyLikeQualityInspections]
    .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
    .slice(0, 5)

  const recentSettlement = [
    ...[...initialStatementDrafts]
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
      .slice(0, 3)
      .map((item) => ({
        id: item.statementId,
        type: 'statement',
        amount: item.totalAmount,
        statusZh: STATEMENT_STATUS_ZH[item.status] ?? item.status,
      })),
    ...[...initialSettlementBatches]
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
      .slice(0, 2)
      .map((item) => ({
        id: item.batchId,
        type: 'batch',
        amount: item.totalAmount,
        statusZh: BATCH_STATUS_ZH[item.status] ?? item.status,
      })),
  ].slice(0, 5)

  const recentQcRows = recentQc
    .map((qc) => {
      const resultClass =
        qc.result === 'PASS'
          ? 'bg-green-50 text-green-700 border-green-200'
          : qc.result === 'FAIL'
            ? 'bg-red-50 text-red-700 border-red-200'
            : ''

      const liabilityClass =
        qc.liabilityStatus === 'DISPUTED'
          ? 'bg-orange-50 text-orange-700 border-orange-200'
          : qc.liabilityStatus === 'CONFIRMED'
            ? 'bg-green-50 text-green-700 border-green-200'
            : ''

      return `
        <tr class="border-b last:border-0 hover:bg-muted/30">
          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(qc.qcId)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(qc.productionOrderId ?? '-')}</td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${resultClass}">
              ${escapeHtml(qc.result === 'PASS' ? '合格' : qc.result === 'FAIL' ? '不合格' : (QC_STATUS_ZH[qc.status] ?? qc.status))}
            </span>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${liabilityClass}">
              ${escapeHtml(LIABILITY_STATUS_ZH[qc.liabilityStatus ?? 'DRAFT'] ?? qc.liabilityStatus ?? '-')}
            </span>
          </td>
          <td class="px-4 py-3 text-right">
            <button data-nav="/fcs/quality/qc-records/${escapeHtml(qc.qcId)}" class="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">查看质检</button>
          </td>
        </tr>
      `
    })
    .join('')

  const recentSettlementRows = recentSettlement
    .map((item) => {
      const href = item.type === 'statement' ? '/fcs/settlement/statements' : '/fcs/settlement/batches'
      const actionText = item.type === 'statement' ? '查看对账单' : '查看批次'
      return `
        <tr class="border-b last:border-0 hover:bg-muted/30">
          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.id)}</td>
          <td class="px-4 py-3 text-xs">${item.type === 'statement' ? '对账单' : '预付款批次'}</td>
          <td class="px-4 py-3 tabular-nums">¥${item.amount.toLocaleString()}</td>
          <td class="px-4 py-3"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.statusZh)}</span></td>
          <td class="px-4 py-3 text-right">
            <button data-nav="${href}" class="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">${actionText}</button>
          </td>
        </tr>
      `
    })
    .join('')

  return `
    <div class="space-y-8 p-6">
      <h1 class="text-xl font-semibold">概览看板</h1>

      <section class="space-y-3">
        <h2 class="text-sm font-medium text-muted-foreground">核心运营</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          ${statCard('生产任务总数', processTasks.length)}
          ${statCard('当前生产暂停任务数', blockedTasks.length, blockedTasks.length > 0 ? 'text-red-600' : 'text-foreground')}
          ${statCard('质检未结案数', openQc.length, openQc.length > 0 ? 'text-amber-600' : 'text-foreground')}
          ${statCard('争议中数', disputedCount, disputedCount > 0 ? 'text-orange-600' : 'text-foreground')}
          ${statCard('可进入结算依据数', readyBasis.length, 'text-green-600')}
          ${statCard('冻结中依据数', frozenBasis.length, frozenBasis.length > 0 ? 'text-amber-600' : 'text-foreground')}
          ${statCard('对账单草稿数', draftStatements.length, draftStatements.length > 0 ? 'text-blue-600' : 'text-foreground')}
          ${statCard('处理中预付款批次数', processingBatches.length, processingBatches.length > 0 ? 'text-blue-600' : 'text-foreground')}
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-sm font-medium text-muted-foreground">染印加工</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          ${statCard('染印加工单总数', dpTotal)}
          ${statCard('染印可继续工单数', dpAvailable, 'text-green-600')}
          ${statCard('染印不合格处理中数', dpFail, dpFail > 0 ? 'text-red-600' : 'text-foreground')}
          ${statCard('回货批次数', legacyLikeDyePrintOrders.reduce((sum, item) => sum + item.returnBatches.length, 0))}
        </div>
      </section>

      ${renderSectionTable('最近质检事项', ['QC单号', '生产单', 'QC结果', '判责状态', '操作'], recentQcRows, '暂无质检记录', 5)}
      ${renderSectionTable('最近结算事项', ['单号', '类型', '金额', '状态', '操作'], recentSettlementRows, '暂无结算记录', 5)}
    </div>
  `
}

export function renderTodosPage(): string {
  const todos = buildTodos()

  const liabilityCount = todos.filter((item) => item.kind === 'PENDING_LIABILITY').length
  const closeCount = todos.filter((item) => item.kind === 'PENDING_CLOSE').length
  const arbitrationCount = todos.filter((item) => item.kind === 'PENDING_ARBITRATION').length
  const statementCount = todos.filter((item) => item.kind === 'PENDING_STATEMENT').length
  const gateCount = todos.filter((item) => item.kind === 'PENDING_GATE').length

  const rows = todos
    .map((item) => `
      <tr class="border-b last:border-0 hover:bg-muted/30">
        <td class="px-4 py-3">
          <span class="inline-flex rounded border px-2 py-0.5 text-xs ${TODO_BADGE[item.kind]}">${escapeHtml(item.kindZh)}</span>
        </td>
        <td class="px-4 py-3 text-sm font-medium">${escapeHtml(item.title)}</td>
        <td class="px-4 py-3 font-mono text-xs text-muted-foreground">${escapeHtml(item.relatedObj)}</td>
        <td class="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.note)}</td>
        <td class="px-4 py-3 text-xs tabular-nums text-muted-foreground">${escapeHtml(formatDateTime(item.updatedAt))}</td>
        <td class="px-4 py-3 text-right">
          <button data-nav="${item.href}" class="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">${escapeHtml(item.actionLabel)}</button>
        </td>
      </tr>
    `)
    .join('')

  return `
    <div class="space-y-6 p-6">
      <h1 class="text-xl font-semibold">我的待办</h1>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        ${statCard('待判责数', liabilityCount, liabilityCount > 0 ? 'text-amber-600' : 'text-foreground')}
        ${statCard('待结案数', closeCount, closeCount > 0 ? 'text-blue-600' : 'text-foreground')}
        ${statCard('待仲裁数', arbitrationCount, arbitrationCount > 0 ? 'text-orange-600' : 'text-foreground')}
        ${statCard('待生成对账单数', statementCount, statementCount > 0 ? 'text-green-600' : 'text-foreground')}
        ${statCard('待处理当前生产暂停数', gateCount, gateCount > 0 ? 'text-red-600' : 'text-foreground')}
      </div>

      <div class="rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b bg-muted/30">
              <tr>
                <th class="px-4 py-3 text-left font-medium text-muted-foreground">待办类型</th>
                <th class="px-4 py-3 text-left font-medium text-muted-foreground">标题</th>
                <th class="px-4 py-3 text-left font-medium text-muted-foreground">关联对象</th>
                <th class="px-4 py-3 text-left font-medium text-muted-foreground">说明</th>
                <th class="px-4 py-3 text-left font-medium text-muted-foreground">更新时间</th>
                <th class="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="6" class="px-4 py-10 text-center text-muted-foreground">暂无待办事项</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
}

export function getBadgeClassByStatus(status: string): string {
  return toClassName(status)
}
