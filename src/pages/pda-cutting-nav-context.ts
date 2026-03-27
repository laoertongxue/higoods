import { appStore } from '../state/store'
import {
  buildPdaCuttingRoute,
  resolvePdaTaskExecPath,
  type PdaCuttingRouteKey,
} from '../data/fcs/pda-cutting-execution-source.ts'
import {
  readLegacyCutPieceOrderNo,
  resolvePdaExecutionOrderNoWithLegacy,
} from '../data/fcs/pda-cutting-legacy-compat.ts'

export type PdaCuttingNavPageKey =
  | 'task-list'
  | 'task-receive-detail'
  | 'cutting-task-detail'
  | 'pickup'
  | 'spreading'
  | 'inbound'
  | 'handover'
  | 'replenishment-feedback'

export type PdaCuttingBackMode = 'list' | 'receive-detail' | 'task-detail' | 'exec'

export type PdaCuttingActionKey = Exclude<PdaCuttingRouteKey, 'task'>

export interface PdaCuttingNavContext {
  sourcePageKey?: PdaCuttingNavPageKey
  sourceSection?: string
  taskId?: string
  taskNo?: string
  productionOrderNo?: string
  executionOrderId?: string
  executionOrderNo?: string
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  materialSku?: string
  // Read-only legacy query compat. Formal navigation no longer writes this field.
  cutPieceOrderNo?: string
  focusTaskId?: string
  focusExecutionOrderId?: string
  focusExecutionOrderNo?: string
  // Read-only legacy query compat. Formal navigation no longer writes this field.
  focusCutPieceOrderNo?: string
  focusActionKey?: PdaCuttingActionKey
  returnTo?: string
  backMode?: PdaCuttingBackMode
  autoFocus?: boolean
  autoExpandActions?: boolean
  justCompletedAction?: PdaCuttingActionKey
  justSaved?: boolean
  highlightTask?: boolean
  highlightCutPieceOrder?: boolean
}

function getCurrentPathname(): string {
  if (typeof window !== 'undefined' && window.location?.pathname) {
    return `${window.location.pathname}${window.location.search}`
  }
  return appStore.getState().pathname
}

function splitPath(pathname: string): { path: string; params: URLSearchParams } {
  const [path, queryString = ''] = pathname.split('?')
  return {
    path,
    params: new URLSearchParams(queryString),
  }
}

function withUpdatedParams(href: string, updater: (params: URLSearchParams) => void): string {
  const { path, params } = splitPath(href)
  updater(params)
  const queryString = params.toString()
  return queryString ? `${path}?${queryString}` : path
}

function readBoolean(value: string | null): boolean | undefined {
  if (value == null || value === '') return undefined
  return value === '1' || value === 'true'
}

function writeBoolean(params: URLSearchParams, key: string, value?: boolean): void {
  if (value == null) return
  params.set(key, value ? '1' : '0')
}

export function readPdaCuttingNavContext(pathname?: string): PdaCuttingNavContext {
  const currentPathname = pathname ?? getCurrentPathname()
  const { params } = splitPath(currentPathname)

  return {
    sourcePageKey: (params.get('sourcePageKey') as PdaCuttingNavPageKey | null) ?? undefined,
    sourceSection: params.get('sourceSection') ?? undefined,
    taskId: params.get('taskId') ?? undefined,
    taskNo: params.get('taskNo') ?? undefined,
    productionOrderNo: params.get('productionOrderNo') ?? undefined,
    executionOrderId: params.get('executionOrderId') ?? undefined,
    executionOrderNo: resolvePdaExecutionOrderNoWithLegacy({
      executionOrderNo: params.get('executionOrderNo'),
      cutPieceOrderNo: readLegacyCutPieceOrderNo(params),
    }),
    originalCutOrderId: params.get('originalCutOrderId') ?? undefined,
    originalCutOrderNo: params.get('originalCutOrderNo') ?? undefined,
    mergeBatchId: params.get('mergeBatchId') ?? undefined,
    mergeBatchNo: params.get('mergeBatchNo') ?? undefined,
    materialSku: params.get('materialSku') ?? undefined,
    cutPieceOrderNo: readLegacyCutPieceOrderNo(params),
    focusTaskId: params.get('focusTaskId') ?? undefined,
    focusExecutionOrderId: params.get('focusExecutionOrderId') ?? undefined,
    focusExecutionOrderNo: resolvePdaExecutionOrderNoWithLegacy({
      executionOrderNo: params.get('focusExecutionOrderNo'),
      focusCutPieceOrderNo: params.get('focusCutPieceOrderNo'),
    }),
    focusCutPieceOrderNo: readLegacyCutPieceOrderNo(params, 'focusCutPieceOrderNo'),
    focusActionKey: (params.get('focusActionKey') as PdaCuttingActionKey | null) ?? undefined,
    returnTo: params.get('returnTo') ?? undefined,
    backMode: (params.get('backMode') as PdaCuttingBackMode | null) ?? undefined,
    autoFocus: readBoolean(params.get('autoFocus')),
    autoExpandActions: readBoolean(params.get('autoExpandActions')),
    justCompletedAction: (params.get('justCompletedAction') as PdaCuttingActionKey | null) ?? undefined,
    justSaved: readBoolean(params.get('justSaved')),
    highlightTask: readBoolean(params.get('highlightTask')),
    highlightCutPieceOrder: readBoolean(params.get('highlightCutPieceOrder')),
  }
}

