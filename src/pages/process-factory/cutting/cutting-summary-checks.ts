import type { CutPieceWarehouseItem } from './cut-piece-warehouse-model.ts'
import type {
  FeiTicketLabelRecord,
  FeiTicketPrintJob,
  CutOrderTicketOwner,
} from './fei-tickets-model.ts'
import type { MarkerSpreadingStore, SpreadingSession } from './marker-spreading-model.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type { MarkerPlanSourceRecord } from './marker-plan-source-model.ts'
import type { CutOrderRow } from './cut-orders-model.ts'
import type {
  ProductionProgressRow,
  ProductionProgressStageKey,
} from './production-progress-model.ts'
import type { ReplenishmentSuggestionRow } from './replenishment-model.ts'
import type { SpecialProcessRow } from './special-processes-model.ts'
import type {
  TransferBagConditionDecisionItem,
  TransferBagReturnUsageItem,
} from './transfer-bag-return-model.ts'
import type { TransferBagUsageItem } from './transfer-bags-model.ts'

export type CuttingCheckSectionKey =
  | 'MATERIAL_PREP'
  | 'SPREADING'
  | 'REPLENISHMENT'
  | 'FEI_TICKETS'
  | 'WAREHOUSE_HANDOFF'
  | 'SPECIAL_PROCESS'

export type CuttingCheckSectionStateKey =
  | 'NOT_APPLICABLE'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'
  | 'DATA_PENDING'

export type CuttingCheckBlockerLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type CuttingCheckCompletionKey = 'COMPLETED' | 'BLOCKED' | 'IN_PROGRESS' | 'DATA_PENDING'
export type CuttingCheckSourceObjectType =
  | 'CUT_ORDER'
  | 'MARKER_PLAN'
  | 'REPLENISHMENT'
  | 'FEI_OWNER'
  | 'FEI_PRINT_JOB'
  | 'BAG_USAGE'
  | 'SPECIAL_PROCESS'

export type CuttingCheckActionTarget =
  | 'productionProgress'
  | 'markerPlanSources'
  | 'cutOrders'
  | 'materialPrep'
  | 'markerSpreading'
  | 'feiTickets'
  | 'fabricWarehouse'
  | 'cutPieceWarehouse'
  | 'sampleWarehouse'
  | 'transferBags'
  | 'replenishment'
  | 'specialProcesses'
  | 'summary'

export type CuttingCheckNavigationPayloadMap = Record<
  CuttingCheckActionTarget,
  Record<string, string | undefined>
>

export interface CuttingCheckCompletionMeta {
  key: CuttingCheckCompletionKey
  label: string
  className: string
  detailText: string
}

export interface CuttingCheckSectionState {
  sectionKey: CuttingCheckSectionKey
  label: string
  stateKey: CuttingCheckSectionStateKey
  currentState: string
  currentStateLabel: string
  className: string
  blocking: boolean
  blockerCount: number
  doneCount: number
  totalCount: number
  detailText: string
  navigationTarget: CuttingCheckActionTarget
  navigationPayload: Record<string, string | undefined>
  defaultAction: CuttingCheckNextAction
}

export interface CuttingCheckBlockerItem {
  blockerId: string
  productionOrderId: string
  productionOrderNo: string
  sectionKey: CuttingCheckSectionKey
  severity: CuttingCheckBlockerLevel
  title: string
  sourceType: CuttingCheckSourceObjectType
  sourceId: string
  sourceNo: string
  sourceLabel: string
  materialSku: string
  currentStateLabel: string
  blockerReason: string
  nextActionLabel: string
  navigationTarget: CuttingCheckActionTarget
  navigationPayload: Record<string, string | undefined>
}

export interface CuttingCheckNextAction {
  actionId: string
  sectionKey: CuttingCheckSectionKey
  label: string
  target: CuttingCheckActionTarget
  payload: Record<string, string | undefined>
  blocking: boolean
  sourceNo: string
}

export interface CuttingCheckBuildOptions {
  productionRow: ProductionProgressRow
  cutOrderRows: CutOrderRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
  materialPrepRows: MaterialPrepRow[]
  spreadingSessions: SpreadingSession[]
  markerStore: MarkerSpreadingStore
  ticketOwners: CutOrderTicketOwner[]
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  cutPieceItems: CutPieceWarehouseItem[]
  bagUsages: TransferBagUsageItem[]
  returnUsages: TransferBagReturnUsageItem[]
  conditionItems: TransferBagConditionDecisionItem[]
  replenishments: ReplenishmentSuggestionRow[]
  specialProcesses: SpecialProcessRow[]
  navigationPayload: CuttingCheckNavigationPayloadMap
}

export interface CuttingCheckResult {
  completionMeta: CuttingCheckCompletionMeta
  sectionStates: CuttingCheckSectionState[]
  blockerItems: CuttingCheckBlockerItem[]
  nextActions: CuttingCheckNextAction[]
  primaryBlocker: CuttingCheckBlockerItem | null
  blockerCount: number
  pendingActionCount: number
  keySourceObjects: string[]
}

