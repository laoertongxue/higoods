import { escapeHtml } from '../utils'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../data/fcs/production-order-identity'
import {
  awardRuntimeTaskTender,
  cancelRuntimeTaskTender,
  captureRuntimeDirectDispatchState,
  evaluateRuntimeTenderAwardDispatchPolicy,
  getRuntimeTaskById,
  listRuntimeProcessTasks,
  prepareRuntimeTaskTenderAward,
  restoreRuntimeDirectDispatchState,
  type RuntimeProcessTask,
  type RuntimeTaskTenderAwardInput,
} from '../data/fcs/runtime-process-tasks.ts'
import {
  captureSewingDeliverySlaSnapshotStore,
  formatOperationLocalWallClock,
  restoreSewingDeliverySlaSnapshotStore,
} from '../data/fcs/sewing-delivery-sla.ts'
import { classifyTaskFulfillmentPolicy } from '../data/fcs/task-fulfillment-policy.ts'
import { createEffectiveTaskAssignment } from '../data/fcs/effective-task-assignments.ts'
import {
  buildProductionReturnRulePreview,
  createProductionReturnRuleSnapshot,
} from '../data/fcs/production-return-fulfillment.ts'
import { generateProductionContract, getProductionContract } from '../data/fcs/production-contracts.ts'
import {
  cancelRuntimeTaskTenderRecord,
  captureRuntimeTaskTenderRecordStore,
  getRuntimeTaskTenderRecord,
  listRuntimeTaskTenderRecords,
  markRuntimeTaskTenderAwarded,
  resolveRuntimeTaskTenderStatus,
  restoreRuntimeTaskTenderRecordStore,
  type RuntimeTaskTenderStatus,
} from '../data/fcs/runtime-task-tenders.ts'

type TenderStatus = RuntimeTaskTenderStatus

const STATUS_ZH: Record<TenderStatus, string> = {
  BIDDING: '招标中',
  AWAIT_AWARD: '待定标',
  NO_QUOTE: '无人报价待处理',
  AWARDED: '已定标',
  CANCELLED: '已取消',
}

const STATUS_BADGE: Record<TenderStatus, string> = {
  BIDDING: 'bg-orange-100 text-orange-700 border-orange-200',
  AWAIT_AWARD: 'bg-purple-100 text-purple-700 border-purple-200',
  NO_QUOTE: 'bg-red-100 text-red-700 border-red-200',
  AWARDED: 'bg-green-100 text-green-700 border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
}

export interface FactoryQuoteEntry {
  factoryId: string
  factoryName: string
  hasQuoted: boolean
  quotePrice?: number
  quoteTime?: string
  deliveryDays?: number
  remark?: string
  notifiedAt?: string
}

export interface TenderRow {
  tenderId: string
  taskId: string
  taskIds?: string[]
  productionOrderId: string
  processNameZh: string
  qty: number
  qtyUnit: string
  standardPrice: number
  currency: string
  unit: string
  factoryPoolCount: number
  factoryPoolNames: string[]
  factoryQuotes: FactoryQuoteEntry[]
  minPrice: number
  biddingDeadline: string
  taskDeadline: string
  status: TenderStatus
  awardedFactory?: string
  awardedFactoryId?: string
  awardedPrice?: number
  awardReason?: string
  remark?: string
  businessAssignedAt?: string
  createdAt: string
  createdBy: string
}

const MOCK_TENDERS: TenderRow[] = [
  {
    tenderId: 'TENDER-0002-001',
    taskId: 'TASK-0002-002',
    productionOrderId: 'PO-2024-0002',
    processNameZh: '车缝',
    qty: 800,
    qtyUnit: '件',
    standardPrice: 14500,
    currency: 'IDR',
    unit: '件',
    factoryPoolCount: 4,
    factoryPoolNames: ['万隆车缝厂', '棉兰卫星工厂', '玛琅精工车缝', '泗水裁片厂'],
    factoryQuotes: [
      {
        factoryId: 'ID-F003',
        factoryName: '万隆车缝厂',
        hasQuoted: true,
        quotePrice: 14200,
        quoteTime: '2026-03-15 10:30',
        deliveryDays: 10,
      },
      {
        factoryId: 'ID-F011',
        factoryName: '棉兰卫星工厂',
        hasQuoted: true,
        quotePrice: 13800,
        quoteTime: '2026-03-15 14:22',
        deliveryDays: 12,
      },
      { factoryId: 'ID-F012', factoryName: '玛琅精工车缝', hasQuoted: false },
      { factoryId: 'ID-F004', factoryName: '泗水裁片厂', hasQuoted: false },
    ],
    minPrice: 12000,
    biddingDeadline: '2026-03-20 18:00:00',
    taskDeadline: '2026-04-10 18:00:00',
    status: 'BIDDING',
    remark: '需要提供车缝工艺说明',
    createdAt: '2026-03-12 09:00:00',
    createdBy: '跟单A',
  },
  {
    tenderId: 'TENDER-0003-001',
    taskId: 'TASK-0003-002',
    productionOrderId: 'PO-2024-0003',
    processNameZh: '裁片',
    qty: 600,
    qtyUnit: '件',
    standardPrice: 12000,
    currency: 'IDR',
    unit: '件',
    factoryPoolCount: 5,
    factoryPoolNames: ['泗水裁片厂', '棉兰卫星工厂', '万隆裁片厂', '玛琅裁片厂', '三宝垄裁片厂'],
    factoryQuotes: [
      {
        factoryId: 'ID-F010',
        factoryName: '泗水裁片厂',
        hasQuoted: true,
        quotePrice: 12800,
        quoteTime: '2026-03-09 11:05',
        deliveryDays: 12,
      },
      {
        factoryId: 'ID-F020',
        factoryName: '棉兰卫星工厂',
        hasQuoted: true,
        quotePrice: 11500,
        quoteTime: '2026-03-09 15:40',
        deliveryDays: 10,
      },
      {
        factoryId: 'ID-F021',
        factoryName: '万隆裁片厂',
        hasQuoted: true,
        quotePrice: 11200,
        quoteTime: '2026-03-10 09:18',
        deliveryDays: 14,
        remark: '急单可缩短2天',
      },
      {
        factoryId: 'ID-F011',
        factoryName: '玛琅裁片厂',
        hasQuoted: true,
        quotePrice: 16200,
        quoteTime: '2026-03-10 16:55',
        deliveryDays: 9,
      },
      {
        factoryId: 'ID-F004',
        factoryName: '三宝垄裁片厂',
        hasQuoted: true,
        quotePrice: 13500,
        quoteTime: '2026-03-10 17:30',
        deliveryDays: 11,
      },
    ],
    minPrice: 11000,
    biddingDeadline: '2026-03-10 18:00:00',
    taskDeadline: '2026-04-05 18:00:00',
    status: 'AWAIT_AWARD',
    createdAt: '2026-03-08 10:30:00',
    createdBy: '跟单B',
  },
  {
    tenderId: 'TENDER-0004-001',
    taskId: 'TASK-0004-002',
    productionOrderId: 'PO-2024-0004',
    processNameZh: '车缝',
    qty: 500,
    qtyUnit: '件',
    standardPrice: 14500,
    currency: 'IDR',
    unit: '件',
    factoryPoolCount: 3,
    factoryPoolNames: ['万隆车缝厂', '玛琅精工车缝', '棉兰卫星工厂'],
    factoryQuotes: [
      {
        factoryId: 'ID-F003',
        factoryName: '万隆车缝厂',
        hasQuoted: true,
        quotePrice: 13200,
        quoteTime: '2026-03-07 09:00',
        deliveryDays: 10,
      },
      {
        factoryId: 'ID-F012',
        factoryName: '玛琅精工车缝',
        hasQuoted: true,
        quotePrice: 13800,
        quoteTime: '2026-03-07 14:30',
        deliveryDays: 8,
      },
      {
        factoryId: 'ID-F011',
        factoryName: '棉兰卫星工厂',
        hasQuoted: true,
        quotePrice: 14100,
        quoteTime: '2026-03-08 10:00',
        deliveryDays: 11,
      },
    ],
    minPrice: 11500,
    biddingDeadline: '2026-03-08 18:00:00',
    taskDeadline: '2026-04-01 18:00:00',
    status: 'AWARDED',
    awardedFactoryId: 'ID-F003',
    awardedFactory: '万隆车缝厂',
    awardedPrice: 13200,
    awardReason: '报价最低且交期最短，综合评估最优',
    createdAt: '2026-03-05 14:00:00',
    createdBy: '跟单A',
  },
]

