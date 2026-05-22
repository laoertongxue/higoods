import { appStore } from '../state/store'
import {
  buildPdaCuttingRoute,
  resolvePdaTaskExecPath,
  type PdaCuttingRouteKey,
} from '../data/fcs/pda-cutting-execution-source.ts'

export type PdaCuttingNavPageKey =
  | 'task-list'
  | 'task-receive-detail'
  | 'cutting-task-detail'
  | 'execution-unit'
  | 'spreading'
  | 'inbound'
  | 'handover'
  | 'replenishment-feedback'

export type PdaCuttingBackMode = 'list' | 'receive-detail' | 'task-detail' | 'execution-unit' | 'exec'

export type PdaCuttingActionKey = Exclude<PdaCuttingRouteKey, 'task' | 'unit'>

export interface PdaCuttingNavContext {
  sourcePageKey?: PdaCuttingNavPageKey
  sourceSection?: string
  taskId?: string
  taskNo?: string
  productionOrderNo?: string
  executionOrderId?: string
  executionOrderNo?: string
  cutOrderId?: string
  cutOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
  materialSku?: string
  focusTaskId?: string
  focusExecutionOrderId?: string
  focusExecutionOrderNo?: string
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
    executionOrderNo: params.get('executionOrderNo') ?? undefined,
    cutOrderId: params.get('cutOrderId') ?? undefined,
    cutOrderNo: params.get('cutOrderNo') ?? undefined,
    markerPlanId: params.get('markerPlanId') ?? undefined,
    markerPlanNo: params.get('markerPlanNo') ?? undefined,
    materialSku: params.get('materialSku') ?? undefined,
    focusTaskId: params.get('focusTaskId') ?? undefined,
    focusExecutionOrderId: params.get('focusExecutionOrderId') ?? undefined,
    focusExecutionOrderNo: params.get('focusExecutionOrderNo') ?? undefined,
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
    if (context.cutOrderId) params.set('cutOrderId', context.cutOrderId)
    if (context.cutOrderNo) params.set('cutOrderNo', context.cutOrderNo)
    if (context.markerPlanId) params.set('markerPlanId', context.markerPlanId)
    if (context.markerPlanNo) params.set('markerPlanNo', context.markerPlanNo)
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
    executionOrderNo: context.executionOrderNo,
    cutOrderId: context.cutOrderId,
    cutOrderNo: context.cutOrderNo,
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
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
    executionOrderNo: context.executionOrderNo,
    cutOrderId: context.cutOrderId,
    cutOrderNo: context.cutOrderNo,
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
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

export function buildPdaCuttingExecutionUnitNavHref(
  taskId: string,
  executionOrderId: string,
  context: Omit<PdaCuttingNavContext, 'taskId'> = {},
): string {
  const baseHref = buildPdaCuttingRoute(taskId, 'unit', {
    executionOrderId,
    executionOrderNo: context.executionOrderNo,
    cutOrderId: context.cutOrderId,
    cutOrderNo: context.cutOrderNo,
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
    materialSku: context.materialSku,
    returnTo: context.returnTo,
  })

  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    sourcePageKey: context.sourcePageKey ?? 'cutting-task-detail',
    taskId,
    executionOrderId,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: context.focusExecutionOrderId ?? executionOrderId,
    focusExecutionOrderNo: context.focusExecutionOrderNo ?? context.executionOrderNo,
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
          cutOrderId: context.cutOrderId,
          cutOrderNo: context.cutOrderNo,
          markerPlanId: context.markerPlanId,
          markerPlanNo: context.markerPlanNo,
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
  const returnTo = context.returnTo?.trim()
  const shouldReturnToExecutionUnit =
    context.sourcePageKey === 'execution-unit'
    || Boolean(returnTo && returnTo.startsWith('/fcs/pda/cutting/unit/'))

  if (shouldReturnToExecutionUnit && executionOrderId) {
    const baseHref = returnTo && returnTo.startsWith('/fcs/pda/cutting/unit/')
      ? returnTo
      : buildPdaCuttingRoute(taskId, 'unit', {
          executionOrderId,
          executionOrderNo: executionOrderNo ?? undefined,
          cutOrderId: context.cutOrderId,
          cutOrderNo: context.cutOrderNo,
          markerPlanId: context.markerPlanId,
          markerPlanNo: context.markerPlanNo,
          materialSku: context.materialSku,
          returnTo: context.returnTo,
        })

    return appendPdaCuttingNavContext(baseHref, {
      ...context,
      sourcePageKey: 'execution-unit',
      taskId,
      executionOrderId,
      executionOrderNo: executionOrderNo ?? undefined,
      focusTaskId: context.focusTaskId ?? taskId,
      focusExecutionOrderId: executionOrderId,
      focusExecutionOrderNo: executionOrderNo ?? undefined,
      focusActionKey: actionKey,
      justCompletedAction: actionKey,
      justSaved: true,
      autoFocus: true,
      highlightCutPieceOrder: true,
    })
  }

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
  if (actionKey === 'spreading') return '已保存铺布记录'
  if (actionKey === 'inbound') return '已确认入仓'
  if (actionKey === 'handover') return '已确认交接'
  if (actionKey === 'replenishment-feedback') return '已提交补料反馈'
  return '已完成当前操作'
}
