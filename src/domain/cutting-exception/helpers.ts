import type {
  CuttingException,
  CuttingExceptionFollowupSummary,
  CuttingExceptionOwnerRole,
  CuttingExceptionRiskLevel,
  CuttingExceptionSourceLayer,
  CuttingExceptionSourcePage,
  CuttingExceptionStatus,
  CuttingExceptionType,
} from './types'

export interface CuttingExceptionFilters {
  keyword: string
  exceptionType: 'ALL' | CuttingExceptionType
  riskLevel: 'ALL' | CuttingExceptionRiskLevel
  status: 'ALL' | 'NOT_CLOSED' | CuttingExceptionStatus
  sourceLayer: 'ALL' | CuttingExceptionSourceLayer
  ownerRole: 'ALL' | CuttingExceptionOwnerRole
  pendingOnly: 'ALL' | 'PENDING_ONLY'
}

export const cuttingExceptionTypeMeta: Record<CuttingExceptionType, { label: string; className: string }> = {
  RECEIVE_DISCREPANCY: { label: '领料差异', className: 'bg-rose-50 text-rose-700' },
  MISSING_EVIDENCE: { label: '无照片凭证', className: 'bg-orange-50 text-orange-700' },
  MARKER_NOT_MAINTAINED: { label: '唛架未维护', className: 'bg-amber-50 text-amber-700' },
  SPREADING_DATA_INSUFFICIENT: { label: '铺布数据不足', className: 'bg-sky-50 text-sky-700' },
  REPLENISHMENT_PENDING: { label: '补料待审核', className: 'bg-fuchsia-50 text-fuchsia-700' },
  INBOUND_PENDING: { label: '未入仓', className: 'bg-violet-50 text-violet-700' },
  ZONE_UNASSIGNED: { label: '未分区', className: 'bg-indigo-50 text-indigo-700' },
  SAMPLE_OVERDUE: { label: '样衣未归还', className: 'bg-slate-100 text-slate-700' },
  HANDOVER_PENDING: { label: '待交接', className: 'bg-pink-50 text-pink-700' },
}

export const cuttingExceptionRiskMeta: Record<CuttingExceptionRiskLevel, { label: string; className: string }> = {
  HIGH: { label: '高风险', className: 'bg-rose-50 text-rose-700' },
  MEDIUM: { label: '中风险', className: 'bg-amber-50 text-amber-700' },
  LOW: { label: '低风险', className: 'bg-sky-50 text-sky-700' },
}

export const cuttingExceptionStatusMeta: Record<CuttingExceptionStatus, { label: string; className: string }> = {
  OPEN: { label: '未关闭', className: 'bg-rose-50 text-rose-700' },
  IN_PROGRESS: { label: '处理中', className: 'bg-sky-50 text-sky-700' },
  WAITING_CONFIRM: { label: '待确认', className: 'bg-amber-50 text-amber-700' },
  CLOSED: { label: '已关闭', className: 'bg-emerald-50 text-emerald-700' },
}

export const cuttingExceptionSourceLayerLabels: Record<CuttingExceptionSourceLayer, string> = {
  PLATFORM: '平台',
  PCS: 'PCS',
  FACTORY_APP: '工厂端',
}

export const cuttingExceptionSourcePageLabels: Record<CuttingExceptionSourcePage, string> = {
  ORDER_PROGRESS: '订单进度',
  MATERIAL_PREP: '仓库配料',
  CUT_PIECE_ORDER: '裁片单',
  REPLENISHMENT: '补料管理',
  WAREHOUSE: '仓库管理',
  PDA_PICKUP: '扫码领料',
  PDA_SPREADING: '铺布录入',
  PDA_INBOUND: '入仓扫码',
  PDA_HANDOVER: '交接扫码',
  PDA_REPLENISHMENT_FEEDBACK: '补料反馈',
}

export const cuttingExceptionOwnerRoleLabels: Record<CuttingExceptionOwnerRole, string> = {
  PLATFORM: '平台',
  CUTTING_FACTORY_OPS: '裁片厂运营',
  FIELD_EXECUTION: '现场执行',
}