interface LocalAward {
  awardedFactoryId: string
  awardedFactory: string
  awardedPrice: number
  awardReason: string
}

interface RuntimeTenderBatchAwardInput extends Omit<RuntimeTaskTenderAwardInput, 'taskId'> {
  taskIds: string[]
  allowLegacyLocalOnly?: boolean
}

interface TendersPageState {
  keyword: string
  statusFilter: 'ALL' | TenderStatus
  processFilter: string
  factoryFilter: string
  quoteFilter: 'ALL' | 'QUOTED' | 'UNQUOTED'
  createdStart: string
  createdEnd: string
  deadlineStart: string
  deadlineEnd: string
  localAwards: Record<string, LocalAward>
  viewTenderId: string | null
  viewAwardFactoryId: string
  viewAwardReason: string
  viewAwardRiskConfirmedByFactoryId: Record<string, boolean>
  viewAwardSupervisorAssignedByFactoryId: Record<string, boolean>
  viewAwardSecondConfirm: boolean
  viewCancelReason: string
  viewCancelSecondConfirm: boolean
  awardContractId: string | null
}

const state: TendersPageState = {
  keyword: '',
  statusFilter: 'ALL',
  processFilter: 'ALL',
  factoryFilter: 'ALL',
  quoteFilter: 'ALL',
  createdStart: '',
  createdEnd: '',
  deadlineStart: '',
  deadlineEnd: '',
  localAwards: {},
  viewTenderId: null,
  viewAwardFactoryId: '',
  viewAwardReason: '',
  viewAwardRiskConfirmedByFactoryId: {},
  viewAwardSupervisorAssignedByFactoryId: {},
  viewAwardSecondConfirm: false,
  viewCancelReason: '',
  viewCancelSecondConfirm: false,
  awardContractId: null,
}

let initializedQueryTenderId: string | null | undefined

function calcRemaining(deadline: string): string {
  const end = new Date(deadline.replace(' ', 'T')).getTime()
  const diff = end - Date.now()

  if (diff <= 0) return '已截止'

  const days = Math.floor(diff / 86400000)
  if (days >= 1) return `还剩 ${days} 天`

  const hours = Math.floor(diff / 3600000)
  if (hours >= 1) return `还剩 ${hours} 小时`

  const mins = Math.floor(diff / 60000)
  return `还剩 ${mins} 分钟`
}

function calcPriceSummary(quotes: FactoryQuoteEntry[], currency: string, unit: string): {
  maxStr: string
  minStr: string
  quotedCount: number
} {
  const prices = quotes
    .filter((quote) => quote.hasQuoted && quote.quotePrice != null)
    .map((quote) => quote.quotePrice as number)

  if (prices.length === 0) {
    return {
      maxStr: '暂无报价',
      minStr: '暂无报价',
      quotedCount: 0,
    }
  }

  const max = Math.max(...prices)
  const min = Math.min(...prices)

  return {
    maxStr: `${max.toLocaleString()} ${currency}/${unit}`,
    minStr: `${min.toLocaleString()} ${currency}/${unit}`,
    quotedCount: prices.length,
  }
}

function formatDeviation(
  quotePrice: number,
  standardPrice: number,
  currency: string,
  unit: string,
): { text: string; className: string } {
  const diff = quotePrice - standardPrice
  const pct = standardPrice !== 0 ? ((diff / standardPrice) * 100).toFixed(2) : '0'
  const sign = diff >= 0 ? '+' : ''

  return {
    text: `${sign}${diff.toLocaleString()} ${currency}/${unit}（${sign}${pct}%）`,
    className: diff === 0 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-blue-700',
  }
}

function projectRuntimeTenderRows(now: string): TenderRow[] {
  const tasksById = new Map(listRuntimeProcessTasks().map((task) => [task.taskId, task] as const))
  return listRuntimeTaskTenderRecords().flatMap((localTender) => {
    const task = tasksById.get(localTender.taskId)
    if (!task) return []
    const status = resolveRuntimeTaskTenderStatus(localTender, now)
    const isCurrentTaskTender = task.tenderId === localTender.tenderId
    if (status !== 'CANCELLED' && (!isCurrentTaskTender || task.assignmentMode !== 'BIDDING')) return []

    const quotesByFactoryId = new Map(localTender.quotes.map((quote) => [quote.factoryId, quote] as const))
    const factoryQuotes: FactoryQuoteEntry[] = localTender.factoryPool.map((factory) => {
      const quote = quotesByFactoryId.get(factory.factoryId)
      return quote
        ? { ...quote, hasQuoted: true }
        : { ...factory, hasQuoted: false }
    })

    return [{
      tenderId: localTender.tenderId,
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      processNameZh: task.processNameZh,
      qty: localTender.taskSnapshot.qty,
      qtyUnit: localTender.taskSnapshot.qtyUnit,
      standardPrice: localTender.standardPrice,
      currency: localTender.currency,
      unit: localTender.unit,
      factoryPoolCount: localTender.factoryPool.length,
      factoryPoolNames: localTender.factoryPool.map((factory) => factory.factoryName),
      factoryQuotes,
      minPrice: localTender.minPrice,
      biddingDeadline: localTender.biddingDeadline,
      taskDeadline: localTender.taskDeadline,
      status,
      awardedFactoryId: isCurrentTaskTender ? task.assignedFactoryId : localTender.awardedFactoryId,
      awardedFactory: isCurrentTaskTender ? task.assignedFactoryName : localTender.awardedFactoryName,
      awardedPrice: isCurrentTaskTender ? task.dispatchPrice : localTender.awardedPrice,
      awardReason: localTender.awardReason,
      remark: localTender.remark,
      businessAssignedAt: task.businessAssignedAt || localTender.businessAssignedAt,
      createdAt: localTender.assignmentOperatedAt,
      createdBy: localTender.createdBy,
    }]
  })
}

export function listDispatchTenderRows(now = formatOperationLocalWallClock()): TenderRow[] {
  const rowsByTenderId = new Map(
    MOCK_TENDERS.map((row) => [row.tenderId, row] as const),
  )
  projectRuntimeTenderRows(now).forEach((row) => rowsByTenderId.set(row.tenderId, row))
  return Array.from(rowsByTenderId.values())
}

function getAllTenders(now = formatOperationLocalWallClock()): TenderRow[] {
  return listDispatchTenderRows(now)
}

function getEffectiveAward(tender: TenderRow): LocalAward | undefined {
  const localAward = state.localAwards[tender.tenderId]
  if (localAward) return localAward

  if (tender.awardedFactory && tender.awardedPrice != null) {
    return {
      awardedFactoryId: tender.awardedFactoryId ?? '',
      awardedFactory: tender.awardedFactory,
      awardedPrice: tender.awardedPrice,
      awardReason: tender.awardReason ?? '',
    }
  }

  return undefined
}

function toEffectiveTender(tender: TenderRow): TenderRow {
  const award = getEffectiveAward(tender)
  if (!award) return tender

  return {
    ...tender,
    status: 'AWARDED',
    awardedFactory: award.awardedFactory,
    awardedFactoryId: award.awardedFactoryId,
    awardedPrice: award.awardedPrice,
    awardReason: award.awardReason,
  }
}

function getViewTender(now = formatOperationLocalWallClock()): TenderRow | null {
  if (!state.viewTenderId) return null
  return getAllTenders(now).find((tender) => tender.tenderId === state.viewTenderId) ?? null
}

