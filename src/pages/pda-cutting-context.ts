import { appStore } from '../state/store'
import {
  getPdaCuttingTaskDetail,
  getPdaTaskFlowTaskById,
  type PdaCuttingRouteKey,
  type PdaCuttingTaskDetailData,
  type PdaCuttingTaskOrderLine,
  type PdaTaskFlowMock,
} from '../data/fcs/pda-cutting-special'
import {
  buildPdaCuttingTaskDetailFocusHref,
  readPdaCuttingNavContext,
  type PdaCuttingNavContext,
} from './pda-cutting-nav-context'

export interface PdaCuttingExecutionContext {
  task: PdaTaskFlowMock | null
  detail: PdaCuttingTaskDetailData | null
  selectedCutPieceOrderNo: string | null
  selectedCutPieceOrder: PdaCuttingTaskOrderLine | null
  selectedCutPieceOrderLine: PdaCuttingTaskOrderLine | null
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

export function readSelectedCutPieceOrderNoFromLocation(pathname?: string): string | null {
  const value = getLocationSearchParams(pathname).get('cutPieceOrderNo')?.trim()
  return value ? value : null
}

export function readPdaCuttingReturnToFromLocation(pathname?: string): string | null {
  const value = getLocationSearchParams(pathname).get('returnTo')?.trim()
  return value ? value : null
}

export function resolveSelectedCutPieceOrderLine(
  detail: PdaCuttingTaskDetailData,
  selectedCutPieceOrderNo?: string | null,
): PdaCuttingTaskOrderLine | null {
  const requestedOrderNo = selectedCutPieceOrderNo?.trim() || ''
  if (requestedOrderNo) {
    return detail.cutPieceOrders.find((item) => item.cutPieceOrderNo === requestedOrderNo) ?? null
  }

  if (detail.cutPieceOrders.length === 1) {
    return detail.cutPieceOrders[0] ?? null
  }

  return null
}

export function buildPdaCuttingExecutionContext(
  taskId: string,
  routeKey: Exclude<PdaCuttingRouteKey, 'task'>,
  pathname?: string,
): PdaCuttingExecutionContext {
  const navContext = readPdaCuttingNavContext(pathname)
  const returnTo = navContext.returnTo || readPdaCuttingReturnToFromLocation(pathname)
  const requestedOrderNo = readSelectedCutPieceOrderNoFromLocation(pathname)
  const task = getPdaTaskFlowTaskById(taskId)
  const baseDetail = getPdaCuttingTaskDetail(taskId)

  if (!baseDetail) {
    return {
      task,
      detail: null,
      selectedCutPieceOrderNo: null,
      selectedCutPieceOrder: null,
      selectedCutPieceOrderLine: null,
      hasMultipleCutPieceOrders: false,
      canAutoFallbackToSingleCutPieceOrder: false,
      selectionRequired: false,
      requiresCutPieceOrderSelection: false,
      selectionNotice: null,
      returnTo,
      backHref: buildPdaCuttingTaskDetailFocusHref(taskId, {
        cutPieceOrderNo: requestedOrderNo ?? undefined,
        returnTo,
        focusTaskId: navContext.focusTaskId ?? taskId,
        focusCutPieceOrderNo: requestedOrderNo ?? undefined,
      }),
      navContext,
    }
  }

  const selectedLine = resolveSelectedCutPieceOrderLine(baseDetail, requestedOrderNo)
  const hasMultipleCutPieceOrders = baseDetail.cutPieceOrders.length > 1
  const canAutoFallbackToSingleCutPieceOrder = baseDetail.cutPieceOrders.length === 1
  const requestedButMissing = Boolean(requestedOrderNo) && !selectedLine
  const requiresCutPieceOrderSelection = !selectedLine && hasMultipleCutPieceOrders
  const selectionNotice = requestedButMissing
    ? '当前裁片单不存在，请先返回裁片任务重新选择。'
    : requiresCutPieceOrderSelection
      ? '请先在裁片任务中选择要处理的裁片单。'
      : null
  const selectedCutPieceOrderNo = selectedLine?.cutPieceOrderNo ?? null
  const detail = getPdaCuttingTaskDetail(taskId, selectedCutPieceOrderNo ?? undefined)
  const taskDetailBackHref = buildPdaCuttingTaskDetailFocusHref(taskId, {
    cutPieceOrderNo: selectedCutPieceOrderNo ?? undefined,
    returnTo,
    focusTaskId: navContext.focusTaskId ?? taskId,
    focusCutPieceOrderNo: selectedCutPieceOrderNo ?? undefined,
    highlightCutPieceOrder: Boolean(selectedCutPieceOrderNo),
    autoFocus: Boolean(selectedCutPieceOrderNo),
  })

  return {
    task,
    detail,
    selectedCutPieceOrderNo,
    selectedCutPieceOrder: selectedLine,
    selectedCutPieceOrderLine: selectedLine,
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