export const cuttingExceptionTriggerConditionTexts: Record<CuttingExceptionType, string> = {
  RECEIVE_DISCREPANCY: '扫码领取结果为需复核，或领取数量与配置数量不一致时触发。',
  MISSING_EVIDENCE: '异常处理需要照片凭证，但 photoProofCount = 0 时触发。',
  MARKER_NOT_MAINTAINED: '裁片单进入执行相关阶段，但唛架信息仍缺失时触发。',
  SPREADING_DATA_INSUFFICIENT: '应有铺布记录但为空，或关键字段不足以判断执行状态时触发。',
  REPLENISHMENT_PENDING: '已有补料建议且状态仍待审核 / 待补充说明时触发。',
  INBOUND_PENDING: '执行阶段已到应入仓节点，但仍未形成入仓摘要时触发。',
  ZONE_UNASSIGNED: '已入仓但区域仍未分配或未指定时触发。',
  SAMPLE_OVERDUE: '样衣处于待归还或超期状态时触发。',
  HANDOVER_PENDING: '已完成前序但后道交接仍未完成时触发。',
}

export const cuttingExceptionClosureConditionTexts: Record<CuttingExceptionType, string> = {
  RECEIVE_DISCREPANCY: '已完成复核，或差异已确认并留痕后关闭。',
  MISSING_EVIDENCE: '已补齐凭证，或已确认无需凭证并补备注后关闭。',
  MARKER_NOT_MAINTAINED: '唛架已维护完成且关键字段完整后关闭。',
  SPREADING_DATA_INSUFFICIENT: '铺布数据已补录，或确认当前阶段不需要铺布记录并留备注后关闭。',
  REPLENISHMENT_PENDING: '补料已审核通过 / 驳回，待处理状态解除后关闭。',
  INBOUND_PENDING: '已入仓，或已确认无需入仓并留备注后关闭。',
  ZONE_UNASSIGNED: '已完成区域分配，当前位置可查后关闭。',
  SAMPLE_OVERDUE: '样衣已归还，或状态转为可调用 / 已回仓后关闭。',
  HANDOVER_PENDING: '已交接，或已确认交接不适用并留备注后关闭。',
}

export function filterCuttingExceptions(
  rows: CuttingException[],
  filters: CuttingExceptionFilters,
): CuttingException[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return rows.filter((row) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [
        row.exceptionNo,
        row.productionOrderNo,
        row.cuttingTaskNo,
        row.cutPieceOrderNo,
        row.materialSku,
        row.exceptionTypeLabel,
        row.triggerSummary,
        row.ownerName,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)

    const matchesType = filters.exceptionType === 'ALL' || row.exceptionType === filters.exceptionType
    const matchesRisk = filters.riskLevel === 'ALL' || row.riskLevel === filters.riskLevel
    const matchesSource = filters.sourceLayer === 'ALL' || row.sourceLayer === filters.sourceLayer
    const matchesOwner = filters.ownerRole === 'ALL' || row.ownerRole === filters.ownerRole
    const matchesPending = filters.pendingOnly === 'ALL' || row.status !== 'CLOSED'
    const matchesStatus =
      filters.status === 'ALL'
        ? true
        : filters.status === 'NOT_CLOSED'
          ? row.status !== 'CLOSED'
          : row.status === filters.status

    return matchesKeyword && matchesType && matchesRisk && matchesSource && matchesOwner && matchesPending && matchesStatus
  })
}

export function buildCuttingExceptionStats(rows: CuttingException[]) {
  const openRows = rows.filter((row) => row.status !== 'CLOSED')
  return {
    openCount: openRows.length,
    highRiskCount: openRows.filter((row) => row.riskLevel === 'HIGH').length,
    receiveDiscrepancyCount: openRows.filter((row) => row.exceptionType === 'RECEIVE_DISCREPANCY').length,
    replenishmentPendingCount: openRows.filter((row) => row.exceptionType === 'REPLENISHMENT_PENDING').length,
    warehouseRiskCount: openRows.filter((row) => row.exceptionType === 'INBOUND_PENDING' || row.exceptionType === 'ZONE_UNASSIGNED').length,
    sampleOverdueCount: openRows.filter((row) => row.exceptionType === 'SAMPLE_OVERDUE').length,
  }
}