export const cuttingCheckSectionLabelMap: Record<CuttingCheckSectionKey, string> = {
  MATERIAL_PREP: '待加工仓',
  SPREADING: '唛架铺布',
  REPLENISHMENT: '补料',
  FEI_TICKETS: '打印菲票',
  WAREHOUSE_HANDOFF: '仓务交接',
  SPECIAL_PROCESS: '特殊工艺',
}

export const cuttingCheckCompletionMetaMap: Record<CuttingCheckCompletionKey, CuttingCheckCompletionMeta> = {
  COMPLETED: {
    key: 'COMPLETED',
    label: '已闭环',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前生产单关联链路已闭环。',
  },
  BLOCKED: {
    key: 'BLOCKED',
    label: '有风险',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前存在明确风险项，需要去专业页面处理。',
  },
  IN_PROGRESS: {
    key: 'IN_PROGRESS',
    label: '处理中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前链路仍在推进，但暂无明确风险。',
  },
  DATA_PENDING: {
    key: 'DATA_PENDING',
    label: '待补数据',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前真相源不足，暂时无法判定闭环。',
  },
}

const sectionStateMetaMap: Record<
  CuttingCheckSectionStateKey,
  { label: string; className: string }
> = {
  NOT_APPLICABLE: {
    label: '不适用',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
  NOT_STARTED: {
    label: '未开始',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
  IN_PROGRESS: {
    label: '处理中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  BLOCKED: {
    label: '有风险',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  DONE: {
    label: '已完成',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  DATA_PENDING: {
    label: '待补数据',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
}

const ownerStatusLabelMap: Record<string, string> = {
  NOT_GENERATED: '未生成',
  DRAFT: '草稿中',
  PARTIAL_PRINTED: '需补打',
  PRINTED: '已打印',
  REPRINTED: '已重打',
  PENDING_SUPPLEMENT: '待补录',
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function severityWeight(level: CuttingCheckBlockerLevel): number {
  if (level === 'HIGH') return 3
  if (level === 'MEDIUM') return 2
  return 1
}

function maxSeverity(levels: CuttingCheckBlockerLevel[]): CuttingCheckBlockerLevel {
  return levels.reduce<CuttingCheckBlockerLevel>((highest, current) => {
    return severityWeight(current) > severityWeight(highest) ? current : highest
  }, 'LOW')
}

function buildAction(options: {
  sectionKey: CuttingCheckSectionKey
  label: string
  target: CuttingCheckActionTarget
  payload: Record<string, string | undefined>
  sourceNo: string
  blocking: boolean
}): CuttingCheckNextAction {
  return {
    actionId: `${options.sectionKey}-${options.target}-${options.sourceNo || 'default'}`,
    sectionKey: options.sectionKey,
    label: options.label,
    target: options.target,
    payload: options.payload,
    blocking: options.blocking,
    sourceNo: options.sourceNo,
  }
}

function buildSectionState(options: {
  sectionKey: CuttingCheckSectionKey
  stateKey: CuttingCheckSectionStateKey
  blockerCount: number
  doneCount: number
  totalCount: number
  detailText: string
  navigationTarget: CuttingCheckActionTarget
  navigationPayload: Record<string, string | undefined>
  defaultActionLabel: string
}): CuttingCheckSectionState {
  const meta = sectionStateMetaMap[options.stateKey]
  return {
    sectionKey: options.sectionKey,
    label: cuttingCheckSectionLabelMap[options.sectionKey],
    stateKey: options.stateKey,
    currentState: meta.label,
    currentStateLabel: meta.label,
    className: meta.className,
    blocking: options.stateKey === 'BLOCKED',
    blockerCount: options.blockerCount,
    doneCount: options.doneCount,
    totalCount: options.totalCount,
    detailText: options.detailText,
    navigationTarget: options.navigationTarget,
    navigationPayload: options.navigationPayload,
    defaultAction: buildAction({
      sectionKey: options.sectionKey,
      label: options.defaultActionLabel,
      target: options.navigationTarget,
      payload: options.navigationPayload,
      sourceNo: '',
      blocking: options.stateKey === 'BLOCKED',
    }),
  }
}

function buildBlocker(options: {
  productionOrderId: string
  productionOrderNo: string
  sectionKey: CuttingCheckSectionKey
  severity: CuttingCheckBlockerLevel
  title: string
  sourceType: CuttingCheckSourceObjectType
  sourceId: string
  sourceNo: string
  sourceLabel: string
  materialSku?: string
  currentStateLabel: string
  blockerReason: string
  navigationTarget: CuttingCheckActionTarget
  navigationPayload: Record<string, string | undefined>
  nextActionLabel: string
}): CuttingCheckBlockerItem {
  return {
    blockerId: `${options.sectionKey}-${options.sourceType}-${options.sourceId || options.sourceNo}`,
    productionOrderId: options.productionOrderId,
    productionOrderNo: options.productionOrderNo,
    sectionKey: options.sectionKey,
    severity: options.severity,
    title: options.title,
    sourceType: options.sourceType,
    sourceId: options.sourceId,
    sourceNo: options.sourceNo,
    sourceLabel: options.sourceLabel,
    materialSku: options.materialSku || '',
    currentStateLabel: options.currentStateLabel,
    blockerReason: options.blockerReason,
    nextActionLabel: options.nextActionLabel,
    navigationTarget: options.navigationTarget,
    navigationPayload: options.navigationPayload,
  }
}

function buildMaterialPrepSection(options: CuttingCheckBuildOptions): {
  section: CuttingCheckSectionState
  blockers: CuttingCheckBlockerItem[]
} {
  const blockers = options.materialPrepRows.flatMap((row) => {
    const payload = row.navigationPayload.materialPrep
    if (row.materialPrepStatus.key !== 'CONFIGURED') {
      return [
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'MATERIAL_PREP',
          severity: 'HIGH',
          title: `${row.cutOrderNo} 领料数量不足`,
          sourceType: 'CUT_ORDER',
          sourceId: row.cutOrderId,
          sourceNo: row.cutOrderNo,
          sourceLabel: '裁片单',
          materialSku: row.materialSkuSummary,
          currentStateLabel: row.materialPrepStatus.label,
          blockerReason: row.materialPrepStatus.detailText,
          navigationTarget: 'materialPrep',
          navigationPayload: payload,
          nextActionLabel: '去待加工仓',
        }),
      ]
    }
    if (row.materialClaimStatus.key !== 'RECEIVED') {
      return [
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'MATERIAL_PREP',
          severity: row.materialClaimStatus.key === 'EXCEPTION' ? 'HIGH' : 'MEDIUM',
          title: `${row.cutOrderNo} 领料记录未闭环`,
          sourceType: 'CUT_ORDER',
          sourceId: row.cutOrderId,
          sourceNo: row.cutOrderNo,
          sourceLabel: '裁片单',
          materialSku: row.materialSkuSummary,
          currentStateLabel: row.materialClaimStatus.label,
          blockerReason: row.materialClaimStatus.detailText,
          navigationTarget: 'materialPrep',
          navigationPayload: payload,
          nextActionLabel: '去待加工仓',
        }),
      ]
    }
    if (row.schedulingStatus.key === 'UNASSIGNED') {
      return [
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'MATERIAL_PREP',
          severity: 'MEDIUM',
          title: `${row.cutOrderNo} 待排单`,
          sourceType: 'CUT_ORDER',
          sourceId: row.cutOrderId,
          sourceNo: row.cutOrderNo,
          sourceLabel: '裁片单',
          materialSku: row.materialSkuSummary,
          currentStateLabel: row.schedulingStatus.label,
          blockerReason: row.schedulingStatus.detailText,
          navigationTarget: 'materialPrep',
          navigationPayload: payload,
          nextActionLabel: '去待加工仓',
        }),
      ]
    }
    return []
  })

  const doneCount = options.materialPrepRows.length - blockers.length
  const stateKey: CuttingCheckSectionStateKey = !options.materialPrepRows.length
    ? 'DATA_PENDING'
    : blockers.length
      ? 'BLOCKED'
      : 'DONE'

  return {
    section: buildSectionState({
      sectionKey: 'MATERIAL_PREP',
      stateKey,
      blockerCount: blockers.length,
      doneCount: Math.max(doneCount, 0),
      totalCount: options.materialPrepRows.length,
      detailText: !options.materialPrepRows.length
        ? '当前缺少领料对象，无法核查。'
        : blockers.length
          ? `当前有 ${blockers.length} 个领料对象未闭环。`
          : '当前领料链路已通过。',
      navigationTarget: 'materialPrep',
      navigationPayload: options.navigationPayload.materialPrep,
      defaultActionLabel: '去待加工仓',
    }),
    blockers,
  }
}

