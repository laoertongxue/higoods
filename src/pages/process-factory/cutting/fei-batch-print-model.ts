import {
  buildReprintDraft,
  createFeiTicketDraft,
  createFeiTicketPrintJob,
  type FeiTicketDraft,
  type FeiTicketLabelRecord,
  type FeiTicketPrintJob,
  type FeiTicketsContext,
  type OriginalCutOrderTicketOwner,
} from './fei-tickets-model.ts'
import {
  buildCuttingTraceabilityId,
} from '../../../data/fcs/cutting/qr-codes.ts'

export const CUTTING_FEI_BATCH_PRINT_SESSIONS_STORAGE_KEY = 'cuttingFeiBatchPrintSessions'

export type FeiBatchAggregateTicketStatus =
  | 'ALL_NOT_GENERATED'
  | 'PARTIAL_GENERATED'
  | 'ALL_GENERATED'
  | 'PARTIAL_PRINTED'
  | 'ALL_PRINTED'
  | 'PARTIAL_REPRINTED'

export type FeiBatchPrintSessionStatus = 'DRAFTS_CREATED' | 'PRINTED' | 'REPRINTED' | 'PARTIAL_SUCCESS'

export interface FeiBatchOwnerGroup {
  ownerType: 'original-cut-order'
  groupId: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  color: string
  plannedTicketQty: number
  printedTicketQty: number
  reprintCount: number
  ticketStatus: OriginalCutOrderTicketOwner['ticketStatus']
  latestPrintJobNo: string
  latestPrintJobIds: string[]
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  previewDraftId: string
  sourceContextLabel: string
  owner: OriginalCutOrderTicketOwner
}

export interface FeiBatchExpansionResult {
  sourceContextType: 'merge-batch'
  mergeBatchId: string
  mergeBatchNo: string
  ownerGroupCount: number
  totalPlannedTicketQty: number
  totalPrintedTicketQty: number
  totalReprintCount: number
  ownerGroups: FeiBatchOwnerGroup[]
  aggregateStatus: FeiBatchAggregateTicketStatus
  warningMessages: string[]
}

export interface FeiBatchSessionIssue {
  groupId: string
  originalCutOrderNo: string
  reason: string
}

export interface FeiBatchPrintSessionResult {
  batchPrintSessionId: string
  createdDraftCount: number
  createdPrintJobCount: number
  failedOwnerGroups: FeiBatchSessionIssue[]
  skippedOwnerGroups: FeiBatchSessionIssue[]
  warningMessages: string[]
}

export interface FeiBatchPrintSession {
  batchPrintSessionId: string
  mergeBatchId: string
  mergeBatchNo: string
  ownerGroupIds: string[]
  totalOwnerGroups: number
  totalPlannedTicketQty: number
  status: FeiBatchPrintSessionStatus
  createdAt: string
  createdBy: string
  note: string
  resultSummary: FeiBatchPrintSessionResult
}

export interface FeiBatchPrintPreviewItem {
  order: number
  groupId: string
  originalCutOrderNo: string
  draftId: string
}

export interface FeiBatchDraftCreationResult {
  nextDrafts: Record<string, FeiTicketDraft>
  session: FeiBatchPrintSession
}

export interface FeiBatchPrintCreationResult {
  nextDrafts: Record<string, FeiTicketDraft>
  nextPrintJobs: FeiTicketPrintJob[]
  nextTicketRecords: FeiTicketLabelRecord[]
  session: FeiBatchPrintSession
}

export interface FeiBatchContextNavigationPayload {
  mergeBatches: Record<string, string | undefined>
  originalOrders: Record<string, string | undefined>
  summary: Record<string, string | undefined>
  transferBags: Record<string, string | undefined>
  markerSpreading: Record<string, string | undefined>
}

export interface FeiBatchSessionPrefilter {
  ownerStatus?: OriginalCutOrderTicketOwner['ticketStatus']
  originalCutOrderNo?: string
}

export interface FeiBatchAggregateStatusMeta {
  label: string
  className: string
  detailText: string
}

