// 中转仓在线页（老中转仓 Hilon 2 页 + 新中转仓 Mahameru 12 页）路由片段。
// 形状对齐 src/router/routes-wls.ts 的 exactRoutes 条目（path + render），
// 额外提供 handle 供主处理器按 path 注册事件分发。
// 由调和阶段统一合并进 src/router/routes-wls.ts 与 src/main-handlers/wls-page-handlers.ts。
import { renderTransitOnlineHilonCuttingFactoryPage, handleTransitOnlineHilonCuttingFactoryEvent } from './hilon-cutting-factory.ts'
import { renderTransitOnlineHilonCuttingAllPage, handleTransitOnlineHilonCuttingAllEvent } from './hilon-cutting-all.ts'
import { renderTransitOnlineMahameruCuttingPage, handleTransitOnlineMahameruCuttingEvent } from './mahameru-cutting.ts'
import { renderTransitOnlineMahameruInboundPage, handleTransitOnlineMahameruInboundEvent } from './mahameru-inbound.ts'
import { renderTransitOnlineMahameruReceivedPage, handleTransitOnlineMahameruReceivedEvent } from './mahameru-received.ts'
import { renderTransitOnlineMahameruPutawayPage, handleTransitOnlineMahameruPutawayEvent } from './mahameru-putaway.ts'
import { renderTransitOnlineMahameruInventoryPage, handleTransitOnlineMahameruInventoryEvent } from './mahameru-inventory.ts'
import { renderTransitOnlineMahameruLocationPage, handleTransitOnlineMahameruLocationEvent } from './mahameru-location.ts'
import { renderTransitOnlineMahameruKitPage, handleTransitOnlineMahameruKitEvent } from './mahameru-kit.ts'
import { renderTransitOnlineMahameruAllocationPage, handleTransitOnlineMahameruAllocationEvent } from './mahameru-allocation.ts'
import { renderTransitOnlineMahameruOutboundPage, handleTransitOnlineMahameruOutboundEvent } from './mahameru-outbound.ts'
import { renderTransitOnlineMahameruWorkPage, handleTransitOnlineMahameruWorkEvent } from './mahameru-work.ts'
import { renderTransitOnlineMahameruCuttingFactoryPage, handleTransitOnlineMahameruCuttingFactoryEvent } from './mahameru-cutting-factory.ts'

export interface TransitOnlineWlsRoute {
  path: string
  render: () => string
  handle: (target: HTMLElement, event?: Event) => boolean
}

export const transitOnlineWlsRoutes: TransitOnlineWlsRoute[] = [
  // 老中转仓 Hilon
  { path: '/wls/online/hilon-cutting-factory', render: renderTransitOnlineHilonCuttingFactoryPage, handle: handleTransitOnlineHilonCuttingFactoryEvent },
  { path: '/wls/online/hilon-cutting-all', render: renderTransitOnlineHilonCuttingAllPage, handle: handleTransitOnlineHilonCuttingAllEvent },
  // 新中转仓 Mahameru
  { path: '/wls/online/mahameru-cutting', render: renderTransitOnlineMahameruCuttingPage, handle: handleTransitOnlineMahameruCuttingEvent },
  // 注意：菜单 id mahameru-receive 对应「预入库」，mahameru-inbound 对应「收货单」。
  { path: '/wls/online/mahameru-receive', render: renderTransitOnlineMahameruInboundPage, handle: handleTransitOnlineMahameruInboundEvent },
  { path: '/wls/online/mahameru-inbound', render: renderTransitOnlineMahameruReceivedPage, handle: handleTransitOnlineMahameruReceivedEvent },
  { path: '/wls/online/mahameru-putaway', render: renderTransitOnlineMahameruPutawayPage, handle: handleTransitOnlineMahameruPutawayEvent },
  { path: '/wls/online/mahameru-inventory', render: renderTransitOnlineMahameruInventoryPage, handle: handleTransitOnlineMahameruInventoryEvent },
  { path: '/wls/online/mahameru-location', render: renderTransitOnlineMahameruLocationPage, handle: handleTransitOnlineMahameruLocationEvent },
  { path: '/wls/online/mahameru-kit', render: renderTransitOnlineMahameruKitPage, handle: handleTransitOnlineMahameruKitEvent },
  { path: '/wls/online/mahameru-allocation', render: renderTransitOnlineMahameruAllocationPage, handle: handleTransitOnlineMahameruAllocationEvent },
  { path: '/wls/online/mahameru-outbound', render: renderTransitOnlineMahameruOutboundPage, handle: handleTransitOnlineMahameruOutboundEvent },
  { path: '/wls/online/mahameru-work', render: renderTransitOnlineMahameruWorkPage, handle: handleTransitOnlineMahameruWorkEvent },
  { path: '/wls/online/mahameru-cutting-factory', render: renderTransitOnlineMahameruCuttingFactoryPage, handle: handleTransitOnlineMahameruCuttingFactoryEvent },
]