function buildSpreadingSection(options: CuttingCheckBuildOptions): {
  section: CuttingCheckSectionState
  blockers: CuttingCheckBlockerItem[]
} {
  const blockers: CuttingCheckBlockerItem[] = []
  const requiresSpreading = ['CUTTING', 'WAITING_INBOUND', 'DONE'].includes(options.productionRow.currentStage.key)

  if (!options.spreadingSessions.length) {
    if (requiresSpreading) {
      const sourceCutOrder = options.cutOrderRows[0]
      const sourceMarkerPlan = options.markerPlanSources[0]
      blockers.push(
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'SPREADING',
          severity: 'HIGH',
          title: '缺少铺布记录',
          sourceType: sourceMarkerPlan ? 'MARKER_PLAN' : 'CUT_ORDER',
          sourceId: sourceMarkerPlan?.markerPlanId || sourceCutOrder?.cutOrderId || options.productionRow.productionOrderId,
          sourceNo: sourceMarkerPlan?.markerPlanNo || sourceCutOrder?.cutOrderNo || options.productionRow.productionOrderNo,
          sourceLabel: sourceMarkerPlan ? '唛架方案' : '裁片单',
          materialSku: sourceCutOrder?.materialSku || '',
          currentStateLabel: '待补记录',
          blockerReason: '当前生产单已进入裁剪链路，但未找到对应铺布记录。',
          navigationTarget: 'markerSpreading',
          navigationPayload: options.navigationPayload.markerSpreading,
          nextActionLabel: '去唛架铺布',
        }),
      )
    }
  } else {
    options.spreadingSessions.forEach((session) => {
      if (session.status !== 'DONE') {
        blockers.push(
          buildBlocker({
            productionOrderId: options.productionRow.productionOrderId,
            productionOrderNo: options.productionRow.productionOrderNo,
            sectionKey: 'SPREADING',
            severity: 'HIGH',
            title: `${session.spreadingSessionNo} 未完成`,
            sourceType: session.contextType === 'marker-plan' ? 'MARKER_PLAN' : 'CUT_ORDER',
            sourceId: session.contextType === 'marker-plan' ? session.markerPlanId : session.cutOrderIds[0] || session.spreadingSessionId,
            sourceNo: session.contextType === 'marker-plan'
              ? session.markerPlanNo || session.spreadingSessionNo
              : session.cutOrderNos?.[0] || session.spreadingSessionNo,
            sourceLabel: session.contextType === 'marker-plan' ? '唛架方案' : '裁片单',
            materialSku: session.materialSku || '',
            currentStateLabel: session.status === 'IN_PROGRESS' ? '铺布中' : '待补录',
            blockerReason: session.status === 'IN_PROGRESS' ? '当前铺布记录仍在执行中。' : '当前铺布记录待补录。',
            navigationTarget: 'markerSpreading',
            navigationPayload: options.navigationPayload.markerSpreading,
            nextActionLabel: '去唛架铺布',
          }),
        )
        return
      }
      if ((session.warningMessages || []).length) {
        blockers.push(
          buildBlocker({
            productionOrderId: options.productionRow.productionOrderId,
            productionOrderNo: options.productionRow.productionOrderNo,
            sectionKey: 'SPREADING',
            severity: 'MEDIUM',
            title: `${session.spreadingSessionNo} 存在差异`,
            sourceType: session.contextType === 'marker-plan' ? 'MARKER_PLAN' : 'CUT_ORDER',
            sourceId: session.contextType === 'marker-plan' ? session.markerPlanId : session.cutOrderIds[0] || session.spreadingSessionId,
            sourceNo: session.contextType === 'marker-plan'
              ? session.markerPlanNo || session.spreadingSessionNo
              : session.cutOrderNos?.[0] || session.spreadingSessionNo,
            sourceLabel: session.contextType === 'marker-plan' ? '唛架方案' : '裁片单',
            materialSku: session.materialSku || '',
            currentStateLabel: '差异待核',
            blockerReason: session.warningMessages[0] || '当前铺布存在差异，需继续核查。',
            navigationTarget: 'markerSpreading',
            navigationPayload: options.navigationPayload.markerSpreading,
            nextActionLabel: '去唛架铺布',
          }),
        )
      }
    })
  }

  let stateKey: CuttingCheckSectionStateKey = 'DONE'
  let detailText = '当前唛架铺布链路已通过。'
  if (!options.spreadingSessions.length && !requiresSpreading) {
    stateKey = 'NOT_STARTED'
    detailText = '当前尚未进入唛架铺布执行阶段。'
  } else if (!options.spreadingSessions.length && requiresSpreading) {
    stateKey = 'DATA_PENDING'
    detailText = '当前缺少铺布记录，无法判断是否已闭环。'
  } else if (blockers.length) {
    stateKey = blockers.some((item) => item.currentStateLabel === '待补记录') ? 'DATA_PENDING' : 'BLOCKED'
    detailText = `当前有 ${blockers.length} 个铺布对象需继续处理。`
  }

  const doneCount = options.spreadingSessions.filter((session) => session.status === 'DONE').length

  return {
    section: buildSectionState({
      sectionKey: 'SPREADING',
      stateKey,
      blockerCount: blockers.length,
      doneCount,
      totalCount: options.spreadingSessions.length || options.cutOrderRows.length,
      detailText,
      navigationTarget: 'markerSpreading',
      navigationPayload: options.navigationPayload.markerSpreading,
      defaultActionLabel: '去唛架铺布',
    }),
    blockers,
  }
}