export function buildCuttingExceptionFocusRows(rows: CuttingException[]): CuttingException[] {
  return [...rows]
    .filter((row) => row.status !== 'CLOSED')
    .sort((left, right) => {
      const score = (row: CuttingException): number => {
        if (row.exceptionType === 'MISSING_EVIDENCE' && row.riskLevel === 'HIGH') return 0
        if (row.exceptionType === 'RECEIVE_DISCREPANCY' && row.riskLevel === 'HIGH') return 1
        if (row.exceptionType === 'REPLENISHMENT_PENDING' && row.riskLevel === 'HIGH') return 2
        if (row.exceptionType === 'INBOUND_PENDING') return 3
        if (row.exceptionType === 'ZONE_UNASSIGNED') return 4
        if (row.exceptionType === 'SAMPLE_OVERDUE') return 5
        if (row.exceptionType === 'HANDOVER_PENDING') return 6
        if (row.riskLevel === 'HIGH') return 7
        if (row.riskLevel === 'MEDIUM') return 8
        return 9
      }

      const scoreDiff = score(left) - score(right)
      if (scoreDiff !== 0) return scoreDiff
      return left.exceptionNo.localeCompare(right.exceptionNo)
    })
    .slice(0, 6)
}

export function buildCuttingExceptionEmptyStateText(
  hasFilters: boolean,
  mode: 'records' | 'focus',
): string {
  if (mode === 'focus') return '当前没有需要平台优先推进的裁片专项异常。'
  return hasFilters ? '未找到符合筛选条件的裁片专项异常。' : '当前没有可展示的裁片专项异常。'
}

export function hasCuttingExceptionFilters(filters: CuttingExceptionFilters): boolean {
  return (
    filters.keyword.trim().length > 0 ||
    filters.exceptionType !== 'ALL' ||
    filters.riskLevel !== 'ALL' ||
    filters.status !== 'ALL' ||
    filters.sourceLayer !== 'ALL' ||
    filters.ownerRole !== 'ALL' ||
    filters.pendingOnly !== 'ALL'
  )
}

export function buildCuttingExceptionFollowupSummary(rows: CuttingException[]): CuttingExceptionFollowupSummary {
  const openRows = rows.filter((row) => row.status !== 'CLOSED')
  const threshold = Date.now() - 48 * 60 * 60 * 1000
  const longOpenRows = openRows.filter((row) => {
    if (!row.latestActionAt || row.latestActionAt === '-') return false
    const parsed = new Date(row.latestActionAt.replace(' ', 'T')).getTime()
    return Number.isFinite(parsed) && parsed < threshold
  })

  return {
    openHighRiskCount: openRows.filter((row) => row.riskLevel === 'HIGH').length,
    repeatedRecheckCount: openRows.filter((row) => row.needsRecheck && row.exceptionType === 'RECEIVE_DISCREPANCY').length,
    photoEvidenceCount: openRows.filter((row) => row.hasPhotoEvidence).length,
    longOpenCount: longOpenRows.length,
    settlementAttentionCount: openRows.filter((row) => row.riskLevel === 'HIGH' || row.exceptionType === 'REPLENISHMENT_PENDING').length,
    factoryScoreAttentionCount: openRows.filter((row) => row.needsRecheck || row.exceptionType === 'SAMPLE_OVERDUE' || row.exceptionType === 'HANDOVER_PENDING').length,
  }
}

export function buildExceptionLatestActionText(row: CuttingException): string {
  if (!row.latestActionAt || row.latestActionAt === '-') return row.latestActionSummary
  return `${row.latestActionSummary} · ${row.latestActionAt}${row.latestActionBy && row.latestActionBy !== '-' ? ` · ${row.latestActionBy}` : ''}`
}
