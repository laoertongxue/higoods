import { appStore } from '../state/store'
import {
  getPdaCuttingTaskSnapshot,
  getPdaTaskFlowTaskById,
  type PdaCuttingRouteKey,
  type PdaCuttingTaskDetailData,
  type PdaCuttingTaskOrderLine,
  type PdaTaskFlowMock,
} from '../data/fcs/pda-cutting-execution-source.ts'
import {
  buildPdaCuttingTaskDetailFocusHref,
  readPdaCuttingNavContext,
  type PdaCuttingNavContext,
} from './pda-cutting-nav-context'
import {
  readLegacyCutPieceOrderNo,
  resolvePdaExecutionOrderNoWithLegacy,
} from '../data/fcs/pda-cutting-legacy-compat.ts'

export interface PdaCuttingExecutionContext {
  task: PdaTaskFlowMock | null
  detail: PdaCuttingTaskDetailData | null
  selectedExecutionOrderId: string | null
  selectedExecutionOrderNo: string | null
  selectedExecutionOrder: PdaCuttingTaskOrderLine | null
  selectedExecutionOrderLine: PdaCuttingTaskOrderLine | null
  hasMultipleCutPieceOrders: boolean
  canAutoFallbackToSingleCutPieceOrder: boolean
  selectionRequired: boolean
  requiresCutPieceOrderSelection: boolean
  selectionNotice: string | null
  returnTo: string | null
  backHref: string
  navContext: PdaCuttingNavContext
}

function getCurrentPathname(): string {
  if (typeof window !== 'undefined' && window.location?.pathname) {
    return `${window.location.pathname}${window.location.search}`
  }
  return appStore.getState().pathname
}

function getLocationSearchParams(pathname?: string): URLSearchParams {
  const currentPathname = pathname ?? getCurrentPathname()
  const [, queryString = ''] = currentPathname.split('?')
  return new URLSearchParams(queryString)
}

function readSelectedExecutionOrderNoCompatFromLocation(pathname?: string): string | null {
  const params = getLocationSearchParams(pathname)
  const value = resolvePdaExecutionOrderNoWithLegacy({
    executionOrderNo: params.get('executionOrderNo'),
    cutPieceOrderNo: readLegacyCutPieceOrderNo(params),
  })
  return value ? value : null
}

export function readSelectedExecutionOrderIdFromLocation(pathname?: string): string | null {
  const value = getLocationSearchParams(pathname).get('executionOrderId')?.trim()
  return value ? value : null
}

export function readSelectedExecutionOrderNoFromLocation(pathname?: string): string | null {
  return readSelectedExecutionOrderNoCompatFromLocation(pathname)
}

export function readPdaCuttingReturnToFromLocation(pathname?: string): string | null {
  const value = getLocationSearchParams(pathname).get('returnTo')?.trim()
  return value ? value : null
}

export function resolveSelectedExecutionOrderLine(
  detail: PdaCuttingTaskDetailData,
  selectedExecutionOrderId?: string | null,
  selectedExecutionOrderNo?: string | null,
): PdaCuttingTaskOrderLine | null {
  const requestedExecutionId = selectedExecutionOrderId?.trim() || ''
  if (requestedExecutionId) {
    return detail.cutPieceOrders.find((item) => item.executionOrderId === requestedExecutionId) ?? null
  }

  const requestedOrderNo = selectedExecutionOrderNo?.trim() || ''
  if (requestedOrderNo) {
    return detail.cutPieceOrders.find((item) => item.executionOrderNo === requestedOrderNo) ?? null
  }

  if (detail.cutPieceOrders.length === 1) {
    return detail.cutPieceOrders[0] ?? null
  }

  return null
}

export function buildPdaCuttingExecutionContext(
  taskId: string,
  routeKey: Exclude<PdaCuttingRouteKey, 'task' | 'unit'>,
  pathname?: string,
): PdaCuttingExecutionContext {
  const navContext = readPdaCuttingNavContext(pathname)
  const returnTo = navContext.returnTo || readPdaCuttingReturnToFromLocation(pathname)
  const requestedExecutionOrderId = readSelectedExecutionOrderIdFromLocation(pathname)
  const requestedOrderNo = readSelectedExecutionOrderNoFromLocation(pathname)
  const task = getPdaTaskFlowTaskById(taskId)
  const baseDetail = getPdaCuttingTaskSnapshot(taskId)

  if (!baseDetail) {
    return {
      task,
      detail: null,
      selectedExecutionOrderId: null,
      selectedExecutionOrderNo: null,
      selectedExecutionOrder: null,
      selectedExecutionOrderLine: null,
      hasMultipleCutPieceOrders: false,
      canAutoFallbackToSingleCutPieceOrder: false,
      selectionRequired: false,
      requiresCutPieceOrderSelection: false,
      selectionNotice: null,
      returnTo,
      backHref: buildPdaCuttingTaskDetailFocusHref(taskId, {
        executionOrderId: requestedExecutionOrderId ?? undefined,
        executionOrderNo: requestedOrderNo ?? undefined,
        returnTo,
        focusTaskId: navContext.focusTaskId ?? taskId,
        focusExecutionOrderId: requestedExecutionOrderId ?? undefined,
        focusExecutionOrderNo: requestedOrderNo ?? undefined,
      }),
      navContext,
    }
  }

  const selectedLine = resolveSelectedExecutionOrderLine(baseDetail, requestedExecutionOrderId, requestedOrderNo)
  const hasMultipleCutPieceOrders = baseDetail.cutPieceOrders.length > 1
  const canAutoFallbackToSingleCutPieceOrder = baseDetail.cutPieceOrders.length === 1
  const requestedButMissing = Boolean(requestedExecutionOrderId || requestedOrderNo) && !selectedLine
  const requiresCutPieceOrderSelection = !selectedLine && hasMultipleCutPieceOrders
  const selectionNotice = requestedButMissing
    ? '当前裁片单不存在，请先返回裁片任务重新选择。'
    : requiresCutPieceOrderSelection
      ? '请先在裁片任务中选择要处理的裁片单。'
      : null
  const selectedExecutionOrderId = selectedLine?.executionOrderId ?? null
  const selectedExecutionOrderNo = selectedLine?.executionOrderNo ?? null
  const detail = getPdaCuttingTaskSnapshot(taskId, selectedExecutionOrderId ?? selectedExecutionOrderNo ?? undefined)
  const taskDetailBackHref = buildPdaCuttingTaskDetailFocusHref(taskId, {
    executionOrderId: selectedExecutionOrderId ?? undefined,
    executionOrderNo: selectedExecutionOrderNo ?? undefined,
    returnTo,
    focusTaskId: navContext.focusTaskId ?? taskId,
    focusExecutionOrderId: selectedExecutionOrderId ?? undefined,
    focusExecutionOrderNo: selectedExecutionOrderNo ?? undefined,
    highlightCutPieceOrder: Boolean(selectedExecutionOrderId || selectedExecutionOrderNo),
    autoFocus: Boolean(selectedExecutionOrderId || selectedExecutionOrderNo),
  })

  return {
    task,
    detail,
    selectedExecutionOrderId,
    selectedExecutionOrderNo,
    selectedExecutionOrder: selectedLine,
    selectedExecutionOrderLine: selectedLine,
    hasMultipleCutPieceOrders,
    canAutoFallbackToSingleCutPieceOrder,
    selectionRequired: requiresCutPieceOrderSelection,
    requiresCutPieceOrderSelection,
    selectionNotice,
    returnTo,
    backHref: taskDetailBackHref,
    navContext,
  }
}