function buildReplenishmentSection(options: CuttingCheckBuildOptions): {
  section: CuttingCheckSectionState
  blockers: CuttingCheckBlockerItem[]
} {
  const blockingStatuses = new Set(['PENDING_REVIEW', 'PENDING_SUPPLEMENT', 'APPROVED_PENDING_ACTION', 'IN_ACTION'])
  const blockers = options.replenishments
    .filter((item) => blockingStatuses.has(item.statusMeta.key))
    .map((item) =>
      buildBlocker({
        productionOrderId: options.productionRow.productionOrderId,
        productionOrderNo: options.productionRow.productionOrderNo,
        sectionKey: 'REPLENISHMENT',
        severity: item.riskLevel === 'HIGH' ? 'HIGH' : item.riskLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW',
        title: `${item.suggestionNo} 待纠偏`,
        sourceType: 'REPLENISHMENT',
        sourceId: item.suggestionId,
        sourceNo: item.suggestionNo,
        sourceLabel: '补料建议',
        materialSku: item.materialSku,
        currentStateLabel: item.statusMeta.label,
        blockerReason: item.blockingSummary,
        navigationTarget: 'replenishment',
        navigationPayload: item.navigationPayload.replenishment,
        nextActionLabel: '去补料管理',
      }),
    )

  const doneCount = options.replenishments.filter((item) =>
    ['NO_ACTION', 'REJECTED', 'COMPLETED'].includes(item.statusMeta.key),
  ).length

  const stateKey: CuttingCheckSectionStateKey = !options.replenishments.length
    ? 'NOT_APPLICABLE'
    : blockers.length
      ? 'BLOCKED'
      : 'DONE'

  return {
    section: buildSectionState({
      sectionKey: 'REPLENISHMENT',
      stateKey,
      blockerCount: blockers.length,
      doneCount,
      totalCount: options.replenishments.length,
      detailText: !options.replenishments.length
        ? '当前没有补料建议。'
        : blockers.length
          ? `当前有 ${blockers.length} 条补料建议仍未闭环。`
          : '当前补料链路已闭环。',
      navigationTarget: 'replenishment',
      navigationPayload: options.navigationPayload.replenishment,
      defaultActionLabel: '去补料管理',
    }),
    blockers,
  }
}

