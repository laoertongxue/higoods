import {
  type PdaCuttingCurrentStepCode,
  type PdaCuttingRouteKey,
  type PdaCuttingTaskOrderLine,
} from '../data/fcs/pda-cutting-execution-source.ts'
import { buildPdaCuttingExecutionNavHref } from './pda-cutting-nav-context'

export type PdaCuttingExecutionRouteKey = Exclude<PdaCuttingRouteKey, 'task' | 'unit'>

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
  if (routeKey === 'pickup') return '去领料'
  if (routeKey === 'spreading') return '去铺布'
  if (routeKey === 'inbound') return '去入仓'
  if (routeKey === 'handover') return '去交出'
  return '去补料'
}

function hasPendingReplenishment(line: PdaCuttingTaskOrderLine): boolean {
  return (
    Boolean(line.replenishmentRiskLabel) &&
    !includesAny(line.replenishmentRiskLabel, ['当前无', '无补料', '暂无补料', '无需补料'])
  )
}

function isReceiveCompleted(status: string): boolean {
  return includesAny(status, ['领取成功', '已回执', '已领取'])
}

function isSpreadingCompleted(status: string): boolean {
  return includesAny(status, ['铺布已完成'])
}

function isHandoverCompleted(status: string): boolean {
  return includesAny(status, ['已交接'])
}

function isInboundCompleted(status: string): boolean {
  return includesAny(status, ['已入仓'])
}

function resolveCurrentStepLabel(stepCode: PdaCuttingCurrentStepCode): string {
  if (stepCode === 'PICKUP') return '去领料'
  if (stepCode === 'SPREADING') return '去铺布'
  if (stepCode === 'REPLENISHMENT') return '去补料'
  if (stepCode === 'HANDOVER') return '去交出'
  if (stepCode === 'INBOUND') return '去入仓'
  return '已完成'
}

function mapStepCodeToRouteKey(stepCode: PdaCuttingCurrentStepCode): PdaCuttingExecutionRouteKey | null {
  if (stepCode === 'PICKUP') return 'pickup'
  if (stepCode === 'SPREADING') return 'spreading'
  if (stepCode === 'REPLENISHMENT') return 'replenishment-feedback'
  if (stepCode === 'HANDOVER') return 'handover'
  if (stepCode === 'INBOUND') return 'inbound'
  return null
}

export function resolvePdaCuttingTaskOrderCurrentStepCode(line: PdaCuttingTaskOrderLine): PdaCuttingCurrentStepCode {
  if (line.currentStepCode) return line.currentStepCode
  if (!isReceiveCompleted(line.currentReceiveStatus)) return 'PICKUP'
  if (!isSpreadingCompleted(line.currentExecutionStatus)) return 'SPREADING'
  if (hasPendingReplenishment(line)) return 'REPLENISHMENT'
  if (!isHandoverCompleted(line.currentHandoverStatus)) return 'HANDOVER'
  if (!isInboundCompleted(line.currentInboundStatus)) return 'INBOUND'
  return 'DONE'
}

export function resolvePdaCuttingTaskOrderCurrentStepLabel(line: PdaCuttingTaskOrderLine): string {
  if (line.currentStepCode) return resolveCurrentStepLabel(line.currentStepCode)
  if (line.currentStepLabel) return line.currentStepLabel
  return resolveCurrentStepLabel(resolvePdaCuttingTaskOrderCurrentStepCode(line))
}

export function resolvePdaCuttingTaskOrderPrimaryRouteKey(line: PdaCuttingTaskOrderLine): PdaCuttingExecutionRouteKey {
  // 仅用于兼容“更多操作”动作列表；任务详情主流程统一先进入当前任务。
  if (line.primaryExecutionRouteKey) return line.primaryExecutionRouteKey
  const currentStepCode = resolvePdaCuttingTaskOrderCurrentStepCode(line)
  return mapStepCodeToRouteKey(currentStepCode) || 'handover'
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
      executionOrderId: line.executionOrderId,
      executionOrderNo: line.executionOrderNo,
      originalCutOrderId: line.originalCutOrderId,
      originalCutOrderNo: line.originalCutOrderNo,
      mergeBatchId: line.mergeBatchId,
      mergeBatchNo: line.mergeBatchNo,
      materialSku: line.materialSku,
      returnTo,
      sourcePageKey: 'cutting-task-detail',
      focusTaskId: taskId,
      focusExecutionOrderId: line.executionOrderId,
      focusExecutionOrderNo: line.executionOrderNo,
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
