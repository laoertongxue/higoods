import { clonePlatformCuttingOverviewRows } from './overview.mock'
import {
  buildPlatformAttentionItems,
  buildPlatformChainSections,
  buildPlatformCuttingDetailRoute,
  type PlatformCuttingAttentionItem,
  type PlatformCuttingChainSection,
} from './detail.helpers'
import type { PlatformCuttingOverviewRow } from './overview.adapter'

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
  const row = clonePlatformCuttingOverviewRows().find((item) => item.id === recordId)
  if (!row) return null

  const issues: PlatformCuttingDetailIssueItem[] = row.issues.map((issue) => ({
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