function buildFeiTicketSection(options: CuttingCheckBuildOptions): {
  section: CuttingCheckSectionState
  blockers: CuttingCheckBlockerItem[]
} {
  const blockers: CuttingCheckBlockerItem[] = []
  const shouldHaveTickets = ['CUTTING', 'WAITING_INBOUND', 'DONE'].includes(options.productionRow.currentStage.key)

  if (!options.ticketOwners.length) {
    if (shouldHaveTickets) {
      blockers.push(
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'FEI_TICKETS',
          severity: 'MEDIUM',
          title: '缺少打印主体',
          sourceType: 'FEI_OWNER',
          sourceId: options.productionRow.productionOrderId,
          sourceNo: options.productionRow.productionOrderNo,
          sourceLabel: '打票主体',
          materialSku: '',
          currentStateLabel: '待补数据',
          blockerReason: '当前应进入打印链路，但未找到可核查的打票主体。',
          navigationTarget: 'feiTickets',
          navigationPayload: options.navigationPayload.feiTickets,
          nextActionLabel: '去打印菲票',
        }),
      )
    }
  } else {
    options.ticketOwners.forEach((owner) => {
      if (!['PRINTED', 'REPRINTED'].includes(owner.ticketStatus)) {
        blockers.push(
          buildBlocker({
            productionOrderId: options.productionRow.productionOrderId,
            productionOrderNo: options.productionRow.productionOrderNo,
            sectionKey: 'FEI_TICKETS',
            severity: owner.ticketStatus === 'PENDING_SUPPLEMENT' ? 'HIGH' : 'MEDIUM',
            title: `${owner.cutOrderNo} 待打印菲票`,
            sourceType: 'FEI_OWNER',
            sourceId: owner.cutOrderId,
            sourceNo: owner.cutOrderNo,
            sourceLabel: '打票主体',
            materialSku: owner.materialSku,
            currentStateLabel: ownerStatusLabelMap[owner.ticketStatus] || owner.ticketStatus,
            blockerReason: owner.ticketCountBasisDetail || '当前打印主体尚未闭环。',
            navigationTarget: 'feiTickets',
            navigationPayload: owner.navigationPayload.feiTickets,
            nextActionLabel: '去打印菲票',
          }),
        )
      }
    })
  }

  const schemaMissingRecords = options.ticketRecords.filter((record) => !record.schemaVersion)
  if (schemaMissingRecords.length) {
    const latestJob = options.printJobs[0]
    blockers.push(
      buildBlocker({
        productionOrderId: options.productionRow.productionOrderId,
        productionOrderNo: options.productionRow.productionOrderNo,
        sectionKey: 'FEI_TICKETS',
        severity: 'MEDIUM',
        title: '菲票码版本缺失',
        sourceType: 'FEI_PRINT_JOB',
        sourceId: latestJob?.printJobId || `${options.productionRow.productionOrderId}-print-job-missing`,
        sourceNo: latestJob?.printJobNo || '待补打印作业',
        sourceLabel: '打印作业',
        materialSku: '',
        currentStateLabel: '版本待补',
        blockerReason: `当前有 ${schemaMissingRecords.length} 张菲票缺少版本信息。`,
        navigationTarget: 'feiTickets',
        navigationPayload: options.navigationPayload.feiTickets,
        nextActionLabel: '去打印菲票',
      }),
    )
  }

  let stateKey: CuttingCheckSectionStateKey = 'DONE'
  let detailText = '当前打印菲票链路已通过。'
  if (!options.ticketOwners.length && !shouldHaveTickets) {
    stateKey = 'NOT_STARTED'
    detailText = '当前尚未进入打印菲票链路。'
  } else if (!options.ticketOwners.length && shouldHaveTickets) {
    stateKey = 'DATA_PENDING'
    detailText = '当前缺少打票主体，无法确认打印闭环。'
  } else if (blockers.length) {
    stateKey = blockers.some((item) => item.currentStateLabel === '待补数据') ? 'DATA_PENDING' : 'BLOCKED'
    detailText = `当前有 ${blockers.length} 个打印对象仍待处理。`
  }

  const doneCount = options.ticketOwners.filter((owner) => ['PRINTED', 'REPRINTED'].includes(owner.ticketStatus)).length

  return {
    section: buildSectionState({
      sectionKey: 'FEI_TICKETS',
      stateKey,
      blockerCount: blockers.length,
      doneCount,
      totalCount: options.ticketOwners.length || schemaMissingRecords.length,
      detailText,
      navigationTarget: 'feiTickets',
      navigationPayload: options.navigationPayload.feiTickets,
      defaultActionLabel: '去打印菲票',
    }),
    blockers,
  }
}