const aggregateStatusMeta: Record<FeiBatchAggregateTicketStatus, FeiBatchAggregateStatusMeta> = {
  ALL_NOT_GENERATED: {
    label: '全部未生成',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前批次关联的原始裁片单尚未生成菲票草稿。',
  },
  PARTIAL_GENERATED: {
    label: '部分已生成',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前批次下仅部分原始裁片单已生成菲票草稿。',
  },
  ALL_GENERATED: {
    label: '全部已生成',
    className: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    detailText: '当前批次下全部原始裁片单都已生成菲票草稿，但未全部打印。',
  },
  PARTIAL_PRINTED: {
    label: '部分已打印',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '当前批次下仅部分原始裁片单完成打印。',
  },
  ALL_PRINTED: {
    label: '全部已打印',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前批次下全部原始裁片单均已完成菲票打印。',
  },
  PARTIAL_REPRINTED: {
    label: '部分重打',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前批次下部分原始裁片单存在重打记录。',
  },
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function buildSessionId(prefix: string, issuedAt = new Date()): string {
  const nowText = issuedAt.toISOString().slice(0, 16).replace('T', ' ')
  return buildCuttingTraceabilityId(prefix, nowText, 'batch-print')
}

function buildIssue(group: FeiBatchOwnerGroup, reason: string): FeiBatchSessionIssue {
  return {
    groupId: group.groupId,
    originalCutOrderNo: group.originalCutOrderNo,
    reason,
  }
}

export function summarizeBatchOwnerTicketStatus(owner: OriginalCutOrderTicketOwner, printJobs: FeiTicketPrintJob[]): FeiBatchOwnerGroup {
  const ownerJobs = printJobs
    .filter((job) => job.originalCutOrderIds.includes(owner.originalCutOrderId))
    .sort((left, right) => right.printedAt.localeCompare(left.printedAt, 'zh-CN'))

  const reprintCount = ownerJobs.reduce((sum, job) => sum + (job.status === 'REPRINTED' ? 1 : 0), 0)

  return {
    ownerType: 'original-cut-order',
    groupId: owner.originalCutOrderId,
    originalCutOrderId: owner.originalCutOrderId,
    originalCutOrderNo: owner.originalCutOrderNo,
    productionOrderNo: owner.productionOrderNo,
    styleCode: owner.styleCode,
    spuCode: owner.spuCode,
    materialSku: owner.materialSku,
    color: owner.color,
    plannedTicketQty: owner.plannedTicketQty,
    printedTicketQty: owner.printedTicketQty,
    reprintCount,
    ticketStatus: owner.ticketStatus,
    latestPrintJobNo: ownerJobs[0]?.printJobNo || owner.latestPrintJobNo || '',
    latestPrintJobIds: ownerJobs.map((job) => job.printJobId),
    sourceMergeBatchId: owner.relatedMergeBatchIds[0] || '',
    sourceMergeBatchNo: owner.relatedMergeBatchNos[0] || '',
    previewDraftId: `draft-${owner.originalCutOrderId}`,
    sourceContextLabel: owner.sourceContextLabel,
    owner,
  }
}

export function deriveBatchAggregateTicketStatus(ownerGroups: FeiBatchOwnerGroup[]): FeiBatchAggregateTicketStatus {
  if (!ownerGroups.length) return 'ALL_NOT_GENERATED'

  const allNotGenerated = ownerGroups.every((group) => group.ticketStatus === 'NOT_GENERATED')
  if (allNotGenerated) return 'ALL_NOT_GENERATED'

  const hasReprint = ownerGroups.some((group) => group.reprintCount > 0 || group.ticketStatus === 'REPRINTED')
  const allPrinted = ownerGroups.every((group) => group.printedTicketQty >= group.plannedTicketQty && group.plannedTicketQty > 0)
  if (hasReprint) return allPrinted ? 'PARTIAL_REPRINTED' : 'PARTIAL_REPRINTED'
  if (allPrinted) return 'ALL_PRINTED'

  const hasPrinted = ownerGroups.some((group) => group.printedTicketQty > 0 || group.ticketStatus === 'PARTIAL_PRINTED')
  if (hasPrinted) return 'PARTIAL_PRINTED'

  const allGenerated = ownerGroups.every((group) => group.ticketStatus === 'DRAFT')
  if (allGenerated) return 'ALL_GENERATED'

  return 'PARTIAL_GENERATED'
}

export function getFeiBatchAggregateStatusMeta(status: FeiBatchAggregateTicketStatus): FeiBatchAggregateStatusMeta {
  return aggregateStatusMeta[status]
}

export function expandMergeBatchToOriginalTicketOwners(
  context: FeiTicketsContext | null,
  owners: OriginalCutOrderTicketOwner[],
  printJobs: FeiTicketPrintJob[],
): FeiBatchExpansionResult | null {
  if (!context || context.contextType !== 'merge-batch') return null

  const allowedIds = new Set(context.originalCutOrderIds)
  const ownerGroups = owners
    .filter((owner) => allowedIds.has(owner.originalCutOrderId))
    .map((owner) => summarizeBatchOwnerTicketStatus(owner, printJobs))
    .sort(
      (left, right) =>
        left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN') ||
        left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN'),
    )

  const warningMessages: string[] = []
  if (!ownerGroups.length) {
    warningMessages.push('当前批次尚未匹配到可打印的原始裁片单。')
  }
  if (ownerGroups.some((group) => group.ticketStatus === 'PENDING_SUPPLEMENT')) {
    warningMessages.push('存在待补录的原始裁片单，批量打印时会自动跳过。')
  }
  if (ownerGroups.some((group) => group.ticketStatus === 'PARTIAL_PRINTED')) {
    warningMessages.push('存在部分已打印的原始裁片单，建议逐组检查后再处理。')
  }

  return {
    sourceContextType: 'merge-batch',
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    ownerGroupCount: ownerGroups.length,
    totalPlannedTicketQty: ownerGroups.reduce((sum, group) => sum + group.plannedTicketQty, 0),
    totalPrintedTicketQty: ownerGroups.reduce((sum, group) => sum + group.printedTicketQty, 0),
    totalReprintCount: ownerGroups.reduce((sum, group) => sum + group.reprintCount, 0),
    ownerGroups,
    aggregateStatus: deriveBatchAggregateTicketStatus(ownerGroups),
    warningMessages,
  }
}

export function buildBatchPrintPreviewIndex(ownerGroups: FeiBatchOwnerGroup[]): FeiBatchPrintPreviewItem[] {
  return ownerGroups.map((group, index) => ({
    order: index + 1,
    groupId: group.groupId,
    originalCutOrderNo: group.originalCutOrderNo,
    draftId: group.previewDraftId,
  }))
}

export function buildOwnerLevelPrintPayloadFromBatch(
  ownerGroup: FeiBatchOwnerGroup,
  context: FeiTicketsContext,
): Record<string, string | undefined> {
  return {
    mergeBatchId: context.mergeBatchId || ownerGroup.sourceMergeBatchId,
    mergeBatchNo: context.mergeBatchNo || ownerGroup.sourceMergeBatchNo,
    originalCutOrderId: ownerGroup.originalCutOrderId,
    originalCutOrderNo: ownerGroup.originalCutOrderNo,
  }
}

export function buildBatchContextNavigationPayload(context: FeiTicketsContext): FeiBatchContextNavigationPayload {
  return {
    mergeBatches: {
      mergeBatchId: context.mergeBatchId || undefined,
      mergeBatchNo: context.mergeBatchNo || undefined,
    },
    originalOrders: {
      mergeBatchId: context.mergeBatchId || undefined,
      mergeBatchNo: context.mergeBatchNo || undefined,
    },
    summary: {
      mergeBatchId: context.mergeBatchId || undefined,
      mergeBatchNo: context.mergeBatchNo || undefined,
    },
    transferBags: {
      mergeBatchId: context.mergeBatchId || undefined,
      mergeBatchNo: context.mergeBatchNo || undefined,
    },
    markerSpreading: {
      mergeBatchId: context.mergeBatchId || undefined,
      mergeBatchNo: context.mergeBatchNo || undefined,
    },
  }
}

export function createFeiBatchPrintSession(options: {
  mergeBatchId: string
  mergeBatchNo: string
  ownerGroups: FeiBatchOwnerGroup[]
  totalPlannedTicketQty: number
  createdBy: string
  note: string
  status: FeiBatchPrintSessionStatus
  resultSummary: Omit<FeiBatchPrintSessionResult, 'batchPrintSessionId'>
  nowText: string
}): FeiBatchPrintSession {
  const batchPrintSessionId = buildSessionId('batch-fei-session')
  return {
    batchPrintSessionId,
    mergeBatchId: options.mergeBatchId,
    mergeBatchNo: options.mergeBatchNo,
    ownerGroupIds: options.ownerGroups.map((group) => group.groupId),
    totalOwnerGroups: options.ownerGroups.length,
    totalPlannedTicketQty: options.totalPlannedTicketQty,
    status: options.status,
    createdAt: options.nowText,
    createdBy: options.createdBy,
    note: options.note,
    resultSummary: {
      batchPrintSessionId,
      ...options.resultSummary,
    },
  }
}

export function markOwnerGroupsAsPartiallyPrinted(
  ownerGroups: FeiBatchOwnerGroup[],
  failedGroupIds: string[],
  skippedGroupIds: string[],
): FeiBatchOwnerGroup[] {
  const blocked = new Set([...failedGroupIds, ...skippedGroupIds])
  return ownerGroups.map((group) => {
    if (!blocked.has(group.groupId)) return group
    if (group.printedTicketQty > 0 && group.printedTicketQty < group.plannedTicketQty) {
      return {
        ...group,
        ticketStatus: 'PARTIAL_PRINTED',
      }
    }
    return group
  })
}

export function createDraftsFromBatchOwnerGroups(options: {
  expansion: FeiBatchExpansionResult
  context: FeiTicketsContext
  existingDrafts: Record<string, FeiTicketDraft>
  nowText: string
  createdBy: string
}): FeiBatchDraftCreationResult {
  const nextDrafts = { ...options.existingDrafts }
  const failedOwnerGroups: FeiBatchSessionIssue[] = []
  const skippedOwnerGroups: FeiBatchSessionIssue[] = []
  let createdDraftCount = 0

  options.expansion.ownerGroups.forEach((group) => {
    if (group.ticketStatus === 'PENDING_SUPPLEMENT') {
      failedOwnerGroups.push(buildIssue(group, '当前原始裁片单为待补录状态，不能批量生成草稿。'))
      return
    }
    if (group.ticketStatus === 'PRINTED' || group.ticketStatus === 'REPRINTED' || group.ticketStatus === 'PARTIAL_PRINTED') {
      skippedOwnerGroups.push(buildIssue(group, '当前原始裁片单已存在打印结果，请逐组处理或使用重打。'))
      return
    }
    if (nextDrafts[group.originalCutOrderId]) {
      skippedOwnerGroups.push(buildIssue(group, '当前原始裁片单已存在打印草稿。'))
      return
    }

    nextDrafts[group.originalCutOrderId] = createFeiTicketDraft({
      owner: group.owner,
      context: options.context,
      ticketCount: group.plannedTicketQty,
      note: `${group.originalCutOrderNo} 来自批次 ${options.expansion.mergeBatchNo} 的批量打印草稿。`,
      nowText: options.nowText,
    })
    createdDraftCount += 1
  })

  const session = createFeiBatchPrintSession({
    mergeBatchId: options.expansion.mergeBatchId,
    mergeBatchNo: options.expansion.mergeBatchNo,
    ownerGroups: options.expansion.ownerGroups,
    totalPlannedTicketQty: options.expansion.totalPlannedTicketQty,
    createdBy: options.createdBy,
    note: '从合并裁剪批次发起批量生成菲票草稿。',
    status: failedOwnerGroups.length || skippedOwnerGroups.length ? 'PARTIAL_SUCCESS' : 'DRAFTS_CREATED',
    resultSummary: {
      createdDraftCount,
      createdPrintJobCount: 0,
      failedOwnerGroups,
      skippedOwnerGroups,
      warningMessages: uniqueStrings([
        failedOwnerGroups.length ? '部分原始裁片单因待补录未生成草稿。' : '',
        skippedOwnerGroups.length ? '部分原始裁片单已存在草稿或打印记录，已跳过。' : '',
      ]),
    },
    nowText: options.nowText,
  })

  return { nextDrafts, session }
}

export function createPrintJobsFromBatchOwnerGroups(options: {
  expansion: FeiBatchExpansionResult
  context: FeiTicketsContext
  existingDrafts: Record<string, FeiTicketDraft>
  existingPrintJobs: FeiTicketPrintJob[]
  existingTicketRecords: FeiTicketLabelRecord[]
  nowText: string
  printedBy: string
  createdBy: string
  includeReprint?: boolean
}): FeiBatchPrintCreationResult {
  const nextDrafts = { ...options.existingDrafts }
  let nextPrintJobs = [...options.existingPrintJobs]
  let nextTicketRecords = [...options.existingTicketRecords]
  const failedOwnerGroups: FeiBatchSessionIssue[] = []
  const skippedOwnerGroups: FeiBatchSessionIssue[] = []
  let createdPrintJobCount = 0
  let createdDraftCount = 0

  options.expansion.ownerGroups.forEach((group) => {
    if (group.ticketStatus === 'PENDING_SUPPLEMENT') {
      failedOwnerGroups.push(buildIssue(group, '当前原始裁片单为待补录状态，不能批量打印。'))
      return
    }

    const shouldReprint = Boolean(options.includeReprint)
    if (!shouldReprint && (group.ticketStatus === 'PRINTED' || group.ticketStatus === 'REPRINTED')) {
      skippedOwnerGroups.push(buildIssue(group, '当前原始裁片单已完成打印，批量打印默认跳过。'))
      return
    }
    if (!shouldReprint && group.ticketStatus === 'PARTIAL_PRINTED') {
      skippedOwnerGroups.push(buildIssue(group, '当前原始裁片单存在部分已打印记录，请逐组处理。'))
      return
    }
    if (shouldReprint && group.printedTicketQty <= 0) {
      skippedOwnerGroups.push(buildIssue(group, '当前原始裁片单尚无可重打的历史票据。'))
      return
    }

    let draft = nextDrafts[group.originalCutOrderId] ?? null
    if (!draft) {
      if (shouldReprint) {
        draft = buildReprintDraft(group.owner, nextTicketRecords, options.context, options.nowText)
        if (!draft) {
          failedOwnerGroups.push(buildIssue(group, '当前原始裁片单缺少可重打的历史票据。'))
          return
        }
      } else {
        draft = createFeiTicketDraft({
          owner: group.owner,
          context: options.context,
          ticketCount: group.plannedTicketQty,
          note: `${group.originalCutOrderNo} 来自批次 ${options.expansion.mergeBatchNo} 的批量打印草稿。`,
          nowText: options.nowText,
        })
      }
      nextDrafts[group.originalCutOrderId] = draft
      createdDraftCount += 1
    }

    const result = createFeiTicketPrintJob({
      draft,
      owner: group.owner,
      existingRecords: nextTicketRecords,
      existingJobs: nextPrintJobs,
      printedBy: options.printedBy,
      nowText: options.nowText,
    })
    nextTicketRecords = result.nextRecords
    nextPrintJobs = [...nextPrintJobs, result.printJob]
    delete nextDrafts[group.originalCutOrderId]
    createdPrintJobCount += 1
  })

  const finalOwnerGroups = markOwnerGroupsAsPartiallyPrinted(
    options.expansion.ownerGroups,
    failedOwnerGroups.map((item) => item.groupId),
    skippedOwnerGroups.map((item) => item.groupId),
  )
  const status: FeiBatchPrintSessionStatus =
    createdPrintJobCount === 0
      ? 'PARTIAL_SUCCESS'
      : failedOwnerGroups.length || skippedOwnerGroups.length
        ? 'PARTIAL_SUCCESS'
        : shouldUseReprintStatus(finalOwnerGroups, options.includeReprint)
          ? 'REPRINTED'
          : 'PRINTED'

  const session = createFeiBatchPrintSession({
    mergeBatchId: options.expansion.mergeBatchId,
    mergeBatchNo: options.expansion.mergeBatchNo,
    ownerGroups: finalOwnerGroups,
    totalPlannedTicketQty: options.expansion.totalPlannedTicketQty,
    createdBy: options.createdBy,
    note: options.includeReprint ? '从合并裁剪批次发起批量重打。' : '从合并裁剪批次发起批量打印。',
    status,
    resultSummary: {
      createdDraftCount,
      createdPrintJobCount,
      failedOwnerGroups,
      skippedOwnerGroups,
      warningMessages: uniqueStrings([
        failedOwnerGroups.length ? '部分原始裁片单因数据不完整未完成处理。' : '',
        skippedOwnerGroups.length ? '部分原始裁片单因已有打印结果或状态限制被跳过。' : '',
      ]),
    },
    nowText: options.nowText,
  })

  return {
    nextDrafts,
    nextPrintJobs,
    nextTicketRecords,
    session,
  }
}

function shouldUseReprintStatus(ownerGroups: FeiBatchOwnerGroup[], includeReprint: boolean | undefined): boolean {
  if (includeReprint) return true
  return ownerGroups.some((group) => group.reprintCount > 0)
}

export function serializeFeiBatchPrintSessionsStorage(sessions: FeiBatchPrintSession[]): string {
  return JSON['stringify'](sessions)
}

export function deserializeFeiBatchPrintSessionsStorage(raw: string | null): FeiBatchPrintSession[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
