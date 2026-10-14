// 原料管理域 /wls/online 占位页路由片段。
// 由调和阶段合并进 src/router/routes-wls.ts 与 main-handlers/wls-page-handlers.ts。
import { renderDyeArrivalPage, renderPrintArrivalPage, renderEmbroideryArrivalPage, handleDyeArrivalPageEvent, handlePrintArrivalPageEvent, handleEmbroideryArrivalPageEvent } from './arrival-page.ts'
import { renderTransferWaitHandoverPage, renderTransferHandoverPage, renderTransferWaitInboundPage, handleTransferWaitHandoverPageEvent, handleTransferHandoverPageEvent, handleTransferWaitInboundPageEvent } from './transfer-pages.ts'
import { renderRawPutawayPage, renderRawBarcodePage, handleRawPutawayPageEvent, handleRawBarcodePageEvent } from './barcode-pages.ts'
import { renderConsumableOutboundListPage, handleConsumableOutboundListPageEvent } from './consumable-outbound.ts'
import { renderRawMoveListPage, handleRawMoveListPageEvent } from './raw-move.ts'
import { renderBarcodeExceptionListPage, handleBarcodeExceptionListPageEvent } from './barcode-exception.ts'
import { renderStockMonitorListPage, handleStockMonitorListPageEvent } from './stock-monitor.ts'

export interface RawOnlineWlsRoute {
  path: string
  render: () => string
}

export const rawOnlineWlsRoutes: RawOnlineWlsRoute[] = [
  { path: '/wls/online/dye-arrival', render: () => renderDyeArrivalPage() },
  { path: '/wls/online/print-arrival', render: () => renderPrintArrivalPage() },
  { path: '/wls/online/embroidery-arrival', render: () => renderEmbroideryArrivalPage() },
  { path: '/wls/online/transfer-wait-handover', render: () => renderTransferWaitHandoverPage() },
  { path: '/wls/online/transfer-handover', render: () => renderTransferHandoverPage() },
  { path: '/wls/online/transfer-wait-inbound', render: () => renderTransferWaitInboundPage() },
  { path: '/wls/online/raw-putaway', render: () => renderRawPutawayPage() },
  { path: '/wls/online/raw-barcode', render: () => renderRawBarcodePage() },
  { path: '/wls/online/consumable-outbound', render: () => renderConsumableOutboundListPage() },
  { path: '/wls/online/raw-move', render: () => renderRawMoveListPage() },
  { path: '/wls/online/barcode-exception', render: () => renderBarcodeExceptionListPage() },
  { path: '/wls/online/stock-monitor', render: () => renderStockMonitorListPage() },
]

export type RawOnlineWlsPageHandler = (target: HTMLElement, event?: Event) => boolean

export const rawOnlineWlsPageHandlers: Record<string, RawOnlineWlsPageHandler> = {
  '/wls/online/dye-arrival': handleDyeArrivalPageEvent,
  '/wls/online/print-arrival': handlePrintArrivalPageEvent,
  '/wls/online/embroidery-arrival': handleEmbroideryArrivalPageEvent,
  '/wls/online/transfer-wait-handover': handleTransferWaitHandoverPageEvent,
  '/wls/online/transfer-handover': handleTransferHandoverPageEvent,
  '/wls/online/transfer-wait-inbound': handleTransferWaitInboundPageEvent,
  '/wls/online/raw-putaway': handleRawPutawayPageEvent,
  '/wls/online/raw-barcode': handleRawBarcodePageEvent,
  '/wls/online/consumable-outbound': handleConsumableOutboundListPageEvent,
  '/wls/online/raw-move': handleRawMoveListPageEvent,
  '/wls/online/barcode-exception': handleBarcodeExceptionListPageEvent,
  '/wls/online/stock-monitor': handleStockMonitorListPageEvent,
}