function buildWarehouseSection(options: CuttingCheckBuildOptions): {
  section: CuttingCheckSectionState
  blockers: CuttingCheckBlockerItem[]
} {
  const blockers: CuttingCheckBlockerItem[] = []
  const shouldHaveWarehouseObjects = ['WAITING_INBOUND', 'DONE'].includes(options.productionRow.currentStage.key)

  options.cutPieceItems.forEach((item) => {
    if (item.warehouseStatus.key === 'PENDING_INBOUND') {
      blockers.push(
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'WAREHOUSE_HANDOFF',
          severity: 'HIGH',
          title: `${item.cutOrderNo} 待入仓`,
          sourceType: 'CUT_ORDER',
          sourceId: item.cutOrderId,
          sourceNo: item.cutOrderNo,
          sourceLabel: '裁片单',
          materialSku: '',
          currentStateLabel: item.warehouseStatus.label,
          blockerReason: item.warehouseStatus.detailText,
          navigationTarget: 'cutPieceWarehouse',
          navigationPayload: item.navigationPayload,
          nextActionLabel: '去裁片仓',
        }),
      )
      return
    }
    if (item.handoffStatus.key === 'WAITING_HANDOVER') {
      blockers.push(
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'WAREHOUSE_HANDOFF',
          severity: 'MEDIUM',
          title: `${item.cutOrderNo} 待交接`,
          sourceType: 'CUT_ORDER',
          sourceId: item.cutOrderId,
          sourceNo: item.cutOrderNo,
          sourceLabel: '裁片单',
          materialSku: '',
          currentStateLabel: item.handoffStatus.label,
          blockerReason: item.handoffStatus.detailText,
          navigationTarget: 'cutPieceWarehouse',
          navigationPayload: item.navigationPayload,
          nextActionLabel: '去裁片仓',
        }),
      )
    }
  })

  options.bagUsages.forEach((usage) => {
    if (!['CLOSED', 'EXCEPTION_CLOSED'].includes(usage.usageStatus)) {
      blockers.push(
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'WAREHOUSE_HANDOFF',
          severity: 'MEDIUM',
          title: `${usage.usageNo} 未闭环`,
          sourceType: 'BAG_USAGE',
          sourceId: usage.usageId,
          sourceNo: usage.usageNo,
          sourceLabel: '中转袋使用周期',
          materialSku: '',
          currentStateLabel: usage.pocketStatusMeta.label,
          blockerReason: `当前中转袋码 ${usage.bagCode} 仍在${usage.pocketStatusMeta.label}。`,
          navigationTarget: 'transferBags',
          navigationPayload: usage.navigationPayload,
          nextActionLabel: '去中转袋管理',
        }),
      )
    }
  })

  options.returnUsages.forEach((usage) => {
    if (usage.returnExceptionMeta || usage.latestClosureResult?.closureStatus === 'EXCEPTION_CLOSED') {
      blockers.push(
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'WAREHOUSE_HANDOFF',
          severity: 'HIGH',
          title: `${usage.usageNo} 回仓异常`,
          sourceType: 'BAG_USAGE',
          sourceId: usage.usageId,
          sourceNo: usage.usageNo,
          sourceLabel: '中转袋使用周期',
          materialSku: '',
          currentStateLabel: usage.pocketStatusMeta.label,
          blockerReason: usage.returnExceptionMeta?.detailText || usage.latestClosureResult?.reason || '当前回仓链路存在异常。',
          navigationTarget: 'transferBags',
          navigationPayload: usage.navigationPayload,
          nextActionLabel: '去中转袋管理',
        }),
      )
    }
  })

  options.conditionItems.forEach((item) => {
    if (item.decisionMeta.reusableDecision !== 'REUSABLE') {
      blockers.push(
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'WAREHOUSE_HANDOFF',
          severity: item.decisionMeta.reusableDecision === 'DISABLED' ? 'HIGH' : 'MEDIUM',
          title: `${item.bagCode} 袋况待处理`,
          sourceType: 'BAG_USAGE',
          sourceId: item.usageId,
          sourceNo: item.usageNo || item.bagCode,
          sourceLabel: '中转袋使用周期',
          materialSku: '',
          currentStateLabel: item.decisionMeta.label,
          blockerReason: item.decisionMeta.detailText,
          navigationTarget: 'transferBags',
          navigationPayload: item.latestUsage?.navigationPayload || options.navigationPayload.transferBags,
          nextActionLabel: '去中转袋管理',
        }),
      )
    }
  })

  const totalCount =
    options.cutPieceItems.length +
    options.bagUsages.length +
    options.returnUsages.length +
    options.conditionItems.length

  let stateKey: CuttingCheckSectionStateKey = 'DONE'
  let detailText = '当前仓务交接链路已通过。'
  if (!totalCount && !shouldHaveWarehouseObjects) {
    stateKey = 'NOT_STARTED'
    detailText = '当前尚未进入仓务交接链路。'
  } else if (!totalCount && shouldHaveWarehouseObjects) {
    stateKey = 'DATA_PENDING'
    detailText = '当前缺少仓务交接对象，无法确认是否闭环。'
  } else if (blockers.length) {
    stateKey = 'BLOCKED'
    detailText = `当前有 ${blockers.length} 个仓务交接对象待处理。`
  }

  return {
    section: buildSectionState({
      sectionKey: 'WAREHOUSE_HANDOFF',
      stateKey,
      blockerCount: blockers.length,
      doneCount: Math.max(totalCount - blockers.length, 0),
      totalCount,
      detailText,
      navigationTarget: blockers.some((item) => item.sourceType === 'BAG_USAGE') ? 'transferBags' : 'cutPieceWarehouse',
      navigationPayload: blockers.some((item) => item.sourceType === 'BAG_USAGE')
        ? options.navigationPayload.transferBags
        : options.navigationPayload.cutPieceWarehouse,
      defaultActionLabel: blockers.some((item) => item.sourceType === 'BAG_USAGE') ? '去中转袋管理' : '去裁片仓',
    }),
    blockers,
  }
}

