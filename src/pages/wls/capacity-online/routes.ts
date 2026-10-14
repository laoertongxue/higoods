// 产能统计路由片段（L3 泳道）。
// 只导出本域路由与事件处理器；统一由调和阶段合并进 routes-wls.ts 与 wls-page-handlers.ts。
import { renderCapacityPage, handleCapacityPageEvent } from './capacity-page.ts'

type CapacityRouteEntry = {
  path: string
  title: string
  timeLabel: string
}

const capacityRouteDefs: CapacityRouteEntry[] = [
  { path: '/wls/online/capacity-return', title: '回货入库', timeLabel: '收货' },
  // 测试环境该页时间列名为「上架时间」，此处沿用测试环境口径。
  { path: '/wls/online/capacity-return-in', title: '退货入库', timeLabel: '上架' },
  { path: '/wls/online/capacity-putaway', title: '成衣上架', timeLabel: '上架' },
  { path: '/wls/online/capacity-count', title: '库存盘点', timeLabel: '盘点' },
  { path: '/wls/online/capacity-pick', title: '成衣拣货', timeLabel: '拣货' },
  { path: '/wls/online/capacity-ship', title: '发货扫描', timeLabel: '发货' },
]

export const capacityOnlineWlsRoutes = capacityRouteDefs.map(def => ({
  path: def.path,
  render: () => renderCapacityPage({ title: def.title, timeLabel: def.timeLabel, route: def.path }),
}))

/** 路由 → 事件处理器映射，供调和阶段注册到 wls-page-handlers。 */
export const capacityOnlineWlsEventHandlers: Record<string, typeof handleCapacityPageEvent> =
  Object.fromEntries(capacityRouteDefs.map(def => [def.path, handleCapacityPageEvent]))