export function appendPdaCuttingNavContext(href: string, context: PdaCuttingNavContext): string {
  return withUpdatedParams(href, (params) => {
    if (context.sourcePageKey) params.set('sourcePageKey', context.sourcePageKey)
    if (context.sourceSection) params.set('sourceSection', context.sourceSection)
    if (context.taskId) params.set('taskId', context.taskId)
    if (context.taskNo) params.set('taskNo', context.taskNo)
    if (context.productionOrderNo) params.set('productionOrderNo', context.productionOrderNo)
    if (context.executionOrderId) params.set('executionOrderId', context.executionOrderId)
    if (context.executionOrderNo) params.set('executionOrderNo', context.executionOrderNo)
    if (context.originalCutOrderId) params.set('originalCutOrderId', context.originalCutOrderId)
    if (context.originalCutOrderNo) params.set('originalCutOrderNo', context.originalCutOrderNo)
    if (context.mergeBatchId) params.set('mergeBatchId', context.mergeBatchId)
    if (context.mergeBatchNo) params.set('mergeBatchNo', context.mergeBatchNo)
    if (context.materialSku) params.set('materialSku', context.materialSku)
    if (context.focusTaskId) params.set('focusTaskId', context.focusTaskId)
    if (context.focusExecutionOrderId) params.set('focusExecutionOrderId', context.focusExecutionOrderId)
    if (context.focusExecutionOrderNo) params.set('focusExecutionOrderNo', context.focusExecutionOrderNo)
    if (context.focusActionKey) params.set('focusActionKey', context.focusActionKey)
    if (context.returnTo) params.set('returnTo', context.returnTo)
    if (context.backMode) params.set('backMode', context.backMode)
    writeBoolean(params, 'autoFocus', context.autoFocus)
    writeBoolean(params, 'autoExpandActions', context.autoExpandActions)
    if (context.justCompletedAction) params.set('justCompletedAction', context.justCompletedAction)
    writeBoolean(params, 'justSaved', context.justSaved)
    writeBoolean(params, 'highlightTask', context.highlightTask)
    writeBoolean(params, 'highlightCutPieceOrder', context.highlightCutPieceOrder)
  })
}

function sanitizeTaskListPath(pathname?: string): string {
  const current = pathname?.trim() || '/fcs/pda/task-receive'
  if (current.startsWith('/fcs/pda/task-receive')) return current
  return '/fcs/pda/task-receive'
}

export function buildPdaTaskListFocusHref(
  pathname?: string,
  context: Pick<PdaCuttingNavContext, 'focusTaskId' | 'taskId' | 'highlightTask' | 'autoFocus' | 'sourcePageKey'> = {},
): string {
  const basePath = sanitizeTaskListPath(pathname)
  return appendPdaCuttingNavContext(basePath, {
    sourcePageKey: context.sourcePageKey ?? 'task-list',
    focusTaskId: context.focusTaskId ?? context.taskId,
    taskId: context.taskId ?? context.focusTaskId,
    highlightTask: context.highlightTask ?? true,
    autoFocus: context.autoFocus ?? true,
  })
}

export function buildPdaTaskReceiveDetailNavHref(
  taskId: string,
  context: Omit<PdaCuttingNavContext, 'taskId'> = {},
): string {
  const listReturnTo = buildPdaTaskListFocusHref(context.returnTo, {
    sourcePageKey: 'task-list',
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    highlightTask: true,
    autoFocus: true,
  })

  return appendPdaCuttingNavContext(`/fcs/pda/task-receive/${taskId}`, {
    ...context,
    sourcePageKey: context.sourcePageKey ?? 'task-list',
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    returnTo: listReturnTo,
    highlightTask: context.highlightTask ?? true,
    autoFocus: context.autoFocus ?? true,
  })
}