export function resolveTenderBusinessAssignedAt(
  tender: Pick<TenderRow, 'businessAssignedAt' | 'createdAt'>,
  task?: Pick<RuntimeProcessTask, 'businessAssignedAt' | 'assignmentOperatedAt'> | null,
): string {
  return task?.businessAssignedAt
    || tender.businessAssignedAt
    || task?.assignmentOperatedAt
    || tender.createdAt
}

function renderTenderReturnRulePreview(tender: TenderRow): string {
  const task = getRuntimeTaskById(tender.taskId)
  if (!task) return ''
  const policy = classifyTaskFulfillmentPolicy(task)
  const businessAssignedAt = resolveTenderBusinessAssignedAt(tender, task)
  try {
    const preview = buildProductionReturnRulePreview({
      assignedQty: tender.qty,
      businessAssignedAt,
      policy,
    })
    if (!preview) return ''
    return `
      <div class="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-semibold text-blue-900">定标后的分阶段回货要求</p>
          <span class="text-xs text-blue-700">业务分配日期 ${escapeHtml(preview.assignmentDate)} 为第 1 自然日</span>
        </div>
        <div class="mt-2 grid grid-cols-3 gap-2">
          ${preview.milestones.map((milestone) => `
            <div class="rounded border border-blue-200 bg-white px-2.5 py-2">
              <p class="text-sm font-semibold text-blue-900">${Math.round(milestone.ratio * 100)}% · 第 ${milestone.naturalDay} 天</p>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(milestone.deadlineDate)} 前累计回货</p>
              <p class="mt-1 text-sm font-semibold tabular-nums">${milestone.targetQty.toLocaleString()} 件</p>
            </div>
          `).join('')}
        </div>
        <p class="mt-2 text-xs text-blue-700">此处为定标前预览；二次确认后按同一业务日期与数量生成正式回货规则快照及合同。</p>
      </div>
    `
  } catch (error) {
    return `<div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">回货规则预览失败：${escapeHtml(error instanceof Error ? error.message : '数据异常')}</div>`
  }
}

function getStats(now = formatOperationLocalWallClock()): {
  bidding: number
  awaitAward: number
  noQuote: number
  awarded: number
  cancelled: number
  total: number
} {
  const allTenders = getAllTenders(now).map((tender) => toEffectiveTender(tender))

  return {
    bidding: allTenders.filter((tender) => tender.status === 'BIDDING').length,
    awaitAward: allTenders.filter((tender) => tender.status === 'AWAIT_AWARD').length,
    noQuote: allTenders.filter((tender) => tender.status === 'NO_QUOTE').length,
    awarded: allTenders.filter((tender) => tender.status === 'AWARDED').length,
    cancelled: allTenders.filter((tender) => tender.status === 'CANCELLED').length,
    total: allTenders.length,
  }
}

function getFilteredTenders(now = formatOperationLocalWallClock()): TenderRow[] {
  const allTenders = getAllTenders(now).map((tender) => toEffectiveTender(tender))
  const keyword = state.keyword.trim().toLowerCase()

  return allTenders.filter((tender) => {
    if (state.statusFilter !== 'ALL' && tender.status !== state.statusFilter) return false
    if (state.processFilter !== 'ALL' && tender.processNameZh !== state.processFilter) return false
    if (state.factoryFilter !== 'ALL' && !tender.factoryQuotes.some((factory) => factory.factoryId === state.factoryFilter)) return false
    const quotedCount = tender.factoryQuotes.filter((factory) => factory.hasQuoted).length
    if (state.quoteFilter === 'QUOTED' && quotedCount === 0) return false
    if (state.quoteFilter === 'UNQUOTED' && quotedCount === tender.factoryPoolCount) return false
    const createdDate = tender.createdAt.slice(0, 10)
    const deadlineDate = tender.biddingDeadline.slice(0, 10)
    if (state.createdStart && createdDate < state.createdStart) return false
    if (state.createdEnd && createdDate > state.createdEnd) return false
    if (state.deadlineStart && deadlineDate < state.deadlineStart) return false
    if (state.deadlineEnd && deadlineDate > state.deadlineEnd) return false

    if (keyword) {
      return (
        tender.tenderId.toLowerCase().includes(keyword) ||
        tender.taskId.toLowerCase().includes(keyword) ||
        tender.productionOrderId.toLowerCase().includes(keyword) ||
        tender.processNameZh.toLowerCase().includes(keyword)
      )
    }

    return true
  })
}

function openViewDrawer(tenderId: string, now = formatOperationLocalWallClock()): void {
  const tender = getAllTenders(now).find((row) => row.tenderId === tenderId)
  if (!tender) return

  const award = getEffectiveAward(tender)
  state.viewTenderId = tenderId
  state.viewAwardFactoryId = award?.awardedFactoryId ?? ''
  state.viewAwardReason = award?.awardReason ?? ''
  state.viewAwardRiskConfirmedByFactoryId = {}
  state.viewAwardSupervisorAssignedByFactoryId = {}
  state.viewAwardSecondConfirm = false
  state.viewCancelReason = ''
  state.viewCancelSecondConfirm = false
}

function closeViewDrawer(): void {
  state.viewTenderId = null
  state.viewAwardFactoryId = ''
  state.viewAwardReason = ''
  state.viewAwardRiskConfirmedByFactoryId = {}
  state.viewAwardSecondConfirm = false
  state.viewAwardSupervisorAssignedByFactoryId = {}
  state.viewCancelReason = ''
  state.viewCancelSecondConfirm = false
}

function closeDialogs(): void {
  closeViewDrawer()
  state.awardContractId = null
}

function showTenderToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'dispatch-tender-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'
  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'
    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2400)
}

export function awardRuntimeTenderTasks(input: RuntimeTenderBatchAwardInput): {
  ok: boolean
  message?: string
  tasks?: RuntimeProcessTask[]
} {
  if (input.allowLegacyLocalOnly && input.taskIds.every((taskId) => !getRuntimeTaskById(taskId))) {
    return { ok: true, tasks: [] }
  }
  let preparations: ReturnType<typeof prepareRuntimeTaskTenderAward>[]
  try {
    preparations = input.taskIds.map((taskId) => prepareRuntimeTaskTenderAward({ ...input, taskId }))
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '竞价定标前置校验失败' }
  }

  const runtimeState = captureRuntimeDirectDispatchState()
  const snapshotState = captureSewingDeliverySlaSnapshotStore()
  const tenderRecordState = captureRuntimeTaskTenderRecordStore()
  try {
    const tasks = preparations.map(({ input: awardInput }) => awardRuntimeTaskTender(awardInput))
    preparations.forEach(({ input: awardInput }) => {
      if (!getRuntimeTaskTenderRecord(awardInput.taskId)) return
      markRuntimeTaskTenderAwarded({
        taskId: awardInput.taskId,
        factoryId: awardInput.factoryId,
        factoryName: awardInput.factoryName,
        awardedPrice: awardInput.awardedPrice,
        awardedAt: awardInput.awardedAt,
        awardReason: awardInput.priceDiffReason,
      })
    })
    return { ok: true, tasks }
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(snapshotState)
    restoreRuntimeTaskTenderRecordStore(tenderRecordState)
    return { ok: false, message: error instanceof Error ? error.message : '竞价定标提交失败' }
  }
}

function getTenderAwardPolicyDecision(
  tender: TenderRow,
  quote: FactoryQuoteEntry,
  now = formatOperationLocalWallClock(),
) {
  if (!quote.hasQuoted || quote.quotePrice == null) return null
  const taskIds = tender.taskIds?.length ? tender.taskIds : [tender.taskId]
  const decisions = taskIds
    .map((taskId) => evaluateRuntimeTenderAwardDispatchPolicy({
      taskId,
      factoryId: quote.factoryId,
      factoryName: quote.factoryName,
      awardedAt: now,
      awardedPrice: quote.quotePrice as number,
      by: '平台定标员',
      riskConfirmed: state.viewAwardRiskConfirmedByFactoryId[quote.factoryId] === true,
      supervisorAssigned: state.viewAwardSupervisorAssignedByFactoryId[quote.factoryId] === true,
    }))
    .filter((decision): decision is NonNullable<typeof decision> => decision !== null)
  return decisions.find((decision) => decision.severity === 'BLOCK') ??
    decisions.find((decision) => decision.requiresConfirm) ??
    decisions[0] ??
    null
}

