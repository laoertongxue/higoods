import type { CuttingSummaryIssue } from '../../data/fcs/cutting/cutting-summary'
import type { PlatformCuttingOverviewRow } from './overview.adapter'

export interface PlatformCuttingChainSection {
  key: 'pickup' | 'execution' | 'replenishment' | 'warehouse' | 'sample'
  title: string
  statusLabel: string
  summaryText: string
  latestActionText: string
  riskTags: string[]
}

export interface PlatformCuttingAttentionItem {
  key: string
  title: string
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  suggestedFollowUp: string
}

export function buildPlatformCuttingDetailRoute(recordId: string): string {
  return `/fcs/progress/cutting-overview/${encodeURIComponent(recordId)}`
}

export function buildPlatformIssueSourceLabel(issue: CuttingSummaryIssue): string {
  if (issue.sourcePage === 'MATERIAL_PREP') return '仓库配料'
  if (issue.sourcePage === 'CUT_PIECE_ORDER') return '裁片执行'
  if (issue.sourcePage === 'REPLENISHMENT') return '补料管理'
  if (issue.sourcePage === 'WAREHOUSE') return '仓库管理'
  return '样衣流转'
}

export function buildPlatformChainSections(row: PlatformCuttingOverviewRow): PlatformCuttingChainSection[] {
  return [
    {
      key: 'pickup',
      title: '配料 / 领料',
      statusLabel: row.pickupSummary.needsRecheck
        ? '领料需复核'
        : row.currentStage === 'PENDING_PICKUP'
          ? '待领料'
          : row.pickupAggregate.receiveSuccessCount > 0
            ? '已完成领料'
            : '已进入准备',
      summaryText: row.pickupSummaryText,
      latestActionText:
        row.pickupSummary.latestScannedAt !== '-'
          ? `最近扫码 ${row.pickupSummary.latestScannedAt} · ${row.pickupSummary.latestScannedBy}`
          : '当前暂无扫码回写',
      riskTags: [
        ...(row.pickupSummary.needsRecheck ? ['需复核'] : []),
        ...(row.pickupSummary.hasPhotoEvidence ? ['有照片凭证'] : []),
      ],
    },
    {
      key: 'execution',
      title: '裁片执行（唛架 / 铺布）',
      statusLabel: row.hasExecutionStalled ? '执行待收口' : '执行推进中',
      summaryText: row.executionSummaryText,
      latestActionText:
        row.record.spreadingSummary.latestSpreadingAt
          ? `最近铺布 ${row.record.spreadingSummary.latestSpreadingAt} · ${row.record.spreadingSummary.latestSpreadingBy || '-'}`
          : '当前暂无铺布回写',
      riskTags: [
        ...(row.record.markerSummary.pendingMarkerCount > 0 ? ['唛架待维护'] : []),
        ...(row.record.spreadingSummary.pendingSpreadingCount > 0 ? ['铺布待补录'] : []),
      ],
    },
    {
      key: 'replenishment',
      title: '补料',
      statusLabel: row.hasPendingReplenishment ? '待补料处理' : '当前无补料阻断',
      summaryText: row.replenishmentSummaryText,
      latestActionText:
        row.record.replenishmentSummary.suggestionCount > 0
          ? `待审核 ${row.record.replenishmentSummary.pendingReviewCount} · 已通过 ${row.record.replenishmentSummary.approvedCount}`
          : '当前无补料建议',
      riskTags: [
        ...(row.record.replenishmentSummary.highRiskCount > 0 ? ['高风险补料'] : []),
        ...(row.record.replenishmentSummary.pendingPrepCount > 0 ? ['待仓库配料领料'] : []),
      ],
    },
    {
      key: 'warehouse',
      title: '入仓 / 交接',
      statusLabel: row.hasPendingInbound ? '待入仓' : row.hasPendingHandover ? '待交接' : '仓务已基本收口',
      summaryText: row.warehouseSummaryText,
      latestActionText:
        row.record.warehouseSummary.latestInboundAt
          ? `最近入仓 ${row.record.warehouseSummary.latestInboundAt} · ${row.record.warehouseSummary.latestInboundBy || '-'}`
          : '当前暂无入仓回写',
      riskTags: [
        ...(row.record.warehouseSummary.unassignedZoneCount > 0 ? ['区域未分配'] : []),
        ...(row.hasPendingInbound ? ['待入仓'] : []),
        ...(row.hasPendingHandover ? ['待交接'] : []),
      ],
    },
    {
      key: 'sample',
      title: '样衣',
      statusLabel: row.hasSampleRisk ? '样衣待归还 / 有风险' : '当前无样衣风险',
      summaryText: row.sampleSummaryText,
      latestActionText:
        row.record.sampleSummary.latestSampleActionAt
          ? `最近流转 ${row.record.sampleSummary.latestSampleActionAt} · ${row.record.sampleSummary.latestSampleActionBy || '-'}`
          : '当前无样衣流转摘要',
      riskTags: [
        ...(row.record.sampleSummary.sampleWaitingReturnCount > 0 ? ['待归还'] : []),
        ...(row.record.sampleSummary.overdueReturnCount > 0 ? ['超期风险'] : []),
      ],
    },
  ]
}