export function buildPdaCuttingTaskDetailNavHref(
  taskId: string,
  context: Omit<PdaCuttingNavContext, 'taskId'> = {},
): string {
  const baseHref = buildPdaCuttingRoute(taskId, 'task', {
    executionOrderId: context.executionOrderId,
    executionOrderNo: resolvePdaExecutionOrderNoWithLegacy(context),
    originalCutOrderId: context.originalCutOrderId,
    originalCutOrderNo: context.originalCutOrderNo,
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    materialSku: context.materialSku,
    returnTo: context.returnTo,
  })

  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    sourcePageKey: context.sourcePageKey ?? 'task-receive-detail',
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
  })
}

export function buildPdaCuttingExecutionNavHref(
  taskId: string,
  routeKey: PdaCuttingActionKey,
  context: Omit<PdaCuttingNavContext, 'taskId' | 'focusActionKey'> = {},
): string {
  const baseHref = buildPdaCuttingRoute(taskId, routeKey, {
    executionOrderId: context.executionOrderId,
    executionOrderNo: resolvePdaExecutionOrderNoWithLegacy(context),
    originalCutOrderId: context.originalCutOrderId,
    originalCutOrderNo: context.originalCutOrderNo,
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    materialSku: context.materialSku,
    returnTo: context.returnTo,
  })

  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    sourcePageKey: context.sourcePageKey ?? 'cutting-task-detail',
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: context.focusExecutionOrderId ?? context.executionOrderId,
    focusExecutionOrderNo: context.focusExecutionOrderNo ?? context.executionOrderNo,
    focusActionKey: routeKey,
  })
}

export function buildPdaCuttingDirectExecEntryHref(
  taskId: string,
  context: Omit<PdaCuttingNavContext, 'taskId'> = {},
): string {
  const baseHref = resolvePdaTaskExecPath(taskId, context.returnTo)
  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: context.focusExecutionOrderId ?? context.executionOrderId,
    focusExecutionOrderNo: context.focusExecutionOrderNo ?? context.executionOrderNo,
  })
}

export function buildPdaCuttingTaskDetailFocusHref(
  taskId: string,
  context: Omit<PdaCuttingNavContext, 'taskId' | 'sourcePageKey'> = {},
): string {
  const baseHref =
    context.returnTo && context.returnTo.startsWith('/fcs/pda/cutting/task/')
      ? context.returnTo
      : buildPdaCuttingRoute(taskId, 'task', {
          executionOrderId: context.executionOrderId,
          executionOrderNo: context.executionOrderNo,
          originalCutOrderId: context.originalCutOrderId,
          originalCutOrderNo: context.originalCutOrderNo,
          mergeBatchId: context.mergeBatchId,
          mergeBatchNo: context.mergeBatchNo,
          materialSku: context.materialSku,
          returnTo: context.returnTo,
        })

  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    sourcePageKey: 'cutting-task-detail',
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: context.focusExecutionOrderId ?? context.executionOrderId,
    focusExecutionOrderNo: context.focusExecutionOrderNo ?? context.executionOrderNo,
    highlightCutPieceOrder: context.highlightCutPieceOrder ?? true,
    autoFocus: context.autoFocus ?? true,
  })
}

export function buildPdaCuttingCompletedReturnHref(
  taskId: string,
  executionOrderId: string | null | undefined,
  executionOrderNo: string | null | undefined,
  context: PdaCuttingNavContext,
  actionKey: PdaCuttingActionKey,
): string {
  return buildPdaCuttingTaskDetailFocusHref(taskId, {
    executionOrderId: executionOrderId ?? undefined,
    executionOrderNo: executionOrderNo ?? undefined,
    returnTo: context.returnTo,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: executionOrderId ?? undefined,
    focusExecutionOrderNo: executionOrderNo ?? undefined,
    focusActionKey: actionKey,
    justCompletedAction: actionKey,
    justSaved: true,
    autoFocus: true,
    autoExpandActions: true,
    highlightCutPieceOrder: true,
  })
}

export function resolvePdaCuttingBackHref(context: PdaCuttingNavContext | null | undefined, fallbackHref: string): string {
  const returnTo = context?.returnTo?.trim()
  if (!returnTo || !returnTo.startsWith('/fcs/pda/')) {
    return fallbackHref
  }
  return returnTo
}

export function getPdaCuttingCompletedActionLabel(actionKey?: PdaCuttingActionKey): string {
  if (actionKey === 'pickup') return '已完成领料'
  if (actionKey === 'spreading') return '已保存铺布记录'
  if (actionKey === 'inbound') return '已确认入仓'
  if (actionKey === 'handover') return '已确认交接'
  if (actionKey === 'replenishment-feedback') return '已提交补料反馈'
  return '已完成当前操作'
}