function buildSpecialProcessSection(options: CuttingCheckBuildOptions): {
  section: CuttingCheckSectionState
  blockers: CuttingCheckBlockerItem[]
} {
  const blockers = options.specialProcesses.flatMap((item) => {
    if (!item.typeExecutionMeta.enabledForExecution) {
      return [
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'SPECIAL_PROCESS',
          severity: 'MEDIUM',
          title: `${item.processOrderNo} 预留未接入`,
          sourceType: 'SPECIAL_PROCESS',
          sourceId: item.processOrderId,
          sourceNo: item.processOrderNo,
          sourceLabel: '特殊工艺单',
          materialSku: item.materialSku,
          currentStateLabel: item.typeExecutionMeta.readinessLabel,
          blockerReason: item.typeExecutionMeta.disabledReason,
          navigationTarget: 'specialProcesses',
          navigationPayload: item.navigationPayload.specialProcesses,
          nextActionLabel: '去特殊工艺',
        }),
      ]
    }
    if (['DRAFT', 'PENDING_EXECUTION', 'IN_PROGRESS'].includes(item.status)) {
      return [
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'SPECIAL_PROCESS',
          severity: item.status === 'IN_PROGRESS' ? 'MEDIUM' : 'LOW',
          title: `${item.processOrderNo} ${item.statusMeta.label}`,
          sourceType: 'SPECIAL_PROCESS',
          sourceId: item.processOrderId,
          sourceNo: item.processOrderNo,
          sourceLabel: '特殊工艺单',
          materialSku: item.materialSku,
          currentStateLabel: item.statusMeta.label,
          blockerReason: item.executionProgressSummary || item.statusMeta.detailText,
          navigationTarget: 'specialProcesses',
          navigationPayload: item.navigationPayload.specialProcesses,
          nextActionLabel: '去特殊工艺',
        }),
      ]
    }
    if (item.followupPendingCount > 0 || item.downstreamBlocked) {
      return [
        buildBlocker({
          productionOrderId: options.productionRow.productionOrderId,
          productionOrderNo: options.productionRow.productionOrderNo,
          sectionKey: 'SPECIAL_PROCESS',
          severity: 'MEDIUM',
          title: `${item.processOrderNo} 后续未闭环`,
          sourceType: 'SPECIAL_PROCESS',
          sourceId: item.processOrderId,
          sourceNo: item.processOrderNo,
          sourceLabel: '特殊工艺单',
          materialSku: item.materialSku,
          currentStateLabel: item.followupProgressSummary,
          blockerReason: item.downstreamBlockReason || '当前特殊工艺后续动作仍未完成。',
          navigationTarget: 'specialProcesses',
          navigationPayload: item.navigationPayload.specialProcesses,
          nextActionLabel: '去特殊工艺',
        }),
      ]
    }
    return []
  })

  const totalCount = options.specialProcesses.length
  const doneCount = options.specialProcesses.filter(
    (item) => item.typeExecutionMeta.enabledForExecution && ['DONE', 'CANCELLED'].includes(item.status) && item.followupPendingCount === 0,
  ).length

  let stateKey: CuttingCheckSectionStateKey = 'NOT_APPLICABLE'
  let detailText = '当前未创建特殊工艺单。'
  if (totalCount) {
    if (blockers.length) {
      stateKey = blockers.some((item) => item.currentStateLabel === '预留') ? 'DATA_PENDING' : 'BLOCKED'
      detailText = `当前有 ${blockers.length} 张特殊工艺单未闭环。`
    } else {
      stateKey = 'DONE'
      detailText = '当前特殊工艺链路已通过。'
    }
  }

  return {
    section: buildSectionState({
      sectionKey: 'SPECIAL_PROCESS',
      stateKey,
      blockerCount: blockers.length,
      doneCount,
      totalCount,
      detailText,
      navigationTarget: 'specialProcesses',
      navigationPayload: options.navigationPayload.specialProcesses,
      defaultActionLabel: '去特殊工艺',
    }),
    blockers,
  }
}