export function buildPlatformAttentionItems(row: PlatformCuttingOverviewRow): PlatformCuttingAttentionItem[] {
  const items: PlatformCuttingAttentionItem[] = []

  if (row.hasReceiveRecheck || row.hasPhotoEvidence) {
    items.push({
      key: 'exception-follow-up',
      title: '建议异常跟进',
      level: row.hasPhotoEvidence ? 'HIGH' : 'MEDIUM',
      description: row.hasPhotoEvidence
        ? '当前已提交照片凭证，平台需要尽快核对差异是否影响后续裁片与交期。'
        : '当前扫码结果需复核，建议回到仓库配料页核对领料差异。',
      suggestedFollowUp: '优先回仓库配料页核对扫码结果、凭证和差异说明。',
    })
  }

  if (row.overallRiskLevel === 'HIGH' || row.record.replenishmentSummary.highRiskCount > 0) {
    items.push({
      key: 'quality-follow-up',
      title: '建议质量关注',
      level: 'HIGH',
      description: '当前存在高风险问题或高风险补料建议，后续可能对质量判定与扣款产生影响。',
      suggestedFollowUp: '在裁片收口前保留问题记录，供后续质量与扣款跟进使用。',
    })
  }

  if (row.hasPendingReplenishment || row.hasPendingInbound || row.hasPendingHandover) {
    items.push({
      key: 'execution-stability',
      title: '建议关注工厂执行稳定性',
      level: row.hasPendingReplenishment ? 'HIGH' : 'MEDIUM',
      description: '当前仍有关键节点未收口，可能继续拖累仓务节奏和后续工序安排。',
      suggestedFollowUp: '优先处理补料、入仓和交接卡点，再判断是否需要升级平台跟进。',
    })
  }

  if (row.pendingIssueCount > 0) {
    items.push({
      key: 'settlement-follow-up',
      title: '建议后续结算 / 评分关注',
      level: row.highRiskIssueCount > 0 ? 'HIGH' : 'LOW',
      description: '当前任务仍存在待核查问题，建议保留现场动作时间、复核次数和凭证信息，供后续结算与工厂评分使用。',
      suggestedFollowUp: '后续在结算与评分输入页复用当前摘要，不在本页直接处理。',
    })
  }

  if (items.length === 0) {
    items.push({
      key: 'stable',
      title: '当前无额外平台关注提示',
      level: 'LOW',
      description: '当前裁片任务各段摘要稳定，没有明显阻断性问题。',
      suggestedFollowUp: '继续按当前节奏跟进，必要时回总览页查看整体盘面。',
    })
  }

  return items
}
