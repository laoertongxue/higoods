// 成衣出库域线上页路由片段（L1 泳道）。
// 只导出本域路由与事件处理器；统一由调和阶段合并进 routes-wls.ts 与 wls-page-handlers.ts。
import { renderWlsOnlineScanPick, handleWlsOnlineScanPickEvent } from './scan-pick.ts'
import { renderWlsOnlinePrintCollect, handleWlsOnlinePrintCollectEvent } from './print-collect.ts'
import { renderWlsOnlineKolPrint, handleWlsOnlineKolPrintEvent } from './kol-print.ts'
import { renderWlsOnlineOrderScanShip, handleWlsOnlineOrderScanShipEvent } from './order-scan-ship.ts'
import { renderWlsOnlineLoan, handleWlsOnlineLoanEvent } from './loan.ts'
import { renderWlsOnlineShopee, handleWlsOnlineShopeeEvent } from './shopee.ts'
import { renderWlsOnlinePromo, handleWlsOnlinePromoEvent } from './promo.ts'

export type FinishedOnlineWlsRouteEntry = { path: string; render: () => string }
export type FinishedOnlineWlsEventHandler = (target: HTMLElement, event?: Event) => boolean

export const finishedOnlineWlsRoutes: FinishedOnlineWlsRouteEntry[] = [
  { path: '/wls/online/scan-pick', render: () => renderWlsOnlineScanPick() },
  { path: '/wls/online/print-collect', render: () => renderWlsOnlinePrintCollect() },
  { path: '/wls/online/kol-print', render: () => renderWlsOnlineKolPrint() },
  { path: '/wls/online/order-scan-ship', render: () => renderWlsOnlineOrderScanShip() },
  { path: '/wls/online/loan', render: () => renderWlsOnlineLoan() },
  { path: '/wls/online/shopee', render: () => renderWlsOnlineShopee() },
  { path: '/wls/online/promo', render: () => renderWlsOnlinePromo() },
]

/** 路由 → 事件处理器映射，供调和阶段注册到 wls-page-handlers。 */
export const finishedOnlineWlsEventHandlers: Record<string, FinishedOnlineWlsEventHandler> = {
  '/wls/online/scan-pick': handleWlsOnlineScanPickEvent,
  '/wls/online/print-collect': handleWlsOnlinePrintCollectEvent,
  '/wls/online/kol-print': handleWlsOnlineKolPrintEvent,
  '/wls/online/order-scan-ship': handleWlsOnlineOrderScanShipEvent,
  '/wls/online/loan': handleWlsOnlineLoanEvent,
  '/wls/online/shopee': handleWlsOnlineShopeeEvent,
  '/wls/online/promo': handleWlsOnlinePromoEvent,
}