function getTenderAwardPolicyTone(severity: 'ALLOW' | 'WARN' | 'BLOCK'): string {
  if (severity === 'BLOCK') return 'border-red-200 bg-red-50 text-red-700'
  if (severity === 'WARN') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function renderTenderAwardPolicyControls(tender: TenderRow, quote: FactoryQuoteEntry): string {
  const decision = getTenderAwardPolicyDecision(tender, quote)
  if (!decision) return ''
  const riskConfirm = decision.requiresConfirm && decision.reason.includes('黄牌')
    ? `<label class="mt-1 flex items-center gap-1.5 text-[11px]"><input type="checkbox" ${state.viewAwardRiskConfirmedByFactoryId[quote.factoryId] ? 'checked' : ''} data-tender-field="view.awardRiskConfirmed" data-factory-id="${escapeHtml(quote.factoryId)}" />已确认黄牌风险</label>`
    : ''
  const supervisorConfirm = decision.requiresConfirm && decision.reason.includes('主管指定')
    ? `<label class="mt-1 flex items-center gap-1.5 text-[11px]"><input type="checkbox" ${state.viewAwardSupervisorAssignedByFactoryId[quote.factoryId] ? 'checked' : ''} data-tender-field="view.awardSupervisorAssigned" data-factory-id="${escapeHtml(quote.factoryId)}" />主管已指定定标</label>`
    : ''
  return `
    <span class="mt-1 inline-flex flex-col rounded border px-2 py-1 text-[11px] ${getTenderAwardPolicyTone(decision.severity)}">
      <span>${escapeHtml(decision.reason)}</span>
      ${riskConfirm}${supervisorConfirm}
    </span>
  `
}

function confirmAwardInView(now = formatOperationLocalWallClock()): void {
  const tender = getViewTender(now)
  if (!tender) return

  const effective = toEffectiveTender(tender)
  if (effective.status !== 'AWAIT_AWARD') return

  const selectedQuote = tender.factoryQuotes.find(
    (quote) =>
      quote.factoryId === state.viewAwardFactoryId &&
      quote.hasQuoted &&
      quote.quotePrice != null,
  )
  if (!selectedQuote || selectedQuote.quotePrice == null) return

  const needsPriceDifferenceReason = selectedQuote.quotePrice > tender.standardPrice
  if (needsPriceDifferenceReason && state.viewAwardReason.trim() === '') return
  const selectedPolicyDecision = getTenderAwardPolicyDecision(tender, selectedQuote, now)
  if (selectedPolicyDecision && !selectedPolicyDecision.allowed) {
    showTenderToast(selectedPolicyDecision.reason)
    return
  }

  if (!state.viewAwardSecondConfirm) {
    state.viewAwardSecondConfirm = true
    return
  }

  const taskIds = tender.taskIds?.length ? tender.taskIds : [tender.taskId]
  const awardResult = awardRuntimeTenderTasks({
    taskIds,
    factoryId: selectedQuote.factoryId,
    factoryName: selectedQuote.factoryName,
    awardedAt: now,
    awardedPrice: selectedQuote.quotePrice,
    priceDiffReason: state.viewAwardReason.trim() || undefined,
    by: '平台定标员',
    riskConfirmed: state.viewAwardRiskConfirmedByFactoryId[selectedQuote.factoryId] === true,
    supervisorAssigned: state.viewAwardSupervisorAssignedByFactoryId[selectedQuote.factoryId] === true,
    allowLegacyLocalOnly: tender.processNameZh !== '车缝',
  })
  if (!awardResult.ok) {
    showTenderToast(awardResult.message || '定标失败，请刷新后重试')
    return
  }

  const generatedContractIds: string[] = []
  for (const awardedTask of awardResult.tasks ?? []) {
    const policy = classifyTaskFulfillmentPolicy(awardedTask)
    const businessAssignedAt = resolveTenderBusinessAssignedAt(tender, awardedTask)
    const skuLines = awardedTask.scopeSkuLines.length
      ? awardedTask.scopeSkuLines.map((line) => ({ skuCode: line.skuCode, color: line.color, size: line.size, qty: line.qty }))
      : [{ skuCode: awardedTask.skuCode || 'SKU-ALL', color: awardedTask.skuColor || '混色', size: awardedTask.skuSize || '混码', qty: awardedTask.scopeQty }]
    const assignment = createEffectiveTaskAssignment({
      runtimeTaskId: awardedTask.taskId,
      productionOrderId: awardedTask.productionOrderId || tender.productionOrderId,
      productionOrderNo: awardedTask.productionOrderNo,
      taskNo: awardedTask.taskNo,
      factoryId: selectedQuote.factoryId,
      factoryName: selectedQuote.factoryName,
      source: 'TENDER_AWARD',
      assignedQty: skuLines.reduce((sum, line) => sum + line.qty, 0),
      skuLines,
      processCodes: policy.normalizedProcessCodes,
      frozenPrice: selectedQuote.quotePrice,
      priceCurrency: tender.currency,
      priceUnit: tender.unit,
      businessAssignedAt,
      operatedAt: now,
      operatedBy: '平台定标员',
    })
    const returnRuleSnapshot = createProductionReturnRuleSnapshot({
      assignmentId: assignment.assignmentId,
      runtimeTaskId: assignment.runtimeTaskId,
      productionOrderId: assignment.productionOrderId,
      factoryId: assignment.factoryId,
      factoryName: assignment.factoryName,
      assignedQty: assignment.assignedQty,
      businessAssignedAt,
      policy,
    })
    const contract = generateProductionContract({
      assignment,
      policy,
      returnRuleSnapshot,
      processNames: awardedTask.coveredProcesses?.map((item) => item.processName) || [awardedTask.processNameZh],
      generatedAt: now,
      generatedBy: '平台定标员',
    })
    if (contract) generatedContractIds.push(contract.contractId)
  }

  state.localAwards = {
    ...state.localAwards,
    [tender.tenderId]: {
      awardedFactoryId: selectedQuote.factoryId,
      awardedFactory: selectedQuote.factoryName,
      awardedPrice: selectedQuote.quotePrice,
      awardReason: state.viewAwardReason.trim(),
    },
  }

  showTenderToast(
    `定标完成：${selectedQuote.factoryName}，中标价 ${selectedQuote.quotePrice.toLocaleString()} ${tender.currency}/${tender.unit}`,
  )
  closeViewDrawer()
  state.awardContractId = generatedContractIds[0] || null
}

function confirmCancelTenderInView(now = formatOperationLocalWallClock()): void {
  const tender = getViewTender(now)
  if (!tender) return
  const effectiveStatus = toEffectiveTender(tender).status
  if (!['BIDDING', 'AWAIT_AWARD', 'NO_QUOTE'].includes(effectiveStatus)) return
  const runtimeRecord = getRuntimeTaskTenderRecord(tender.taskId)
  if (!runtimeRecord || runtimeRecord.tenderId !== tender.tenderId) {
    showTenderToast('当前招标单不是任务的有效竞价记录，不能取消')
    return
  }
  if (!state.viewCancelReason.trim()) {
    showTenderToast('取消竞价必须填写原因')
    return
  }
  if (!state.viewCancelSecondConfirm) {
    state.viewCancelSecondConfirm = true
    return
  }

  const runtimeState = captureRuntimeDirectDispatchState()
  const tenderRecordState = captureRuntimeTaskTenderRecordStore()
  try {
    cancelRuntimeTaskTenderRecord({
      taskId: tender.taskId,
      tenderId: tender.tenderId,
      cancelledAt: now,
      cancelledBy: '平台定标员',
      reason: state.viewCancelReason,
    })
    cancelRuntimeTaskTender({
      taskId: tender.taskId,
      tenderId: tender.tenderId,
      cancelledAt: now,
      cancelledBy: '平台定标员',
      reason: state.viewCancelReason,
    })
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreRuntimeTaskTenderRecordStore(tenderRecordState)
    showTenderToast(error instanceof Error ? error.message : '取消竞价失败，请刷新后重试')
    return
  }

  showTenderToast(`已取消竞价 ${tender.tenderId}，任务已返回待分配`)
  closeViewDrawer()
}

function renderTenderCancelPanel(tender: TenderRow, status: TenderStatus): string {
  if (!['BIDDING', 'AWAIT_AWARD', 'NO_QUOTE'].includes(status)) return ''
  const runtimeRecord = getRuntimeTaskTenderRecord(tender.taskId)
  if (!runtimeRecord || runtimeRecord.tenderId !== tender.tenderId) return ''
  return `
    <div class="space-y-2 rounded-md border border-red-200 bg-red-50/60 p-3">
      <p class="text-sm font-semibold text-red-700">取消本次竞价</p>
      <p class="text-xs text-red-700">取消后停止接收报价并保留本招标单历史；任务返回待分配，可重新设置工厂池并发起新的整任务竞价。</p>
      <textarea class="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm" rows="2" placeholder="请填写取消原因（必填）" data-tender-field="view.cancelReason">${escapeHtml(state.viewCancelReason)}</textarea>
      ${state.viewCancelSecondConfirm ? '<div class="rounded border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700">请再次确认：该竞价将立即失效，已提交报价仅作为历史留痕，不能继续定标。</div>' : ''}
      <div class="flex justify-end">
        <button class="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100" data-tender-action="confirm-cancel-tender">${state.viewCancelSecondConfirm ? '二次确认取消竞价' : '取消本次竞价'}</button>
      </div>
    </div>
  `
}

function renderAwardContractPrompt(): string {
  const contract = state.awardContractId ? getProductionContract(state.awardContractId) : undefined
  if (!contract) return ''
  return `<div class="fixed inset-0 z-[70] flex items-center justify-center p-4"><button class="absolute inset-0 bg-black/45" data-tender-action="close-award-contract"></button><section class="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"><h2 class="text-lg font-semibold">中标分配及合同已生成</h2><p class="mt-3 text-sm">${escapeHtml(contract.contractNo)} · ${escapeHtml(contract.factoryName)} · ${contract.assignedQty}件</p><p class="mt-2 text-xs text-muted-foreground">是否立即打印合同？稍后可从生产合同管理、任务分配工作台或生产单进度跟踪再次查看。</p><div class="mt-5 flex justify-end gap-2"><button class="rounded border px-4 py-2" data-tender-action="close-award-contract">稍后打印</button><a class="rounded bg-blue-600 px-4 py-2 text-white" target="_blank" href="/fcs/contracts/print?contractId=${encodeURIComponent(contract.contractId)}">立即打印</a></div></section></div>`
}

function renderViewTenderSheet(tender: TenderRow | null): string {
  if (!tender || !state.viewTenderId) return ''

  const effectiveTender = toEffectiveTender(tender)
  const effectiveAward = getEffectiveAward(tender)
  const effectiveStatus = effectiveTender.status
  const priceSummary = calcPriceSummary(tender.factoryQuotes, tender.currency, tender.unit)
  const quotedCount = priceSummary.quotedCount
  const unquotedCount = tender.factoryPoolCount - quotedCount
  const remaining = calcRemaining(tender.biddingDeadline)
  const quotedRows = tender.factoryQuotes.filter((quote) => quote.hasQuoted && quote.quotePrice != null)
  const selectedQuote = quotedRows.find((quote) => quote.factoryId === state.viewAwardFactoryId)
  const selectedPrice = selectedQuote?.quotePrice
  const needReason = selectedPrice != null && selectedPrice > tender.standardPrice
  const selectedPolicyDecision = selectedQuote ? getTenderAwardPolicyDecision(tender, selectedQuote) : null
  const canConfirm =
    effectiveStatus === 'AWAIT_AWARD' &&
    state.viewAwardFactoryId !== '' &&
    selectedPrice != null &&
    (!needReason || state.viewAwardReason.trim() !== '') &&
    selectedPolicyDecision?.allowed !== false

  const avgPrice =
    quotedCount > 0
      ? Math.round(
          quotedRows.reduce((sum, quote) => sum + (quote.quotePrice as number), 0) / quotedCount,
        )
      : null

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-tender-action="close-view" aria-label="关闭"></button>

      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[600px]">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">招标单详情</h3>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-tender-action="close-view">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div class="flex items-center justify-between">
            <span class="font-mono text-sm font-semibold">${escapeHtml(tender.tenderId)}</span>
            <span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[effectiveStatus]}">
              ${STATUS_ZH[effectiveStatus]}
            </span>
          </div>

          <div class="space-y-1.5 rounded-md border bg-muted/20 p-3">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">基础信息</p>
            ${[
              ['招标单号', tender.tenderId],
              ['任务编号', tender.taskId],
              ['生产单号', tender.productionOrderId],
              ['工序', tender.processNameZh],
              ['数量', `${tender.qty} ${tender.qtyUnit}`],
              ['招标状态', STATUS_ZH[effectiveStatus]],
              ['竞价截止时间', tender.biddingDeadline.slice(0, 16)],
              ['任务截止时间', tender.taskDeadline.slice(0, 16)],
              ['距招标结束', remaining],
            ]
              .map(
                ([key, value]) => `
                  <div class="flex items-center justify-between gap-2 text-sm">
                    <span class="shrink-0 text-muted-foreground">${escapeHtml(key)}</span>
                    <span class="text-right text-xs ${
                      key === '距招标结束'
                        ? remaining === '已截止'
                          ? 'font-medium text-red-600'
                          : 'font-medium text-orange-700'
                        : ''
                    }">${escapeHtml(value)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>

          <div class="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/60 p-3">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-xs font-semibold text-amber-800">价格参考</p>
              <span class="rounded border border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-700">平台内部可见，工厂不可见</span>
            </div>

            <p class="mb-2 text-[10px] text-amber-700">以下价格信息仅供平台内部定标参考，工厂不可见</p>
            ${[
              ['工序标准价', `${tender.standardPrice.toLocaleString()} ${tender.currency}/${tender.unit}`, ''],
              ['最低允许报价', `${tender.minPrice.toLocaleString()} ${tender.currency}/${tender.unit}`, 'font-medium text-amber-700'],
            ]
              .map(
                ([key, value, className]) => `
                  <div class="flex items-center justify-between gap-2 text-sm">
                    <span class="text-muted-foreground">${escapeHtml(key)}</span>
                    <span class="tabular-nums ${className}">${escapeHtml(value)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>

          <div class="space-y-3 rounded-md border p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">报价进度</p>
            <div class="grid grid-cols-2 gap-2">
              ${[
                { label: '工厂池总数', value: `${tender.factoryPoolCount} 家`, color: 'text-gray-700' },
                { label: '已报价工厂数', value: `${quotedCount} 家`, color: 'text-green-700' },
                {
                  label: '未报价工厂数',
                  value: `${unquotedCount} 家`,
                  color: unquotedCount > 0 ? 'text-orange-600' : 'text-gray-500',
                },
                {
                  label: '报价进度',
                  value: `${quotedCount} / ${tender.factoryPoolCount}`,
                  color: 'text-blue-700',
                },
                { label: '当前最高报价', value: priceSummary.maxStr, color: 'text-red-700' },
                { label: '当前最低报价', value: priceSummary.minStr, color: 'text-blue-700' },
                ...(avgPrice != null
                  ? [
                      {
                        label: '当前平均报价',
                        value: `${avgPrice.toLocaleString()} ${tender.currency}/${tender.unit}`,
                        color: 'text-gray-700',
                      },
                    ]
                  : []),
                {
                  label: '距招标结束',
                  value: remaining,
                  color: remaining === '已截止' ? 'text-red-600' : 'text-orange-700',
                },
              ]
                .map(
                  (summary) => `
                    <div class="rounded border bg-muted/20 px-2.5 py-2">
                      <p class="text-sm font-semibold ${summary.color}">${escapeHtml(summary.value)}</p>
                      <p class="mt-0.5 text-[10px] text-muted-foreground">${escapeHtml(summary.label)}</p>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold">工厂报价明细</p>
              <span class="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">一张招标单内同一工厂只允许报价一次</span>
            </div>

            <div class="divide-y rounded-md border">
              ${tender.factoryQuotes
                .map((quote) => {
                  const deviation =
                    quote.hasQuoted && quote.quotePrice != null
                      ? formatDeviation(quote.quotePrice, tender.standardPrice, tender.currency, tender.unit)
                      : null

                  const belowMin = quote.quotePrice != null && quote.quotePrice < tender.minPrice
                  const isAwarded = effectiveAward?.awardedFactoryId === quote.factoryId

                  return `
                    <div class="px-3 py-2.5 ${isAwarded ? 'bg-green-50' : ''}" data-quote-factory-id="${escapeHtml(quote.factoryId)}" data-awarded="${isAwarded ? 'true' : 'false'}">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-sm font-medium">${escapeHtml(quote.factoryName)}</span>
                          <span class="inline-flex rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] font-medium text-blue-700">PDA消息已发送 · ${escapeHtml((quote.notifiedAt || tender.createdAt).slice(0, 16))}</span>
                          ${
                            isAwarded
                              ? '<span class="inline-flex rounded border border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-medium text-green-700">中标</span>'
                              : ''
                          }
                          ${
                            quote.hasQuoted
                              ? '<span class="inline-flex items-center gap-0.5 rounded border border-green-200 bg-green-50 px-1.5 py-0 text-[10px] font-medium text-green-700"><i data-lucide="check" class="h-2.5 w-2.5"></i>已报价</span>'
                              : '<span class="inline-flex items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0 text-[10px] font-medium text-gray-500"><i data-lucide="x" class="h-2.5 w-2.5"></i>未报价</span>'
                          }
                          ${
                            belowMin
                              ? '<span class="inline-flex rounded border border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] font-medium text-orange-700">低于最低允许报价（无效）</span>'
                              : ''
                          }
                        </div>
                      </div>

                      ${
                        quote.hasQuoted && quote.quotePrice != null
                          ? `<div class="mt-1 space-y-0.5 text-xs">
                              <div class="flex flex-wrap items-center gap-3">
                                <span class="font-medium tabular-nums">报价：${quote.quotePrice.toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}</span>
                                ${
                                  deviation
                                    ? `<span class="tabular-nums ${deviation.className}">偏差：${escapeHtml(deviation.text)}</span>`
                                    : ''
                                }
                              </div>
                              <div class="flex flex-wrap items-center gap-3 text-muted-foreground">
                                ${quote.quoteTime ? `<span>报价时间：${escapeHtml(quote.quoteTime)}</span>` : ''}
                                ${quote.deliveryDays != null ? `<span>交货期：${quote.deliveryDays} 天</span>` : ''}
                                ${quote.remark ? `<span>备注：${escapeHtml(quote.remark)}</span>` : ''}
                              </div>
                            </div>`
                          : '<p class="mt-1 text-xs text-muted-foreground">该工厂尚未报价</p>'
                      }
                    </div>
                  `
                })
                .join('')}
            </div>
          </div>

          <div class="space-y-2 pb-4">
            <p class="text-sm font-semibold">${
              effectiveStatus === 'AWARDED'
                ? '定标结果'
                : effectiveStatus === 'AWAIT_AWARD'
                  ? '定标处理'
                  : '定标状态'
            }</p>

            ${
              effectiveStatus === 'AWARDED' && effectiveAward
                ? `<div class="space-y-1.5 rounded-md border border-green-200 bg-green-50 p-3">
                    <div class="mb-2 flex items-center gap-1.5">
                      <i data-lucide="check-circle-2" class="h-4 w-4 text-green-600"></i>
                      <p class="text-xs font-semibold text-green-800">已定标</p>
                    </div>
                    ${[
                      ['中标工厂', effectiveAward.awardedFactory],
                      ['中标价', `${effectiveAward.awardedPrice.toLocaleString()} ${tender.currency}/${tender.unit}`],
                      ['定标说明', effectiveAward.awardReason || '—'],
                    ]
                      .map(
                        ([key, value]) => `
                          <div class="flex items-start justify-between gap-2 text-sm">
                            <span class="shrink-0 text-muted-foreground">${escapeHtml(key)}</span>
                            <span class="text-right font-medium">${escapeHtml(value)}</span>
                          </div>
                        `,
                      )
                      .join('')}
                  </div>`
                : effectiveStatus === 'AWAIT_AWARD'
                  ? `<div class="space-y-3 rounded-md border border-purple-200 bg-purple-50/40 p-3">
                      <p class="text-xs text-purple-700">竞价已截止，请从报价工厂中选择中标方并确认定标。</p>

                      <div class="space-y-1.5">
                        <p class="text-xs font-medium text-muted-foreground">选择中标工厂</p>
                        <div class="divide-y rounded-md border bg-background">
                          ${
                            quotedRows.length === 0
                              ? '<p class="px-3 py-3 text-sm text-muted-foreground">暂无有效报价</p>'
                              : quotedRows
                                  .map((quote) => {
                                    const isSelected = state.viewAwardFactoryId === quote.factoryId
                                    const deviation = formatDeviation(
                                      quote.quotePrice as number,
                                      tender.standardPrice,
                                      tender.currency,
                                      tender.unit,
                                    )
                                    const isLow = (quote.quotePrice as number) < tender.minPrice

                                    return `
                                      <div class="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/30 ${isSelected ? 'bg-blue-50' : ''}" data-tender-action="select-award-factory" data-factory-id="${escapeHtml(quote.factoryId)}">
                                        <span class="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border ${isSelected ? 'border-blue-600' : 'border-muted-foreground/40'}">
                                          <span class="h-2 w-2 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-transparent'}"></span>
                                        </span>
                                        <span class="min-w-0 flex-1">
                                          <span class="flex flex-wrap items-center gap-1.5">
                                            <span class="text-sm font-medium">${escapeHtml(quote.factoryName)}</span>
                                            ${
                                              isLow
                                                ? '<span class="inline-flex rounded border border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] font-medium text-orange-700">低于最低允许报价（无效）</span>'
                                                : ''
                                            }
                                          </span>
                                          <span class="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                            <span class="font-medium text-foreground tabular-nums">${(quote.quotePrice as number).toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}</span>
                                            <span class="tabular-nums ${deviation.className}">偏差 ${escapeHtml(deviation.text)}</span>
                                            ${
                                              quote.deliveryDays != null
                                                ? `<span>交货期 ${quote.deliveryDays} 天</span>`
                                                : ''
                                            }
                                          </span>
                                          ${renderTenderAwardPolicyControls(tender, quote)}
                                        </span>
                                      </div>
                                    `
                                  })
                                  .join('')
                          }
                        </div>
                      </div>

                      <div class="space-y-1.5">
                        <p class="text-xs font-medium text-muted-foreground">
                          定标说明
                          ${needReason ? '<span class="ml-1 text-red-500">*（中标价高于工序标准价，必填）</span>' : '<span class="ml-1 text-muted-foreground">（可选）</span>'}
                        </p>
                        <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="3" placeholder="请填写定标理由；中标价高于工序标准价时必须说明原因" data-tender-field="view.awardReason">${escapeHtml(state.viewAwardReason)}</textarea>
                      </div>

                      ${state.viewAwardSecondConfirm && selectedQuote ? `<div class="rounded-lg border-2 border-amber-400 bg-amber-50 p-3"><p class="font-semibold text-red-700">谨慎确认价格，一经提交确认不得修改。</p><p class="mt-1 text-xs text-amber-800">中标工厂：${escapeHtml(selectedQuote.factoryName)} · 中标价：${selectedQuote.quotePrice?.toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}。提交后冻结并作为结算唯一价格来源。</p></div>${renderTenderReturnRulePreview(tender)}` : ''}
                      <div class="flex items-center justify-between pt-1">
                        <p class="text-xs text-muted-foreground">${
                          selectedQuote
                            ? `已选：${escapeHtml(selectedQuote.factoryName)}`
                            : '请选择中标工厂'
                        }</p>
                        <button class="inline-flex h-8 items-center rounded-md bg-purple-600 px-3 text-sm font-medium text-white hover:bg-purple-700 ${canConfirm ? '' : 'pointer-events-none opacity-50'}" data-tender-action="confirm-award">
                          <i data-lucide="check-circle-2" class="mr-1 h-3.5 w-3.5"></i>${state.viewAwardSecondConfirm ? '二次确认并冻结中标价' : '确认定标'}
                        </button>
                      </div>
                    </div>`
                  : effectiveStatus === 'NO_QUOTE'
                    ? `<div class="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-3">
                        <p class="text-sm font-medium text-red-700">竞价截止后没有工厂报价，当前不能定标。</p>
                        <p class="text-xs text-red-700">请返回任务分配工作台，核查工厂池与竞价条件后取消本次竞价并重新发起；不得直接指定未报价工厂。</p>
                        <button class="rounded border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700" data-nav="/fcs/dispatch/workbench">返回任务分配工作台</button>
                      </div>`
                    : effectiveStatus === 'CANCELLED'
                      ? `<div class="rounded-md border border-gray-200 bg-gray-50 px-3 py-3">
                          <p class="text-sm text-gray-600">本次竞价已取消，仅保留历史记录，不再接收报价或定标。</p>
                        </div>`
                      : `<div class="rounded-md border border-dashed px-3 py-3">
                          <p class="text-sm text-muted-foreground">竞价进行中，尚未截止，请等待竞价结束后再处理定标。</p>
                        </div>`
            }
            ${renderTenderCancelPanel(tender, effectiveStatus)}
          </div>
        </div>
      </section>
    </div>
  `
}

function renderRow(tender: TenderRow): string {
  const summary = calcPriceSummary(tender.factoryQuotes, tender.currency, tender.unit)
  const quoted = summary.quotedCount
  const unquoted = tender.factoryPoolCount - quoted
  const progress = tender.factoryPoolCount > 0 ? (quoted / tender.factoryPoolCount) * 100 : 0
  const remaining = calcRemaining(tender.biddingDeadline)
  const overdue = remaining === '已截止'

  return `
    <tr class="border-b last:border-b-0">
      <td class="whitespace-nowrap px-3 py-3 font-mono text-xs text-orange-700">${escapeHtml(tender.tenderId)}</td>
      <td class="whitespace-nowrap px-3 py-3 font-mono text-xs">${escapeHtml(tender.taskId)}</td>
      <td class="px-3 py-3">${renderProductionOrderIdentityCell(tender.productionOrderId)}</td>
      <td class="px-3 py-3 text-sm font-medium">${escapeHtml(tender.processNameZh)}</td>
      <td class="whitespace-nowrap px-3 py-3 text-sm tabular-nums">${tender.qty} ${escapeHtml(tender.qtyUnit)}</td>
      <td class="px-3 py-3">
        <button class="text-sm text-blue-600 underline-offset-2 hover:underline" data-tender-action="open-view" data-tender-id="${escapeHtml(tender.tenderId)}">${tender.factoryPoolCount} 家</button>
      </td>
      <td class="px-3 py-3"><span class="text-sm font-medium tabular-nums text-green-700">${quoted} 家</span></td>
      <td class="px-3 py-3"><span class="text-sm font-medium tabular-nums ${unquoted > 0 ? 'text-orange-600' : 'text-gray-400'}">${unquoted} 家</span></td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-medium tabular-nums text-blue-700">${quoted} / ${tender.factoryPoolCount}</span>
          <div class="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
            <div class="h-full rounded-full bg-blue-500" style="width: ${progress}%"></div>
          </div>
        </div>
      </td>
      <td class="whitespace-nowrap px-3 py-3 text-xs tabular-nums">${
        quoted > 0 ? `<span class="text-red-700">${escapeHtml(summary.maxStr)}</span>` : '<span class="text-muted-foreground">暂无报价</span>'
      }</td>
      <td class="whitespace-nowrap px-3 py-3 text-xs tabular-nums">${
        quoted > 0 ? `<span class="text-blue-700">${escapeHtml(summary.minStr)}</span>` : '<span class="text-muted-foreground">暂无报价</span>'
      }</td>
      <td class="whitespace-nowrap px-3 py-3 text-xs font-medium tabular-nums text-amber-700">${tender.minPrice.toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}</td>
      <td class="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted-foreground">${tender.standardPrice.toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}</td>
      <td class="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">${escapeHtml(tender.biddingDeadline.slice(0, 16))}</td>
      <td class="whitespace-nowrap px-3 py-3">
        <span class="flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-600' : 'text-orange-700'}"><i data-lucide="clock" class="h-3 w-3 shrink-0"></i>${remaining}</span>
      </td>
      <td class="px-3 py-3"><span class="inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[tender.status]}">${STATUS_ZH[tender.status]}</span></td>
      <td class="whitespace-nowrap px-3 py-3 text-xs">${
        tender.awardedFactory
          ? `<span class="font-medium text-green-700">${escapeHtml(tender.awardedFactory)}</span>`
          : '<span class="text-muted-foreground">—</span>'
      }</td>
      <td class="whitespace-nowrap px-3 py-3 text-xs tabular-nums">${
        tender.awardedPrice != null
          ? `<span class="font-medium">${tender.awardedPrice.toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}</span>`
          : '<span class="text-muted-foreground">—</span>'
      }</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-1">
          <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-tender-action="open-view" data-tender-id="${escapeHtml(tender.tenderId)}"><i data-lucide="file-text" class="mr-1 h-3.5 w-3.5"></i>查看</button>
          ${
            tender.status === 'AWAIT_AWARD'
              ? `<button class="h-7 whitespace-nowrap rounded-md border border-purple-200 px-2 text-xs text-purple-700 hover:bg-purple-50" data-tender-action="open-view" data-tender-id="${escapeHtml(tender.tenderId)}">定标处理</button>`
              : ''
          }
          <button class="h-7 whitespace-nowrap rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/dispatch/non-sewing">非车缝任务分配</button>
        </div>
      </td>
    </tr>
  `
}

export function renderDispatchTendersPage(now = formatOperationLocalWallClock()): string {
  if (typeof window !== 'undefined') {
    const queryTenderId = new URLSearchParams(window.location.search).get('tenderId')?.trim() || null
    const isEnteringTenderPage = typeof document !== 'undefined'
      && !document.querySelector('[data-dispatch-tenders-page]')
    if (initializedQueryTenderId !== queryTenderId || Boolean(queryTenderId && isEnteringTenderPage)) {
      const previousQueryTenderId = initializedQueryTenderId
      initializedQueryTenderId = queryTenderId

      if (queryTenderId) {
        state.keyword = queryTenderId
        openViewDrawer(queryTenderId, now)
      } else if (previousQueryTenderId) {
        state.keyword = ''
        closeViewDrawer()
      }
    }
  }
  const stats = getStats(now)
  const filtered = getFilteredTenders(now)
  const viewTender = getViewTender(now)
  const allTenders = getAllTenders(now)
  const processOptions = [...new Set(allTenders.map((tender) => tender.processNameZh))].sort()
  const factoryOptions = [...new Map(allTenders.flatMap((tender) => tender.factoryQuotes).map((factory) => [factory.factoryId, factory.factoryName] as const)).entries()].sort((left, right) => left[1].localeCompare(right[1], 'zh-CN'))

  return `
    <div class="space-y-6" data-dispatch-tenders-page>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">招标单管理</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">一个竞价任务对应一个招标单；工厂池中的工厂对同一招标单只允许报价一次；共 ${stats.total} 条</p>
        </div>
        <button class="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-nav="/fcs/dispatch/workbench">
          <i data-lucide="arrow-left-right" class="h-4 w-4"></i>从任务分配发起竞价
        </button>
      </div>

      <div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
        <strong>报价规则：</strong>工厂池中的每个工厂对同一张招标单只允许报价一次，不允许重复报价、修改报价或多轮报价。
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        ${[
          { label: '招标中', value: stats.bidding, color: 'text-orange-600' },
          { label: '待定标', value: stats.awaitAward, color: 'text-purple-600' },
          { label: '无人报价', value: stats.noQuote, color: 'text-red-600' },
          { label: '已定标', value: stats.awarded, color: 'text-green-600' },
          { label: '已取消', value: stats.cancelled, color: 'text-gray-500' },
          { label: '招标单总数', value: stats.total, color: 'text-gray-700' },
        ]
          .map(
            (summary) => `
              <article class="rounded-lg border bg-card">
                <div class="p-4 text-center">
                  <p class="text-2xl font-bold ${summary.color}">${summary.value}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${summary.label}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative w-full max-w-xs">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" placeholder="招标单号 / 任务编号 / 生产单号 / 工序" data-tender-field="filter.keyword" value="${escapeHtml(state.keyword)}" />
        </div>

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-tender-field="filter.status">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="BIDDING" ${state.statusFilter === 'BIDDING' ? 'selected' : ''}>招标中</option>
          <option value="AWAIT_AWARD" ${state.statusFilter === 'AWAIT_AWARD' ? 'selected' : ''}>待定标</option>
          <option value="NO_QUOTE" ${state.statusFilter === 'NO_QUOTE' ? 'selected' : ''}>无人报价待处理</option>
          <option value="AWARDED" ${state.statusFilter === 'AWARDED' ? 'selected' : ''}>已定标</option>
          <option value="CANCELLED" ${state.statusFilter === 'CANCELLED' ? 'selected' : ''}>已取消</option>
        </select>

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-tender-field="filter.process"><option value="ALL">全部工序</option>${processOptions.map((process) => `<option value="${escapeHtml(process)}" ${state.processFilter === process ? 'selected' : ''}>${escapeHtml(process)}</option>`).join('')}</select>
        <select class="h-9 w-44 rounded-md border bg-background px-3 text-sm" data-tender-field="filter.factory"><option value="ALL">全部池内工厂</option>${factoryOptions.map(([id, name]) => `<option value="${escapeHtml(id)}" ${state.factoryFilter === id ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select>
        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-tender-field="filter.quote"><option value="ALL">全部报价情况</option><option value="QUOTED" ${state.quoteFilter === 'QUOTED' ? 'selected' : ''}>已有报价</option><option value="UNQUOTED" ${state.quoteFilter === 'UNQUOTED' ? 'selected' : ''}>仍有未报价</option></select>
        <label class="text-xs text-muted-foreground">创建日期<input type="date" class="ml-1 h-9 rounded border px-2" data-tender-field="filter.createdStart" value="${state.createdStart}"/></label><span>—</span><input type="date" aria-label="创建日期止" class="h-9 rounded border px-2" data-tender-field="filter.createdEnd" value="${state.createdEnd}"/>
        <label class="text-xs text-muted-foreground">截止日期<input type="date" class="ml-1 h-9 rounded border px-2" data-tender-field="filter.deadlineStart" value="${state.deadlineStart}"/></label><span>—</span><input type="date" aria-label="截止日期止" class="h-9 rounded border px-2" data-tender-field="filter.deadlineEnd" value="${state.deadlineEnd}"/>

        <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" data-tender-action="reset-filter">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>
        </button>

        <p class="ml-auto text-sm text-muted-foreground">筛选结果 ${filtered.length} 条</p>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1800px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs">
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">招标单号</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">任务编号</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">工序</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">数量</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">工厂池</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">已报价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">未报价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">报价进度</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">当前最高报价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">当前最低报价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">最低允许报价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">工序标准价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">竞价截止</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">距结束</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">招标状态</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">中标工厂</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">中标价</th>
              <th class="whitespace-nowrap px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              filtered.length === 0
                ? '<tr><td colspan="19" class="py-10 text-center text-muted-foreground">暂无招标单数据</td></tr>'
                : filtered.map((tender) => renderRow(tender)).join('')
            }
          </tbody>
        </table>
      </div>

      ${renderViewTenderSheet(viewTender)}
      ${renderAwardContractPrompt()}
    </div>
  `
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  if (field === 'filter.keyword') {
    state.keyword = node.value
    return
  }

  if (field === 'filter.status') {
    state.statusFilter = node.value as 'ALL' | TenderStatus
    return
  }
  if (field === 'filter.process') { state.processFilter = node.value; return }
  if (field === 'filter.factory') { state.factoryFilter = node.value; return }
  if (field === 'filter.quote') { state.quoteFilter = node.value as TendersPageState['quoteFilter']; return }
  if (field === 'filter.createdStart') { state.createdStart = node.value; return }
  if (field === 'filter.createdEnd') { state.createdEnd = node.value; return }
  if (field === 'filter.deadlineStart') { state.deadlineStart = node.value; return }
  if (field === 'filter.deadlineEnd') { state.deadlineEnd = node.value; return }

  if (field === 'view.awardReason') {
    state.viewAwardReason = node.value
    return
  }
  if (field === 'view.cancelReason') {
    state.viewCancelReason = node.value
    state.viewCancelSecondConfirm = false
    return
  }
  if (field === 'view.awardRiskConfirmed' && node instanceof HTMLInputElement) {
    const factoryId = node.dataset.factoryId
    if (factoryId) state.viewAwardRiskConfirmedByFactoryId[factoryId] = node.checked
  }
  if (field === 'view.awardSupervisorAssigned' && node instanceof HTMLInputElement) {
    const factoryId = node.dataset.factoryId
    if (factoryId) state.viewAwardSupervisorAssignedByFactoryId[factoryId] = node.checked
  }
}

export function handleDispatchTendersEvent(
  target: HTMLElement,
  now = formatOperationLocalWallClock(),
): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-tender-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.tenderField
    if (!field) return true

    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-tender-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.tenderAction
  if (!action) return false

  if (action === 'open-view') {
    const tenderId = actionNode.dataset.tenderId
    if (!tenderId) return true

    openViewDrawer(tenderId, now)
    return true
  }

  if (action === 'close-view') {
    closeViewDrawer()
    return true
  }

  if (action === 'reset-filter') {
    state.keyword = ''
    state.statusFilter = 'ALL'
    state.processFilter = 'ALL'
    state.factoryFilter = 'ALL'
    state.quoteFilter = 'ALL'
    state.createdStart = ''
    state.createdEnd = ''
    state.deadlineStart = ''
    state.deadlineEnd = ''
    return true
  }

  if (action === 'select-award-factory') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true

    state.viewAwardFactoryId = factoryId
    state.viewAwardSecondConfirm = false
    return true
  }

  if (action === 'confirm-award') {
    confirmAwardInView(now)
    return true
  }

  if (action === 'confirm-cancel-tender') {
    confirmCancelTenderInView(now)
    return true
  }

  if (action === 'close-award-contract') {
    state.awardContractId = null
    return true
  }

  if (action === 'close-dialog') {
    closeDialogs()
    return true
  }

  return false
}

export function isDispatchTendersDialogOpen(): boolean {
  return state.viewTenderId !== null || state.awardContractId !== null
}
