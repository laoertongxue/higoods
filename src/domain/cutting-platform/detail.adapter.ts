import { buildFcsCuttingRuntimeDetailData } from '../fcs-cutting-runtime/sources'
import {
  buildPlatformAttentionItems,
  buildPlatformChainSections,
  buildPlatformCuttingDetailRoute,
  type PlatformCuttingAttentionItem,
  type PlatformCuttingChainSection,
} from './detail.helpers'
import {
  buildPlatformCuttingRuntimeOverviewData,
  type PlatformCuttingOverviewRow,
} from './overview.adapter'

const blockerRouteMap: Record<string, string> = {
  productionProgress: '/fcs/craft/cutting/order-progress',
  cuttablePool: '/fcs/craft/cutting/cuttable-pool',
  mergeBatches: '/fcs/craft/cutting/merge-batches',
  originalOrders: '/fcs/craft/cutting/cut-piece-orders',
  materialPrep: '/fcs/craft/cutting/material-prep',
  markerSpreading: '/fcs/craft/cutting/marker-spreading',
  feiTickets: '/fcs/craft/cutting/fei-tickets',
  fabricWarehouse: '/fcs/craft/cutting/fabric-warehouse',
  cutPieceWarehouse: '/fcs/craft/cutting/cut-piece-warehouse',
  sampleWarehouse: '/fcs/craft/cutting/sample-warehouse',
  transferBags: '/fcs/craft/cutting/transfer-bags',
  replenishment: '/fcs/craft/cutting/replenishment',
  specialProcesses: '/fcs/craft/cutting/special-processes',
  summary: '/fcs/craft/cutting/summary',
}

function buildRouteWithPayload(route: string, payload?: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${route}?${query}` : route
}

export interface PlatformCuttingDetailIssueItem {
  title: string
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  sourceLabel: string
  description: string
  suggestedAction: string
  suggestedRoute: string
}

export interface PlatformCuttingDetailView {
  row: PlatformCuttingOverviewRow
  backRoute: string
  detailRoute: string
  chainSections: PlatformCuttingChainSection[]
  issues: PlatformCuttingDetailIssueItem[]
  attentionItems: PlatformCuttingAttentionItem[]
  latestFactoryActionText: string
  suggestedExceptionSeedCount: number
  suggestedSettlementAttention: boolean
  suggestedFactoryScoreAttention: boolean
}

export function buildPlatformCuttingDetailView(recordId: string): PlatformCuttingDetailView | null {
  const overview = buildPlatformCuttingRuntimeOverviewData()
  const row = overview.rows.find((item) => item.id === recordId)
  if (!row) return null

  const detailData = buildFcsCuttingRuntimeDetailData(row.sourceRowId, overview.runtime)

  const issues: PlatformCuttingDetailIssueItem[] = detailData
    ? detailData.blockerItems.map((item) => ({
        title: item.title,
        level: item.severity,
        sourceLabel: item.sourceLabel,
        description: item.blockerReason,
        suggestedAction: item.nextActionLabel,
        suggestedRoute: buildRouteWithPayload(
          blockerRouteMap[item.navigationTarget] || row.suggestedRoute,
          item.navigationPayload,
        ),
      }))
    : row.issues.map((issue) => ({
        title: issue.title,
        level: issue.level,
        sourceLabel:
          issue.sourcePage === 'MATERIAL_PREP'
            ? '仓库配料'
            : issue.sourcePage === 'CUT_PIECE_ORDER'
              ? '裁片执行'
              : issue.sourcePage === 'REPLENISHMENT'
                ? '补料管理'
                : issue.sourcePage === 'WAREHOUSE'
                  ? '仓库管理'
                  : '样衣流转',
        description: issue.description,
        suggestedAction: issue.suggestedAction,
        suggestedRoute: issue.suggestedRoute,
      }))

  const latestFactoryActionText =
    row.recentFactoryActionAt !== '-'
      ? `${row.recentFactoryActionSource} · ${row.recentFactoryActionAt} · ${row.recentFactoryActionBy}`
      : '当前暂无工厂端最新动作回写'

  return {
    row,
    backRoute: '/fcs/progress/cutting-overview',
    detailRoute: buildPlatformCuttingDetailRoute(recordId),
    chainSections: buildPlatformChainSections(row),
    issues,
    attentionItems: buildPlatformAttentionItems(row),
    latestFactoryActionText,
    suggestedExceptionSeedCount: issues.filter((item) => item.level === 'HIGH' || item.title.includes('复核') || item.title.includes('差异')).length,
    suggestedSettlementAttention: row.pendingIssueCount > 0,
    suggestedFactoryScoreAttention: row.overallRiskLevel === 'HIGH' || row.hasReceiveRecheck || row.hasPendingReplenishment,
  }
}
