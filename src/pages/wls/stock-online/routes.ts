// L2 泳道（库存与库内操作域）路由片段。
// 形状对齐 src/router/routes-wls.ts 的 exactRoutes 条目（{ path, render }），
// 另附 handle 便于调和阶段注册 wls-page-handlers；本文件不改 src/router/*。
import { renderWarehouseStock, handleWarehouseStockEvent } from './warehouse-stock'
import { renderTransitFlow, handleTransitFlowEvent } from './transit-flow'
import { renderTransitMove, handleTransitMoveEvent } from './transit-move'
import { renderGarmentTransfer, handleGarmentTransferEvent } from './garment-transfer'
import { renderTransitCount, handleTransitCountEvent } from './transit-count'
import { renderKolMove, handleKolMoveEvent } from './kol-move'

export type StockOnlineWlsRoute = {
  path: string
  render: () => string
  handle: (target: HTMLElement, event?: Event) => boolean
}

export const stockOnlineWlsRoutes: StockOnlineWlsRoute[] = [
  { path: '/wls/online/warehouse-stock', render: () => renderWarehouseStock(), handle: handleWarehouseStockEvent },
  { path: '/wls/online/transit-flow', render: () => renderTransitFlow(), handle: handleTransitFlowEvent },
  { path: '/wls/online/transit-move', render: () => renderTransitMove(), handle: handleTransitMoveEvent },
  { path: '/wls/online/garment-transfer', render: () => renderGarmentTransfer(), handle: handleGarmentTransferEvent },
  { path: '/wls/online/transit-count', render: () => renderTransitCount(), handle: handleTransitCountEvent },
  { path: '/wls/online/kol-move', render: () => renderKolMove(), handle: handleKolMoveEvent },
]
