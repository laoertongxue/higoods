import { closePdaShellDialogsOnEscape, handlePdaShellEvent } from '../pages/pda-shell'
import { showPdaWarehouseActionToast } from '../pages/pda-warehouse-shared'
import { normalizePdaPageEventResult } from './pda-local-action-result'

type PdaPageHandler = (target: HTMLElement, event?: Event) => unknown | Promise<unknown>

interface PdaRouteHandler {
  matches: (pathname: string) => boolean
  load: () => Promise<Record<string, unknown>>
  exportName: string
}

const exact = (path: string) => (pathname: string) => pathname === path
const startsWith = (path: string) => (pathname: string) => pathname.startsWith(path)

const pdaRouteHandlers: PdaRouteHandler[] = [
  { matches: exact('/fcs/pda/auth/login'), load: () => import('../pages/pda-login'), exportName: 'handlePdaLoginEvent' },
  { matches: exact('/fcs/pda/auth/onboarding'), load: () => import('../pages/pda-onboarding'), exportName: 'handlePdaOnboardingEvent' },
  { matches: exact('/fcs/pda/notify/due-soon'), load: () => import('../pages/pda-notify-due-soon'), exportName: 'handlePdaNotifyDueSoonEvent' },
  { matches: startsWith('/fcs/pda/notify/'), load: () => import('../pages/pda-notify-detail'), exportName: 'handlePdaNotifyDetailEvent' },
  { matches: exact('/fcs/pda/notify'), load: () => import('../pages/pda-notify'), exportName: 'handlePdaNotifyEvent' },
  { matches: startsWith('/fcs/pda/quality/'), load: () => import('../pages/pda-quality'), exportName: 'handlePdaQualityDetailEvent' },
  { matches: exact('/fcs/pda/quality'), load: () => import('../pages/pda-quality'), exportName: 'handlePdaQualityEvent' },
  { matches: startsWith('/fcs/pda/task-receive/'), load: () => import('../pages/pda-task-receive-detail'), exportName: 'handlePdaTaskReceiveDetailEvent' },
  { matches: exact('/fcs/pda/task-receive'), load: () => import('../pages/pda-task-receive'), exportName: 'handlePdaTaskReceiveEvent' },
  { matches: startsWith('/fcs/pda/exec/'), load: () => import('../pages/pda-exec-detail'), exportName: 'handlePdaExecDetailEvent' },
  { matches: exact('/fcs/pda/exec'), load: () => import('../pages/pda-exec'), exportName: 'handlePdaExecEvent' },
  { matches: exact('/fcs/pda/warehouse/wait-process'), load: () => import('../pages/pda-warehouse-wait-process'), exportName: 'handlePdaWarehouseWaitProcessEvent' },
  { matches: exact('/fcs/pda/warehouse/wait-handover'), load: () => import('../pages/pda-warehouse-wait-handover'), exportName: 'handlePdaWarehouseWaitHandoverEvent' },
  { matches: exact('/fcs/pda/warehouse/inbound-records'), load: () => import('../pages/pda-warehouse-inbound-records'), exportName: 'handlePdaWarehouseInboundRecordsEvent' },
  { matches: exact('/fcs/pda/warehouse/outbound-records'), load: () => import('../pages/pda-warehouse-outbound-records'), exportName: 'handlePdaWarehouseOutboundRecordsEvent' },
  { matches: exact('/fcs/pda/warehouse/stocktake'), load: () => import('../pages/pda-warehouse-stocktake'), exportName: 'handlePdaWarehouseStocktakeEvent' },
  { matches: exact('/fcs/pda/warehouse'), load: () => import('../pages/pda-warehouse'), exportName: 'handlePdaWarehouseEvent' },
  { matches: startsWith('/fcs/pda/cutting/task/'), load: () => import('../pages/pda-cutting-task-detail'), exportName: 'handlePdaCuttingTaskDetailEvent' },
  { matches: startsWith('/fcs/pda/cutting/unit/'), load: () => import('../pages/pda-cutting-execution-unit'), exportName: 'handlePdaCuttingExecutionUnitEvent' },
  { matches: startsWith('/fcs/pda/cutting/spreading/'), load: () => import('../pages/pda-cutting-spreading'), exportName: 'handlePdaCuttingSpreadingEvent' },
  { matches: startsWith('/fcs/pda/cutting/inbound/'), load: () => import('../pages/pda-cutting-inbound'), exportName: 'handlePdaCuttingInboundEvent' },
  { matches: startsWith('/fcs/pda/cutting/handover/'), load: () => import('../pages/pda-cutting-handover'), exportName: 'handlePdaCuttingHandoverEvent' },
  { matches: exact('/fcs/pda/cutting/transfer-bag/repack'), load: () => import('../pages/pda-cutting-transfer-bag-repack'), exportName: 'handlePdaCuttingTransferBagRepackEvent' },
  { matches: exact('/fcs/pda/cutting/transfer-bag/recovery'), load: () => import('../pages/pda-cutting-transfer-bag-recovery'), exportName: 'handlePdaCuttingTransferBagRecoveryEvent' },
  { matches: exact('/fcs/pda/cutting/transfer-bag/scrap'), load: () => import('../pages/pda-cutting-transfer-bag-scrap'), exportName: 'handlePdaCuttingTransferBagScrapEvent' },
  { matches: exact('/fcs/pda/handover/sewing-self-return'), load: () => import('../pages/pda-sewing-self-return'), exportName: 'handlePdaSewingSelfReturnEvent' },
  { matches: startsWith('/fcs/pda/handover/'), load: () => import('../pages/pda-handover-detail'), exportName: 'handlePdaHandoverDetailEvent' },
  { matches: exact('/fcs/pda/handover'), load: () => import('../pages/pda-handover'), exportName: 'handlePdaHandoverEvent' },
  { matches: exact('/fcs/pda/settlement'), load: () => import('../pages/pda-settlement'), exportName: 'handlePdaSettlementEvent' },
]

const handlerPromises = new Map<string, Promise<PdaPageHandler>>()

function getActivePdaPageHandler(pathname: string): Promise<PdaPageHandler> | null {
  const route = pdaRouteHandlers.find((item) => item.matches(pathname))
  if (!route) return null

  const cacheKey = `${route.exportName}:${pathname}`
  let promise = handlerPromises.get(cacheKey)
  if (!promise) {
    promise = route.load().then((module) => {
      const handler = module[route.exportName]
      if (typeof handler !== 'function') throw new Error(`PDA 页面事件处理器不存在：${route.exportName}`)
      return handler as PdaPageHandler
    }).catch((error) => {
      handlerPromises.delete(cacheKey)
      throw error
    })
    handlerPromises.set(cacheKey, promise)
  }
  return promise
}

export async function dispatchPdaPageEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  try {
    const shellResult = await handlePdaShellEvent(target)
    if (shellResult) return normalizePdaPageEventResult(shellResult)

    const handlerPromise = getActivePdaPageHandler(window.location.pathname)
    if (!handlerPromise) return false
    const handler = await handlerPromise
    return normalizePdaPageEventResult(await handler(target, event))
  } catch (error) {
    showPdaWarehouseActionToast(error instanceof Error ? error.message : 'PDA 操作失败，请按最新页面重试。')
    return true
  }
}

export function closePdaDialogsOnEscape(): boolean {
  return closePdaShellDialogsOnEscape()
}