export function buildPdaCuttingExecutionUnitContext(
  taskId: string,
  executionOrderIdFromPath: string,
  pathname?: string,
): PdaCuttingExecutionContext {
  const navContext = readPdaCuttingNavContext(pathname)
  const returnTo = navContext.returnTo || readPdaCuttingReturnToFromLocation(pathname)
  const requestedExecutionOrderId = readSelectedExecutionOrderIdFromLocation(pathname) || executionOrderIdFromPath
  const requestedOrderNo = readSelectedExecutionOrderNoFromLocation(pathname)
  const task = getPdaTaskFlowTaskById(taskId)
  const baseDetail = getPdaCuttingTaskSnapshot(taskId)

  if (!baseDetail) {
    return {
      task,
      detail: null,
      selectedExecutionOrderId: requestedExecutionOrderId,
      selectedExecutionOrderNo: requestedOrderNo,
      selectedExecutionOrder: null,
      selectedExecutionOrderLine: null,
      hasMultipleCutPieceOrders: false,
      canAutoFallbackToSingleCutPieceOrder: false,
      selectionRequired: false,
      requiresCutPieceOrderSelection: false,
      selectionNotice: null,
      returnTo,
      backHref: buildPdaCuttingTaskDetailFocusHref(taskId, {
        executionOrderId: requestedExecutionOrderId || undefined,
        executionOrderNo: requestedOrderNo ?? undefined,
        returnTo,
        focusTaskId: navContext.focusTaskId ?? taskId,
        focusExecutionOrderId: requestedExecutionOrderId || undefined,
        focusExecutionOrderNo: requestedOrderNo ?? undefined,
      }),
      navContext,
    }
  }

  const selectedLine = resolveSelectedExecutionOrderLine(baseDetail, requestedExecutionOrderId, requestedOrderNo)
  const hasMultipleCutPieceOrders = baseDetail.cutPieceOrders.length > 1
  const requestedButMissing = Boolean(requestedExecutionOrderId || requestedOrderNo) && !selectedLine
  const selectionNotice = requestedButMissing
    ? '当前任务不存在，请先返回裁片任务重新选择。'
    : !selectedLine && hasMultipleCutPieceOrders
      ? '请先在裁片任务中选择要处理的执行单。'
      : null
  const selectedExecutionOrderId = selectedLine?.executionOrderId ?? null
  const selectedExecutionOrderNo = selectedLine?.executionOrderNo ?? null
  const detail = getPdaCuttingTaskSnapshot(taskId, selectedExecutionOrderId ?? selectedExecutionOrderNo ?? undefined)
  const taskDetailBackHref = buildPdaCuttingTaskDetailFocusHref(taskId, {
    executionOrderId: selectedExecutionOrderId ?? undefined,
    executionOrderNo: selectedExecutionOrderNo ?? undefined,
    returnTo,
    focusTaskId: navContext.focusTaskId ?? taskId,
    focusExecutionOrderId: selectedExecutionOrderId ?? undefined,
    focusExecutionOrderNo: selectedExecutionOrderNo ?? undefined,
    highlightCutPieceOrder: true,
    autoFocus: true,
  })

  return {
    task,
    detail,
    selectedExecutionOrderId,
    selectedExecutionOrderNo,
    selectedExecutionOrder: selectedLine,
    selectedExecutionOrderLine: selectedLine,
    hasMultipleCutPieceOrders,
    canAutoFallbackToSingleCutPieceOrder: baseDetail.cutPieceOrders.length === 1,
    selectionRequired: !selectedLine && hasMultipleCutPieceOrders,
    requiresCutPieceOrderSelection: !selectedLine && hasMultipleCutPieceOrders,
    selectionNotice,
    returnTo,
    backHref: taskDetailBackHref,
    navContext,
  }
}
