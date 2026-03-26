import {
  type PdaCuttingRouteKey,
  type PdaCuttingTaskOrderLine,
} from '../data/fcs/pda-cutting-special'
import { buildPdaCuttingExecutionNavHref } from './pda-cutting-nav-context'

export type PdaCuttingExecutionRouteKey = Exclude<PdaCuttingRouteKey, 'task'>

export interface PdaCuttingTaskOrderActionEntry {
  key: PdaCuttingExecutionRouteKey
  label: string
  href: string
}

function includesAny(value: string | undefined, keywords: string[]): boolean {
  if (!value) return false
  return keywords.some((keyword) => value.includes(keyword))
}

function resolveRouteLabel(routeKey: PdaCuttingExecutionRouteKey): string {
  if (routeKey === 'pickup') return '扫码领料'
  if (routeKey === 'spreading') return '铺布录入'
  if (routeKey === 'inbound') return '入仓扫码'
  if (routeKey === 'handover') return '交接扫码'
  return '补料反馈'
}

function resolveRouteFromNextAction(nextActionLabel: string): PdaCuttingExecutionRouteKey | null {
  if (includesAny(nextActionLabel, ['领料'])) return 'pickup'
  if (includesAny(nextActionLabel, ['铺布'])) return 'spreading'
  if (includesAny(nextActionLabel, ['入仓'])) return 'inbound'
  if (includesAny(nextActionLabel, ['交接'])) return 'handover'
  if (includesAny(nextActionLabel, ['补料'])) return 'replenishment-feedback'
  return null
}

function hasPendingReplenishment(line: PdaCuttingTaskOrderLine): boolean {
  return (
    Boolean(line.replenishmentRiskLabel) &&
    !includesAny(line.replenishmentRiskLabel, ['当前无', '无补料', '暂无补料', '无需补料'])
  )
}

export function resolvePdaCuttingTaskOrderPrimaryRouteKey(line: PdaCuttingTaskOrderLine): PdaCuttingExecutionRouteKey {
  if (!includesAny(line.currentReceiveStatus, ['领取成功', '已回执', '已领取'])) {
    return 'pickup'
  }

  if (includesAny(line.currentExecutionStatus, ['待铺布', '未开始铺布', '未开始', '待开始'])) {
    return 'spreading'
  }

  if (!includesAny(line.currentInboundStatus, ['已入仓'])) {
    return 'inbound'
  }

  if (!includesAny(line.currentHandoverStatus, ['已交接'])) {
    return 'handover'
  }

  if (hasPendingReplenishment(line)) {
    return 'replenishment-feedback'
  }

  return resolveRouteFromNextAction(line.nextActionLabel) ?? 'handover'
}

export function resolvePdaCuttingTaskOrderPrimaryActionLabel(line: PdaCuttingTaskOrderLine): string {
  return resolveRouteLabel(resolvePdaCuttingTaskOrderPrimaryRouteKey(line))
}

export function buildPdaCuttingTaskOrderActions(
  taskId: string,
  line: PdaCuttingTaskOrderLine,
  returnTo?: string,
): PdaCuttingTaskOrderActionEntry[] {
  return ([
    'pickup',
    'spreading',
    'inbound',
    'handover',
    'replenishment-feedback',
  ] as PdaCuttingExecutionRouteKey[]).map((routeKey) => ({
    key: routeKey,
    label: resolveRouteLabel(routeKey),
    href: buildPdaCuttingExecutionNavHref(taskId, routeKey, {
      cutPieceOrderNo: line.cutPieceOrderNo,
      returnTo,
      sourcePageKey: 'cutting-task-detail',
      focusTaskId: taskId,
      focusCutPieceOrderNo: line.cutPieceOrderNo,
      highlightCutPieceOrder: true,
    }),
  }))
}

export function resolvePdaCuttingTaskOverviewStatusLabel(input: {
  cutPieceOrderCount: number
  completedCutPieceOrderCount: number
  pendingCutPieceOrderCount: number
  exceptionCutPieceOrderCount: number
}): string {
  if (!input.cutPieceOrderCount) return '暂无裁片单'
  if (input.exceptionCutPieceOrderCount > 0) return '有异常待处理'
  if (input.completedCutPieceOrderCount === input.cutPieceOrderCount) return '已全部完成'
  if (input.completedCutPieceOrderCount === 0) return '待开始'
  if (input.pendingCutPieceOrderCount > 0) return '处理中'
  return '待确认'
}