function dedupeActions(actions: CuttingCheckNextAction[]): CuttingCheckNextAction[] {
  const map = new Map<string, CuttingCheckNextAction>()
  actions.forEach((action) => {
    const key = `${action.sectionKey}-${action.target}-${action.sourceNo || 'default'}-${action.label}`
    if (!map.has(key) || action.blocking) {
      map.set(key, action)
    }
  })
  return Array.from(map.values())
}

export function buildCuttingCheckResult(options: CuttingCheckBuildOptions): CuttingCheckResult {
  const materialPrep = buildMaterialPrepSection(options)
  const spreading = buildSpreadingSection(options)
  const replenishment = buildReplenishmentSection(options)
  const feiTickets = buildFeiTicketSection(options)
  const warehouse = buildWarehouseSection(options)
  const specialProcess = buildSpecialProcessSection(options)

  const sectionStates = [
    materialPrep.section,
    spreading.section,
    replenishment.section,
    feiTickets.section,
    warehouse.section,
    specialProcess.section,
  ]

  const blockerItems = [
    ...materialPrep.blockers,
    ...spreading.blockers,
    ...replenishment.blockers,
    ...feiTickets.blockers,
    ...warehouse.blockers,
    ...specialProcess.blockers,
  ].sort((left, right) => {
    const severityDiff = severityWeight(right.severity) - severityWeight(left.severity)
    if (severityDiff) return severityDiff
    return left.sectionKey.localeCompare(right.sectionKey, 'zh-CN')
  })

  const primaryBlocker = blockerItems[0] || null

  const pendingSections = sectionStates.filter((section) => ['NOT_STARTED', 'IN_PROGRESS', 'DATA_PENDING'].includes(section.stateKey))
  const nextActions = dedupeActions([
    ...blockerItems.map((item) =>
      buildAction({
        sectionKey: item.sectionKey,
        label: item.nextActionLabel,
        target: item.navigationTarget,
        payload: item.navigationPayload,
        sourceNo: item.sourceNo,
        blocking: true,
      }),
    ),
    ...pendingSections
      .filter((section) => section.stateKey !== 'NOT_APPLICABLE')
      .map((section) => section.defaultAction),
  ])

  const completionKey: CuttingCheckCompletionKey = blockerItems.length
    ? 'BLOCKED'
    : sectionStates.some((section) => section.stateKey === 'DATA_PENDING')
      ? 'DATA_PENDING'
      : sectionStates.every((section) => ['DONE', 'NOT_APPLICABLE'].includes(section.stateKey))
        ? 'COMPLETED'
        : 'IN_PROGRESS'

  return {
    completionMeta: cuttingCheckCompletionMetaMap[completionKey],
    sectionStates,
    blockerItems,
    nextActions,
    primaryBlocker,
    blockerCount: blockerItems.length,
    pendingActionCount: nextActions.filter((item) => item.blocking).length,
    keySourceObjects: uniqueStrings(
      blockerItems.map((item) => item.sourceNo).slice(0, 3),
    ),
  }
}
